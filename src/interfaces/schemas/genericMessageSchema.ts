import { z } from 'zod';

// Supported channel types
export const ChannelType = z.enum(['whatsapp', 'sms', 'rcs', 'telegram']);
export type ChannelType = z.infer<typeof ChannelType>;

// Generic message schema
export const genericMessageSchema = z.object({
  // Channel information
  channel: ChannelType,
  messageId: z.string(),
  timestamp: z.string().datetime(),
  
  // Sender information
  sender: z.object({
    id: z.string(),
    phone: z.string().optional(),
    email: z.string().optional(),
    username: z.string().optional(),
  }),
  
  // Message content
  content: z.object({
    text: z.string().optional(),
    media: z.array(z.object({
      type: z.enum(['image', 'video', 'audio', 'document']),
      mimeType: z.string(),
      url: z.string().optional(),
      base64: z.string().optional(),
      caption: z.string().optional(),
    })).optional(),
  }),
  
  // Metadata
  metadata: z.record(z.any()).optional(),
});

export type GenericMessage = z.infer<typeof genericMessageSchema>;

// Generic response schema
export const genericResponseSchema = z.object({
  // Channel information
  channel: ChannelType,
  recipient: z.object({
    id: z.string(),
    phone: z.string().optional(),
    email: z.string().optional(),
    username: z.string().optional(),
  }),
  
  // Response content
  content: z.object({
    text: z.string().optional(),
    media: z.array(z.object({
      type: z.enum(['image', 'video', 'audio', 'document']),
      mimeType: z.string(),
      url: z.string().optional(),
      base64: z.string().optional(),
      caption: z.string().optional(),
    })).optional(),
  }),
  
  // Response metadata
  metadata: z.object({
    inReplyTo: z.string().optional(),
    status: z.enum(['queued', 'sent', 'delivered', 'failed']),
    error: z.string().optional(),
  }).optional(),
});

export type GenericResponse = z.infer<typeof genericResponseSchema>;

// Action schema for user interactions
export const actionSchema = z.object({
  type: z.enum(['create_expense', 'get_report', 'unknown', 'confirm', 'cancel']),
  confidence: z.number().min(0).max(1),
  data: z.object({
    // For create_expense
    tipo_transacao: z.enum(['debit', 'credit']).optional(),
    valor: z.number().optional(),
    categoria: z.string().optional(),
    descricao: z.string().optional(),
    data_ocorrencia: z.string().optional(),
    forma_pagamento: z.enum(['pix', 'credit_card', 'debit_card', 'boleto', 'cash', 'vr_va', 'prepaid_debit']).optional(),
    
    // For get_report
    periodo: z.enum(['hoje', 'diario', 'semanal', 'mensal', 'ano_atual']).optional(),
    filtro_categoria: z.string().optional(),
    
    // For confirm/cancel
    actionId: z.string().optional(),
  }).optional(),
});

export type Action = z.infer<typeof actionSchema>;

// LLM response schema
export const llmResponseSchema = z.object({
  response: z.string(),
  actions: z.array(actionSchema),
});

export type LLMResponse = z.infer<typeof llmResponseSchema>;

// Channel adapter interface
export interface ChannelAdapter {
  processMessage(message: GenericMessage): Promise<GenericResponse>;
  sendMessage(response: GenericResponse): Promise<void>;
  validateMessage(message: GenericMessage): boolean;
}
