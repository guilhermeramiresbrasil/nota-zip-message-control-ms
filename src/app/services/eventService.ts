import { NewProcessingEvent, processingEvents } from '../../infra/db/schema';
import { db } from '../../infra/db';
import { eq } from 'drizzle-orm';

export class eventService {
  async createEvent(id: string, eventType: string, eventData: any): Promise<void> {
    const newEvent: NewProcessingEvent = {
      id,
      eventType,
      eventData: JSON.stringify(eventData),
      status: 'pending',
      createdAt: new Date()
    };
    
    await db.insert(processingEvents).values(newEvent);
  }

  async updateEvent(id: string, status: string, errorMessage?: string): Promise<void> {
    const updateData: any = { status };
    
    if (status === 'completed' || status === 'failed') {
      updateData.processedAt = new Date();
    }
    
    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }
    
    await db
      .update(processingEvents)
      .set(updateData)
      .where(eq(processingEvents.id, id));
  }
}
