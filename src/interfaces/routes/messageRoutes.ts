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
    // Endpoint para envio manual de mensagens (testes)
    .post('/send', ({ body, set }) => {
      const validated = whatsappWebhookSchema.parse(body);
      return controller.sendMessage({ body: validated, set });
    });
}
