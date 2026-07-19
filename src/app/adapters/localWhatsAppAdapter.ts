import { ChannelAdapter, GenericMessage, GenericResponse } from '../../interfaces/schemas/genericMessageSchema';
import { whatsappService } from '../services/whatsappService';

export class LocalWhatsAppAdapter implements ChannelAdapter {
  private readonly service: whatsappService;

  constructor() {
    this.service = new whatsappService();
  }

  validateMessage(message: GenericMessage): boolean {
    return message.channel === 'whatsapp' && !!message.sender?.phone;
  }

  async processMessage(message: GenericMessage): Promise<GenericResponse> {
    return {
      channel: 'whatsapp',
      recipient: message.sender,
      content: {
        text: 'Mensagem recebida. Processando...',
      },
      metadata: {
        inReplyTo: message.messageId,
        status: 'queued',
      },
    };
  }

  async sendMessage(response: GenericResponse): Promise<void> {
    const phone = response.recipient?.phone;
    const text = response.content?.text;

    if (!phone || !text) {
      throw new Error('Invalid WhatsApp response: phone and text are required');
    }

    await this.service.sendMessage(phone, text);
  }
}
