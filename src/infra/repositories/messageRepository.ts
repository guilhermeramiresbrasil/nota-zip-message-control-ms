import { db, messages, NewMessage } from '../db';
import { eq, and, desc } from 'drizzle-orm';

export class messageRepository {
  async create(data: NewMessage) {
    const [message] = await db.insert(messages).values(data).returning();
    return message;
  }

  async findById(id: string) {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message;
  }

  async findByWhatsAppId(whatsappMessageId: string) {
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.whatsappMessageId, whatsappMessageId));
    return message;
  }

  async findByConversationId(conversationId: string, limit: number = 50, offset: number = 0) {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async update(id: string, data: Partial<NewMessage>) {
    const [message] = await db
      .update(messages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(messages.id, id))
      .returning();
    return message;
  }

  async updateStatus(id: string, status: string) {
    const [message] = await db
      .update(messages)
      .set({ status, updatedAt: new Date() })
      .where(eq(messages.id, id))
      .returning();
    return message;
  }

  async list(limit: number = 50, offset: number = 0) {
    return await db
      .select()
      .from(messages)
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async delete(id: string) {
    await db.delete(messages).where(eq(messages.id, id));
  }
}
