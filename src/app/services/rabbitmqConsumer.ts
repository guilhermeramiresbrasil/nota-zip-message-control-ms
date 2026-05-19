import type { ConsumeMessage } from 'amqplib';
import { RabbitMQService } from './rabbitmqService';
import { conversationRepository } from '../../infra/repositories/conversationRepository';
import { messageRepository } from '../../infra/repositories/messageRepository';
import { v4 as uuidv4 } from 'uuid';

export interface IncomingWhatsAppMessage {
  type: 'incoming_message';
  phoneNumber: string;
  messageId: string;
  whatsappMessageId: string;
  direction: string;
  messageType: string;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  userId?: string;
  conversationId?: string;
  identityVerificationStatus?: string;
}

export interface StatusUpdateMessage {
  type: 'status_update';
  whatsappMessageId: string;
  status: string;
  timestamp: string;
}

type RabbitMQMessage = IncomingWhatsAppMessage | StatusUpdateMessage;

export class RabbitMQConsumer {
  private readonly rabbitMQ: RabbitMQService;
  private readonly conversationRepo: conversationRepository;
  private readonly messageRepo: messageRepository;

  constructor(rabbitMQ: RabbitMQService) {
    this.rabbitMQ = rabbitMQ;
    this.conversationRepo = new conversationRepository();
    this.messageRepo = new messageRepository();
  }

  async start(): Promise<void> {
    await this.rabbitMQ.consume('message.control', (msg) => this.handleMessage(msg));
    console.log('RabbitMQ consumer started for message.control queue');
  }

  private async handleMessage(msg: ConsumeMessage): Promise<void> {
    const content = JSON.parse(msg.content.toString()) as RabbitMQMessage;

    switch (content.type) {
      case 'incoming_message':
        await this.handleIncomingMessage(content);
        break;
      case 'status_update':
        await this.handleStatusUpdate(content);
        break;
      default:
        console.warn('Unknown message type:', (content as Record<string, unknown>).type);
    }
  }

  private async handleIncomingMessage(data: IncomingWhatsAppMessage): Promise<void> {
    try {
      let conversation = await this.conversationRepo.findByPhoneNumber(data.phoneNumber);

      if (!conversation) {
        conversation = await this.conversationRepo.create({
          id: uuidv4(),
          phoneNumber: data.phoneNumber,
          userId: data.userId,
          status: 'active',
          identityVerificationStatus: data.identityVerificationStatus || 'not_started',
          metadata: data.metadata || null,
          lastMessageAt: new Date(data.timestamp),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      await this.messageRepo.create({
        id: data.messageId || uuidv4(),
        conversationId: conversation.id,
        whatsappMessageId: data.whatsappMessageId,
        direction: data.direction,
        type: data.messageType,
        content: data.content,
        status: 'pending',
        retryCount: 0,
        metadata: data.metadata || null,
        createdAt: new Date(data.timestamp),
        updatedAt: new Date(data.timestamp),
      });

      await this.conversationRepo.update(conversation.id, {
        lastMessageAt: new Date(data.timestamp),
        status: 'active',
      });

      if (data.messageType === 'image') {
        await this.rabbitMQ.publish('ocr.events', 'process', {
          type: 'ocr_request',
          messageId: data.messageId,
          conversationId: conversation.id,
          imageData: data.content,
          timestamp: data.timestamp,
        });
      } else if (data.messageType === 'text') {
        await this.rabbitMQ.publish('llm.events', 'process', {
          type: 'llm_request',
          messageId: data.messageId,
          conversationId: conversation.id,
          text: data.content,
          userId: data.userId || conversation.userId,
          timestamp: data.timestamp,
        });
      }

      console.log(`Processed incoming message from ${data.phoneNumber}`);
    } catch (error) {
      console.error('Error handling incoming message:', error);
      throw error;
    }
  }

  private async handleStatusUpdate(data: StatusUpdateMessage): Promise<void> {
    try {
      const message = await this.messageRepo.findByWhatsAppId(data.whatsappMessageId);
      if (!message) {
        console.warn(`Message not found for WhatsApp ID: ${data.whatsappMessageId}`);
        return;
      }

      const updateData: Record<string, unknown> = { status: data.status };
      const timestamp = new Date(data.timestamp);

      if (data.status === 'sent') updateData.sentAt = timestamp;
      if (data.status === 'delivered') updateData.deliveredAt = timestamp;
      if (data.status === 'read') updateData.readAt = timestamp;

      await this.messageRepo.update(message.id, updateData as Parameters<typeof this.messageRepo.update>[1]);

      console.log(`Status updated for message ${data.whatsappMessageId}: ${data.status}`);
    } catch (error) {
      console.error('Error handling status update:', error);
      throw error;
    }
  }
}
