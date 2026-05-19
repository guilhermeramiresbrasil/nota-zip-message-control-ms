# Nota Zip Message Control MS

Serviço de controle de mensagens do Nota Zip, responsável por gerenciar filas e processamento de mensagens.

## Tech Stack

- Bun
- Elysia

## Features

- Gerenciamento de filas
- Processamento de mensagens assíncrono
- Integração com outros microserviços

## Environment Variables

- `REDIS_URL`: URL do Redis (se usar para filas)

## Running Locally

```bash
bun install
bun run dev
```

## Docker

```bash
docker build -t nota-zip-message-control-ms .
docker run -p 3006:3006 nota-zip-message-control-ms
```

## License

MIT
