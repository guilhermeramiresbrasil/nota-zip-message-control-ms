import { conversationService } from '../services/conversationService';
import { whatsappService } from '../services/whatsappService';

export interface ReceiveOCRRequest {
  messageId: string;
  conversationId: string;
  phoneNumber: string;
  extractedText: string;
  confidence: number;
  status: string;
}

export class receiveOCROperation {
  private readonly conversationService: conversationService;
  private readonly whatsappService: whatsappService;

  constructor() {
    this.conversationService = new conversationService();
    this.whatsappService = new whatsappService();
  }

  async execute(request: any): Promise<{ status: string; message: string }> {
    try {
      console.log('🔄 Executando operação de recebimento de resultado OCR');
      
      const { conversationId, messageId, extractedText, confidence, status } = request.body;
      
      const ocrMessage = {
        conversationId,
        whatsappMessageId: messageId,
        direction: 'incoming',
        type: 'text',
        content: `[OCR - ${Math.round(confidence)}%] ${extractedText}`,
        status: 'processed'
      };
      
      await this.conversationService.createMessage(ocrMessage);
      await this.conversationService.updateLastMessage(conversationId);
      
      console.log(`💾 Resultado OCR salvo: ${messageId}`);
      
      const replyMessage = this.whatsappService.createReplyForOCRText(extractedText, confidence, status);
      
      console.log(`✅ Resultado OCR processado: "${extractedText.substring(0, 50)}..."`);
      
      return {
        status: 'processed',
        message: 'OCR result processed successfully'
      };
      
    } catch (error) {
      console.error('❌ Erro na operação de OCR:', error);
      throw error;
    }
  }
}
