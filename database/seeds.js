const { leadsDB, dealsDB, activitiesDB, tasksDB, settingsDB } = require('./db');

function runSeeds(force = false) {
  if (!force && leadsDB.count() > 0) {
    console.log('⚡ [Seeds] Base de dados já populada. Pulando sementes.');
    return;
  }

  console.log('🌱 [Seeds] Populando base com dados de demonstração...');

  // Configurações Globais
  settingsDB.insert({
    id: 'general_settings',
    companyName: 'Agentise Empreendimentos Digitais',
    pixKey: 'luciano.contato@crm.ia.br',
    pixName: 'MEGA CRM AGENTISE',
    pixCity: 'SAO PAULO',
    currency: 'BRL',
    language: 'pt-BR',
    aiModel: 'Claude 3.7 Sonnet / Claude Code Engine'
  });

  // Leads
  const l1 = leadsDB.insert({
    name: 'Carlos Eduardo Silveira',
    company: 'Silveira Logística Integrada',
    role: 'Diretor de Operações',
    email: 'carlos@silveiralog.com.br',
    phone: '11987654321',
    estimatedBudget: 28000,
    tags: ['Logística', 'B2B', 'Decisor Direto'],
    notes: 'Empresa com 45 caminhões e perda de 15% em roteirização manual. Busca automação urgente com agentes de IA.'
  });

  const l2 = leadsDB.insert({
    name: 'Dra. Marina Albuquerque',
    company: 'Albuquerque Clínicas Médicas',
    role: 'Sócia-Proprietária',
    email: 'marina@albuquerqueclinicas.com.br',
    phone: '21976543210',
    estimatedBudget: 15500,
    tags: ['Saúde', 'High-Ticket', 'WhatsApp'],
    notes: 'Rede com 3 unidades no Rio. Secretárias sobrecarregadas com agendamentos no WhatsApp. Deseja qualificação automática de pacientes.'
  });

  const l3 = leadsDB.insert({
    name: 'Rodrigo Vasconcelos',
    company: 'Nexus Tech Educação',
    role: 'CEO & Fundador',
    email: 'rodrigo@nexustech.io',
    phone: '31965432109',
    estimatedBudget: 45000,
    tags: ['EdTech', 'SaaS', 'Escala'],
    notes: 'Plataforma de cursos online com 12 mil alunos. Quer implementar CRM automatizado com funil de vendas integrado ao PIX nativo.'
  });

  const l4 = leadsDB.insert({
    name: 'Beatriz Fagundes',
    company: 'Studio Fagundes Arquitetura',
    role: 'Arquiteta Titular',
    email: 'beatriz@fagundesarq.com.br',
    phone: '41954321098',
    estimatedBudget: 8500,
    tags: ['Design', 'PME'],
    notes: 'Escritório de arquitetura em expansão. Perde prazos de follow-up de orçamentos por falta de funil centralizado.'
  });

  const l5 = leadsDB.insert({
    name: 'Felipe Fontana',
    company: 'Fontana Distribuidora de Alimentos',
    role: 'Gerente Comercial',
    email: 'felipe@fontanaalimentos.com.br',
    phone: '19943210987',
    estimatedBudget: 35000,
    tags: ['Atacado', 'Varejo', 'B2B'],
    notes: 'Equipe externa de 12 representantes comerciais. Precisam de aplicativo ágil com pipeline e geração de propostas PIX na hora.'
  });

  // Oportunidades (Deals / Pipeline)
  const d1 = dealsDB.insert({
    leadId: l1.id,
    title: 'Implantação Agentes IA & Roteirização',
    value: 28000,
    stage: 'negociacao',
    priority: 'alta',
    probability: 80,
    assignedTo: 'Luciano',
    expectedCloseDate: '2026-09-30'
  });

  const d2 = dealsDB.insert({
    leadId: l2.id,
    title: 'Automação Atendimento Clínicas WhatsApp',
    value: 15500,
    stage: 'proposta',
    priority: 'alta',
    probability: 70,
    assignedTo: 'Luciano',
    expectedCloseDate: '2026-09-25'
  });

  const d3 = dealsDB.insert({
    leadId: l3.id,
    title: 'Mega CRM Integrado & Checkout PIX',
    value: 45000,
    stage: 'apresentacao',
    priority: 'urgente',
    probability: 60,
    assignedTo: 'Luciano',
    expectedCloseDate: '2026-10-15'
  });

  const d4 = dealsDB.insert({
    leadId: l4.id,
    title: 'Funil Comercial & Acompanhamento',
    value: 8500,
    stage: 'qualificacao',
    priority: 'media',
    probability: 40,
    assignedTo: 'Luciano',
    expectedCloseDate: '2026-10-05'
  });

  const d5 = dealsDB.insert({
    leadId: l5.id,
    title: 'Ecossistema de Vendas Externas',
    value: 35000,
    stage: 'ganho',
    priority: 'alta',
    probability: 100,
    assignedTo: 'Luciano',
    expectedCloseDate: '2026-09-10'
  });

  // Atividades Iniciais
  activitiesDB.insert({
    dealId: d1.id,
    leadId: l1.id,
    type: 'meeting',
    title: 'Reunião de Diagnóstico Realizada',
    description: 'Apresentada a arquitetura dos agentes autônomos. Cliente solicitou modelo de contrato com marcos via PIX.',
    timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
  });

  activitiesDB.insert({
    dealId: d2.id,
    leadId: l2.id,
    type: 'proposal_sent',
    title: 'Proposta Comercial Enviada no WhatsApp',
    description: 'Enviada proposta de R$ 15.500 com QR Code PIX e condições especiais para fechamento nesta semana.',
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  });

  // Tarefas Iniciais
  tasksDB.insert({
    dealId: d1.id,
    leadId: l1.id,
    title: 'Alinhamento final de contrato com Diretor Carlos',
    deadline: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
    completed: false,
    priority: 'urgente'
  });

  tasksDB.insert({
    dealId: d2.id,
    leadId: l2.id,
    title: 'Follow-up de proposta enviada para Dra. Marina',
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    completed: false,
    priority: 'alta'
  });

  tasksDB.insert({
    dealId: d3.id,
    leadId: l3.id,
    title: 'Apresentação ao vivo da demo do Mega CRM',
    deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    completed: false,
    priority: 'media'
  });

  console.log('✅ [Seeds] Base populada com sucesso!');
}

module.exports = {
  runSeeds
};
