import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Tabela de conversas
export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  phoneNumber: text('phone_number').notNull(),
  userId: text('user_id'),
  userName: text('user_name'),
  status: text('status').notNull().default('active'),
  lastMessageAt: integer('last_message_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Tabela de mensagens
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  whatsappMessageId: text('whatsapp_message_id').notNull(),
  direction: text('direction').notNull(), // 'incoming' | 'outgoing'
  type: text('type').notNull(), // 'text', 'image', 'audio', etc.
  content: text('content').notNull(),
  status: text('status').notNull().default('pending'), // 'pending', 'sent', 'delivered', 'read', 'failed'
  metadata: text('metadata'), // JSON com metadados adicionais
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Tabela de respostas automáticas
export const autoReplies = sqliteTable('auto_replies', {
  id: text('id').primaryKey(),
  triggerPattern: text('trigger_pattern').notNull(), // padrão que ativa a resposta
  responseMessage: text('response_message').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  priority: integer('priority').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Tabela de eventos de processamento
export const processingEvents = sqliteTable('processing_events', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(), // 'webhook_received', 'message_processed', 'reply_sent'
  eventData: text('event_data').notNull(), // JSON com dados do evento
  status: text('status').notNull().default('pending'), // 'pending', 'processing', 'completed', 'failed'
  errorMessage: text('error_message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  processedAt: integer('processed_at', { mode: 'timestamp' }),
});

// Types básicos
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type AutoReply = typeof autoReplies.$inferSelect;
export type NewAutoReply = typeof autoReplies.$inferInsert;
export type ProcessingEvent = typeof processingEvents.$inferSelect;
export type NewProcessingEvent = typeof processingEvents.$inferInsert;
