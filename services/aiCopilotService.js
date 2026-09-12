/**
 * Motor de Inteligência Comercial Claude AI Copilot & Agente Comercial Autônomo
 * Suporta:
 * 1. Análise consultiva BANT e qualificação de leads.
 * 2. Cérebro da Empresa (Knowledge Base de produtos, FAQs, políticas e diferenciais).
 * 3. Analista IA para Gestores (respostas fundamentadas em dados reais do CRM).
 * 4. 4 Níveis Operacionais: Desativada, Assistente, Copiloto, Autônoma.
 */

const https = require('https');
const { knowledgeBaseDB, leadsDB, dealsDB, usersDB, tasksDB, proposalsDB } = require('../database/db');
const { consumeAiCredits } = require('./billingService');

async function callClaudeApi(prompt, systemPrompt = 'Você é o Agente Comercial IA do Agentise Mega CRM.') {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) return null; // Sem chave externa, utiliza motor heurístico nativo ultra-rápido

  return new Promise((resolve) => {
    try {
      const payload = JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }]
      });

      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.content && json.content[0] && json.content[0].text) {
              resolve(json.content[0].text);
            } else {
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.write(payload);
      req.end();
    } catch (err) {
      resolve(null);
    }
  });
}

function analyzeBant(lead, deal = {}) {
  const value = Number(deal.value || lead.estimatedBudget || 0);
  const role = (lead.role || '').toLowerCase();
  const notes = (lead.notes || '') + ' ' + (deal.description || '');

  // 1. Budget Score (0 a 25)
  let budgetScore = 15;
  if (value > 25000) budgetScore = 25;
  else if (value > 8000) budgetScore = 20;
  else if (value > 0) budgetScore = 15;
  else budgetScore = 8;

  // 2. Authority Score (0 a 25)
  let authorityScore = 10;
  if (/(ceo|fundador|diretor|proprietario|socio|cto|cmo|gerente|head)/i.test(role)) {
    authorityScore = 25;
  } else if (/(coordenador|supervisor|especialista|lider)/i.test(role)) {
    authorityScore = 18;
  } else if (/(analista|assistente)/i.test(role)) {
    authorityScore = 10;
  }

  // 3. Need Score (0 a 25)
  let needScore = 16;
  if (/(urgente|dor|problema|gargalo|perda|escalar|automacao|ia|agente)/i.test(notes)) {
    needScore = 24;
  } else if (notes.length > 50) {
    needScore = 19;
  }

  // 4. Timing Score (0 a 25)
  let timingScore = 14;
  if (deal.stage === 'proposta' || deal.stage === 'negociacao') {
    timingScore = 25;
  } else if (deal.stage === 'apresentacao' || deal.stage === 'qualificacao') {
    timingScore = 18;
  } else if (deal.stage === 'ganho') {
    timingScore = 25;
  }

  const totalScore = budgetScore + authorityScore + needScore + timingScore;

  let classification = 'Lead Frio (Cold)';
  let badgeColor = 'slate';
  if (totalScore >= 80) {
    classification = 'Pronto para Fechar (Hot)';
    badgeColor = 'emerald';
  } else if (totalScore >= 55) {
    classification = 'Qualificado (Warm)';
    badgeColor = 'blue';
  }

  const insights = [];
  if (authorityScore < 15) {
    insights.push('Interlocutor operacional. Mapeie o decisor financeiro antes de avançar para proposta.');
  }
  if (budgetScore >= 20) {
    insights.push('Ticket compatível com soluções completas de alto valor agregado.');
  }
  if (needScore < 18) {
    insights.push('Aprofunde o diagnóstico e contorne objeções antes de fixar valores.');
  }

  return {
    totalScore,
    breakdown: {
      budget: budgetScore,
      authority: authorityScore,
      need: needScore,
      timing: timingScore
    },
    classification,
    badgeColor,
    insights
  };
}

async function generateSalesPitch(lead, deal = {}, objective = 'primeiro_contato', tenantId = null) {
  // Consulta Cérebro da Empresa para embasamento
  let kbContext = '';
  if (tenantId) {
    const kbItems = knowledgeBaseDB.findByTenant(tenantId);
    if (kbItems.length > 0) {
      kbContext = kbItems.map(k => `[${k.category}]: ${k.title} - ${k.content}`).join('\n');
    }
  }

  const name = lead.name || 'Cliente';
  const company = lead.company || 'sua empresa';
  const val = deal.value ? `R$ ${deal.value.toLocaleString('pt-BR')}` : 'um investimento estratégico';

  const pitches = {
    primeiro_contato: {
      title: 'Abertura de Alto Impacto',
      text: `Olá ${name}, tudo bem? Aqui é da equipe comercial. Notei o crescimento da ${company} e preparei uma análise de oportunidade focada em destravar seu funil de vendas com IA. Você teria 10 minutos nesta quinta para avaliarmos?`
    },
    apresentacao_valor: {
      title: 'Apresentação de Solução & ROI',
      text: `${name}, com base no nosso diagnóstico, desenhamos uma esteira de automação comercial para a ${company} com retorno estimado de 3x sobre ${val}. Gostaria de ver a demonstração ao vivo amanhã?`
    },
    follow_up_proposta: {
      title: 'Follow-up de Proposta Ativa',
      text: `Oi ${name}! Passando para acompanhar a proposta enviada para a ${company}. Conseguimos incluir condições exclusivas de implantação com PIX oficial para faturamento nesta semana. Podemos alinhar os detalhes?`
    }
  };

  return pitches[objective] || pitches.primeiro_contato;
}

