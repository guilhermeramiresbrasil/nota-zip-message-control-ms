import axios from 'axios';
import { GenericMessage, GenericResponse, LLMResponse } from '../../interfaces/schemas/genericMessageSchema';
import { GenericChannelService } from '../services/genericChannelService';
import { GenericUserLinkRepository } from '../repositories/genericUserLinkRepository';

const NOTE_GUARD_MS_URL = process.env.NOTE_GUARD_MS_URL || 'http://debr-note-guard-ms:3011';

export class GenericProcessMessageOperation {
  private channelService: GenericChannelService;
  private userLinkRepository: GenericUserLinkRepository;
  private llmAdpUrl: string;

  constructor(
    channelService: GenericChannelService,
    userLinkRepository: GenericUserLinkRepository
  ) {
    this.channelService = channelService;
    this.userLinkRepository = userLinkRepository;
    this.llmAdpUrl = process.env.LLM_ADP_URL || 'http://localhost:3010';
  }

  /**
   * Process a generic message from any channel
   */
  async execute(message: GenericMessage): Promise<GenericResponse> {
    try {
      // 1. Find or create user link
      const userLink = await this.findOrCreateUserLink(message);
      
      if (!userLink || !userLink.isActive) {
        return this.createErrorResponse(message, 'User not linked or inactive');
      }

      // 2. Fetch active credit cards for user context
      const activeCards = await this.fetchActiveCards(userLink.userId);

      // 3. Prepare message for LLM
      const llmRequest = this.prepareLLMRequest(message, userLink.userId, activeCards);

      // 4. Send to LLM-ADP
      const llmResponse = await this.sendToLLM(llmRequest);

      // 4. Process LLM response
      const response = this.processLLMResponse(message, llmResponse, userLink.userId);

      // 5. Send response back through channel
      await this.channelService.sendMessage(response);

      return response;
    } catch (error) {
      console.error('Error processing message:', error);
      return this.createErrorResponse(message, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Find or create user link
   */
  private async findOrCreateUserLink(message: GenericMessage) {
    // Try to find existing link
    let link = await this.userLinkRepository.findByChannelAndChannelUserId(
      message.channel,
      message.sender.id
    );

    if (!link) {
      // Create new link (in production, this would require user verification)
      link = await this.userLinkRepository.create({
        userId: `user-${message.sender.id}`, // In production, this would come from user-ms
        channel: message.channel,
        channelUserId: message.sender.id,
        channelPhone: message.sender.phone,
        channelEmail: message.sender.email,
        channelUsername: message.sender.username,
        isActive: true,
      });
    }

    return link;
  }

  /**
   * Fetch active credit cards from note-guard-ms
   */
  private async fetchActiveCards(userId: string): Promise<Array<{ id: string; name: string; type: string }>> {
    try {
      const response = await axios.get(`${NOTE_GUARD_MS_URL}/api/credit-cards/active`, {
        params: { userId },
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.data?.success && Array.isArray(response.data.data)) {
        return response.data.data.map((card: any) => ({
          id: card.id,
          name: card.name,
          type: card.type,
        }));
      }
      return [];
    } catch (error) {
      console.error(`❌ Failed to fetch active cards for user ${userId}:`, error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * Prepare message for LLM
   */
  private prepareLLMRequest(message: GenericMessage, userId: string, cards: Array<{ id: string; name: string; type: string }>): any {
    const text = message.content.text || '';
    const media = message.content.media || [];

    // If there's media, include the first item
    const mediaItem = media[0];
    const mediaBase64 = mediaItem?.base64;
    const mimeType = mediaItem?.mimeType;

    return {
      text,
      mediaBase64,
      mimeType,
      context: {
        userId,
        conversationId: userId,
        cards,
      },
    };
  }

  /**
   * Send request to LLM-ADP
   */
  private async sendToLLM(request: any): Promise<LLMResponse> {
    const response = await fetch(`${this.llmAdpUrl}/api/llm/interpret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`LLM-ADP error: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Process LLM response into generic response
   */
  private processLLMResponse(
    message: GenericMessage,
    llmResponse: LLMResponse,
    userId: string
  ): GenericResponse {
    return {
      channel: message.channel,
      recipient: message.sender,
      content: {
        text: llmResponse.response,
      },
      metadata: {
        inReplyTo: message.messageId,
        status: 'queued',
      },
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(message: GenericMessage, errorMessage: string): GenericResponse {
    return {
      channel: message.channel,
      recipient: message.sender,
      content: {
        text: `Desculpe, ocorreu um erro ao processar sua mensagem: ${errorMessage}`,
      },
      metadata: {
        inReplyTo: message.messageId,
        status: 'failed',
        error: errorMessage,
      },
    };
  }
}
