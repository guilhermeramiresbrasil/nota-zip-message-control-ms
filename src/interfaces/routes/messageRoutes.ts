import { Elysia } from 'elysia';
import { messageController } from '../controllers/messageController';
import { whatsappWebhookSchema } from '../schemas/messageSchema';
import { set } from 'zod';

export function messageRoutes(): any {
  const controller = new messageController();
  
  return new Elysia({ prefix: '/api/messages' })
    // Webhook endpoint para receber mensagens do WhatsApp
    .post('/webhook', ({ body, set }) => {
      const validated = whatsappWebhookSchema.parse(body);
      return controller.processWebhook({ body: validated, set });
    })    
    // Health check
    .get('/health', () => controller.healthCheck())    
    // Endpoint para receber resultados do OCR
    .post('/ocr-result', ({ body, set }) => {
      return controller.receiveOCRResult({ body, set });
    })
    // Endpoint para criar link de usuário (teste)
    .post('/link', ({ body, set }) => {
      return controller.createUserLink({ body, set });
    });
}
