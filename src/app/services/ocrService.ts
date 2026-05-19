import axios from 'axios';

export class ocrService {
  private readonly ocrApiUrl: string;

  constructor() {
    this.ocrApiUrl = process.env.OCR_API_URL || 'http://localhost:3008';
  }

  async processImage(ocrRequest: any): Promise<void> {
    try {
      await axios.post(`${this.ocrApiUrl}/api/ocr/process`, ocrRequest, {
        headers: {
          'Content-Type': 'application/json',
          'X-Source-Service': 'message-control-ms'
        },
        timeout: 10000
      });

      console.log(`📤 Imagem enviada para OCR-ADP: ${ocrRequest.messageId}`);
    } catch (error) {
      console.error('⚠️ Erro ao enviar imagem para OCR-ADP:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}
