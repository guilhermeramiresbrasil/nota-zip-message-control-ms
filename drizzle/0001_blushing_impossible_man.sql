DROP TABLE "message_control_ms"."auto_replies" CASCADE;--> statement-breakpoint
DROP TABLE "message_control_ms"."webhook_events" CASCADE;--> statement-breakpoint
ALTER TABLE "message_control_ms"."messages" ADD COLUMN "conversation_id" text;--> statement-breakpoint
ALTER TABLE "message_control_ms"."messages" ADD COLUMN "actions" jsonb;