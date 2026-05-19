import { db, conversations, NewConversation } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export class conversationRepository {
  async create(data: NewConversation) {
    const [conversation] = await db.insert(conversations).values(data).returning();
    return conversation;
  }

  async findById(id: string) {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async findByPhoneNumber(phoneNumber: string) {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.phoneNumber, phoneNumber))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(1);
    return conversation;
  }

  async update(id: string, data: Partial<NewConversation>) {
    const [conversation] = await db
      .update(conversations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return conversation;
  }

  async updateLastMessage(id: string) {
    const [conversation] = await db
      .update(conversations)
      .set({ 
        lastMessageAt: new Date(), 
        updatedAt: new Date() 
      })
      .where(eq(conversations.id, id))
      .returning();
    return conversation;
  }

  async list(limit: number = 50, offset: number = 0) {
    return await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.lastMessageAt))
      .limit(limit)
      .offset(offset);
  }

  async delete(id: string) {
    await db.delete(conversations).where(eq(conversations.id, id));
  }
}
