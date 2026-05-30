import { pgSchema, text, integer, timestamp, boolean, jsonb, uuid } from 'drizzle-orm/pg-core';

export const messageControlSchema = pgSchema('message_control_ms');

export const whatsappUserLinks = messageControlSchema.table('whatsapp_user_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  phoneJid: text('phone_jid').notNull(),
  phone: text('phone'),
  phoneNormalized: text('phone_normalized'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const messages = messageControlSchema.table('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  whatsappMessageId: text('whatsapp_message_id'),
  conversationId: text('conversation_id'),
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
  actions: jsonb('actions'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const processingEvents = messageControlSchema.table('processing_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventType: text('event_type').notNull(),
  eventData: jsonb('event_data').notNull(),
  status: text('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull(),
  processedAt: timestamp('processed_at'),
});

// Types
export type WhatsappUserLink = typeof whatsappUserLinks.$inferSelect;
export type NewWhatsappUserLink = typeof whatsappUserLinks.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type ProcessingEvent = typeof processingEvents.$inferSelect;
export type NewProcessingEvent = typeof processingEvents.$inferInsert;
