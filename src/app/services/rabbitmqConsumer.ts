import type { ConsumeMessage } from 'amqplib';
import axios from 'axios';
import { RabbitMQService } from './rabbitmqService';
import { whatsappUserLinksRepository } from '../../infra/repositories/whatsappUserLinksRepository';
import { redisCache } from './redisCache';
import { messageRepository } from '../../infra/repositories/messageRepository';

const WHATSAPP_ADP_URL = process.env.WHATSAPP_API_URL || 'http://whatsapp-adp:3006';
const AUTH_MS_URL = process.env.AUTH_MS_URL || 'http://auth-ms:3004';
const USER_MS_URL = process.env.USER_MS_URL || 'http://user-ms:3002';

const PLAN_LIMITS: Record<string, number> = {
  free: 12,
  trial: 20,
  basic: 100,
  premium: -1,
};
const VERIFICATION_CODE_REGEX = /^[A-F0-9]{6}$/i;

export interface IncomingWhatsAppMessage {
  type: 'incoming_message';
  phoneNumber: string;
  messageId: string;
  whatsappMessageId: string;
  direction: string;
  messageType: string;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface StatusUpdateMessage {
  type: 'status_update';
  whatsappMessageId: string;
  status: string;
  timestamp: string;
}

type RabbitMQMessage = IncomingWhatsAppMessage | StatusUpdateMessage;

export class RabbitMQConsumer {
  private readonly rabbitMQ: RabbitMQService;
  private readonly whatsappUserLinksRepo: whatsappUserLinksRepository;
  private readonly redisCache: redisCache;
  private readonly messageRepo: messageRepository;
  private readonly processedMessages: Set<string> = new Set();
  private readonly pendingApprovals: Map<string, { userId: string; actionData: any; phoneNumber: string; timestamp: number }> = new Map();

  constructor(rabbitMQ: RabbitMQService) {
    this.rabbitMQ = rabbitMQ;
    this.whatsappUserLinksRepo = new whatsappUserLinksRepository();
    this.redisCache = new redisCache();
    this.messageRepo = new messageRepository();
  }

  async start(): Promise<void> {
    await this.rabbitMQ.consume('message.control', (msg) => this.handleMessage(msg));
    await this.rabbitMQ.consume('llm.results', (msg) => this.handleLlmResult(msg));
    console.log('RabbitMQ consumer started for message.control and llm.results queues');
  }

