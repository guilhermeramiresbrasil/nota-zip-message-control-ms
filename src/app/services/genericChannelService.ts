import { GenericMessage, GenericResponse, ChannelType, ChannelAdapter } from '../../interfaces/schemas/genericMessageSchema';

export class GenericChannelService {
  private adapters: Map<ChannelType, ChannelAdapter>;

  constructor() {
    this.adapters = new Map();
  }

  /**
   * Register a channel adapter
   */
  registerAdapter(channel: ChannelType, adapter: ChannelAdapter): void {
    this.adapters.set(channel, adapter);
  }

  /**
   * Process a message from any channel
   */
  async processMessage(message: GenericMessage): Promise<GenericResponse> {
    const adapter = this.adapters.get(message.channel);
    
    if (!adapter) {
      throw new Error(`No adapter registered for channel: ${message.channel}`);
    }

    // Validate message
    if (!adapter.validateMessage(message)) {
      throw new Error(`Invalid message for channel: ${message.channel}`);
    }

    // Process message
    return await adapter.processMessage(message);
  }

  /**
   * Send a response through the appropriate channel
   */
  async sendMessage(response: GenericResponse): Promise<void> {
    const adapter = this.adapters.get(response.channel);
    
    if (!adapter) {
      throw new Error(`No adapter registered for channel: ${response.channel}`);
    }

    await adapter.sendMessage(response);
  }

  /**
   * Get registered channels
   */
  getRegisteredChannels(): ChannelType[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if a channel is registered
   */
  hasAdapter(channel: ChannelType): boolean {
    return this.adapters.has(channel);
  }
}
