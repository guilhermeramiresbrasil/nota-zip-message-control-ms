import { Elysia } from 'elysia';
import { messageRoutes } from './interfaces/routes/messageRoutes';
import Database from 'bun:sqlite';

// Inicializar banco de dados
async function initializeDatabase() {
  try {
    console.log('🔄 Initializing Message Control MS database...');
    
    // Criar tabelas usando SQL bruto
    const sqlite = new Database('message-control.db');
    
    await sqlite.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        phone_number TEXT NOT NULL,
        user_id TEXT,
        user_name TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        last_message_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    await sqlite.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        whatsapp_message_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    await sqlite.exec(`
      CREATE TABLE IF NOT EXISTS processing_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        event_data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        error_message TEXT,
        created_at INTEGER NOT NULL,
        processed_at INTEGER
      )
    `);

    console.log('✅ Message Control MS database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

// Inicializar e iniciar servidor
async function startServer() {
  await initializeDatabase();
  
  const app = new Elysia()
    .use(messageRoutes)
    .listen(3007);

  console.log('🚀 Message Control MS running on 0.0.0.0:3007');
  console.log('📱 Webhook endpoint: http://0.0.0.0:3007/api/messages/webhook');
  console.log('📊 Health check: http://0.0.0.0:3007/api/messages/health');
  console.log('💾 Database: SQLite (message-control.db)');
}

startServer().catch(console.error);
