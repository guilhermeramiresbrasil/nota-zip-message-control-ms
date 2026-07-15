import { GenericMessage, GenericResponse, ChannelAdapter } from '../../interfaces/schemas/genericMessageSchema';

export class WhatsAppAdapter implements ChannelAdapter {
  private whatsappApiUrl: string;
  private accessToken: string;

  constructor() {
    this.whatsappApiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
  }

  /**
   * Process a WhatsApp webhook message
   */
  async processMessage(message: GenericMessage): Promise<GenericResponse> {
    // The message is already in generic format
    // This method would handle any WhatsApp-specific processing if needed
    return {
      channel: 'whatsapp',
      recipient: message.sender,
      content: message.content,
      metadata: {
        inReplyTo: message.messageId,
        status: 'queued',
      },
    };
  }

  /**
   * Send a response through WhatsApp API
   */
  async sendMessage(response: GenericResponse): Promise<void> {
    if (!this.accessToken) {
      console.warn('WhatsApp access token not configured, skipping send');
      return;
    }

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!phoneNumberId) {
      console.warn('WhatsApp phone number ID not configured, skipping send');
      return;
    }

    try {
      const payload: any = {
        messaging_product: 'whatsapp',
        to: response.recipient.phone || response.recipient.id,
        type: 'text',
        text: {
          body: response.content.text || '',
        },
      };

      const apiResponse = await fetch(
        `${this.whatsappApiUrl}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!apiResponse.ok) {
        const error = await apiResponse.text();
        console.error('WhatsApp API error:', error);
        throw new Error(`WhatsApp API error: ${apiResponse.status}`);
      }

      console.log('WhatsApp message sent successfully');
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Validate a WhatsApp message
   */
  validateMessage(message: GenericMessage): boolean {
    // Check required fields
    if (!message.channel || message.channel !== 'whatsapp') {
      return false;
    }

    if (!message.sender.id) {
      return false;
    }

    if (!message.messageId) {
      return false;
    }

    // Check if content has either text or media
    if (!message.content.text && !message.content.media) {
      return false;
    }

    return true;
  }

  /**
   * Transform WhatsApp webhook payload to generic message
   */
  static fromWebhook(webhookPayload: any): GenericMessage {
    const entry = webhookPayload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    return {
      channel: 'whatsapp',
      messageId: message?.id || 'unknown',
      timestamp: message?.timestamp || new Date().toISOString(),
      sender: {
        id: message?.from || 'unknown',
        phone: message?.from,
      },
      content: {
        text: message?.text?.body,
        media: message?.image ? [{
          type: 'image',
          mimeType: 'image/jpeg',
          url: message.image?.id,
        }] : undefined,
      },
      metadata: {
        webhookPayload,
      },
    };
  }
}
