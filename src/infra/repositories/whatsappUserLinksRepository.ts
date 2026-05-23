import { db } from '../db';
import { whatsappUserLinks, NewWhatsappUserLink } from '../db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export class whatsappUserLinksRepository {
  async create(data: Omit<NewWhatsappUserLink, 'id' | 'createdAt' | 'updatedAt'>) {
    const [link] = await db.insert(whatsappUserLinks).values({
      id: uuidv4(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return link;
  }

  async findByPhoneJid(phoneJid: string) {
    const [link] = await db
      .select()
      .from(whatsappUserLinks)
      .where(eq(whatsappUserLinks.phoneJid, phoneJid))
      .limit(1);
    return link;
  }

  async findByPhoneNormalized(phoneNormalized: string) {
    const [link] = await db
      .select()
      .from(whatsappUserLinks)
      .where(eq(whatsappUserLinks.phoneNormalized, phoneNormalized))
      .limit(1);
    return link;
  }

  async findByUserId(userId: string) {
    const [link] = await db
      .select()
      .from(whatsappUserLinks)
      .where(eq(whatsappUserLinks.userId, userId))
      .limit(1);
    return link;
  }

  async update(id: string, data: Partial<NewWhatsappUserLink>) {
    const [link] = await db
      .update(whatsappUserLinks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(whatsappUserLinks.id, id))
      .returning();
    return link;
  }

  async delete(id: string) {
    await db.delete(whatsappUserLinks).where(eq(whatsappUserLinks.id, id));
  }
}
