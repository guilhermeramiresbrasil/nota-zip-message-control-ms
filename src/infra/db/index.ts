import Database from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

// Criar banco de dados
const sqlite = new Database('message-control.db');
export const db = drizzle(sqlite, { schema });

// Exportar schemas
export * from './schema';