  private async handleLlmResult(msg: ConsumeMessage): Promise<void> {
    const content = JSON.parse(msg.content.toString());
    if (content.type !== 'llm_result' || !content.phoneNumber || !content.response) return;

    console.log('🤖 handleLlmResult - content:', {
      type: content.type,
      phoneNumber: content.phoneNumber,
      userId: content.userId,
      messageId: content.messageId
    });

    let sendTo = String(content.phoneNumber);
    let userId = content.userId;

    try {
      const link = await this.whatsappUserLinksRepo.findByPhoneJid(sendTo);
      console.log('🔗 Found link:', link);
      if (link) {
        if (link.phone) {
          sendTo = link.phone;
        }
        userId = link.userId;
        console.log('🔗 Updated userId from link:', userId);
      }
    } catch (error) {
      console.error('❌ Error finding user link:', error);
    }

    try {
      // Update message status to processed and save actions
      if (content.messageId) {
        await this.messageRepo.updateStatusAndActions(content.messageId, 'processed', content.actions);
      }

      // Check if there are create_expense actions with high confidence
      const createExpenseAction = content.actions?.find(
        (action: any) => action.type === 'create_expense' && action.confidence > 0.7
      );

      // Check if there are get_report actions with high confidence
      const getReportAction = content.actions?.find(
        (action: any) => action.type === 'get_report' && action.confidence > 0.7
      );

      if (createExpenseAction) {
        // Save pending approval
        const approvalKey = `${userId}_${content.messageId}`;
        this.pendingApprovals.set(approvalKey, {
          userId,
          actionData: createExpenseAction.data,
          phoneNumber: sendTo,
          timestamp: Date.now()
        });

        // Send confirmation request to user
        const actionData = createExpenseAction.data;
        const PAYMENT_LABELS: Record<string, string> = {
          pix: 'Pix', credit_card: 'Cartão de crédito', debit_card: 'Débito',
          boleto: 'Boleto', cash: 'Dinheiro', vr_va: 'VR/VA', prepaid_debit: 'Pré-pago',
        };
        const paymentLine = actionData.forma_pagamento
          ? `💳 Pagamento: ${PAYMENT_LABELS[actionData.forma_pagamento] || actionData.forma_pagamento}\n`
          : '';
        const confirmationMessage = `🤖 Detectei uma transação:\n\n` +
          `💰 Valor: R$ ${actionData.valor}\n` +
          `📁 Categoria: ${actionData.categoria}\n` +
          `📝 Descrição: ${actionData.descricao}\n` +
          `📅 Data: ${actionData.data_ocorrencia}\n` +
          paymentLine +
          `\nDeseja confirmar? Responda "sim" ou "não".`;

        await axios.post(`${WHATSAPP_ADP_URL}/api/whatsapp/send`,
          { phoneNumber: sendTo, message: confirmationMessage },
          { headers: { 'Content-Type': 'application/json' } }
        );
        console.log(`✅ Sent approval request to ${sendTo}`);

        // Set timeout for approval (5 minutes)
        setTimeout(() => {
          const pending = this.pendingApprovals.get(approvalKey);
          if (pending && Date.now() - pending.timestamp > 5 * 60 * 1000) {
            this.pendingApprovals.delete(approvalKey);
            if (content.messageId) {
              this.messageRepo.updateStatus(content.messageId, 'expired');
            }
            console.log(`⏰ Approval expired for ${approvalKey}`);
          }
        }, 5 * 60 * 1000);
      } else if (getReportAction) {
        // Handle get_report action - fetch transactions from note-guard-ms
        if (!userId) {
          console.error('❌ Cannot handle get_report: userId is undefined');
          await axios.post(`${WHATSAPP_ADP_URL}/api/whatsapp/send`,
            { phoneNumber: sendTo, message: '❌ Erro: usuário não identificado. Por favor, verifique sua conexão.' },
            { headers: { 'Content-Type': 'application/json' } }
          );
          return;
        }
        await this.handleGetReportAction(userId, sendTo, getReportAction.data);
      } else {
        // No action to approve, just send the LLM response
        await axios.post(`${WHATSAPP_ADP_URL}/api/whatsapp/send`,
          { phoneNumber: sendTo, message: content.response },
          { headers: { 'Content-Type': 'application/json' } }
        );
        console.log(`✅ Replied to ${sendTo}`);
      }

      if (userId) {
        await this.redisCache.saveMessage(userId, {
          direction: 'out',
          content: content.response,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error(`❌ Failed to send reply to ${sendTo}:`, error instanceof Error ? error.message : String(error));
    }
  }

  private async handleMessage(msg: ConsumeMessage): Promise<void> {
    const content = JSON.parse(msg.content.toString()) as RabbitMQMessage;

    switch (content.type) {
      case 'incoming_message':
        await this.handleIncomingMessage(content);
        break;
      case 'status_update':
        await this.handleStatusUpdate(content);
        break;
      default:
        console.warn('Unknown message type:', (content as Record<string, unknown>).type);
    }
  }

  private async sendWhatsApp(phoneNumber: string, message: string): Promise<void> {
    await axios.post(`${WHATSAPP_ADP_URL}/api/whatsapp/send`,
      { phoneNumber, message },
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  private async handleIncomingMessage(data: IncomingWhatsAppMessage): Promise<void> {
    const phoneJid = String(data.phoneNumber);
    const sanitizedPhone = phoneJid.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '').replace(/\D/g, '');
    const sanitizedPhoneWithout9 = sanitizedPhone.replace(/^55(\d)9/, '55$1');

    // Deduplication key using whatsappMessageId
    const dedupeKey = data.whatsappMessageId || `${phoneJid}:${data.timestamp}:${data.content}`;
    if (this.processedMessages.has(dedupeKey)) {
      console.log(`⏭️ Skipping duplicate message: ${dedupeKey}`);
      return;
    }
    this.processedMessages.add(dedupeKey);

    // Clean up old keys to prevent memory leak
    if (this.processedMessages.size > 1000) {
      const keysArray = Array.from(this.processedMessages);
      this.processedMessages.delete(keysArray[0]);
    }

    try {
      const textContent = data.messageType === 'text' ? data.content.trim().toLowerCase() : '';
      const isVerificationCode = VERIFICATION_CODE_REGEX.test(textContent);

      if (isVerificationCode) {
        let authResult: any = null;
        try {
          const res = await axios.post(`${AUTH_MS_URL}/api/auth/whatsapp/validate-by-code`,
            { code: textContent.toUpperCase(), phoneJid },
            { headers: { 'Content-Type': 'application/json' } }
          );
          authResult = res.data;
        } catch (e) {
          console.error('Error calling auth-ms:', e instanceof Error ? e.message : e);
        }

        if (authResult?.success) {
          const userId = authResult?.data?.userId;
          let phone = null;
          try {
            const userRes = await axios.get(`${USER_MS_URL}/api/users/${userId}`);
            phone = userRes.data?.data?.phone || null;
          } catch { }

          const phoneNormalized = phone ? phone.replace(/\D/g, '').replace(/^55(\d)9/, '55$1') : null;

          await this.whatsappUserLinksRepo.create({
            userId,
            phoneJid,
            phone,
            phoneNormalized,
          });

          console.log(`✅ Identity verified for ${phoneJid} -> userId ${userId} -> phone ${phone}`);
          try { await this.sendWhatsApp(phone || phoneJid, '✅ Identidade verificada! Agora pode me enviar suas notas fiscais.'); } catch { }
        } else {
          console.log(`❌ Invalid code attempt from ${phoneJid}: ${textContent}`);
        }
        return;
      }

      let link = await this.whatsappUserLinksRepo.findByPhoneJid(phoneJid);
      
      if (!link) {
        link = await this.whatsappUserLinksRepo.findByPhoneNormalized(sanitizedPhone);
      }
      
      if (!link) {
        link = await this.whatsappUserLinksRepo.findByPhoneNormalized(sanitizedPhoneWithout9);
      }

      if (!link) {
        if (!phoneJid.includes('@lid')) {
          await this.sendWhatsApp(phoneJid, 'Olá! Para usar o NotaZip pelo WhatsApp, acesse o app, vá em Configurações → WhatsApp e envie o código de verificação que aparece na tela.');
        } else {
          console.log(`⚠️ User with @lid not verified: ${phoneJid} - cannot send instructions`);
        }
        return;
      }

      // WhatsApp enabled check
      const whatsappDisabled = await this.checkWhatsAppEnabled(link.userId, phoneJid);
      if (whatsappDisabled) return;

      // Check if this is an approval response
      // Find the most recent pending approval for this user
      let pendingApproval = null;
      let approvalKey = null;
      
      for (const [key, value] of this.pendingApprovals.entries()) {
        if (value.userId === link.userId) {
          pendingApproval = value;
          approvalKey = key;
          break;
        }
      }

      console.log(`🔍 Checking approval for userId: ${link.userId}`);
      console.log(`🔍 Pending approval found: ${!!pendingApproval}`);
      console.log(`🔍 Text content: "${textContent}"`);

      if (pendingApproval) {
        const isApproved = textContent === 'sim' || textContent === 'ok' || textContent === 'confirmar' || textContent === 'yes';
        const isRejected = textContent === 'não' || textContent === 'nao' || textContent === 'cancelar' || textContent === 'no';

        console.log(`🔍 Approval check - isApproved: ${isApproved}, isRejected: ${isRejected}`);

        if (isApproved || isRejected) {
          this.pendingApprovals.delete(approvalKey);

          if (isApproved) {
            // Update status to approved
            await this.messageRepo.updateStatus(data.messageId, 'approved');

            // Publish event to note-guard
            await this.rabbitMQ.publish('note_guard.events', 'transaction.approved', {
              type: 'transaction_approved',
              userId: pendingApproval.userId,
              phoneNumber: pendingApproval.phoneNumber,
              actionData: pendingApproval.actionData,
              approvedAt: new Date().toISOString()
            });

            await this.sendWhatsApp(pendingApproval.phoneNumber, '✅ Transação confirmada com sucesso!');
            console.log(`✅ Transaction approved and published for ${pendingApproval.userId}`);
          } else {
            // Update status to rejected
            await this.messageRepo.updateStatus(data.messageId, 'rejected');
            await this.sendWhatsApp(pendingApproval.phoneNumber, '❌ Transação cancelada.');
            console.log(`❌ Transaction rejected for ${pendingApproval.userId}`);
          }

          await this.redisCache.saveMessage(link.userId, {
            direction: 'in',
            content: data.content,
            timestamp: new Date(data.timestamp),
          });
          return;
        }
      }

      await this.redisCache.saveMessage(link.userId, {
        direction: 'in',
        content: data.content,
        timestamp: new Date(data.timestamp),
      });

      const llmPayload: Record<string, unknown> = {
        type: 'llm_request',
        messageId: data.messageId,
        userId: link.userId,
        phoneNumber: phoneJid,
        timestamp: data.timestamp,
      };

      if (data.messageType === 'text') {
        llmPayload.text = data.content;
      } else if (data.messageType === 'image' || data.messageType === 'audio') {
        llmPayload.mediaBase64 = (data.metadata as any)?.mediaBase64 || data.content;
        llmPayload.mimeType = (data.metadata as any)?.mimeType || (data.messageType === 'audio' ? 'audio/ogg' : 'image/jpeg');
      } else {
        llmPayload.text = `Mensagem do tipo ${data.messageType} recebida.`;
      }

      await this.rabbitMQ.publish('message.processing', 'llm.process', llmPayload);
      console.log(`Processed incoming message from ${phoneJid} (userId: ${link.userId})`);
    } catch (error) {
      console.error('Error handling incoming message:', error);
      throw error;
    }
  }

  private async checkWhatsAppEnabled(userId: string, phoneJid: string): Promise<boolean> {
    try {
      const subRes = await axios.get(`${USER_MS_URL}/api/subscriptions/${userId}`);
      if (subRes.data?.success && subRes.data?.data?.plan) {
        const plan = subRes.data.data.plan;
        if (!plan.whatsappEnabled) {
          const sendTo = phoneJid.includes('@lid') ? null : phoneJid;
          if (sendTo) {
            await this.sendWhatsApp(sendTo,
              '⚠️ Seu plano atual não inclui WhatsApp. Faça upgrade para o plano Pro para usar esta funcionalidade.'
            );
          }
          console.log(`🚫 WhatsApp disabled for userId ${userId} (plan: ${plan.name})`);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('WhatsApp enabled check failed, allowing message:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  private async handleStatusUpdate(data: StatusUpdateMessage): Promise<void> {
    console.log(`Status updated for message ${data.whatsappMessageId}: ${data.status}`);
  }

  private async handleGetReportAction(userId: string, phoneNumber: string, actionData: any): Promise<void> {
    try {
      const NOTE_GUARD_MS_URL = process.env.NOTE_GUARD_MS_URL || 'http://debr-note-guard-ms:3011';

      console.log(`📊 handleGetReportAction - userId: ${userId}, actionData:`, actionData);

      // Determine date range based on period
      let startDate: string;
      let endDate: string;
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      switch (actionData.periodo) {
        case 'hoje':
        case 'today':
        case 'diario':
        case 'daily':
          startDate = todayStr;
          endDate = todayStr;
          break;
        case 'semanal':
        case 'week':
        case 'semana':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          startDate = weekAgo.toISOString().split('T')[0];
          endDate = todayStr;
          break;
        case 'mensal':
        case 'month':
        case 'mes':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          startDate = monthAgo.toISOString().split('T')[0];
          endDate = todayStr;
          break;
        case 'ano_atual':
        case 'year':
        case 'ano':
          const yearStart = new Date(today.getFullYear(), 0, 1);
          startDate = yearStart.toISOString().split('T')[0];
          endDate = todayStr;
          break;
        default:
          startDate = todayStr;
          endDate = todayStr;
      }

      const payload = {
        userId,
        startDate,
        endDate,
        ...(actionData.filtro_categoria && actionData.filtro_categoria !== 'todos' && { categories: [actionData.filtro_categoria] })
      };

      console.log(`📊 Request payload:`, payload);

      // Fetch transactions from note-guard-ms using detailed endpoint
      const response = await axios.post(`${NOTE_GUARD_MS_URL}/api/transactions/detailed`, payload, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.data?.success && response.data?.data) {
        const transactions = response.data.data;
        const totalDebit = transactions
          .filter((t: any) => t.type === 'debit')
          .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
        const totalCredit = transactions
          .filter((t: any) => t.type === 'credit')
          .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

        let reportMessage = `📊 **Relatório de ${actionData.periodo || 'hoje'}**\n\n`;

        if (transactions.length === 0) {
          reportMessage += `Nenhuma transação encontrada neste período.`;
        } else {
          reportMessage += `💰 Total despesas: R$ ${totalDebit.toFixed(2)}\n`;
          reportMessage += `💵 Total receitas: R$ ${totalCredit.toFixed(2)}\n`;
          reportMessage += `📈 Saldo: R$ ${(totalCredit - totalDebit).toFixed(2)}\n\n`;
          reportMessage += `📝 **Transações (${transactions.length}):**\n\n`;

          transactions.forEach((t: any, index: number) => {
            const emoji = t.type === 'credit' ? '💵' : '💰';
            reportMessage += `${index + 1}. ${emoji} ${t.description || 'Sem descrição'}\n`;
            reportMessage += `   Valor: R$ ${parseFloat(t.amount).toFixed(2)}\n`;
            reportMessage += `   Categoria: ${t.category || 'Sem categoria'}\n`;
            reportMessage += `   Data: ${t.date}\n\n`;
          });
        }

        await axios.post(`${WHATSAPP_ADP_URL}/api/whatsapp/send`,
          { phoneNumber, message: reportMessage },
          { headers: { 'Content-Type': 'application/json' } }
        );
        console.log(`✅ Sent report to ${phoneNumber}`);
      } else {
        await axios.post(`${WHATSAPP_ADP_URL}/api/whatsapp/send`,
          { phoneNumber, message: '❌ Não foi possível buscar suas transações. Tente novamente mais tarde.' },
          { headers: { 'Content-Type': 'application/json' } }
        );
        console.log(`❌ Failed to fetch transactions for ${phoneNumber}`);
      }
    } catch (error) {
      console.error('Error handling get_report action:', error);
      await axios.post(`${WHATSAPP_ADP_URL}/api/whatsapp/send`,
        { phoneNumber, message: '❌ Erro ao buscar relatório. Tente novamente mais tarde.' },
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
}
