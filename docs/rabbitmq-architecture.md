# Arquitetura RabbitMQ

## Visão Geral

RabbitMQ 3.13 é usado como message broker para comunicação assíncrona entre microserviços, substituindo chamadas HTTP síncronas e persistência local.

## Diagrama de Fluxo

```
┌──────────────┐    publish     ┌──────────────┐    consume     ┌─────────────────────┐
│ whatsapp-adp │──────────────→ │   RabbitMQ   │──────────────→ │ message-control-ms  │
│ (stateless)  │                │              │                │ (PostgreSQL)        │
└──────────────┘                │              │                └─────────┬───────────┘
                                │              │                          │
                                │              │    route by type         │
                                │              │                    ┌─────┴─────┐
                                │              │    consume         │           │
                                │              │◄──────────────    image      text
                                │              │                    │           │
                                │              │    consume    ┌────▼────┐ ┌────▼────┐
                                │              │──────────────→│ ocr-adp │ │ llm-adp │
                                │              │               └────┬────┘ └────┬────┘
                                │              │    publish         │           │
                                │              │◄──────────────────┘           │
                                │              │◄──────────────────────────────┘
                                └──────────────┘
```

## Exchanges

| Exchange | Tipo | Descrição |
|---|---|---|
| `whatsapp.events` | topic | Eventos do WhatsApp (webhook recebidos) |
| `message.processing` | topic | Roteamento de mensagens para processamento |
| `ocr.events` | topic | Resultados de processamento OCR |
| `llm.events` | topic | Resultados de processamento LLM |

## Filas

| Fila | Exchange | Routing Key | Consumidor |
|---|---|---|---|
| `whatsapp.incoming` | whatsapp.events | whatsapp.# | message-control-ms |
| `message.control` | message.processing | control | message-control-ms |
| `ocr.processing` | message.processing | ocr.# | ocr-adp |
| `llm.processing` | message.processing | llm.# | llm-adp |

## Formato de Mensagens

### Mensagem Incoming (whatsapp-adp → message-control-ms)

```json
{
  "type": "incoming_message",
  "phoneNumber": "+5511999999999",
  "messageId": "uuid",
  "whatsappMessageId": "wamid.xxx",
  "direction": "incoming",
  "messageType": "text|image|audio|video|document",
  "content": "conteúdo da mensagem",
  "metadata": {},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Status Update (whatsapp-adp → message-control-ms)

```json
{
  "type": "status_update",
  "whatsappMessageId": "wamid.xxx",
  "status": "sent|delivered|read",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### OCR Result (ocr-adp → message-control-ms)

```json
{
  "type": "ocr_result",
  "messageId": "uuid",
  "conversationId": "uuid",
  "extractedText": "texto extraído",
  "confidence": 85.5,
  "status": "success|low_confidence",
  "processedAt": "2024-01-01T00:00:00.000Z"
}
```

### LLM Result (llm-adp → message-control-ms)

```json
{
  "type": "llm_result",
  "messageId": "uuid",
  "conversationId": "uuid",
  "response": "resposta do LLM",
  "actions": [],
  "status": "success",
  "processedAt": "2024-01-01T00:00:00.000Z"
}
```

## Configuração

### Docker Compose

```yaml
services:
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: nota_zip
      RABBITMQ_DEFAULT_PASS: changeme
      RABBITMQ_DEFAULT_VHOST: nota_zip
    ports:
      - "5672:5672"   # AMQP
      - "15672:15672" # Management UI
```

### Variável de Ambiente

```bash
RABBITMQ_URL=amqp://nota_zip:changeme@localhost:5672/nota_zip
```

### Management UI

Acessível em http://localhost:15672 (usuário: nota_zip, senha: changeme).

## Padrões de Implementação

### Retry com Reconexão

Todos os serviços implementam retry automático na conexão RabbitMQ:

```typescript
const initializeRabbitMQ = async () => {
  try {
    rabbitMQService = new RabbitMQService();
    await rabbitMQService.connect();
    const consumer = new RabbitMQConsumer(rabbitMQService);
    await consumer.start();
  } catch (error) {
    setTimeout(initializeRabbitMQ, 5000);
  }
};
```

### Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  await rabbitMQService?.close();
  process.exit(0);
});
```
