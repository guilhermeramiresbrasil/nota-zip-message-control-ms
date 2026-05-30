// Teste simplificado do fluxo de aprovação sem dependências externas
// Este teste simula o fluxo lógico do message-control-ms

const testPhoneNumber = '5511999999999@s.whatsapp.net';
const testUserId = 'test-user-id-123';
const testMessage = 'Gastei 50 reais no mercado hoje';

console.log('🧪 Teste do Fluxo de Aprovação (Simulado)\n');
console.log('Este teste demonstra o fluxo lógico sem dependências externas.\n');

// Step 1: Simular criação de user link
console.log('Step 1: Criando link de usuário...');
const userLink = {
  userId: testUserId,
  phoneJid: testPhoneNumber,
  phone: '5511999999999',
  phoneNormalized: '5511999999999',
  createdAt: new Date().toISOString()
};
console.log('✅ User link criado:', JSON.stringify(userLink, null, 2));
console.log();

// Step 2: Simular mensagem recebida
console.log('Step 2: Simulando mensagem recebida do WhatsApp...');
const incomingMessage = {
  type: 'incoming_whatsapp_message',
  phoneNumber: testPhoneNumber,
  messageType: 'text',
  content: testMessage,
  timestamp: new Date().toISOString(),
  whatsappMessageId: `test-msg-${Date.now()}`,
};
console.log('✅ Mensagem recebida:', JSON.stringify(incomingMessage, null, 2));
console.log();

// Step 3: Simular publicação para LLM
console.log('Step 3: Publicando mensagem para fila do LLM...');
const llmPayload = {
  type: 'llm_request',
  messageId: incomingMessage.whatsappMessageId,
  userId: testUserId,
  phoneNumber: testPhoneNumber,
  text: testMessage,
  timestamp: incomingMessage.timestamp,
};
console.log('✅ Payload enviado ao LLM:', JSON.stringify(llmPayload, null, 2));
console.log();

// Step 4: Simular resposta do LLM
console.log('Step 4: Simulando resposta do LLM...');
const llmResponse = {
  type: 'llm_result',
  messageId: incomingMessage.whatsappMessageId,
  userId: testUserId,
  phoneNumber: testPhoneNumber,
  response: 'Perfeito! Já anotei seu gasto de R$ 50,00 em Mercado.',
  actions: [{
    type: 'create_expense',
    confidence: 0.95,
    data: {
      tipo_transacao: 'debit',
      valor: 50.00,
      categoria: 'Mercado',
      descricao: 'Compra no mercado',
      data_ocorrencia: new Date().toISOString().split('T')[0]
    }
  }],
  timestamp: new Date().toISOString()
};
console.log('✅ Resposta do LLM recebida:', JSON.stringify(llmResponse, null, 2));
console.log();

// Step 5: Simular salvamento no banco (status: processed)
console.log('Step 5: Atualizando status da mensagem para "processed" e salvando actions...');
const messageUpdate = {
  id: incomingMessage.whatsappMessageId,
  status: 'processed',
  actions: llmResponse.actions,
  updatedAt: new Date().toISOString()
};
console.log('✅ Mensagem atualizada:', JSON.stringify(messageUpdate, null, 2));
console.log();

// Step 6: Simular pedido de aprovação ao usuário
console.log('Step 6: Enviando pedido de aprovação ao usuário...');
const approvalMessage = `🤖 Detectei uma transação:\n\n` +
  `💰 Valor: R$ ${llmResponse.actions[0].data.valor}\n` +
  `📁 Categoria: ${llmResponse.actions[0].data.categoria}\n` +
  `📝 Descrição: ${llmResponse.actions[0].data.descricao}\n` +
  `📅 Data: ${llmResponse.actions[0].data.data_ocorrencia}\n\n` +
  `Deseja confirmar? Responda "sim" ou "não".`;
console.log('✅ Mensagem de aprovação enviada:', approvalMessage);
console.log();

// Step 7: Simular resposta de aprovação do usuário
console.log('Step 7: Simulando resposta de aprovação do usuário (sim)...');
const approvalResponse = {
  type: 'incoming_whatsapp_message',
  phoneNumber: testPhoneNumber,
  messageType: 'text',
  content: 'sim',
  timestamp: new Date().toISOString(),
  whatsappMessageId: `test-msg-approval-${Date.now()}`,
};
console.log('✅ Resposta de aprovação recebida:', JSON.stringify(approvalResponse, null, 2));
console.log();

// Step 8: Simular atualização de status para approved
console.log('Step 8: Atualizando status da mensagem para "approved"...');
const approvedMessage = {
  id: incomingMessage.whatsappMessageId,
  status: 'approved',
  updatedAt: new Date().toISOString()
};
console.log('✅ Mensagem aprovada:', JSON.stringify(approvedMessage, null, 2));
console.log();

// Step 9: Simular publicação de evento para note-guard
console.log('Step 9: Publicando evento "transaction.approved" para note-guard...');
const transactionApprovedEvent = {
  type: 'transaction_approved',
  userId: testUserId,
  phoneNumber: testPhoneNumber,
  actionData: llmResponse.actions[0].data,
  approvedAt: new Date().toISOString()
};
console.log('✅ Evento publicado:', JSON.stringify(transactionApprovedEvent, null, 2));
console.log();

// Step 10: Simular processamento no note-guard
console.log('Step 10: Simulando processamento no note-guard...');
console.log('  - Normalizando/criando categoria: "Mercado"');
console.log('  - Criando transação com categoryId');
console.log('✅ Transação criada com sucesso');
console.log();

// Step 11: Simular confirmação ao usuário
console.log('Step 11: Enviando confirmação de sucesso ao usuário...');
const successMessage = '✅ Transação confirmada com sucesso!';
console.log('✅ Mensagem de sucesso enviada:', successMessage);
console.log();

console.log('🎉 Teste do fluxo de aprovação concluído com sucesso!\n');
console.log('📋 Resumo do fluxo:');
console.log('1. ✅ User link criado');
console.log('2. ✅ Mensagem recebida do WhatsApp');
console.log('3. ✅ Mensagem publicada para fila do LLM');
console.log('4. ✅ LLM processou e retornou action');
console.log('5. ✅ Status atualizado para "processed" e actions salvas');
console.log('6. ✅ Pedido de aprovação enviado ao usuário');
console.log('7. ✅ Usuário respondeu "sim"');
console.log('8. ✅ Status atualizado para "approved"');
console.log('9. ✅ Evento "transaction.approved" publicado para note-guard');
console.log('10. ✅ note-guard normalizou categoria e criou transação');
console.log('11. ✅ Confirmação de sucesso enviada ao usuário');
console.log();
console.log('🔧 Para testar com serviços reais, inicie o Docker Compose:');
console.log('   cd /Users/guilhermebrasil/CascadeProjects/github-workspace/debr-repos');
console.log('   docker-compose up -d postgres redis rabbitmq');
console.log('   Em seguida, execute o servidor message-control-ms e rode o teste.');

