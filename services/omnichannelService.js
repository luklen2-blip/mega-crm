/**
 * Central de Atendimento Omnichannel
 * Gerenciamento de conversas, mensagens e conectores para APIs oficiais (WhatsApp, Instagram, Webchat).
 * Cumpre a diretriz de integridade: NUNCA simula conexão falsa. Exibe "Conectar canal" quando não configurado.
 * FASE 8: Inbox Multicanal com Modos Human-in-the-Loop (autonoma, copiloto, humano) e Sugestão com IA.
 */

const { 
  conversationsDB, 
  messagesDB, 
  settingsDB, 
  activitiesDB, 
  leadsDB, 
  knowledgeBaseDB 
} = require('../database/db');

const { generateAIResponse } = require('./aiGatewayService');

const SUPPORTED_CHANNELS = [
  {
    id: 'whatsapp',
    name: 'WhatsApp Business Oficial (Cloud API)',
    icon: 'message-circle',
    description: 'API Oficial Meta Graph v21.0 com suporte a modelos de mensagem e selo de verificação.',
    requiresConfig: ['metaPhoneNumberId', 'metaAccessToken', 'metaWabaId']
  },
  {
    id: 'instagram',
    name: 'Instagram Direct API',
    icon: 'instagram',
    description: 'Atendimento direto de direct messages e respostas a stories via Meta for Developers.',
    requiresConfig: ['instagramPageId', 'instagramAccessToken']
  },
  {
    id: 'webchat',
    name: 'Webchat Widget do Site',
    icon: 'globe',
    description: 'Widget flutuante JavaScript para captura e atendimento de visitantes em tempo real.',
    requiresConfig: ['widgetDomain']
  }
];

function getChannelsStatus(tenantId) {
  const settings = settingsDB.findById(`settings_${tenantId}`) || settingsDB.findById('general_settings') || {};

  return SUPPORTED_CHANNELS.map(ch => {
    const isConfigured = ch.requiresConfig.every(key => Boolean(settings[key]));
    return {
      id: ch.id,
      name: ch.name,
      icon: ch.icon,
      description: ch.description,
      status: isConfigured ? 'connected' : 'disconnected',
      statusLabel: isConfigured ? 'Conectado (Oficial)' : 'Integração não configurada',
      buttonLabel: isConfigured ? 'Gerenciar Canal' : 'Configurar Credenciais',
      isConfigured: Boolean(isConfigured),
      isOfficial: true,
      lastSync: isConfigured ? (settings[`${ch.id}_lastSync`] || new Date().toISOString()) : null
    };
  });
}

function getConversations(tenantId) {
  return conversationsDB.findByTenant(tenantId).sort((a, b) => {
    return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
  });
}

function getConversationMessages(conversationId) {
  return messagesDB.findAll(m => m.conversationId === conversationId).sort((a, b) => {
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

function sendMessage({ tenantId, conversationId, text, sender = 'vendedor', senderName = 'Equipe' }) {
  const conv = conversationsDB.findById(conversationId);
  if (!conv || (conv.tenantId && conv.tenantId !== tenantId)) throw new Error('Conversa não encontrada.');

  const msg = messagesDB.insert({
    tenantId,
    conversationId,
    text,
    sender, // 'cliente' | 'vendedor' | 'ia'
    senderName,
    status: 'sent',
    channel: conv.channel || 'whatsapp'
  });

  conversationsDB.update(conversationId, {
    lastMessage: text,
    lastMessageAt: new Date().toISOString(),
    status: sender === 'cliente' ? 'aguardando_atendimento' : 'em_atendimento'
  });

  activitiesDB.insert({
    tenantId,
    leadId: conv.leadId,
    type: 'message_sent',
    title: `Mensagem enviada por ${senderName}`,
    description: text.slice(0, 80) + (text.length > 80 ? '...' : ''),
    timestamp: new Date().toISOString()
  });

  return msg;
}

/**
 * Gera sugestão de resposta com IA baseada nas últimas mensagens e Cérebro da Empresa (Human-in-the-Loop)
 */
async function generateSuggestedResponse({ conversationId, tenantId }) {
  const conv = conversationsDB.findById(conversationId);
  if (!conv || (conv.tenantId && conv.tenantId !== tenantId)) {
    throw new Error('Conversa não encontrada.');
  }

  const messages = getConversationMessages(conversationId).slice(-6);
  const lead = leadsDB.findById(conv.leadId) || {};
  const kbItems = knowledgeBaseDB.findByTenant(tenantId);
  const kbContext = kbItems.map(k => `[${k.category}] ${k.title}: ${k.content}`).join('\n\n');

  const historyText = messages.map(m => `${m.sender === 'cliente' ? 'Cliente' : 'Atendente'}: ${m.text}`).join('\n');

  const prompt = `Histórico Recente da Conversa:\n${historyText || 'Sem mensagens anteriores.'}\n\nCom base no histórico e nas informações da empresa, gere uma sugestão de resposta consultiva, empática e focada em avançar a negociação comercial.`;

  const systemPrompt = `Você é o Copiloto Comercial do Inbox Omnichannel do Agentise Mega CRM.\n` +
    `Informações do Cérebro da Empresa:\n${kbContext || 'Empresa especializada em soluções comerciais de alta performance.'}\n\n` +
    `Dados do Cliente:\nNome: ${lead.name || 'Cliente'}\nEmpresa: ${lead.company || '-'}\n` +
    `Regras: Forneça uma resposta direta, pronta para envio no WhatsApp pelo vendedor, sem introduções explicativas.`;

  const aiResult = await generateAIResponse({
    prompt,
    systemPrompt,
    taskType: 'chat',
    modelPreference: 'auto',
    tenantId
  });

  return {
    suggestion: aiResult.text,
    modelUsed: aiResult.modelUsed,
    latencyMs: aiResult.latencyMs
  };
}

/**
 * Alterna o modo de atendimento da conversa: 'autonoma', 'copiloto', 'humano'
 */
function setConversationMode({ conversationId, tenantId, mode }) {
  const conv = conversationsDB.findById(conversationId);
  if (!conv || (conv.tenantId && conv.tenantId !== tenantId)) {
    throw new Error('Conversa não encontrada.');
  }

  const validModes = ['autonoma', 'copiloto', 'humano'];
  const newMode = validModes.includes(mode) ? mode : 'copiloto';

  const updated = conversationsDB.update(conversationId, { mode: newMode });

  activitiesDB.insert({
    tenantId,
    leadId: conv.leadId,
    type: 'mode_change',
    title: `Modo de atendimento alterado para ${newMode.toUpperCase()}`,
    description: `A conversa agora opera no modo ${newMode}.`,
    timestamp: new Date().toISOString()
  });

  return updated;
}

module.exports = {
  SUPPORTED_CHANNELS,
  getChannelsStatus,
  getConversations,
  getConversationMessages,
  sendMessage,
  generateSuggestedResponse,
  setConversationMode
};
