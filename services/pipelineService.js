/**
 * AGENTISE MEGA CRM - Motor de Pipelines Inteligentes & AI Deal Score (FASE 5)
 * Suporte a múltiplos funis por tenant, estágios dinâmicos com SLA e pontuação preditiva explicável.
 */

const { 
  pipelinesDB, 
  pipelineStagesDB, 
  dealsDB, 
  leadsDB, 
  activitiesDB, 
  tasksDB, 
  proposalsDB 
} = require('../database/db');

// Estágios Padrão do Funil de Vendas B2B
const DEFAULT_SALES_STAGES = [
  { id: 'prospeccao', name: 'Prospecção', probability: 10, slaDays: 3, color: '#64748b', order: 1 },
  { id: 'qualificacao', name: 'Qualificação (BANT)', probability: 30, slaDays: 4, color: '#3b82f6', order: 2 },
  { id: 'apresentacao', name: 'Apresentação / Demo', probability: 50, slaDays: 5, color: '#8b5cf6', order: 3 },
  { id: 'proposta', name: 'Proposta Enviada', probability: 70, slaDays: 3, color: '#f59e0b', order: 4 },
  { id: 'negociacao', name: 'Negociação', probability: 85, slaDays: 5, color: '#06b6d4', order: 5 },
  { id: 'ganho', name: 'Venda Concluída', probability: 100, slaDays: 0, color: '#10b981', order: 6 },
  { id: 'perdido', name: 'Perdido', probability: 0, slaDays: 0, color: '#ef4444', order: 7 }
];

// Estágios do Funil de Pós-Venda & Expansão
const DEFAULT_EXPANSION_STAGES = [
  { id: 'onboarding', name: 'Onboarding & Boas-Vindas', probability: 20, slaDays: 7, color: '#6366f1', order: 1 },
  { id: 'adocao', name: 'Adoção Ativa do Produto', probability: 40, slaDays: 14, color: '#3b82f6', order: 2 },
  { id: 'checkpoint', name: 'Checkpoint de Sucesso (30d)', probability: 60, slaDays: 10, color: '#06b6d4', order: 3 },
  { id: 'upsell', name: 'Oferta de Upsell / Expansão', probability: 80, slaDays: 5, color: '#f59e0b', order: 4 },
  { id: 'renovado', name: 'Contrato Renovado / Expandido', probability: 100, slaDays: 0, color: '#10b981', order: 5 }
];

/**
 * Garante a existência de ao menos um pipeline padrão para o tenant.
 */
function ensureTenantPipelines(tenantId) {
  if (!tenantId) return [];

  let pipes = pipelinesDB.findByTenant(tenantId);
  if (pipes.length === 0) {
    // 1. Funil Comercial Principal
    const mainPipe = pipelinesDB.insert({
      id: `pipe_${tenantId}_default`,
      tenantId,
      name: 'Funil Comercial Geral',
      description: 'Esteira comercial padrão de aquisição, qualificação e fechamento B2B.',
      isDefault: true,
      createdAt: new Date().toISOString()
    });

    DEFAULT_SALES_STAGES.forEach(s => {
      pipelineStagesDB.insert({
        id: `stg_${tenantId}_${s.id}`,
        tenantId,
        pipelineId: mainPipe.id,
        key: s.id,
        name: s.name,
        probability: s.probability,
        slaDays: s.slaDays,
        color: s.color,
        order: s.order
      });
    });

    // 2. Funil de Expansão & Upsell
    const expPipe = pipelinesDB.insert({
      id: `pipe_${tenantId}_expansion`,
      tenantId,
      name: 'Pós-Venda & Expansão (Upsell)',
      description: 'Gestão de onboarding, retenção e expansão de receita (LTV) com clientes ativos.',
      isDefault: false,
      createdAt: new Date().toISOString()
    });

    DEFAULT_EXPANSION_STAGES.forEach(s => {
      pipelineStagesDB.insert({
        id: `stg_${tenantId}_${s.id}`,
        tenantId,
        pipelineId: expPipe.id,
        key: s.id,
        name: s.name,
        probability: s.probability,
        slaDays: s.slaDays,
        color: s.color,
        order: s.order
      });
    });

    pipes = [mainPipe, expPipe];
  }

  return pipes;
}

/**
 * Motor de Pontuação Preditiva com IA: AI Deal Score (0 a 100)
 * Analisa BANT, recência de interações, tarefas vencidas, propostas PIX e comportamento do lead.
 */