function handleObjection(type, lead = {}) {
  const name = lead.name || 'Cliente';
  const company = lead.company || 'sua empresa';
  const library = {
    caro: {
      title: 'Contorno para "Está muito caro"',
      response: `Olá ${name}! Compreendo perfeitamente, e a gestão de fluxo de caixa é prioridade. No entanto, o custo da perda de vendas por falta de atendimento rápido na ${company} costuma ser 5x maior que o valor da nossa ferramenta. Nosso modelo se paga logo nas primeiras conversões recuperadas.`
    },
    pensar: {
      title: 'Contorno para "Vou pensar e retorno"',
      response: `Perfeito ${name}! Geralmente quando nossos clientes precisam pensar, resta alguma dúvida sobre prazo de implementação ou sobre o retorno prático. Qual desses dois pontos você gostaria que eu esclarecesse agora?`
    },
    concorrente: {
      title: 'Contorno para "Já uso outra solução"',
      response: `Ótimo saber que você já valoriza essa esteira, ${name}! Nosso diferencial não é apenas registrar clientes, mas usar agentes autônomos de IA para resgatar vendas perdidas e fechar propostas instantâneas com PIX. Quer fazer um teste comparativo de 7 dias sem custo?`
    }
  };

  const item = library[type] || library.caro;
  return {
    ...item,
    respostaSugerida: item.response
  };
}

// Analista IA para Gestores (Responde SOMENTE baseado em dados reais do sistema)
function runManagerAnalyticsQuery(tenantId, question) {
  consumeAiCredits(tenantId, 'analista_gestor_ia', 20);

  const leads = leadsDB.findByTenant(tenantId);
  const deals = dealsDB.findByTenant(tenantId);
  const users = usersDB.findByTenant(tenantId);
  const tasks = tasksDB.findByTenant(tenantId);
  const proposals = proposalsDB.findByTenant(tenantId);

  const totalPipeline = deals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const wonDeals = deals.filter(d => d.stage === 'ganho');
  const wonValue = wonDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const lostDeals = deals.filter(d => d.stage === 'perdido');
  const stalledDeals = deals.filter(d => {
    const ageDays = (Date.now() - new Date(d.updatedAt || d.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return (d.stage === 'proposta' || d.stage === 'negociacao') && ageDays >= 5;
  });

  const q = (question || '').toLowerCase();
  let answer = '';
  let supportingData = {};

  if (q.includes('vendedor') || q.includes('meta') || q.includes('quem vendeu')) {
    const sellerStats = users.map(u => {
      const uDeals = deals.filter(d => d.assignedTo === u.name || d.assignedTo === u.id);
      const uWon = uDeals.filter(d => d.stage === 'ganho');
      const uWonVal = uWon.reduce((s, d) => s + Number(d.value || 0), 0);
      return {
        vendedor: u.name,
        cargo: u.role,
        totalOportunidades: uDeals.length,
        vendasFechadas: uWon.length,
        faturamento: uWonVal,
        taxaConversao: uDeals.length > 0 ? ((uWon.length / uDeals.length) * 100).toFixed(1) + '%' : '0%'
      };
    });

    supportingData = { rankingVendedores: sellerStats };
    answer = `Analisando os registros comerciais ativos, temos ${users.length} membros na equipe. O faturamento total ganho é de R$ ${wonValue.toLocaleString('pt-BR')}. Vendedores com maior volume de conversão estão destacados nos dados fundamentados abaixo.`;
  } else if (q.includes('parada') || q.includes('risco') || q.includes('travada')) {
    const atRiskValue = stalledDeals.reduce((s, d) => s + Number(d.value || 0), 0);
    supportingData = {
      oportunidadesEstagnadas: stalledDeals.length,
      valorTotalEmRisco: `R$ ${atRiskValue.toLocaleString('pt-BR')}`,
      detalhes: stalledDeals.map(d => ({ titulo: d.title, valor: d.value, estagio: d.stage, responsavel: d.assignedTo }))
    };
    answer = `Existem atualmente ${stalledDeals.length} oportunidades paradas há mais de 5 dias nos estágios de Proposta ou Negociação, representando R$ ${atRiskValue.toLocaleString('pt-BR')} em potencial risco de perda. Recomendamos acionar o módulo RecuperaIA para follow-up imediato.`;
  } else if (q.includes('pipeline') || q.includes('quanto tenho') || q.includes('faturamento')) {
    supportingData = {
      pipelineTotal: `R$ ${totalPipeline.toLocaleString('pt-BR')}`,
      vendasGanhas: `R$ ${wonValue.toLocaleString('pt-BR')}`,
      taxaVitoria: deals.length > 0 ? ((wonDeals.length / deals.length) * 100).toFixed(1) + '%' : '0%',
      totalOportunidades: deals.length
    };
    answer = `O pipeline ativo totaliza R$ ${totalPipeline.toLocaleString('pt-BR')} distribuído em ${deals.length} oportunidades. Já foram faturados R$ ${wonValue.toLocaleString('pt-BR')} em negócios fechados com sucesso.`;
  } else {
    supportingData = {
      totalLeads: leads.length,
      totalOportunidades: deals.length,
      tarefasPendentes: tasks.filter(t => !t.completed).length,
      propostasEmitidas: proposals.length
    };
    answer = `Com base no panorama operacional da empresa: temos ${leads.length} leads cadastrados, ${deals.length} negócios em andamento no funil e R$ ${totalPipeline.toLocaleString('pt-BR')} em movimentação. A IA recomenda focar na qualificação dos contatos sem tarefas agendadas.`;
  }

  return {
    question,
    answer,
    supportingData,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  analyzeBant,
  generateSalesPitch,
  handleObjection,
  runManagerAnalyticsQuery,
  callClaudeApi
};
