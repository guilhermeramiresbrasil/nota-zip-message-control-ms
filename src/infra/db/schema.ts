import { pgSchema, text, integer, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

export const messageControlSchema = pgSchema('message_control_ms');

export const conversations = messageControlSchema.table('conversations', {
  id: text('id').primaryKey(),
  phoneNumber: text('phone_number').notNull(),
  userId: text('user_id'),
  userName: text('user_name'),
  status: text('status').notNull().default('active'),
  workerId: text('worker_id'),
  identityVerificationStatus: text('identity_verification_status').notNull().default('not_started'),
  metadata: jsonb('metadata'),
  lastMessageAt: timestamp('last_message_at').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const messages = messageControlSchema.table('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
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
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type AutoReply = typeof autoReplies.$inferSelect;
export type NewAutoReply = typeof autoReplies.$inferInsert;
export type ProcessingEvent = typeof processingEvents.$inferSelect;
export type NewProcessingEvent = typeof processingEvents.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
