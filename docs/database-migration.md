# Migração de Banco de Dados - SQLite para PostgreSQL

## Visão Geral

Todos os microserviços foram migrados de SQLite (bun:sqlite / better-sqlite3) para PostgreSQL 16 com schemas isolados.

## Arquitetura de Schemas

```
PostgreSQL (nota_zip database)
├── auth_ms          → auth-ms (Lucia Auth)
├── user_ms          → user-ms (gestão de usuários)
├── message_control_ms → message-control-ms (mensagens e conversas)
└── note_guard_ms    → note-guard-ms (notas e gastos)
```

## Configuração

### Docker Compose

PostgreSQL roda via Docker Compose com volume persistente:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: nota_zip
      POSTGRES_USER: nota_zip
      POSTGRES_PASSWORD: changeme
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-schemas.sql:/docker-entrypoint-initdb.d/init-schemas.sql
```

### Variável de Ambiente

```bash
DATABASE_URL=postgresql://nota_zip:changeme@localhost:5432/nota_zip
```

### Script de Inicialização (init-schemas.sql)

```sql
CREATE SCHEMA IF NOT EXISTS auth_ms;
CREATE SCHEMA IF NOT EXISTS user_ms;
CREATE SCHEMA IF NOT EXISTS message_control_ms;
CREATE SCHEMA IF NOT EXISTS note_guard_ms;
GRANT ALL ON SCHEMA auth_ms TO nota_zip;
GRANT ALL ON SCHEMA user_ms TO nota_zip;
GRANT ALL ON SCHEMA message_control_ms TO nota_zip;
GRANT ALL ON SCHEMA note_guard_ms TO nota_zip;
```

## Mudanças por Serviço

### auth-ms (schema: auth_ms)
- **Tabelas**: users, sessions, keys, trusted_devices, email_verification_codes, whatsapp_verification_codes, auth_attempts
- **ORM**: Drizzle com pgSchema('auth_ms')
- **Adapter**: @lucia-auth/adapter-drizzle (DrizzlePostgreSQLAdapter)

### user-ms (schema: user_ms)
- **Tabelas**: users, user_profiles, user_roles, roles, user_sessions, password_reset_tokens, email_verification_tokens
- **ORM**: Drizzle com pgSchema('user_ms')

### message-control-ms (schema: message_control_ms)
- **Tabelas**: conversations, messages, auto_replies, processing_events, webhook_events
- **ORM**: Drizzle com pgSchema('message_control_ms')
- **Novos campos**: workerId, identityVerificationStatus, metadata (conversations); sentAt, deliveredAt, readAt, retryCount, lastRetryAt, error (messages)

### note-guard-ms (schema: note_guard_ms)
- **Tabelas**: expenses, categories, notes
- **ORM**: Drizzle com pgSchema('note_guard_ms')

## Comandos de Migração

Cada serviço possui scripts no package.json:

```bash
bun run db:generate   # Gerar migrações
bun run db:migrate    # Aplicar migrações
bun run db:studio     # Abrir Drizzle Studio
```

## Mudanças Técnicas

| De (SQLite) | Para (PostgreSQL) |
|---|---|
| `sqliteTable` | `pgSchema('schema').table` |
| `integer('col', { mode: 'boolean' })` | `boolean('col')` |
| `integer('col', { mode: 'timestamp' })` | `timestamp('col')` |
| `text('col')` (JSON) | `jsonb('col')` |
| `integer('id').primaryKey({ autoIncrement: true })` | `serial('id').primaryKey()` |
| `bun:sqlite` / `better-sqlite3` | `pg` (node-postgres Pool) |
