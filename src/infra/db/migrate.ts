import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './index';

async function runMigrations() {
  try {
    console.log('Running database migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Database migrations completed');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

if ((import.meta as any).main) {
  runMigrations();
}
