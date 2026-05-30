# Nota Zip Message Control MS

Serviço de controle de mensagens do Nota Zip, responsável por gerenciar filas e processamento de mensagens via RabbitMQ.

## Tech Stack

- Bun
- Elysia
- PostgreSQL
- Drizzle ORM
- RabbitMQ
- Redis

## Features

- Gerenciamento de filas RabbitMQ
- Processamento de mensagens assíncrono
- Integração com WhatsApp Adapter
- Integração com Auth MS e User MS
- Cache com Redis

## Environment Variables

- `MESSAGE_CONTROL_PORT`: Porta do serviço (default: 3007)
- `MESSAGE_CONTROL_HOST`: Host do serviço (default: 0.0.0.0)
- `DATABASE_URL`: URL do PostgreSQL
- `RABBITMQ_URL`: URL do RabbitMQ
- `REDIS_URL`: URL do Redis
- `WHATSAPP_API_URL`: URL do WhatsApp Adapter
- `AUTH_MS_URL`: URL do Auth MS
- `USER_MS_URL`: URL do User MS

## Running Locally

```bash
bun install
bun run dev
```

## Docker

```bash
docker build -t nota-zip-message-control-ms .
docker run -p 3007:3007 nota-zip-message-control-ms
```

## API Endpoints

- `GET /api/messages/health` - Health check
- `POST /api/messages` - Criar mensagem
- `GET /api/messages/:id` - Obter mensagem por ID

## License

MIT
