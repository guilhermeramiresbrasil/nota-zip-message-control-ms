import { Elysia } from 'elysia';
import { initLogger } from './infra/logging/loggerClient';
import { messageRoutes } from './interfaces/routes/messageRoutes';
import { initializeDatabase, closeDatabase } from './infra/db';
import { RabbitMQService } from './app/services/rabbitmqService';
import { RabbitMQConsumer } from './app/services/rabbitmqConsumer';

// Initialize logger
const logger = initLogger({
  serviceName: 'message-control-ms',
  adminAdpUrl: process.env.ADMIN_ADP_URL || 'http://localhost:3017',
  enabled: process.env.NODE_ENV !== 'test',
});

logger.info('Message-Control-MS service starting');

let rabbitMQService: RabbitMQService | null = null;

async function startServer() {
  await initializeDatabase();
  logger.info('Database initialized');

  const app = new Elysia()
    .use(messageRoutes())
    .listen(3007);

  logger.success('Message Control MS running on 0.0.0.0:3007');
  logger.info('Webhook endpoint: http://0.0.0.0:3007/api/messages/webhook');
  logger.info('Health check: http://0.0.0.0:3007/api/messages/health');
  logger.info('Database: PostgreSQL (message_control_ms schema)');

  // Initialize RabbitMQ after server starts (non-blocking)
  rabbitMQService = new RabbitMQService();
  try {
    await rabbitMQService.connect();
    const consumer = new RabbitMQConsumer(rabbitMQService);
    await consumer.start();
    logger.info('RabbitMQ consumer started');
  } catch (error) {
    logger.warning('RabbitMQ not available, running without message queue', { error: (error as Error).message });
  }
}

process.on('SIGTERM', async () => {
  await rabbitMQService?.close();
  await closeDatabase();
  process.exit(0);
});

startServer().catch(console.error);
