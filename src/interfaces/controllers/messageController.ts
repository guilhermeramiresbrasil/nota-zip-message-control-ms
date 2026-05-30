import { processWebhookOperation } from '../../app/operations/processWebhookOperation';
import { receiveOCROperation } from '../../app/operations/receiveOCROperation';
import { healthCheckOperation } from '../../app/operations/healthCheckOperation';
import { whatsappUserLinksRepository } from '../../infra/repositories/whatsappUserLinksRepository';

export class messageController {
  private readonly processWebhookOp: processWebhookOperation;
  private readonly receiveOCROp: receiveOCROperation;
  private readonly healthCheckOp: healthCheckOperation;
  private readonly whatsappUserLinksRepo: whatsappUserLinksRepository;

  constructor() {
    this.processWebhookOp = new processWebhookOperation();
    this.receiveOCROp = new receiveOCROperation();
    this.healthCheckOp = new healthCheckOperation();
    this.whatsappUserLinksRepo = new whatsappUserLinksRepository();
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

  // Endpoint para criar link de usuário (teste)
  async createUserLink({ body, set }: { body: any; set: any }) {
    try {
      console.log('📥 Creating user link for test:', body);
      
      const link = await this.whatsappUserLinksRepo.create({
        userId: body.userId,
        phoneJid: body.phoneJid,
        phone: body.phone,
        phoneNormalized: body.phone?.replace(/\D/g, ''),
      });
      
      set.status = 201;
      return { success: true, data: link };
      
    } catch (error) {
      console.error('❌ Erro criando user link:', error);
      set.status = 500;
      return { error: 'Failed to create user link' };
    }
  }
}
