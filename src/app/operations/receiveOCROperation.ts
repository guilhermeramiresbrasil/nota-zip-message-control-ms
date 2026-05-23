export interface ReceiveOCRRequest {
  messageId: string;
  phoneNumber: string;
  extractedText: string;
  confidence: number;
  status: string;
}

export class receiveOCROperation {
  async execute(request: any): Promise<{ status: string; message: string }> {
    try {
      console.log('🔄 Executando operação de recebimento de resultado OCR');
      
      const { messageId, extractedText, confidence, status } = request.body;
      
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
