import { whatsappService } from '../services/whatsappService';
import { ocrService } from '../services/ocrService';
import { conversationService } from '../services/conversationService';
import { eventService } from '../services/eventService';
import { v4 as uuidv4 } from 'uuid';

export interface ProcessWebhookRequest {
  webhookData: any;
}

export class processWebhookOperation {
  private readonly whatsappService: whatsappService;
  private readonly ocrService: ocrService;
  private readonly conversationService: conversationService;
  private readonly eventService: eventService;

  constructor() {
    this.whatsappService = new whatsappService();
    this.ocrService = new ocrService();
    this.conversationService = new conversationService();
    this.eventService = new eventService();
  }

  async execute(request: ProcessWebhookRequest): Promise<{ status: string }> {
    const eventId = uuidv4();
    
    try {
      await this.eventService.createEvent(eventId, 'webhook_received', request.webhookData);
      
      console.log('� Message Control MS - Processando webhook do WhatsApp');
      
      const entry = request.webhookData.entry[0];
      const changes = entry.changes[0];
      const messages = changes.value.messages;

      if (!messages || messages.length === 0) {
        console.log('⚠️ Nenhuma mensagem encontrada no webhook');
        await this.eventService.updateEvent(eventId, 'completed');
        return { status: 'processed' };
      }

      for (const message of messages) {
        this.processMessageAsync(message, changes.value, eventId);
      }

      await this.eventService.updateEvent(eventId, 'completed');
      console.log('✅ Message Control MS - Webhook recebido e enfileirado para processamento');
      
      return { status: 'processed' };

    } catch (error) {
      console.error('❌ Erro processando webhook no Message Control MS:', error);
      await this.eventService.updateEvent(eventId, 'failed', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async processMessageAsync(message: any, webhookValue: any, parentEventId: string): Promise<void> {
    const messageId = uuidv4();
    
    try {
      await this.eventService.createEvent(messageId, 'message_processing', { message, webhookValue });
      
      const from = message.from;
      const contacts = webhookValue.contacts || [];
      const contact = contacts.find((c: any) => c.wa_id === from);

      if (message.type === 'text') {
        const text = message.text?.body;
        console.log(`📨 Mensagem de texto recebida de ${from}: "${text}"`);

        await this.saveIncomingMessage(message, from, text, contact);
        await this.generateAndSendAutoReply(from, text, contact);
        
      } else if (message.type === 'image') {
        console.log(`📸 Mensagem de imagem recebida de ${from}: ${message.image?.id}`);
        
        await this.saveIncomingMessage(message, from, '[Imagem]', contact);
        await this.sendImageToOCR(message, from, contact);
        
      } else {
        console.log(`📨 Mensagem do tipo ${message.type} recebida de ${from}`);
        
        const content = `[${message.type.toUpperCase()}]`;
        await this.saveIncomingMessage(message, from, content, contact);
        await this.generateAndSendAutoReply(from, content, contact);
      }
      
      await this.eventService.updateEvent(messageId, 'completed');
      
    } catch (error) {
      console.error('❌ Erro processando mensagem assincronamente:', error);
      await this.eventService.updateEvent(messageId, 'failed', error instanceof Error ? error.message : String(error));
    }
  }

  private async saveIncomingMessage(message: any, phoneNumber: string, text: string, contact: any): Promise<void> {
    let conversation = await this.conversationService.findByPhoneNumber(phoneNumber);
    
    if (!conversation) {
      conversation = await this.conversationService.createConversation(phoneNumber, contact);
    } else {
      await this.conversationService.updateLastMessage(conversation.id);
    }

    const messageData = {
      conversationId: conversation.id,
      whatsappMessageId: message.id,
      direction: 'incoming',
      type: message.type,
      content: text,
      status: 'received'
    };
    
    await this.conversationService.createMessage(messageData);
    console.log(`💾 Mensagem salva: ${message.id}`);
  }

  private async generateAndSendAutoReply(phoneNumber: string, receivedMessage: string, contact: any): Promise<void> {
    const replyMessage = this.whatsappService.createReplyMessage(receivedMessage, contact);
    
    const conversation = await this.conversationService.findByPhoneNumber(phoneNumber);
    if (conversation) {
      const replyData = {
        conversationId: conversation.id,
        whatsappMessageId: `reply_${Date.now()}`,
        direction: 'outgoing',
        type: 'text',
        content: replyMessage,
        status: 'pending'
      };
      
      const savedReply = await this.conversationService.createMessage(replyData);
      
      await this.whatsappService.sendMessage(phoneNumber, replyMessage);
      await this.conversationService.updateMessageStatus(savedReply.id, 'sent');
      
      console.log(`✅ Resposta automática enviada para ${phoneNumber}`);
    }
  }

  private async sendImageToOCR(message: any, phoneNumber: string, contact: any): Promise<void> {
    const conversation = await this.conversationService.findByPhoneNumber(phoneNumber);
    if (!conversation) {
      console.error('❌ Conversa não encontrada para OCR');
      return;
    }

    const imageUrl = message.image?.url || `https://graph.facebook.com/v18.0/${message.image?.id}`;

    const ocrRequest = {
      messageId: `ocr_${message.id}_${Date.now()}`,
      conversationId: conversation.id,
      phoneNumber,
      imageUrl,
      imageType: message.image?.mime_type || 'image/jpeg',
      fileName: message.image?.filename || `${message.image?.id}.jpg`,
      metadata: {
        whatsappMessageId: message.id,
        timestamp: message.timestamp,
        mimeType: message.image?.mime_type,
        originalUrl: imageUrl
      }
    };

    await this.ocrService.processImage(ocrRequest);
    
    await this.whatsappService.sendMessage(phoneNumber, 
      `🔍 *Processando Imagem*\n\nRecebi sua imagem e estou processando o texto. Aguarde um momento...`
    );
  }
}
