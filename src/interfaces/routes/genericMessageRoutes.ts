import { Elysia, t } from 'elysia';
import { GenericMessage, genericMessageSchema } from '../../interfaces/schemas/genericMessageSchema';
import { GenericProcessMessageOperation } from '../../app/operations/genericProcessMessageOperation';
import { GenericChannelService } from '../../app/services/genericChannelService';
import { GenericUserLinkRepository } from '../../app/repositories/genericUserLinkRepository';
import { LocalWhatsAppAdapter } from '../../app/adapters/localWhatsAppAdapter';

export function genericMessageRoutes() {
  const channelService = new GenericChannelService();
  const userLinkRepository = new GenericUserLinkRepository();

  channelService.registerAdapter('whatsapp', new LocalWhatsAppAdapter());

  const processMessageOperation = new GenericProcessMessageOperation(channelService, userLinkRepository);

  return new Elysia({ prefix: '/api/channels' })
    // Generic webhook endpoint for all channels
    .post('/webhook', async ({ body }) => {
      try {
        // Validate message
        const message = genericMessageSchema.parse(body);
        
        // Process message
        const response = await processMessageOperation.execute(message);
        
        return { success: true, data: response };
      } catch (error) {
        console.error('Error processing webhook:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Invalid message' 
        };
      }
    }, {
      body: t.Object({
        channel: t.String(),
        messageId: t.String(),
        timestamp: t.String(),
        sender: t.Object({
          id: t.String(),
          phone: t.Optional(t.String()),
          email: t.Optional(t.String()),
          username: t.Optional(t.String()),
        }),
        content: t.Object({
          text: t.Optional(t.String()),
          media: t.Optional(t.Array(t.Any())),
        }),
        metadata: t.Optional(t.Record(t.String(), t.Any())),
      }),
    })

    // Channel-specific webhooks (for convenience)
    .post('/whatsapp/webhook', async ({ body }) => {
      // Transform WhatsApp webhook to generic format
      const whatsappBody = body as any;
      const genericMessage: GenericMessage = {
        channel: 'whatsapp',
        messageId: whatsappBody.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id || 'unknown',
        timestamp: new Date().toISOString(),
        sender: {
          id: whatsappBody.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from || 'unknown',
          phone: whatsappBody.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from,
        },
        content: {
          text: whatsappBody.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body,
        },
      };

      const response = await processMessageOperation.execute(genericMessage);
      return { success: true, data: response };
    })

    .post('/sms/webhook', async ({ body }) => {
      // Transform SMS webhook to generic format
      const smsBody = body as any;
      const genericMessage: GenericMessage = {
        channel: 'sms',
        messageId: smsBody.messageId || 'unknown',
        timestamp: smsBody.timestamp || new Date().toISOString(),
        sender: {
          id: smsBody.from || 'unknown',
          phone: smsBody.from,
        },
        content: {
          text: smsBody.text,
        },
      };

      const response = await processMessageOperation.execute(genericMessage);
      return { success: true, data: response };
    })

    // Get user link status
    .get('/links/:channel/:channelUserId', async ({ params }) => {
      const link = await userLinkRepository.findByChannelAndChannelUserId(
        params.channel as any,
        params.channelUserId
      );
      
      if (!link) {
        return { success: false, error: 'Link not found' };
      }

      return { success: true, data: link };
    })

    // Create user link
    .post('/links', async ({ body }) => {
      const link = await userLinkRepository.create(body as any);
      return { success: true, data: link };
    }, {
      body: t.Object({
        userId: t.String(),
        channel: t.String(),
        channelUserId: t.String(),
        channelPhone: t.Optional(t.String()),
        channelEmail: t.Optional(t.String()),
        channelUsername: t.Optional(t.String()),
        isActive: t.Boolean(),
      }),
    })

    // Update user link
    .put('/links/:id', async ({ params, body }) => {
      const link = await userLinkRepository.update(params.id, body);
      
      if (!link) {
        return { success: false, error: 'Link not found' };
      }

      return { success: true, data: link };
    }, {
      body: t.Object({
        channelPhone: t.Optional(t.String()),
        channelEmail: t.Optional(t.String()),
        channelUsername: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
    })

    // Delete user link
    .delete('/links/:id', async ({ params }) => {
      const deleted = await userLinkRepository.delete(params.id);
      return { success: true, deleted };
    });
}
