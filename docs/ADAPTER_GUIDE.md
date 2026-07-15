# Guia para Criação de Novos Adapters de Canal

Este documento descreve como criar novos adapters de canal para o sistema message-control genérico.

## Estrutura de um Adapter

Todo adapter deve implementar a interface `ChannelAdapter` definida em `src/interfaces/schemas/genericMessageSchema.ts`:

```typescript
export interface ChannelAdapter {
  processMessage(message: GenericMessage): Promise<GenericResponse>;
  sendMessage(response: GenericResponse): Promise<void>;
  validateMessage(message: GenericMessage): boolean;
}
```

## Passos para Criar um Novo Adapter

### 1. Criar o arquivo do adapter

Crie um novo arquivo em `src/app/adapters/` seguindo o padrão `{channel}Adapter.ts`. Por exemplo: `smsAdapter.ts`, `telegramAdapter.ts`, etc.

### 2. Implementar a classe

```typescript
import { GenericMessage, GenericResponse, ChannelAdapter } from '../../interfaces/schemas/genericMessageSchema';

export class SmsAdapter implements ChannelAdapter {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.SMS_API_URL || '';
    this.apiKey = process.env.SMS_API_KEY || '';
  }

  /**
   * Process a message from SMS
   */
  async processMessage(message: GenericMessage): Promise<GenericResponse> {
    // Process any SMS-specific logic here
    return {
      channel: 'sms',
      recipient: message.sender,
      content: message.content,
      metadata: {
        inReplyTo: message.messageId,
        status: 'queued',
      },
    };
  }

  /**
   * Send a response through SMS API
   */
  async sendMessage(response: GenericResponse): Promise<void> {
    // Implement SMS API call here
    const payload = {
      to: response.recipient.phone,
      message: response.content.text,
    };

    const apiResponse = await fetch(`${this.apiUrl}/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!apiResponse.ok) {
      throw new Error(`SMS API error: ${apiResponse.status}`);
    }
  }

  /**
   * Validate an SMS message
   */
  validateMessage(message: GenericMessage): boolean {
    if (!message.channel || message.channel !== 'sms') {
      return false;
    }

    if (!message.sender.phone) {
      return false;
    }

    if (!message.content.text) {
      return false;
    }

    return true;
  }

  /**
   * Transform SMS webhook payload to generic message
   */
  static fromWebhook(webhookPayload: any): GenericMessage {
    return {
      channel: 'sms',
      messageId: webhookPayload.messageId || 'unknown',
      timestamp: webhookPayload.timestamp || new Date().toISOString(),
      sender: {
        id: webhookPayload.from || 'unknown',
        phone: webhookPayload.from,
      },
      content: {
        text: webhookPayload.text,
      },
      metadata: {
        webhookPayload,
      },
    };
  }
}
```

### 3. Adicionar o tipo de canal ao schema

Atualize `src/interfaces/schemas/genericMessageSchema.ts` para incluir o novo tipo de canal:

```typescript
export const ChannelType = z.enum(['whatsapp', 'sms', 'rcs', 'telegram', 'your_channel']);
```

### 4. Registrar o adapter no serviço

No arquivo `src/index.ts` ou onde o `GenericChannelService` é inicializado, registre o novo adapter:

```typescript
import { SmsAdapter } from './app/adapters/smsAdapter';

const channelService = new GenericChannelService();
channelService.registerAdapter('sms', new SmsAdapter());
```

### 5. Adicionar variáveis de ambiente

Adicione as variáveis de ambiente necessárias ao `.env.example`:

```env
SMS_API_URL=https://api.sms-provider.com
SMS_API_KEY=your_api_key_here
```

### 6. Criar rota específica (opcional)

Se o canal tiver um formato de webhook específico, adicione uma rota em `src/interfaces/routes/genericMessageRoutes.ts`:

```typescript
.post('/sms/webhook', async ({ body }) => {
  const smsBody = body as any;
  const genericMessage = SmsAdapter.fromWebhook(smsBody);
  const response = await processMessageOperation.execute(genericMessage);
  return { success: true, data: response };
})
```

## Considerações Importantes

### Validação
- Sempre valide os campos obrigatórios do canal (ex: phone para SMS, email para email)
- Verifique se o conteúdo está presente (text ou media)

### Tratamento de Erros
- Implemente tratamento de erros robusto nas chamadas de API
- Logue erros para debug
- Retorne mensagens de erro apropriadas

### Mídia
- Se o canal suportar mídia, implemente o download/upload conforme necessário
- Converta mídia para base64 quando necessário para o LLM-ADP

### Rate Limiting
- Respeite os limites de rate limit da API do canal
- Implemente retry com backoff exponencial se necessário

### Webhooks
- Implemente verificação de assinatura de webhook se o canal fornecer
- Retorne resposta imediata (200 OK) para confirmar recebimento do webhook

## Exemplos de Adapters

- `whatsappAdapter.ts` - Adapter para WhatsApp Business API
- Consulte o arquivo existente como referência completa

## Testes

Teste seu adapter seguindo estes passos:

1. **Teste de validação**:
   ```bash
   curl -X POST http://localhost:port/api/messages/webhook \
     -H "Content-Type: application/json" \
     -d '{"channel":"sms","messageId":"test","timestamp":"2024-01-01T00:00:00Z","sender":{"id":"123","phone":"5511999999999"},"content":{"text":"Test message"}}'
   ```

2. **Teste de webhook específico**:
   ```bash
   curl -X POST http://localhost:port/api/messages/sms/webhook \
     -H "Content-Type: application/json" \
     -d '{"messageId":"test","timestamp":"2024-01-01T00:00:00Z","from":"5511999999999","text":"Test message"}'
   ```

3. **Teste de envio de resposta**:
   - Verifique se a API do canal é chamada corretamente
   - Verifique se a mensagem é entregue ao usuário final

## Suporte

Para dúvidas ou problemas, consulte a documentação do canal específico ou entre em contato com a equipe de desenvolvimento.
