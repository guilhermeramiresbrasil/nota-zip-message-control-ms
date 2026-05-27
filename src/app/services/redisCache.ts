import Redis from 'ioredis';

export class redisCache {
  private client: Redis;
  private readonly MESSAGE_TTL = 10800; // 3 horas em segundos

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = new Redis(redisUrl);
    this.client.on('error', (err) => console.error('Redis error:', err));
    this.client.on('connect', () => console.log('✅ Redis connected'));
  }

  async saveMessage(userId: string, message: {
    direction: 'in' | 'out';
    content: string;
    timestamp: Date;
  }): Promise<void> {
    const key = `messages:${userId}:${Date.now()}`;
    await this.client.setex(key, this.MESSAGE_TTL, JSON.stringify(message));
  }

  async getRecentMessages(userId: string, limit: number = 50): Promise<any[]> {
    const pattern = `messages:${userId}:*`;
    const keys = await this.client.keys(pattern);
    
    if (keys.length === 0) return [];

    const messages = await Promise.all(
      keys.map(async (key) => {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
      })
    );

    return messages
      .filter(m => m !== null)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-limit);
  }

  async incrementMessageCount(userId: string): Promise<number> {
    const date = new Date().toISOString().split('T')[0];
    const key = `messages:daily:${userId}:${date}`;
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, 86400);
    }
    return count;
  }

  async getMessageCount(userId: string): Promise<number> {
    const date = new Date().toISOString().split('T')[0];
    const key = `messages:daily:${userId}:${date}`;
    const count = await this.client.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  async clearOldMessages(userId: string): Promise<void> {
    const pattern = `messages:${userId}:*`;
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}
