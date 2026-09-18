/**
 * Módulo RecuperaIA - Sistema Inteligente de Reativação e Recuperação de Vendas
 * Identifica leads estagnados, propostas paradas e clientes inativos com propostas personalizadas.
 */

const { leadsDB, dealsDB, proposalsDB, campaignsDB, activitiesDB } = require('../database/db');
const { consumeAiCredits } = require('./billingService');

function scanRecoverableOpportunities(tenantId) {
  const now = Date.now();
  const leads = leadsDB.findByTenant(tenantId);
  const deals = dealsDB.findByTenant(tenantId);
  const proposals = proposalsDB.findByTenant(tenantId);

  // 1. Propostas paradas há mais de 48 horas
  const stagnantProposals = proposals.filter(p => {
    const ageHours = (now - new Date(p.createdAt).getTime()) / (1000 * 60 * 60);
    return p.status === 'pendente' && ageHours >= 48;
  });

  // 2. Oportunidades perdidas com potencial de reativação
  const lostDeals = deals.filter(d => d.stage === 'perdido');

  // 3. Oportunidades paradas em negociação ou proposta há mais de 5 dias
  const stalledDeals = deals.filter(d => {
    const ageDays = (now - new Date(d.updatedAt || d.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return (d.stage === 'proposta' || d.stage === 'negociacao') && ageDays >= 5;
  });

  // 4. Leads cadastrados sem atividade recente há mais de 7 dias
  const inactiveLeads = leads.filter(l => {
    const ageDays = (now - new Date(l.updatedAt || l.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays >= 7;
  });

  const totalValueAtRisk = [...stagnantProposals, ...stalledDeals, ...lostDeals].reduce((sum, item) => {
    return sum + Number(item.amount || item.value || item.estimatedBudget || 0);
  }, 0);

  // 5. Oportunidades efetivamente recuperadas via RecuperaIA
  const recoveredDeals = deals.filter(d => d.stage === 'ganho' && (d.recoveredVia === 'RecuperaIA' || d.origin === 'RecuperaIA'));
  const totalValueRecovered = recoveredDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);

  const totalCount = stagnantProposals.length + stalledDeals.length + lostDeals.length + inactiveLeads.length;

  return {
    totalCount,
    receitaEmRisco: totalValueAtRisk,
    receitaRecuperada: totalValueRecovered,
    totalValueAtRisk,
    totalValueRecovered,
    recoveredDealsCount: recoveredDeals.length,
    categories: {
      stagnantProposals: {
        count: stagnantProposals.length,
        label: 'Propostas Paradas (+48h)',
        items: stagnantProposals
      },
      stalledDeals: {
        count: stalledDeals.length,
        label: 'Oportunidades Estagnadas no Funil (+5d)',
        items: stalledDeals
      },
      lostDeals: {
        count: lostDeals.length,
        label: 'Oportunidades Perdidas Reativáveis',
        items: lostDeals
      },
      inactiveLeads: {
        count: inactiveLeads.length,
        label: 'Leads sem Contato (+7d)',
        items: inactiveLeads
      }
    }
  };
}

function generateRecoveryCampaign(tenantId, categoryKey, customTone = 'consultivo') {
  consumeAiCredits(tenantId, 'recupera_ia_campaign', 15);

  const audit = scanRecoverableOpportunities(tenantId);
  const selectedCategory = audit.categories[categoryKey] || audit.categories.stalledDeals;

  const messagesByTone = {
    consultivo: {
      subject: 'Atualização sobre o seu projeto e novas condições especiais',
      message: 'Olá {{nome}}! Estava revisando nosso planejamento aqui na {{empresa}} e lembrei do seu projeto. Conseguimos liberar uma condição exclusiva nesta semana para você avançar sem travar seu fluxo de caixa.',
      argument: 'Foco em destravar gargalos operacionais e garantir ROI rápido sem atrito.',
      cta: 'Tem 5 minutos amanhã às 10h para vermos isso juntos?'
    },
    urgencia: {
      subject: 'Condição de fechamento reservada até sexta-feira',
      message: 'Olá {{nome}}, tudo bem? Passando para avisar que a condição especial que conversamos para a {{empresa_cliente}} está reservada no nosso sistema até o final desta semana.',
      argument: 'Garantia de tabela antiga e implementação prioritária na fila de clientes.',
      cta: 'Posso manter a sua vaga reservada?'
    },
    reativacao: {
      subject: 'Novidades importantes e nova rodada de atendimento',
      message: 'Oi {{nome}}! Sei que o dia a dia é corrido. Atualizamos nossa solução com agentes autônomos de IA e gostaria de saber se resolver {{dor_principal}} ainda é uma prioridade para vocês.',
      argument: 'Reabertura amigável de canal sem pressão comercial invasiva.',
      cta: 'Como está seu cronograma para este trimestre?'
    }
  };

  const template = messagesByTone[customTone] || messagesByTone.consultivo;

  const campaign = campaignsDB.insert({
    tenantId,
    name: `RecuperaIA: ${selectedCategory.label} (${new Date().toLocaleDateString('pt-BR')})`,
    category: categoryKey,
    targetCount: selectedCategory.count,
    tone: customTone,
    template,
    sequence: [
      { step: 1, delayHours: 0, channel: 'WhatsApp / E-mail', action: 'Primeiro toque de reativação de valor' },
      { step: 2, delayHours: 48, channel: 'WhatsApp', action: 'Envio de case de sucesso do mesmo nicho' },
      { step: 3, delayHours: 120, channel: 'WhatsApp / Ligação', action: 'Último contato e oferta de consultoria rápida' }
    ],
    status: 'pronta',
    complianceNotes: 'Disparo com respeito à LGPD e link de opt-out/descadastro automático.'
  });

  return campaign;
}

module.exports = {
  scanRecoverableOpportunities,
  generateRecoveryCampaign
};
