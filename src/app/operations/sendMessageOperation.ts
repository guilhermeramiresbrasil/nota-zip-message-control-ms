import { whatsappService } from '../services/whatsappService';
import { conversationService } from '../services/conversationService';
import { v4 as uuidv4 } from 'uuid';

export interface SendMessageRequest {
  phoneNumber: string;
  message: string;
}

export class sendMessageOperation {
  private readonly whatsappService: whatsappService;
  private readonly conversationService: conversationService;

  constructor() {
    this.whatsappService = new whatsappService();
    this.conversationService = new conversationService();
  }

  async execute(request: any): Promise<{ status: string }> {
    try {
      console.log('🔄 Executando operação de envio de mensagem');
      
      const { phoneNumber, message } = request.body;
      
      // Salvar mensagem no banco
      const conversation = await this.conversationService.findByPhoneNumber(phoneNumber);
      if (conversation) {
        const messageData = {
          conversationId: conversation.id,
          whatsappMessageId: `manual_${Date.now()}`,
          direction: 'outgoing',
          type: 'text',
          content: message,
          status: 'pending'
        };
        
        const savedMessage = await this.conversationService.createMessage(messageData);
        
        // Enviar para WhatsApp
        await this.whatsappService.sendMessage(phoneNumber, message);
        
        // Atualizar status
        await this.conversationService.updateMessageStatus(savedMessage.id, 'sent');
      } else {
        // Se não existe conversa, apenas enviar
        await this.whatsappService.sendMessage(phoneNumber, message);
      }
      
      console.log('✅ Mensagem enviada com sucesso');
      return { status: 'sent' };
      
    } catch (error) {
      console.error('❌ Erro na operação de envio de mensagem:', error);
      throw error;
    }
  }
}
