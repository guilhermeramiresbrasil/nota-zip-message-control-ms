import { RabbitMQService } from '../services/rabbitmqService';
import { v4 as uuidv4 } from 'uuid';

export interface ProcessWebhookRequest {
  webhookData: any;
}

export class processWebhookOperation {
  private readonly rabbitMQ: RabbitMQService;

  constructor() {
    this.rabbitMQ = new RabbitMQService();
  }

  async execute(request: ProcessWebhookRequest): Promise<{ status: string }> {
    try {
      console.log('📥 Message Control MS - Processando webhook do WhatsApp');
      
      const entry = request.webhookData.entry?.[0];
      const changes = entry?.changes?.[0];
      const messages = changes?.value?.messages;

      if (!messages || messages.length === 0) {
        console.log('⚠️ Nenhuma mensagem encontrada no webhook');
        return { status: 'processed' };
      }

      for (const message of messages) {
        const from = message.from || message.remoteJid;
        const text = message.text?.body || message.message?.conversation || '';
        const messageType = message.type || 'text';
        
        const payload = {
          type: 'incoming_message',
          phoneNumber: from,
          messageId: uuidv4(),
          whatsappMessageId: message.id,
          direction: 'incoming',
          messageType,
          content: text,
          metadata: message,
          timestamp: message.timestamp || new Date().toISOString(),
        };

        await this.rabbitMQ.publish('message.control', 'incoming_message', payload);
        console.log(`� Mensagem enfileirada de ${from}: ${text.substring(0, 50)}...`);
      }

      console.log('✅ Message Control MS - Webhook recebido e enfileirado para processamento');
      return { status: 'processed' };

    } catch (error) {
      console.error('❌ Erro processando webhook no Message Control MS:', error);
      throw error;
    }
  }
}
