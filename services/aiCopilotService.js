/**
 * Motor de Inteligência Comercial Claude AI Copilot
 * Suporta execução híbrida:
 * 1. Heurística determinística ultra-rápida offline (padrão zero latência).
 * 2. Conexão transparente com API da Anthropic (Claude 3.5 / 3.7) caso fornecida chave de API.
 */

const https = require('https');

async function callClaudeApi(prompt, systemPrompt = 'Você é o Claude Sales Copilot especializado em fechamento de vendas B2B no Brasil.') {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) return null; // Sem chave, utiliza motor heurístico nativo

  return new Promise((resolve) => {
    try {
      const payload = JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
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
  
  let classification = 'Morno';
  let badgeColor = 'amber';
  if (totalScore >= 80) {
    classification = 'Ultra Qualificado (Hot)';
    badgeColor = 'emerald';
  } else if (totalScore >= 60) {
    classification = 'Qualificado (Warm)';
    badgeColor = 'blue';
  } else {
    classification = 'Em Nutrição (Cold)';
    badgeColor = 'slate';
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
    insights: generateBantInsights(totalScore, authorityScore, budgetScore)
  };
}

function generateBantInsights(totalScore, authorityScore, budgetScore) {
  const insights = [];
  if (authorityScore >= 20) {
    insights.push('Tomador de decisão direto identificado. Apresente propostas sem intermediários.');
  } else {
    insights.push('Interlocutor operacional. Mapeie o decisor financeiro antes de avançar para proposta.');
  }

  if (budgetScore >= 20) {
    insights.push('Ticket compatível com soluções completas de alto valor agregado.');
  } else {
    insights.push('Verifique condições especiais de entrada via PIX com parcelamento de marcos.');
  }

  if (totalScore >= 75) {
    insights.push('Momento ideal para fechamento com condição promocional em 24h.');
  } else {
    insights.push('Aprofunde o diagnóstico e contorne objeções antes de fixar valores.');
  }

  return insights;
}

async function generateSalesPitch(lead, deal = {}, objective = 'primeiro_contato') {
  const name = lead.name ? lead.name.split(' ')[0] : 'Parceiro';
  const company = lead.company || 'sua empresa';
  const val = Number(deal.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Tenta gerar via Claude API se houver chave configurada
  const prompt = `Gere uma abordagem de vendas persuasiva e profissional para WhatsApp em português brasileiro para o lead ${lead.name} da empresa ${company}. Objetivo: ${objective}. Valor do negócio: ${val}. Dores do lead: ${lead.notes || 'Sem observações'}. Mantenha direto, elegante e com call to action claro.`;
  const liveAi = await callClaudeApi(prompt);
  if (liveAi) {
    return {
      type: 'Abordagem Gerada por Claude AI Live',
      channel: 'whatsapp',
      subject: `Proposta para ${company}`,
      text: liveAi.trim()
    };
  }

  // Fallback Heurístico Nativo
  switch (objective) {
    case 'primeiro_contato':
      return {
        type: 'WhatsApp / E-mail de Prospecção',
        channel: 'whatsapp',
        subject: `Soluções em IA para ${company}`,
        text: `Olá, ${name}! Tudo bem?\n\nNotei a evolução expressiva da ${company} no mercado. Temos ajudado líderes a automatizarem fluxos operacionais e acelerarem vendas através de ecossistemas com Agentes de IA e CRM inteligente.\n\nVocê teria 10 minutinhos nesta quinta-feira para conversarmos sobre como reduzir seu ciclo de vendas? Abraço!`
      };

    case 'followup_proposta':
      return {
        type: 'Follow-up de Proposta Enviada',
        channel: 'whatsapp',
        subject: `Atualização sobre a Proposta da ${company}`,
        text: `Fala, ${name}! Tudo ótimo por aí?\n\nPassando para saber se você e sua equipe conseguiram analisar a proposta de ${val} que enviamos para a ${company}.\n\nPara fechamentos via PIX esta semana, conseguimos liberar o onboarding assistido sem custo adicional. Me avisa se podemos avançar? 🚀`
      };

    case 'quebra_objecao_preco':
      return {
        type: 'Contorno de Objeção (Preço/Valor)',
        channel: 'whatsapp',
        subject: `ROI e Retorno do Investimento para ${company}`,
        text: `Entendo perfeitamente sua preocupação com o orçamento, ${name}.\n\nQuando desenhamos esse projeto para a ${company}, calculamos que a economia operacional gerada e o ganho de conversão pagam o investimento de ${val} em menos de 45 dias.\n\nFaz sentido estruturarmos o pagamento em 2x via PIX com marco de entrega?`
      };

    case 'fechamento_pix':
      return {
        type: 'Fechamento com Pagamento PIX Imediato',
        channel: 'whatsapp',
        subject: `Formalização e Início dos Trabalhos`,
        text: `Excelente notícia, ${name}! 🎉\n\nJá reservei a equipe para iniciar a implantação na ${company}. Para formalizarmos e iniciarmos hoje mesmo, você pode efetuar o PIX de entrada. Posso te enviar o QR Code por aqui agora?`
      };

    default:
      return {
        type: 'Mensagem de Contato Padrão',
        channel: 'whatsapp',
        subject: `Contato Comercial`,
        text: `Olá, ${name}! Como estão os projetos na ${company}? Gostaria de apresentar uma novidade relevante para o seu segmento.`
      };
  }
}

function handleObjection(objectionType, lead = {}) {
  const name = lead.name ? lead.name.split(' ')[0] : 'Cliente';
  
  const responses = {
    caro: {
      titulo: 'Objeção: "Achei o valor elevado"',
      analise: 'O cliente comparou o valor a um custo, não a um investimento gerador de receita.',
      respostaSugerida: `Entendo, ${name}. Deixe-me fazer uma pergunta: se este projeto aumentar em 15% sua taxa de fechamento no próximo trimestre, o investimento ainda parecerá alto ou se pagará sozinho?`,
      proximoPasso: 'Apresentar cálculo do ROI baseado no volume atual da empresa.'
    },
    socio: {
      titulo: 'Objeção: "Preciso alinhar com meu sócio/diretoria"',
      analise: 'Falta de material de apoio para o defensor interno vender a ideia aos demais decisores.',
      respostaSugerida: `Faz todo sentido, ${name}. Geralmente sócios focam em segurança, prazos e ROI. Quer que eu prepare um sumário executivo em 1 página com o QR Code PIX e o plano de entrega para facilitar sua apresentação a ele?`,
      proximoPasso: 'Enviar One-Page Executive Summary em PDF ou WhatsApp.'
    },
    momento: {
      titulo: 'Objeção: "Agora estamos sem tempo / Não é a hora"',
      analise: 'Falta de senso de urgência ou sobrecarga momentânea de rotina.',
      respostaSugerida: `Compreendo perfeitamente, ${name}. O principal motivo pelo qual nossos clientes nos procuram é justamente a falta de tempo pela falta de automação e CRM integrado. Se começarmos hoje, em 7 dias sua equipe já ganha 2 horas livres diárias. Vale a pena postergar esse alívio?`,
      proximoPasso: 'Oferecer implementação piloto com menor atrito operacional.'
    },
    concorrente: {
      titulo: 'Objeção: "Já usamos outra ferramenta no mercado"',
      analise: 'Resistência à migração ou custo de mudança presumido.',
      respostaSugerida: `Excelente saber que vocês já têm essa cultura, ${name}. Nossa grande diferença é a IA integrada que redige abordagens e o checkout PIX oficial sem taxas abusivas de gateway. Nós não substituímos tudo no primeiro dia, nós turbinamos seus resultados.`,
      proximoPasso: 'Demonstrar caso de integração e diferencial de velocidade.'
    }
  };

  return responses[objectionType] || responses.caro;
}

function extractMeetingNotes(rawNotes) {
  if (!rawNotes || typeof rawNotes !== 'string') {
    return {
      resumo: 'Nenhuma nota informada.',
      decisor: 'Não especificado',
      dorPrincipal: 'Não identificada',
      acoesImediatas: ['Realizar novo contato de alinhamento']
    };
  }

  const lines = rawNotes.split('\n').filter(l => l.trim().length > 0);
  return {
    resumo: `Reunião com foco em identificação de demandas operacionais e viabilidade comercial. Pontos debatidos: ${lines.slice(0, 3).join('; ')}`,
    dorPrincipal: /problema|dor|gargalo|lento/i.test(rawNotes) 
      ? 'Processos manuais e lentidão no fechamento' 
      : 'Necessidade de aceleração de vendas e automação com IA',
    decisor: /socio|diretor|proprietario|ceo/i.test(rawNotes) ? 'Decisor direto presente' : 'Aguardando validação com decisores',
    acoesImediatas: [
      'Enviar proposta formal com PIX oficial em até 24 horas',
      'Registrar tarefas de acompanhamento no funil',
      'Configurar alertas de follow-up no WhatsApp'
    ]
  };
}

module.exports = {
  analyzeBant,
  generateSalesPitch,
  handleObjection,
  extractMeetingNotes
};
