/**
 * Motor de Automações Comerciais (Trigger - Condition - Action)
 * Modelo: QUANDO -> SE -> ENTÃO
 */

const { 
  automationsDB, 
  tasksDB, 
  activitiesDB, 
  dealsDB, 
  workflowRunsDB,
  messagesDB 
} = require('../database/db');

// Modelos de Gatilhos Suportados
const TRIGGERS = [
  { id: 'novo_lead', name: 'Novo Lead Entrar no Sistema', icon: 'user-plus' },
  { id: 'mudanca_estagio', name: 'Oportunidade Mudar de Estágio', icon: 'git-commit' },
  { id: 'proposta_criada', name: 'Nova Proposta PIX Gerada', icon: 'file-text' },
  { id: 'proposta_parada', name: 'Proposta Sem Resposta (+48h)', icon: 'clock' },
  { id: 'lead_estagnado', name: 'Lead Sem Contato (+3 dias)', icon: 'alert-circle' },
  { id: 'deal_score_alto', name: 'AI Deal Score Elevado (>= 75)', icon: 'flame' },
  { id: 'deal_score_baixo', name: 'AI Deal Score de Risco (< 40)', icon: 'shield-alert' },
  { id: 'venda_fechada', name: 'Venda Fechada (Ganho)', icon: 'check-circle' },
  { id: 'lead_perdido', name: 'Oportunidade Perdida', icon: 'x-circle' }
];

const ACTIONS = [
  { id: 'enviar_whatsapp', name: 'Disparar / Preparar Mensagem de WhatsApp', type: 'message' },
  { id: 'criar_tarefa', name: 'Criar Tarefa para Vendedor', type: 'task' },
  { id: 'qualificar_ia', name: 'Acionar Diagnóstico BANT por IA', type: 'ai' },
  { id: 'mover_estagio', name: 'Mover Oportunidade no Funil', type: 'pipeline' },
  { id: 'alertar_gestor', name: 'Enviar Alerta para o Gerente / Proprietário', type: 'alert' }
];

function evaluateCondition(condition, context) {
  if (!condition || !condition.field) return true;
  const val = context[condition.field];
  const target = condition.value;

  switch (condition.operator) {
    case 'equals': return String(val).toLowerCase() === String(target).toLowerCase();
    case 'not_equals': return String(val).toLowerCase() !== String(target).toLowerCase();
    case 'greater_than': return Number(val) > Number(target);
    case 'less_than': return Number(val) < Number(target);
    case 'gte': return Number(val) >= Number(target);
    case 'lte': return Number(val) <= Number(target);
    case 'contains': return String(val || '').toLowerCase().includes(String(target || '').toLowerCase());
    default: return true;
  }
}

async function triggerWorkflows(triggerType, context = {}, tenantId) {
  const automations = automationsDB.findByTenant(tenantId, a => a.trigger === triggerType && a.active !== false);
  const executedActions = [];

  for (const auto of automations) {
    // Avalia condição "SE"
    if (auto.condition && !evaluateCondition(auto.condition, context)) {
      continue;
    }

    const autoExecuted = [];
    const action = auto.action || {};

    try {
      if (action.type === 'criar_tarefa' || action.id === 'criar_tarefa') {
        const task = tasksDB.insert({
          tenantId,
          leadId: context.leadId,
          dealId: context.dealId,
          title: (action.params && action.params.title) || `Tarefa Automática: ${auto.name}`,
          priority: (action.params && action.params.priority) || 'alta',
          deadline: new Date(Date.now() + ((action.params && action.params.delayHours) || 24) * 3600000).toISOString(),
          completed: false
        });
        autoExecuted.push({ type: 'task_created', taskId: task.id });
      }

      if ((action.type === 'mover_estagio' || action.id === 'mover_estagio') && context.dealId && action.params && action.params.targetStage) {
        dealsDB.update(context.dealId, { stage: action.params.targetStage });
        autoExecuted.push({ type: 'stage_moved', stage: action.params.targetStage });
      }

      if (action.type === 'alertar_gestor' || action.id === 'alertar_gestor') {
        const alertTask = tasksDB.insert({
          tenantId,
          leadId: context.leadId,
          dealId: context.dealId,
          title: `⚠️ [Alerta Gestão] ${auto.name}: ${context.title || context.name || 'Atenção requerida'}`,
          priority: 'urgente',
          deadline: new Date(Date.now() + 4 * 3600000).toISOString(),
          completed: false
        });
        autoExecuted.push({ type: 'alert_created', taskId: alertTask.id });
      }

      if (action.type === 'enviar_whatsapp' || action.id === 'enviar_whatsapp') {
        autoExecuted.push({ type: 'whatsapp_prepared', text: (action.params && action.params.text) || 'Mensagem automática pronta.' });
      }

      // Registra na timeline de atividades
      activitiesDB.insert({
        tenantId,
        leadId: context.leadId,
        dealId: context.dealId,
        type: 'automation_executed',
        title: `⚡ Automação Executada: ${auto.name}`,
        description: `Gatilho "${triggerType}" disparou ${autoExecuted.length} ação(ões) com sucesso.`,
        timestamp: new Date().toISOString()
      });

      // Registra no histórico de execuções (workflowRunsDB - FASE 9)
      if (workflowRunsDB) {
        workflowRunsDB.insert({
          tenantId,
          automationId: auto.id,
          automationName: auto.name,
          triggerType,
          contextId: context.dealId || context.leadId || null,
          status: 'success',
          actionsExecuted: autoExecuted,
          executedAt: new Date().toISOString()
        });
      }

      executedActions.push(...autoExecuted.map(a => ({ ...a, automationId: auto.id })));
    } catch (err) {
      if (workflowRunsDB) {
        workflowRunsDB.insert({
          tenantId,
          automationId: auto.id,
          automationName: auto.name,
          triggerType,
          contextId: context.dealId || context.leadId || null,
          status: 'failed',
          errorMessage: err.message,
          executedAt: new Date().toISOString()
        });
      }
    }
  }

  return executedActions;
}

// Cria automações recomendadas de acordo com o segmento (Onboarding)
function seedSegmentAutomations(tenantId, segment) {
  const defaultList = [
    {
      tenantId,
      name: 'Boas-Vindas & Follow-up de Novo Lead',
      trigger: 'novo_lead',
      condition: null,
      action: {
        type: 'criar_tarefa',
        params: { title: 'Primeiro contato rápido (meta: < 15 min)', priority: 'urgente', delayHours: 1 }
      },
      active: true
    },
    {
      tenantId,
      name: 'Aceleração de Proposta PIX Aberta',
      trigger: 'proposta_criada',
      condition: null,
      action: {
        type: 'criar_tarefa',
        params: { title: 'Verificar recebimento da proposta e tirar dúvidas pelo WhatsApp', priority: 'alta', delayHours: 24 }
      },
      active: true
    },
    {
      tenantId,
      name: 'Reativação de Oportunidade Perdida',
      trigger: 'lead_perdido',
      condition: null,
      action: {
        type: 'criar_tarefa',
        params: { title: 'Agendar contato de reativação para 15 dias', priority: 'media', delayHours: 360 }
      },
      active: true
    }
  ];

  for (const auto of defaultList) {
    automationsDB.insert(auto);
  }
}

module.exports = {
  TRIGGERS,
  ACTIONS,
  triggerWorkflows,
  seedSegmentAutomations
};
