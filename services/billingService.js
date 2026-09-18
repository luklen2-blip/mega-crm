/**
 * Serviço de Planos SaaS, Trial de 7 Dias e Gestão de Créditos de IA
 */

const { tenantsDB, aiUsageDB, leadsDB, usersDB, automationsDB, pipelinesDB } = require('../database/db');

const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 97,
    maxUsers: 2,
    maxPipelines: 1,
    maxLeads: 500,
    maxAutomations: 3,
    monthlyAiCredits: 1000,
    features: ['Kanban Comercial', 'Leads 360°', 'PIX Oficial EMV', 'Claude Copilot Básico']
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    price: 197,
    maxUsers: 5,
    maxPipelines: 3,
    maxLeads: 2500,
    maxAutomations: 10,
    monthlyAiCredits: 5000,
    features: ['Tudo do Starter', 'Central Omnichannel', 'Cérebro da Empresa', 'RecuperaIA Ativo', 'Automações Avançadas']
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 397,
    maxUsers: 15,
    maxPipelines: 10,
    maxLeads: 10000,
    maxAutomations: 50,
    monthlyAiCredits: 20000,
    features: ['Tudo do Professional', 'Agentise Auto (Vertical)', 'Analista IA para Gestores', 'Múltiplos Pipelines', 'API Rest']
  },
  agency: {
    id: 'agency',
    name: 'Agency Enterprise',
    price: 897,
    maxUsers: 50,
    maxPipelines: 50,
    maxLeads: 50000,
    maxAutomations: 200,
    monthlyAiCredits: 60000,
    features: ['Tudo do Business', 'Multi-Empresas Filiais', 'White-Label', 'Suporte Dedicado 24/7']
  }
};

function getTenantSubscription(tenantId) {
  const tenant = tenantsDB.findById(tenantId);
  if (!tenant) return null;

  const planId = tenant.plan || 'starter';
  const planInfo = PLANS[planId] || PLANS.starter;
  const trialEnds = new Date(tenant.trialEndsAt || Date.now());
  const now = new Date();
  const isTrialActive = now < trialEnds;
  const daysLeftTrial = isTrialActive ? Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24)) : 0;

  const leadsCount = leadsDB.countByTenant ? leadsDB.countByTenant(tenantId) : leadsDB.findByTenant(tenantId).length;
  const usersCount = usersDB.findAll(u => u.tenantId === tenantId).length;
  const automationsCount = automationsDB.findByTenant(tenantId).length;
  const pipelinesCount = pipelinesDB ? pipelinesDB.findByTenant(tenantId).length : 1;

  const maxCredits = tenant.aiCredits || planInfo.monthlyAiCredits;
  const usedCredits = tenant.aiCreditsUsed || 0;

  return {
    tenantId: tenant.id,
    companyName: tenant.name,
    plan: planInfo,
    isTrialActive,
    daysLeftTrial,
    trialEndsAt: tenant.trialEndsAt,
    aiCredits: maxCredits,
    aiCreditsUsed: usedCredits,
    aiCreditsRemaining: Math.max(0, maxCredits - usedCredits),
    quotas: {
      users: { current: usersCount, limit: planInfo.maxUsers, percent: Math.min(100, Math.round((usersCount / planInfo.maxUsers) * 100)) },
      leads: { current: leadsCount, limit: planInfo.maxLeads, percent: Math.min(100, Math.round((leadsCount / planInfo.maxLeads) * 100)) },
      pipelines: { current: pipelinesCount, limit: planInfo.maxPipelines, percent: Math.min(100, Math.round((pipelinesCount / planInfo.maxPipelines) * 100)) },
      automations: { current: automationsCount, limit: planInfo.maxAutomations, percent: Math.min(100, Math.round((automationsCount / planInfo.maxAutomations) * 100)) },
      aiCredits: { current: usedCredits, limit: maxCredits, percent: Math.min(100, Math.round((usedCredits / maxCredits) * 100)) }
    },
    usage: {
      users: { current: usersCount, limit: planInfo.maxUsers },
      leads: { current: leadsCount, limit: planInfo.maxLeads },
      automations: { current: automationsCount, limit: planInfo.maxAutomations },
      pipelines: { current: pipelinesCount, limit: planInfo.maxPipelines }
    }
  };
}

function upgradeTenantPlan(tenantId, newPlanId) {
  const plan = PLANS[newPlanId];
  if (!plan) throw new Error(`Plano '${newPlanId}' inválido.`);

  const updated = tenantsDB.update(tenantId, {
    plan: newPlanId,
    aiCredits: plan.monthlyAiCredits,
    aiCreditsUsed: 0
  });

  return { tenant: updated, plan };
}

function checkResourceLimit(tenantId, resource) {
  const sub = getTenantSubscription(tenantId);
  if (!sub) return { allowed: true };

  if (resource === 'users' && sub.usage.users.current >= sub.plan.maxUsers) {
    return { allowed: false, error: `Limite de usuários atingido para o plano ${sub.plan.name} (${sub.plan.maxUsers} usuários). Faça upgrade para continuar.` };
  }

  if (resource === 'leads' && sub.usage.leads.current >= sub.plan.maxLeads) {
    return { allowed: false, error: `Limite de leads atingido (${sub.plan.maxLeads} leads). Faça upgrade para adicionar mais contatos.` };
  }

  if (resource === 'automations' && sub.usage.automations.current >= sub.plan.maxAutomations) {
    return { allowed: false, error: `Limite de automações ativas atingido (${sub.plan.maxAutomations}). Faça upgrade do plano.` };
  }

  if (resource === 'pipelines' && sub.usage.pipelines && sub.usage.pipelines.current >= sub.plan.maxPipelines) {
    return { allowed: false, error: `Limite de funis de vendas atingido para o plano ${sub.plan.name} (${sub.plan.maxPipelines} funis). Faça upgrade para continuar.` };
  }

  return { allowed: true };
}

function consumeAiCredits(tenantId, featureName, cost = 10) {
  const tenant = tenantsDB.findById(tenantId);
  if (!tenant) return { success: true };

  const currentUsed = tenant.aiCreditsUsed || 0;
  const maxCredits = tenant.aiCredits || 1000;

  if (currentUsed + cost > maxCredits) {
    return {
      success: false,
      error: 'Créditos de IA esgotados para este ciclo. Recarregue seus créditos ou faça upgrade do plano.'
    };
  }

  tenantsDB.update(tenantId, {
    aiCreditsUsed: currentUsed + cost
  });

  aiUsageDB.insert({
    tenantId,
    feature: featureName,
    credits: cost,
    timestamp: new Date().toISOString()
  });

  return {
    success: true,
    creditsUsed: cost,
    remainingCredits: maxCredits - (currentUsed + cost)
  };
}

module.exports = {
  PLANS,
  getTenantSubscription,
  checkResourceLimit,
  consumeAiCredits,
  upgradeTenantPlan
};
