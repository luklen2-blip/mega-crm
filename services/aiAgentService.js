/**
 * AGENTISE MEGA CRM - Agente Comercial de IA & Atendimento Autônomo (FASE 7)
 * Gestão de Agentes Especialistas (SDR e Closer), Transbordo Humano Inteligente (Handover),
 * limites de autonomia comercial e persistência de sessões no aiConversationsDB.
 */

const { 
  aiAgentsDB, 
  aiConversationsDB, 
  leadsDB, 
  dealsDB, 
  tasksDB, 
  activitiesDB, 
  knowledgeBaseDB 
} = require('../database/db');

const { generateAIResponse } = require('./aiGatewayService');

const DEFAULT_HANDOVER_KEYWORDS = [
  'humano', 'atendente', 'falar com pessoa', 'falar com humano', 
  'gerente', 'vendedor', 'reclamar', 'reclamação', 'advogado', 
  'cancelar', 'cancelamento', 'procon', 'ouvidoria', 'falar com alguém'
];

/**
 * Garante que cada tenant possua agentes de IA comerciais configurados por padrão.
 */
function ensureTenantAgents(tenantId) {
  if (!tenantId) return [];

  let agents = aiAgentsDB.findByTenant(tenantId);
  if (agents.length === 0) {
    // 1. Sofia - Closer Consultiva IA
    const closerAgent = aiAgentsDB.insert({
      id: `agt_${tenantId}_sofia`,
      tenantId,
      name: 'Sofia - Closer Comercial IA',
      role: 'CLOSER',
      autonomyLevel: 'copiloto', // desativada, assistente, copiloto, autonoma
      tone: 'consultivo_estrategico',
      systemPrompt: 'Você é Sofia, Closer Comercial Especialista do Agentise Mega CRM. Seu objetivo é entender profundamente a dor do cliente, qualificar o orçamento, demonstrar o ROI da solução e conduzir ao fechamento com proposta e pagamento via PIX oficial.',
      maxDealAutonomy: 35000,
      handoverKeywords: DEFAULT_HANDOVER_KEYWORDS,
      active: true,
      createdAt: new Date().toISOString()
    });

    // 2. Lucas - SDR Hunter IA
    const sdrAgent = aiAgentsDB.insert({
      id: `agt_${tenantId}_lucas`,
      tenantId,
      name: 'Lucas - SDR Hunter IA',
      role: 'SDR',
      autonomyLevel: 'autonoma',
      tone: 'dinamico_proativo',
      systemPrompt: 'Você é Lucas, SDR Proativo do Agentise Mega CRM. Seu foco é abordar novos leads com rapidez, qualificar perfil e orçamento e agendar reuniões de demonstração para a equipe de vendas.',
      maxDealAutonomy: 15000,
      handoverKeywords: DEFAULT_HANDOVER_KEYWORDS,
      active: true,
      createdAt: new Date().toISOString()
    });

    agents = [closerAgent, sdrAgent];
  }

  return agents;
}

/**
 * Avalia se uma mensagem ou negociação requer transbordo imediato para um humano.
 */
function checkHandoverRequired(messageText, agent, deal = {}) {
  const text = (messageText || '').toLowerCase().trim();
  const keywords = agent.handoverKeywords || DEFAULT_HANDOVER_KEYWORDS;

  // 1. Palavras-chave de pedido de atendimento humano ou insatisfação
  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) {
      return {
        required: true,
        reason: `Cliente solicitou transbordo humano explícito (termo identificado: "${kw}")`
      };
    }
  }

  // 2. Sentimento agressivo ou jurídico
  if (/processo|danos morais|fraude|polícia|justiça/i.test(text)) {
    return {
      required: true,
      reason: 'Risco jurídico ou sentimento de alta criticidade detectado na mensagem'
    };
  }

  // 3. Valor da oportunidade acima do teto de autonomia do agente
  const dealValue = Number(deal.value || 0);
  const maxAutonomy = Number(agent.maxDealAutonomy || 30000);
  if (dealValue > maxAutonomy) {
    return {
      required: true,
      reason: `Valor da oportunidade (R$ ${dealValue.toLocaleString('pt-BR')}) excede o teto de autonomia do agente (R$ ${maxAutonomy.toLocaleString('pt-BR')})`
    };
  }

  return { required: false, reason: null };
}

/**
 * Processa a interação com o Agente de IA Comercial.
 */
