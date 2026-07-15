import { ChannelType } from '../../interfaces/schemas/genericMessageSchema';

export interface UserLink {
  id: string;
  userId: string;
  channel: ChannelType;
  channelUserId: string;
  channelPhone?: string;
  channelEmail?: string;
  channelUsername?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class GenericUserLinkRepository {
  private links: Map<string, UserLink> = new Map();

  /**
   * Create a new user link
   */
  async create(link: Omit<UserLink, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserLink> {
    const newLink: UserLink = {
      id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...link,
    };

    this.links.set(newLink.id, newLink);
    return newLink;
  }

  /**
   * Find a link by ID
   */
  async findById(id: string): Promise<UserLink | null> {
    return this.links.get(id) || null;
  }

  /**
   * Find links by user ID
   */
  async findByUserId(userId: string): Promise<UserLink[]> {
    return Array.from(this.links.values()).filter(link => link.userId === userId);
  }

  /**
   * Find a link by channel and channel user ID
   */
  async findByChannelAndChannelUserId(
    channel: ChannelType,
    channelUserId: string
  ): Promise<UserLink | null> {
    return Array.from(this.links.values()).find(
      link => link.channel === channel && link.channelUserId === channelUserId
    ) || null;
  }

  /**
   * Update a link
   */
  async update(id: string, updates: Partial<Omit<UserLink, 'id' | 'createdAt'>>): Promise<UserLink | null> {
    const link = this.links.get(id);
    
    if (!link) {
      return null;
    }

    const updatedLink: UserLink = {
      ...link,
      ...updates,
      updatedAt: new Date(),
    };

    this.links.set(id, updatedLink);
    return updatedLink;
  }

  /**
   * Delete a link
   */
  async delete(id: string): Promise<boolean> {
    return this.links.delete(id);
  }

  /**
   * Activate or deactivate a link
   */
  async setActive(id: string, isActive: boolean): Promise<UserLink | null> {
    return this.update(id, { isActive });
  }

  /**
   * Get all active links for a channel
   */
  async findActiveByChannel(channel: ChannelType): Promise<UserLink[]> {
    return Array.from(this.links.values()).filter(
      link => link.channel === channel && link.isActive
    );
  }
}
