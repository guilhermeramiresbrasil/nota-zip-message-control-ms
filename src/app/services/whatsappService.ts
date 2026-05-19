import axios from 'axios';

export class whatsappService {
  private readonly whatsappApiUrl: string;

  constructor() {
    this.whatsappApiUrl = process.env.WHATSAPP_API_URL || 'http://localhost:3006';
  }

  async sendMessage(phoneNumber: string, message: string): Promise<void> {
    try {
      await axios.post(`${this.whatsappApiUrl}/api/whatsapp/send`, {
        phoneNumber,
        message,
        type: 'text'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Source-Service': 'message-control-ms'
        }
      });

      console.log('✅ Message Control MS - Webhook recebido e enfileirado para processamento');

    } catch (error) {
      console.error('❌ Erro ao enviar mensagem para WhatsApp API:', error);
      throw error;
    }
  }

  createReplyMessage(receivedMessage: string, contact: any): string {
    const userName = contact?.profile?.name || '';
    const message = receivedMessage.toLowerCase();

    // Respostas personalizadas
    if (message.includes('guilherme') && userName.includes('Guilherme')) {
      return `👋 Olá ${userName}! Seja bem-vindo à Braza Gateway!

🚀 *Serviços disponíveis:*
• Autenticação segura com 2FA/MFA
• Microserviços integrados
• API Gateway robusto
• Verificação de identidade

📱 *Como posso ajudar?*
• Responda "AJUDA" para ver os comandos
• Responda "VERIFICAR" para iniciar verificação
• Responda "SUPORTE" para falar com nossa equipe

⏰ *Horário de atendimento:* 24/7
🔒 *Segurança:* Nível bancário`;

    } else if (message.includes('oi') || message.includes('olá')) {
      return `👋 Olá${userName ? `, ${userName}` : ''}! Seja bem-vindo à Braza Gateway!

🔐 *Nossa plataforma oferece:*
• Autenticação segura
• Microserviços integrados
• API Gateway robusto

📝 *Como posso ajudar hoje?*
Digite "AJUDA" para ver todos os comandos disponíveis.`;

    } else if (message === 'ajuda') {
      return `📚 *Menu de Ajuda - Braza Gateway*

🔐 *Comandos de Verificação:*
• "VERIFICAR" - Inicia verificação de identidade
• "STATUS" - Verifica seu status de verificação
• "CANCELAR" - Cancela verificação em andamento

📞 *Suporte:*
• "SUPORTE" - Fale com nossa equipe
• "PROBLEMA" - Reporte uma issue

💼 *Serviços:*
• "API" - Informações sobre nossa API
• "WEBHOOK" - Status dos webhooks
• "SEGURANÇA" - Políticas de segurança

🆘 *Precisa de ajuda humana?*
Responda "HUMANO" para falar com um atendente.`;

    } else if (message === 'humano') {
      return `👨‍💼 *Atendimento Humano*

Olá${userName ? `, ${userName}` : ''}! Um de nossos atendentes irá falar com você em breve.

⏱️ *Tempo médio de espera:* 2-3 minutos
📞 *Canal de atendimento:* WhatsApp
🕐 *Horário:* 24/7

Por favor, descreva sua necessidade e aguarde um momento.`;

    } else {
      // Resposta padrão
      return `🤖 *Braza Gateway - Assistente Virtual*

Olá${userName ? `, ${userName}` : ''}! Recebi sua mensagem: "${receivedMessage}"

📋 *Comandos disponíveis:*
• "AJUDA" - Ver menu completo
• "VERIFICAR" - Iniciar verificação
• "SUPORTE" - Falar com equipe
• "HUMANO" - Falar com atendente

🔒 *Sua segurança é nossa prioridade!*

Digite "AJUDA" para explorar todas as funcionalidades.`;
    }
  }

  createReplyForOCRText(extractedText: string, confidence: number, status: string): string {
    const confidencePercent = Math.round(confidence);
    const text = extractedText.trim();
    
    if (status === 'error' || confidencePercent < 30) {
      return `❌ *OCR Falhou*\n\nNão consegui ler o texto da imagem. Tente enviar uma imagem mais clara ou com texto maior.`;
    }

    if (confidencePercent < 60) {
      return `⚠️ *OCR Baixa Confiança*\n\nConsegui ler o texto, mas com baixa confiança (${confidencePercent}%):\n\n"${text.substring(0, 200)}..."\n\nO texto pode estar impreciso. Poderia enviar uma imagem mais clara?`;
    }

    // Resposta baseada no conteúdo do texto extraído
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('guilherme')) {
      return `👋 *Texto Extraído da Imagem*\n\n"${text}"\n\n🔍 *Confiança:* ${confidencePercent}%\n\nOlá! Vi que você mencionou "Guilherme" na imagem. Como posso ajudar?`;
    }

    if (lowerText.includes('ajuda') || lowerText.includes('help')) {
      return `📚 *Texto Extraído da Imagem*\n\n"${text}"\n\n🔍 *Confiança:* ${confidencePercent}%\n\nVi que você precisa de ajuda! Digite "AJUDA" para ver os comandos disponíveis.`;
    }

    if (lowerText.includes('oi') || lowerText.includes('olá')) {
      return `👋 *Texto Extraído da Imagem*\n\n"${text}"\n\n🔍 *Confiança:* ${confidencePercent}%\n\nOlá! Recebi sua mensagem. Como posso ajudar hoje?`;
    }

    // Resposta padrão para outros textos
    return `📝 *Texto Extraído da Imagem*\n\n"${text}"\n\n🔍 *Confiança:* ${confidencePercent}%\n\nRecebi sua mensagem! Como posso ajudar com isso?`;
  }
}
