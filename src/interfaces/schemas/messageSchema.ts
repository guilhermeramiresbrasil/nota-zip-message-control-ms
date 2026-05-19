import { z } from 'zod';

// Schema para webhook do WhatsApp
export const whatsappWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(z.object({
    id: z.string(),
    changes: z.array(z.object({
      field: z.string(),
      value: z.object({
        messaging_product: z.literal('whatsapp'),
        metadata: z.object({
          display_phone_number: z.string(),
          phone_number_id: z.string()
        }),
        contacts: z.array(z.object({
          profile: z.object({
            name: z.string()
          }),
          wa_id: z.string(),
          user_id: z.string().optional()
        })).optional(),
        messages: z.array(z.object({
          id: z.string(),
          from: z.string(),
          from_user_id: z.string().optional(),
          timestamp: z.string(),
          type: z.enum(['text', 'audio', 'video', 'image', 'document', 'location', 'contact', 'interactive', 'contacts']),
          text: z.object({
            body: z.string()
          }).optional()
        })).optional()
      })
    }))
  }))
});

export type whatsappWebhookType = z.infer<typeof whatsappWebhookSchema>;

// Schema para envio de resposta
export const sendMessageSchema = z.object({
  phoneNumber: z.string().regex(/^\d+$/, 'Invalid phone number'),
  message: z.string().min(1, 'Message cannot be empty'),
  source: z.string().default('message-control')
});

// Schema para resposta automática
export const autoReplySchema = z.object({
  phoneNumber: z.string(),
  receivedMessage: z.string(),
  messageType: z.string().default('text'),
  userProfile: z.object({
    name: z.string().optional(),
    userId: z.string().optional(),
    waId: z.string().optional()
  }).optional()
});

export type autoReplyType = z.infer<typeof autoReplySchema>;