function calculateAiDealScore(deal, lead = {}, activities = [], tasks = [], proposals = []) {
  if (!deal) return { score: 50, classification: 'Média Propensão', color: '#3b82f6', rationale: 'Dados insuficientes' };

  // Casos terminais
  if (deal.stage === 'ganho') {
    return {
      score: 100,
      classification: 'Venda Concluída',
      color: '#10b981',
      rationale: 'Score 100/100: Venda fechada e faturada com êxito.',
      drivers: ['Contrato assinado e pagamento baixado'],
      risks: []
    };
  }

  if (deal.stage === 'perdido') {
    return {
      score: 0,
      classification: 'Oportunidade Perdida',
      color: '#ef4444',
      rationale: 'Score 0/100: Oportunidade perdida ou desqualificada.',
      drivers: [],
      risks: ['Lead desistiu ou não possui orçamento/aderência']
    };
  }

  let score = 50;
  const drivers = [];
  const risks = [];

  // 1. Avaliação do Estágio no Funil
  const stageWeights = {
    prospeccao: 5,
    qualificacao: 15,
    apresentacao: 25,
    proposta: 35,
    negociacao: 42
  };
  const stageBonus = stageWeights[deal.stage] || 10;
  score += stageBonus;
  drivers.push(`Avanço no funil (${(deal.stage || '').toUpperCase()} +${stageBonus}pts)`);

  // 2. Análise BANT
  // Orçamento (Budget)
  const budget = Number(lead.estimatedBudget || deal.value || 0);
  if (budget >= 20000) {
    score += 10;
    drivers.push(`Ticket qualificado de alto valor: R$ ${budget.toLocaleString('pt-BR')} (+10pts)`);
  } else if (budget > 0) {
    score += 5;
    drivers.push(`Orçamento mapeado: R$ ${budget.toLocaleString('pt-BR')} (+5pts)`);
  } else {
    score -= 8;
    risks.push('Orçamento do lead ainda não identificado (-8pts)');
  }

  // Autoridade (Authority)
  const role = (lead.role || '').toLowerCase();
  const isDecisor = /diretor|gerente|propriet|sóci|ceo|fundador|dono|head/i.test(role);
  if (isDecisor) {
    score += 10;
    drivers.push(`Contato direto com decisor (${lead.role || 'Liderança'} +10pts)`);
  } else if (lead.role) {
    score += 3;
  } else {
    risks.push('Contato não identificado como decisor');
  }

  // 3. Propostas e Cobrança PIX
  const dealProposals = proposals.filter(p => p.dealId === deal.id || p.leadId === deal.leadId);
  const hasPix = dealProposals.some(p => p.pixPayload || p.status === 'pendente');
  if (hasPix) {
    score += 12;
    drivers.push('Proposta comercial com PIX oficial emitida (+12pts)');
  }

  // 4. Recência de Interações (Decay)
  const dealActivities = activities.filter(a => a.dealId === deal.id || a.leadId === deal.leadId);
  if (dealActivities.length > 0) {
    const timestamps = dealActivities.map(a => new Date(a.timestamp || a.createdAt || 0).getTime());
    const lastTimestamp = Math.max(...timestamps);
    const daysSinceLastActivity = Math.floor((Date.now() - lastTimestamp) / (1000 * 60 * 60 * 24));

    if (daysSinceLastActivity <= 2) {
      score += 8;
      drivers.push('Engajamento recente (interação há menos de 48h +8pts)');
    } else if (daysSinceLastActivity <= 5) {
      score += 3;
    } else if (daysSinceLastActivity > 14) {
      score -= 15;
      risks.push(`Estagnação: sem interações há ${daysSinceLastActivity} dias (-15pts)`);
    } else if (daysSinceLastActivity > 7) {
      score -= 8;
      risks.push(`Sem contato há mais de uma semana (${daysSinceLastActivity} dias)`);
    }
  } else {
    score -= 10;
    risks.push('Nenhuma interação comercial registrada no histórico (-10pts)');
  }

  // 5. Tarefas Atrasadas / Pendentes
  const dealTasks = tasks.filter(t => t.leadId === deal.leadId && !t.completed);
  if (dealTasks.length > 2) {
    score -= 6;
    risks.push(`${dealTasks.length} tarefas pendentes acumuladas (-6pts)`);
  }

  score = Math.max(8, Math.min(96, score));

  let classification = 'Média Propensão';
  let color = '#3b82f6';
  if (score >= 75) {
    classification = 'Alta Propensão de Fechamento';
    color = '#10b981';
  } else if (score < 50) {
    classification = 'Risco de Perda / Atenção';
    color = '#f43f5e';
  } else {
    classification = 'Média Propensão';
    color = '#0ea5e9';
  }

  let rationale = `Score ${score}/100 (${classification}). `;
  if (drivers.length > 0) {
    rationale += `Pontos fortes: ${drivers.slice(0, 2).join('; ')}. `;
  }
  if (risks.length > 0) {
    rationale += `Atenção recomendada: ${risks.slice(0, 2).join('; ')}.`;
  } else {
    rationale += 'Oportunidade avançando com ritmo saudável.';
  }

  return {
    score,
    classification,
    color,
    rationale,
    drivers,
    risks
  };
}

module.exports = {
  DEFAULT_SALES_STAGES,
  DEFAULT_EXPANSION_STAGES,
  ensureTenantPipelines,
  calculateAiDealScore
};
