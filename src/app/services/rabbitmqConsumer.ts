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

    let sendTo = String(content.phoneNumber);
    let userId = content.userId;

    try {
      const link = await this.whatsappUserLinksRepo.findByPhoneJid(sendTo);
      if (link?.phone) {
        sendTo = link.phone;
        userId = link.userId;
      }
    } catch { }

    try {
      // Update message status to processed and save actions
      if (content.messageId) {
        await this.messageRepo.updateStatusAndActions(content.messageId, 'processed', content.actions);
      }

      // Check if there are create_expense actions with high confidence
      const createExpenseAction = content.actions?.find(
        (action: any) => action.type === 'create_expense' && action.confidence > 0.7
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
        const confirmationMessage = `🤖 Detectei uma transação:\n\n` +
          `💰 Valor: R$ ${actionData.valor}\n` +
          `📁 Categoria: ${actionData.categoria}\n` +
          `📝 Descrição: ${actionData.descricao}\n` +
          `📅 Data: ${actionData.data_ocorrencia}\n\n` +
          `Deseja confirmar? Responda "sim" ou "não".`;

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
      const approvalKey = `${link.userId}_${data.messageId}`;
      const pendingApproval = this.pendingApprovals.get(approvalKey);

      if (pendingApproval) {
        const isApproved = textContent === 'sim' || textContent === 'ok' || textContent === 'confirmar' || textContent === 'yes';
        const isRejected = textContent === 'não' || textContent === 'nao' || textContent === 'cancelar' || textContent === 'no';

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
}
