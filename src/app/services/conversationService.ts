import { conversationRepository } from '../../infra/repositories/conversationRepository';
import { messageRepository } from '../../infra/repositories/messageRepository';
import { v4 as uuidv4 } from 'uuid';

export class conversationService {
  private readonly conversationRepo: conversationRepository;
  private readonly messageRepo: messageRepository;

  constructor() {
    this.conversationRepo = new conversationRepository();
    this.messageRepo = new messageRepository();
  }

  async findByPhoneNumber(phoneNumber: string) {
    return await this.conversationRepo.findByPhoneNumber(phoneNumber);
  }

  async createConversation(phoneNumber: string, contact: any) {
    const newConversation = {
      id: uuidv4(),
      phoneNumber,
      userId: contact?.user_id,
      userName: contact?.profile?.name,
      status: 'active',
      lastMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const conversation = await this.conversationRepo.create(newConversation);
    console.log(`🆕 Nova conversa criada para ${phoneNumber}`);
    return conversation;
  }

  async updateLastMessage(conversationId: string) {
    await this.conversationRepo.updateLastMessage(conversationId);
  }

  async createMessage(messageData: any) {
    const newMessage = {
      id: uuidv4(),
      conversationId: messageData.conversationId,
      whatsappMessageId: messageData.whatsappMessageId,
      direction: messageData.direction,
      type: messageData.type,
      content: messageData.content,
      status: messageData.status,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    return await this.messageRepo.create(newMessage);
  }

  async updateMessageStatus(messageId: string, status: string) {
    await this.messageRepo.updateStatus(messageId, status);
  }

  async getConversations(limit: number = 50, offset: number = 0) {
    return await this.conversationRepo.list(limit, offset);
  }

  async getMessages(conversationId: string, limit: number = 50, offset: number = 0) {
    return await this.messageRepo.findByConversationId(conversationId, limit, offset);
  }
}
