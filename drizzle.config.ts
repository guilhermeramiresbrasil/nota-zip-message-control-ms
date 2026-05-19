import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/infra/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://nota_zip:changeme@localhost:5432/nota_zip',
  },
  schemaFilter: ['message_control_ms'],
});
