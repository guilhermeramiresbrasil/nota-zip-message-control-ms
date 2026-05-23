import amqplib, { type Connection, type Channel, type ConsumeMessage } from 'amqplib';

export interface RabbitMQConfig {
  url: string;
  exchanges: Record<string, string>;
  queues: Record<string, { name: string; exchange: string; routingKey: string }>;
}

const defaultConfig: RabbitMQConfig = {
  url: process.env.RABBITMQ_URL || 'amqp://nota_zip:changeme@localhost:5672/nota_zip',
  exchanges: {
    whatsappEvents: 'whatsapp.events',
    messageProcessing: 'message.processing',
    ocrEvents: 'ocr.events',
    llmEvents: 'llm.events',
  },
  queues: {
    whatsappIncoming: {
      name: 'whatsapp.incoming',
      exchange: 'whatsapp.events',
      routingKey: 'incoming',
    },
    messageControl: {
      name: 'message.control',
      exchange: 'message.processing',
      routingKey: 'control',
    },
    ocrProcessing: {
      name: 'ocr.processing',
      exchange: 'ocr.events',
      routingKey: 'process',
    },
    llmProcessing: {
      name: 'llm.processing',
      exchange: 'llm.events',
      routingKey: 'process',
    },
    llmResults: {
      name: 'llm.results',
      exchange: 'llm.events',
      routingKey: 'llm.result',
    },
  },
};

export class RabbitMQService {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private config: RabbitMQConfig;

  constructor(config?: Partial<RabbitMQConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqplib.connect(this.config.url);
      this.channel = await this.connection.createChannel();

      await this.channel.prefetch(1);

      for (const exchangeName of Object.values(this.config.exchanges)) {
        await this.channel.assertExchange(exchangeName, 'topic', { durable: true });
      }

      for (const queue of Object.values(this.config.queues)) {
        await this.channel.assertQueue(queue.name, { durable: true });
        await this.channel.bindQueue(queue.name, queue.exchange, queue.routingKey);
      }

      this.connection.on('error', (err) => {
        console.error('RabbitMQ connection error:', err);
      });

      this.connection.on('close', () => {
        console.warn('RabbitMQ connection closed, attempting reconnect...');
        setTimeout(() => this.connect(), 5000);
      });

      console.log('RabbitMQ connected successfully');
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async publish(exchange: string, routingKey: string, message: object): Promise<boolean> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    const buffer = Buffer.from(JSON.stringify(message));
    return this.channel.publish(exchange, routingKey, buffer, {
      persistent: true,
      contentType: 'application/json',
      timestamp: Date.now(),
    });
  }

  async consume(
    queueName: string,
    handler: (msg: ConsumeMessage) => Promise<void>
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    await this.channel.consume(queueName, async (msg) => {
      if (!msg) return;

      try {
        await handler(msg);
        this.channel?.ack(msg);
      } catch (error) {
        console.error(`Error processing message from ${queueName}:`, error);
        this.channel?.nack(msg, false, true);
      }
    });

    console.log(`Consuming messages from queue: ${queueName}`);
  }

  async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
      console.log('RabbitMQ connection closed');
    } catch (error) {
      console.error('Error closing RabbitMQ:', error);
    }
  }

  getChannel(): Channel | null {
    return this.channel;
  }
}
