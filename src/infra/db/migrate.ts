import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { db } from './index';

// Realizar migrações
async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    process.exit(1);
  }
}

// Executar migrações se este arquivo for rodado diretamente
if (import.meta.main) {
  runMigrations();
}
