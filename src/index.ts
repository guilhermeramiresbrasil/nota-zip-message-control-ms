import { Elysia } from 'elysia';
import { messageRoutes } from './interfaces/routes/messageRoutes';
import { initializeDatabase, closeDatabase } from './infra/db';
import { RabbitMQService } from './app/services/rabbitmqService';
import { RabbitMQConsumer } from './app/services/rabbitmqConsumer';

let rabbitMQService: RabbitMQService | null = null;

async function startServer() {
  await initializeDatabase();

  rabbitMQService = new RabbitMQService();
  try {
    await rabbitMQService.connect();
    const consumer = new RabbitMQConsumer(rabbitMQService);
    await consumer.start();
  } catch (error) {
    console.warn('RabbitMQ not available, running without message queue:', error);
  }

  const app = new Elysia()
    .use(messageRoutes)
    .listen(3007);

  console.log('Message Control MS running on 0.0.0.0:3007');
  console.log('Webhook endpoint: http://0.0.0.0:3007/api/messages/webhook');
  console.log('Health check: http://0.0.0.0:3007/api/messages/health');
  console.log('Database: PostgreSQL (message_control_ms schema)');
}

process.on('SIGTERM', async () => {
  await rabbitMQService?.close();
  await closeDatabase();
  process.exit(0);
});

startServer().catch(console.error);
