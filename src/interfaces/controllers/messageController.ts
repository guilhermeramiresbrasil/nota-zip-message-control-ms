import { processWebhookOperation } from '../../app/operations/processWebhookOperation';
import { receiveOCROperation } from '../../app/operations/receiveOCROperation';
import { healthCheckOperation } from '../../app/operations/healthCheckOperation';
import { sendMessageOperation } from '../../app/operations/sendMessageOperation';

export class messageController {
  private readonly processWebhookOp: processWebhookOperation;
  private readonly receiveOCROp: receiveOCROperation;
  private readonly healthCheckOp: healthCheckOperation;
  private readonly sendMessageOp: sendMessageOperation;

  constructor() {
    this.processWebhookOp = new processWebhookOperation();
    this.receiveOCROp = new receiveOCROperation();
    this.healthCheckOp = new healthCheckOperation();
    this.sendMessageOp = new sendMessageOperation();
  }

  // Processar webhook do WhatsApp
  async processWebhook({ body, set }: { body: any; set: any }) {
    try {
      console.log('📥 Message Control - Recebendo webhook');
      
      // Processar webhook através da operation
      const result = await this.processWebhookOp.execute({ webhookData: body });
      
      set.status = 200;
      return result;
      
    } catch (error) {
      console.error('❌ Erro processando webhook no Message Control:', error);
      
      if (error && typeof error === 'object') {
        const errorObj = error as any;
        console.error('📋 Error details:', {
          message: errorObj.message,
          stack: errorObj.stack
        });
      }
      
      set.status = 500;
      return { error: 'Internal server error' };
    }
  }

  // Health check
  async healthCheck() {
    return await this.healthCheckOp.execute();
  }

  // Endpoint para receber resultados do OCR
  async receiveOCRResult({ body, set }: { body: any; set: any }) {
    try {
      console.log('📥 Message Control - Recebendo resultado OCR');
      
      const result = await this.receiveOCROp.execute(body);
      
      set.status = 200;
      return result;
      
    } catch (error) {
      console.error('❌ Erro processando resultado OCR:', error);
      set.status = 500;
      return { error: 'Failed to process OCR result' };
    }
  }

  // Endpoint para enviar mensagens manualmente (para testes)
  async sendMessage({ body, set }: { body: any; set: any }) {
    try {
      console.log('📥 Message Control - Enviando mensagem manual');
      
      const result = await this.sendMessageOp.execute(body);
      
      set.status = 200;
      return result;
      
    } catch (error) {
      console.error('❌ Erro enviando mensagem:', error);
      set.status = 500;
      return { error: 'Failed to send message' };
    }
  }
}
