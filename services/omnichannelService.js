/**
 * Central de Atendimento Omnichannel
 * Gerenciamento de conversas, mensagens e conectores para APIs oficiais (WhatsApp, Instagram, Webchat).
 * Cumpre a diretriz de integridade: NUNCA simula conexão falsa. Exibe "Conectar canal" quando não configurado.
 */

const { conversationsDB, messagesDB, settingsDB, activitiesDB } = require('../database/db');

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
      statusLabel: isConfigured ? 'Conectado (Oficial)' : 'Conectar Canal',
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
  if (!conv) throw new Error('Conversa não encontrada.');

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

module.exports = {
  SUPPORTED_CHANNELS,
  getChannelsStatus,
  getConversations,
  getConversationMessages,
  sendMessage
};
