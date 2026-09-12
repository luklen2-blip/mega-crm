const { 
  tenantsDB, 
  usersDB, 
  leadsDB, 
  dealsDB, 
  activitiesDB, 
  tasksDB, 
  settingsDB,
  knowledgeBaseDB,
  conversationsDB,
  messagesDB,
  automationsDB,
  vehiclesDB
} = require('./db');
const { hashPassword } = require('../services/authService');
const { seedSegmentAutomations } = require('../services/workflowEngine');
const { seedAutoDemoData } = require('../services/autoVerticalService');
const { seedAutoPrimeVeiculos } = require('../services/autoPrimeService');

function runSeeds(force = false) {
  // Garante que o Tenant Auto Prime Veículos exista
  if (!tenantsDB.findById('ten_autoprime_veiculos')) {
    seedAutoPrimeVeiculos();
  }

  if (!force && tenantsDB.count() > 1) {
    console.log('⚡ [Seeds] Base de dados multi-tenant já populada. Pulando sementes.');
    return;
  }

  console.log('🌱 [Seeds] Populando base com dados de demonstração SaaS Multi-Tenant...');

  // 1. Tenant Principal de Demonstração
  const tenant = tenantsDB.insert({
    id: 'ten_demo_agentise',
    name: 'Agentise Soluções Comerciais',
    segment: 'Serviços & Tecnologia B2B',
    teamSize: '6-15',
    plan: 'business',
    status: 'active',
    trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    aiCredits: 20000,
    aiCreditsUsed: 1450,
    settings: {
      currency: 'BRL',
      timezone: 'America/Sao_Paulo',
      aiLevel: 'copiloto',
      autoRecoveryEnabled: true
    }
  });

  const tenantId = tenant.id;

  // 2. Usuários Multi-Tenant (Admin, Gerente, Vendedor)
  const adminUser = usersDB.insert({
    id: 'usr_demo_luciano',
    tenantId,
    name: 'Luciano',
    email: 'luciano@recuperaia.local',
    passwordHash: hashPassword('admin123456'),
    role: 'ADMINISTRADOR',
    status: 'active',
    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Luciano'
  });

  const gerenteUser = usersDB.insert({
    id: 'usr_demo_rodrigo',
    tenantId,
    name: 'Rodrigo Martins',
    email: 'rodrigo@agentise.ia.br',
    passwordHash: hashPassword('gerente123'),
    role: 'GERENTE',
    status: 'active',
    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Rodrigo'
  });

  const vendedorUser = usersDB.insert({
    id: 'usr_demo_camila',
    tenantId,
    name: 'Camila Mendes',
    email: 'camila@agentise.ia.br',
    passwordHash: hashPassword('vendedor123'),
    role: 'VENDEDOR',
    status: 'active',
    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Camila'
  });

  // 3. Configurações Globais / PIX
  settingsDB.insert({
    id: 'general_settings',
    tenantId,
    companyName: 'Agentise Soluções Comerciais',
    pixKey: 'luciano.contato@crm.ia.br',
    pixName: 'MEGA CRM AGENTISE',
    pixCity: 'SAO PAULO',
    currency: 'BRL',
    language: 'pt-BR',
    aiModel: 'Claude 3.7 Sonnet / Claude Code Engine'
  });

  // 4. Cérebro da Empresa (Knowledge Base)
  const kbEntries = [
    {
      tenantId,
      category: 'Produtos & Serviços',
      title: 'Mega CRM SaaS Enterprise com Agentes de IA',
      content: 'Plataforma comercial com pipeline kanban, copiloto Claude AI, emissão de cobrança PIX EMV oficial e recuperação de vendas com IA. Planos a partir de R$ 197/mês.'
    },
    {
      tenantId,
      category: 'Diferenciais Competitivos',
      title: 'Por que o Agentise Mega CRM é diferente?',
      content: 'Não é um banco de dados passivo. Nossa IA qualifica ativamente o lead com BANT, gera mensagens personalizadas para WhatsApp e reativa oportunidades abandonadas sem intervenção humana manual.'
    },
    {
      tenantId,
      category: 'Políticas Comerciais & Pagamento',
      title: 'Formas de Pagamento e Condições',
      content: 'Aceitamos PIX instantâneo com geração de payload EMV e QR Code oficial do Banco Central, além de cartão de crédito em até 12x. Desconto de 15% no faturamento anual.'
    },
    {
      tenantId,
      category: 'Scripts de Contorno de Objeções',
      title: 'Contorno para objeção de preço alto',
      content: 'Demonstrar que o valor de 1 único cliente recuperado pelo módulo RecuperaIA cobre a anuidade inteira do sistema.'
    }
  ];

  for (const kb of kbEntries) {
    knowledgeBaseDB.insert(kb);
  }

  // 5. Leads B2B Brasileiros Realistas
  const l1 = leadsDB.insert({
    tenantId,
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
    tenantId,
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
    tenantId,
    name: 'Fernando Rossi',
    company: 'Rossi Engenharia & Construtora',
    role: 'CEO & Fundador',
    email: 'fernando@rossieng.com.br',
    phone: '31988776655',
    estimatedBudget: 45000,
    tags: ['Construção Civil', 'Enterprise', 'Pipeline Longo'],
    notes: 'Negociando esteira comercial para lançamentos imobiliários. Ticket médio alto, ciclo de fechamento em 60 dias.'
  });

  const l4 = leadsDB.insert({
    tenantId,
    name: 'Patrícia Prado',
    company: 'Prado Advocacia Previdenciária',
    role: 'Sócia Administradora',
    email: 'patricia@pradoadv.com.br',
    phone: '41977889900',
    estimatedBudget: 8900,
    tags: ['Jurídico', 'Qualificação Rápida', 'Atendimento'],
    notes: 'Recebe mais de 80 mensagens/dia de consultas previdenciárias. Necessita de triagem e agendamento automático com PIX de consulta.'
  });

  const l5 = leadsDB.insert({
    tenantId,
    name: 'Lucas Brandão',
    company: 'Brandão Autopeças Distribuidora',
    role: 'Gerente Comercial',
    email: 'lucas@brandaodistribuidora.com.br',
    phone: '19966554433',
    estimatedBudget: 19000,
    tags: ['Distribuição', 'Varejo B2B', 'Recorrência'],
    notes: 'Distribuidor para 120 oficinas na região de Campinas. Vendedores gastam 3h/dia montando orçamentos manuais.'
  });

  // 6. Oportunidades no Pipeline Kanban
  const d1 = dealsDB.insert({
    tenantId,
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
    tenantId,
    leadId: l2.id,
    title: 'Triagem & Qualificação WhatsApp Clínicas',
    value: 15500,
    stage: 'proposta',
    priority: 'alta',
    probability: 65,
    assignedTo: 'Camila Mendes',
    expectedCloseDate: '2026-10-05'
  });

  const d3 = dealsDB.insert({
    tenantId,
    leadId: l3.id,
    title: 'CRM Imobiliário Customizado + Integrações',
    value: 45000,
    stage: 'qualificacao',
    priority: 'alta',
    probability: 40,
    assignedTo: 'Luciano',
    expectedCloseDate: '2026-11-15'
  });

  const d4 = dealsDB.insert({
    tenantId,
    leadId: l4.id,
    title: 'Automação Atendimento & Consulta PIX',
    value: 8900,
    stage: 'ganho',
    priority: 'media',
    probability: 100,
    assignedTo: 'Camila Mendes',
    expectedCloseDate: '2026-09-10'
  });

  const d5 = dealsDB.insert({
    tenantId,
    leadId: l5.id,
    title: 'Piloto Orçamentos Automatizados WhatsApp',
    value: 19000,
    stage: 'prospeccao',
    priority: 'media',
    probability: 25,
    assignedTo: 'Rodrigo Martins',
    expectedCloseDate: '2026-10-20'
  });

  // 7. Tarefas Comerciais
  tasksDB.insert({
    tenantId,
    dealId: d1.id,
    leadId: l1.id,
    title: 'Reunião de alinhamento de contrato com Carlos Eduardo',
    deadline: '2026-09-14T14:00:00.000Z',
    completed: false,
    priority: 'alta'
  });

  tasksDB.insert({
    tenantId,
    dealId: d2.id,
    leadId: l2.id,
    title: 'Follow-up da proposta enviada para Dra. Marina via WhatsApp',
    deadline: '2026-09-13T10:00:00.000Z',
    completed: false,
    priority: 'alta'
  });

  tasksDB.insert({
    tenantId,
    dealId: d3.id,
    leadId: l3.id,
    title: 'Mapear requisitos de integração com ERP da Rossi Construtora',
    deadline: '2026-09-18T16:00:00.000Z',
    completed: false,
    priority: 'media'
  });

  // 8. Conversas Omnichannel Demonstrativas
  const conv1 = conversationsDB.insert({
    tenantId,
    leadId: l1.id,
    customerName: 'Carlos Eduardo Silveira',
    customerPhone: '11987654321',
    channel: 'whatsapp',
    status: 'em_atendimento',
    lastMessage: 'Gostei muito da proposta, podemos agendar para segunda-feira?',
    lastMessageAt: new Date(Date.now() - 3600000).toISOString()
  });

  messagesDB.insert({
    tenantId,
    conversationId: conv1.id,
    sender: 'cliente',
    senderName: 'Carlos Eduardo',
    text: 'Olá! Vi a demonstração do Mega CRM e gostaria de entender como ele integra na nossa frota.',
    createdAt: new Date(Date.now() - 7200000).toISOString()
  });

  messagesDB.insert({
    tenantId,
    conversationId: conv1.id,
    sender: 'vendedor',
    senderName: 'Luciano',
    text: 'Olá Carlos! Perfeito, temos um módulo com agentes de IA que automatiza roteirização e orçamentos.',
    createdAt: new Date(Date.now() - 5400000).toISOString()
  });

  messagesDB.insert({
    tenantId,
    conversationId: conv1.id,
    sender: 'cliente',
    senderName: 'Carlos Eduardo',
    text: 'Gostei muito da proposta, podemos agendar para segunda-feira?',
    createdAt: new Date(Date.now() - 3600000).toISOString()
  });

  // 9. Automações de Exemplo e Dados Verticais Auto
  seedSegmentAutomations(tenantId, 'Serviços & Tecnologia B2B');
  seedAutoDemoData(tenantId);

  console.log('✅ [Seeds] Base de dados SaaS Multi-Tenant populada com sucesso.');
}

module.exports = {
  runSeeds
};