async function processAgentInteraction({
  agentId,
  leadId,
  dealId = null,
  message,
  tenantId,
  channel = 'whatsapp',
  userId = 'system'
}) {
  const agent = aiAgentsDB.findById(agentId);
  if (!agent || (agent.tenantId && agent.tenantId !== tenantId)) {
    throw new Error('Agente de IA não encontrado.');
  }

  const lead = leadsDB.findById(leadId) || { name: 'Cliente' };
  const deal = dealId ? (dealsDB.findById(dealId) || {}) : {};

  // Verifica se o agente está ativo
  if (agent.active === false || agent.autonomyLevel === 'desativada') {
    return {
      handover: true,
      reason: 'Agente de IA desativado para este canal',
      reply: 'Nossa equipe comercial foi notificada e entrará em contato em breve.'
    };
  }

  // Verifica regras de transbordo humano (Handover)
  const handoverCheck = checkHandoverRequired(message, agent, deal);
  if (handoverCheck.required) {
    // Cria tarefa urgente para a equipe humana
    const task = tasksDB.insert({
      tenantId,
      leadId: lead.id,
      dealId: deal.id || null,
      title: `🚨 TRANSBORDO HUMANO: ${lead.name}`,
      description: `Motivo: ${handoverCheck.reason}. Última mensagem: "${message}"`,
      priority: 'urgente',
      completed: false,
      assignedTo: deal.assignedTo || 'Equipe Comercial',
      createdAt: new Date().toISOString()
    });

    activitiesDB.insert({
      tenantId,
      leadId: lead.id,
      dealId: deal.id || null,
      type: 'handover',
      title: 'Transbordo Humano Acionado',
      description: handoverCheck.reason,
      timestamp: new Date().toISOString()
    });

    // Registra sessão de conversa
    aiConversationsDB.insert({
      tenantId,
      agentId: agent.id,
      leadId: lead.id,
      dealId: deal.id || null,
      channel,
      customerMessage: message,
      agentReply: 'Transferindo seu atendimento para nossa equipe comercial agora mesmo. Um especialista assumirá a conversa em instantes.',
      status: 'handed_over',
      handoverReason: handoverCheck.reason,
      taskId: task.id,
      timestamp: new Date().toISOString()
    });

    return {
      handover: true,
      reason: handoverCheck.reason,
      taskId: task.id,
      reply: 'Compreendo perfeitamente. Estou transferindo seu atendimento para um de nossos especialistas comerciais agora mesmo. Por favor, aguarde só um instante!'
    };
  }

  // Monta contexto com base no Cérebro da Empresa (Knowledge Base)
  const kbItems = knowledgeBaseDB.findByTenant(tenantId);
  const kbContext = kbItems.map(k => `[${k.category}] ${k.title}: ${k.content}`).join('\n\n');

  const systemPrompt = `${agent.systemPrompt}\n\n` +
    `Informações Oficiais do Cérebro da Empresa:\n${kbContext || 'Empresa especializada em soluções comerciais de alta performance.'}\n\n` +
    `Dados do Lead:\nNome: ${lead.name}\nEmpresa: ${lead.company || '-'}\nCargo: ${lead.role || '-'}\nOrçamento Estimado: R$ ${Number(lead.estimatedBudget || deal.value || 0).toLocaleString('pt-BR')}\n\n` +
    `Regras de Atendimento:\n• Seja direto, profissional, acolhedor e focado em resolver a necessidade do cliente.\n• Se o cliente pedir proposta ou PIX, explique as condições e informe que a chave oficial é luklen2@gmail.com.\n• Não invente preços fora das políticas da empresa.`;

  // Chama o AI Gateway
  const aiResult = await generateAIResponse({
    prompt: message,
    systemPrompt,
    taskType: agent.role === 'CLOSER' ? 'sales_pitch' : 'chat',
    modelPreference: 'auto',
    tenantId,
    userId
  });

  // Salva no histórico de conversas do agente
  const conv = aiConversationsDB.insert({
    tenantId,
    agentId: agent.id,
    leadId: lead.id,
    dealId: deal.id || null,
    channel,
    customerMessage: message,
    agentReply: aiResult.text,
    status: 'handled_by_ai',
    modelUsed: aiResult.modelUsed,
    latencyMs: aiResult.latencyMs,
    timestamp: new Date().toISOString()
  });

  // Registra atividade na timeline do cliente
  activitiesDB.insert({
    tenantId,
    leadId: lead.id,
    dealId: deal.id || null,
    type: 'ai_interaction',
    title: `Interação com ${agent.name}`,
    description: `Cliente: "${message.slice(0, 60)}..." | IA: "${aiResult.text.slice(0, 60)}..."`,
    timestamp: new Date().toISOString()
  });

  return {
    handover: false,
    conversationId: conv.id,
    reply: aiResult.text,
    modelUsed: aiResult.modelUsed,
    latencyMs: aiResult.latencyMs
  };
}

module.exports = {
  DEFAULT_HANDOVER_KEYWORDS,
  ensureTenantAgents,
  checkHandoverRequired,
  processAgentInteraction
};
