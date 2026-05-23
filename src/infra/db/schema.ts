import { pgSchema, text, integer, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

export const messageControlSchema = pgSchema('message_control_ms');

export const whatsappUserLinks = messageControlSchema.table('whatsapp_user_links', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  phoneJid: text('phone_jid').notNull(),
  phone: text('phone'),
  phoneNormalized: text('phone_normalized'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const messages = messageControlSchema.table('messages', {
  id: text('id').primaryKey(),
  whatsappMessageId: text('whatsapp_message_id'),
  direction: text('direction').notNull(),
  type: text('type').notNull(),
  content: text('content').notNull(),
  status: text('status').notNull().default('pending'),
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  readAt: timestamp('read_at'),
  retryCount: integer('retry_count').notNull().default(0),
  lastRetryAt: timestamp('last_retry_at'),
  error: text('error'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const autoReplies = messageControlSchema.table('auto_replies', {
  id: text('id').primaryKey(),
  triggerPattern: text('trigger_pattern').notNull(),
  responseMessage: text('response_message').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  priority: integer('priority').notNull().default(0),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const processingEvents = messageControlSchema.table('processing_events', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(),
  eventData: jsonb('event_data').notNull(),
  status: text('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull(),
  processedAt: timestamp('processed_at'),
});

export const webhookEvents = messageControlSchema.table('webhook_events', {
  id: text('id').primaryKey(),
  eventId: text('event_id').unique().notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  processed: boolean('processed').notNull().default(false),
  processedAt: timestamp('processed_at'),
  error: text('error'),
  createdAt: timestamp('created_at').notNull(),
});

// Types
export type WhatsappUserLink = typeof whatsappUserLinks.$inferSelect;
export type NewWhatsappUserLink = typeof whatsappUserLinks.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type AutoReply = typeof autoReplies.$inferSelect;
export type NewAutoReply = typeof autoReplies.$inferInsert;
export type ProcessingEvent = typeof processingEvents.$inferSelect;
export type NewProcessingEvent = typeof processingEvents.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
