import axios from 'axios';

export class ocrService {
  private readonly llmAdpUrl: string;

  constructor() {
    this.llmAdpUrl = process.env.LLM_ADP_URL || 'http://debr-llm-adp:3010';
  }

  async processImage(ocrRequest: any): Promise<void> {
    try {
      // Send image to LLM-ADP for vision analysis
      await axios.post(`${this.llmAdpUrl}/api/llm/analyze`, {
        text: ocrRequest.text || '',
        mediaBase64: ocrRequest.mediaBase64,
        mimeType: ocrRequest.mimeType,
        messageId: ocrRequest.messageId,
        userId: ocrRequest.userId,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Source-Service': 'message-control-ms'
        },
        timeout: 10000
      });

      console.log(`📤 Imagem enviada para LLM-ADP (vision): ${ocrRequest.messageId}`);
    } catch (error) {
      console.error('⚠️ Erro ao enviar imagem para LLM-ADP:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}
