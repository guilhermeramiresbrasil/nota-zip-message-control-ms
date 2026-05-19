import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://nota_zip:changeme@localhost:5432/nota_zip',
});

export const db = drizzle(pool, { schema });

export async function initializeDatabase(): Promise<void> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('Message Control MS database connected (PostgreSQL)');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export * from './schema';
