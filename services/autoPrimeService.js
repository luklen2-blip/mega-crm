/**
 * AGENTISE MEGA CRM - Módulo de Demonstração & Validação: Auto Prime Veículos
 * Responsável por orquestrar o Teste 16 (Fluxo Real de Venda de Ponta a Ponta):
 * - Cadastro de Concessionária Multi-Tenant (Auto Prime Veículos)
 * - 3 Vendedores de Alta Performance
 * - 50 Leads Automotivos Reais
 * - 20 Oportunidades Ativas no Funil (Kanban)
 * - 10 Propostas Comerciais com PIX Oficial
 * - 5 Vendas Concluídas Iniciais (R$ 738.000,00)
 * - Execução do Fluxo Real: Lead -> Atendimento -> Qualificação -> Oportunidade -> Proposta -> Venda
 * - Consolidação do Dashboard Comercial Executivo (R$ 1.078.000,00 em faturamento ganho)
 */

const { 
  tenantsDB, 
  usersDB, 
  leadsDB, 
  dealsDB, 
  activitiesDB, 
  tasksDB, 
  proposalsDB, 
  vehiclesDB, 
  knowledgeBaseDB, 
  automationsDB 
} = require('../database/db');
const { hashPassword, generateToken, sanitizeUser } = require('./authService');
const { generatePixPayload, getPixQrCodeUrl } = require('./pixService');

const AUTOPRIME_TENANT_ID = 'ten_autoprime_veiculos';

// 50 Leads Automotivos Reais Brasileiros
const LEADS_DATA = [
  { name: 'Marcelo Silveira', phone: '11987110001', email: 'marcelo.silveira@grupom.com.br', company: 'Grupo M Logística', model: 'Corolla XEi 2023', budget: 135000, origin: 'WhatsApp' },
  { name: 'Dra. Vanessa Guimarães', phone: '11987110002', email: 'vanessa@guimaraesodonto.com.br', company: 'Clínica Odonto Prime', model: 'Tracker Premier 1.2 Turbo', budget: 115000, origin: 'Instagram' },
  { name: 'Bruno Albuquerque', phone: '21987110003', email: 'bruno@albuquerqueserv.com.br', company: 'Albuquerque Serviços', model: 'Hilux SRV 4x4 Diesel', budget: 245000, origin: 'Showroom' },
  { name: 'Patrícia Castro', phone: '31987110004', email: 'patricia@castroconsultoria.com.br', company: 'Castro Consultoria', model: 'Honda Civic G10 Touring', budget: 138000, origin: 'Web' },
  { name: 'Ricardo Vasconcelos', phone: '41987110005', email: 'ricardo@vasconceloseng.com.br', company: 'Vasconcelos Engenharia', model: 'Nivus Highline 2023', budget: 112000, origin: 'WhatsApp' },
  { name: 'Larissa Fontes', phone: '19987110006', email: 'larissa@fontesdesign.com.br', company: 'Studio Fontes Interiores', model: 'Fiat Fastback Limited', budget: 125000, origin: 'Instagram' },
  { name: 'Eduardo Fagundes', phone: '51987110007', email: 'eduardo@fagundesagri.com.br', company: 'Fagundes Agropecuária', model: 'Pulse Abarth Turbo 270', budget: 135000, origin: 'Indicação' },
  { name: 'Camila Antunes', phone: '71987110008', email: 'camila@antunesadv.com.br', company: 'Antunes & Associados', model: 'Hyundai Creta Ultimate', budget: 148000, origin: 'WhatsApp' },
  { name: 'Gustavo Nogueira', phone: '81987110009', email: 'gustavo@nogueiraimoveis.com.br', company: 'Nogueira Imóveis Prime', model: 'Nissan Kicks Exclusive', budget: 119000, origin: 'Showroom' },
  { name: 'Mariana Peixoto', phone: '11987110010', email: 'mariana@peixotomed.com.br', company: 'Hospital Santa Rita', model: 'Corolla Cross XRX Hybrid', budget: 185000, origin: 'Web' },
  { name: 'Renato Figueiredo', phone: '11987110011', email: 'renato@figueiredofarm.com.br', company: 'Rede Drogarias Figueiredo', model: 'VW Taos Highline 2023', budget: 172000, origin: 'WhatsApp' },
  { name: 'Tatiana Meireles', phone: '21987110012', email: 'tatiana@meirelesarq.com.br', company: 'Meireles Arquitetura', model: 'T-Cross Comfortline', budget: 118000, origin: 'Instagram' },
  { name: 'André Siqueira', phone: '31987110013', email: 'andre@siqueiramineracao.com.br', company: 'Siqueira Mineração', model: 'Ford Ranger XLS 4x4', budget: 228000, origin: 'Indicação' },
  { name: 'Juliana Barreto', phone: '41987110014', email: 'juliana@barretoboutique.com.br', company: 'Barreto Moda & Luxo', model: 'Jeep Commander Limited', budget: 215000, origin: 'Showroom' },
  { name: 'Felipe Dornelles', phone: '51987110015', email: 'felipe@dornellestec.com.br', company: 'Dornelles Automação', model: 'Caoa Chery Tiggo 7 Pro', budget: 159000, origin: 'WhatsApp' },
  { name: 'Aline Valente', phone: '19987110016', email: 'aline@valentegourmet.com.br', company: 'Valente Gastronomia', model: 'Renault Duster Iconic', budget: 108000, origin: 'Web' },
  { name: 'Gabriel Medeiros', phone: '11987110017', email: 'gabriel@medeirosfrotas.com.br', company: 'Medeiros Locações', model: 'Audi Q3 Prestige Plus', budget: 258000, origin: 'Showroom' },
  { name: 'Priscila Rocha', phone: '21987110018', email: 'priscila@rochacomex.com.br', company: 'Rocha Comércio Exterior', model: 'Honda HR-V Touring', budget: 188000, origin: 'Instagram' },
  { name: 'Leonardo Toledo', phone: '31987110019', email: 'leonardo@toledoseguros.com.br', company: 'Toledo Corretora de Seguros', model: 'Toyota Yaris XLS Sedã', budget: 105000, origin: 'WhatsApp' },
  { name: 'Bianca Esteves', phone: '41987110020', email: 'bianca@estevesestetica.com.br', company: 'Clínica Dermatológica Esteves', model: 'Chevrolet Montana Premier', budget: 122000, origin: 'Showroom' },
  { name: 'Lucas Pimentel', phone: '11987110021', email: 'lucas@pimentelholding.com.br', company: 'Holding Pimentel & Cia', model: 'Fiat Toro Volcano Diesel', budget: 158000, origin: 'Web' },
  { name: 'Carla Brandão', phone: '11987110022', email: 'carla@brandaopsico.com.br', company: 'Consultório Carla Brandão', model: 'Peugeot 208 Griffe Turbo', budget: 98000, origin: 'Instagram' },
  { name: 'Diego Faria', phone: '21987110023', email: 'diego@fariadvogados.com.br', company: 'Faria & Silva Advocacia', model: 'BMW 320i Sport GP', budget: 275000, origin: 'Indicação' },
  { name: 'Monique Lemos', phone: '31987110024', email: 'monique@lemoscosmeticos.com.br', company: 'Lemos Dermocosméticos', model: 'Mercedes-Benz C 200 AMG', budget: 310000, origin: 'Showroom' },
  { name: 'Danilo Rezende', phone: '41987110025', email: 'danilo@rezendefrete.com.br', company: 'Rezende Transportes Rápidos', model: 'RAM Rampage Laramie', budget: 235000, origin: 'WhatsApp' },
  { name: 'Beatriz Sampaio', phone: '19987110026', email: 'beatriz@sampaiovet.com.br', company: 'Hospital Veterinário Sampaio', model: 'Volvo XC40 Recharge', budget: 320000, origin: 'Web' },
  { name: 'Rodrigo Caetano', phone: '51987110027', email: 'rodrigo@caetanobikes.com.br', company: 'Caetano Distribuição', model: 'Mitsubishi Eclipse Cross', budget: 175000, origin: 'Showroom' },
  { name: 'Fernanda Dantas', phone: '71987110028', email: 'fernanda@dantasrh.com.br', company: 'Dantas Soluções em RH', model: 'BYD Dolphin Plus Elétrico', budget: 169000, origin: 'Instagram' },
  { name: 'Alexandre Borges', phone: '81987110029', email: 'alexandre@borgesconstrutora.com.br', company: 'Borges Edificações', model: 'Toyota SW4 Diamond 4x4', budget: 380000, origin: 'Indicação' },
  { name: 'Carolina Freitas', phone: '11987110030', email: 'carolina@freitascomunicacao.com.br', company: 'Freitas Agência Digital', model: 'GWM Haval H6 HEV', budget: 214000, origin: 'WhatsApp' },
  { name: 'Maurício Vianna', phone: '21987110031', email: 'mauricio@viannaassessoria.com.br', company: 'Vianna Contabilidade', model: 'Honda City Hatchback Touring', budget: 118000, origin: 'Web' },
  { name: 'Débora Neves', phone: '31987110032', email: 'debora@nevesfisioterapia.com.br', company: 'Clínica Neves Reabilitação', model: 'Hyundai HB20 Platinum Plus', budget: 95000, origin: 'Showroom' },
  { name: 'Vinícius Aguiar', phone: '41987110033', email: 'vinicius@aguiargrafica.com.br', company: 'Gráfica Express Aguiar', model: 'Fiat Strada Ranch CVT', budget: 124000, origin: 'WhatsApp' },
  { name: 'Letícia Muniz', phone: '11987110034', email: 'leticia@munizdecor.com.br', company: 'Muniz Design de Interiores', model: 'Jeep Renegade Serie S', budget: 152000, origin: 'Instagram' },
  { name: 'Cristiano Paiva', phone: '19987110035', email: 'cristiano@paivatecnologia.com.br', company: 'Paiva Softwares Cloud', model: 'VW Polo GTS 1.4 TSI', budget: 139000, origin: 'Web' },
  { name: 'Sabrina Gouveia', phone: '51987110036', email: 'sabrina@gouveiaproducoes.com.br', company: 'Gouveia Eventos Corporativos', model: 'Nissan Sentra Exclusive', budget: 165000, origin: 'Showroom' },
  { name: 'Caio Pinheiro', phone: '71987110037', email: 'caio@pinheirolog.com.br', company: 'Pinheiro Cargas Nordeste', model: 'Chevrolet S10 High Country', budget: 285000, origin: 'Indicação' },
  { name: 'Rafaela Simões', phone: '81987110038', email: 'rafaela@simoesimunologia.com.br', company: 'Instituto Simões de Vacinas', model: 'Kia Stonic Hybrid', budget: 129000, origin: 'WhatsApp' },
  { name: 'Tiago Bueno', phone: '11987110039', email: 'tiago@buenoengenharia.com.br', company: 'Bueno & Bueno Projetos', model: 'Subaru Forester e-Boxer', budget: 230000, origin: 'Web' },
  { name: 'Lorena Maciel', phone: '21987110040', email: 'lorena@macielodonto.com.br', company: 'Maciel Harmonização Facial', model: 'Mini Cooper S Countryman', budget: 290000, origin: 'Instagram' },
  { name: 'Fábio Camargo', phone: '31987110041', email: 'fabio@camargometal.com.br', company: 'Camargo Metalúrgica', model: 'Ford Territory Titanium', budget: 198000, origin: 'Showroom' },
  { name: 'Natália Ramos', phone: '41987110042', email: 'natalia@ramosadvocacia.com.br', company: 'Ramos Direito Tributário', model: 'Audi A3 Sedan S line', budget: 249000, origin: 'Indicação' },
  { name: 'Igor Vasques', phone: '11987110043', email: 'igor@vasquescomercio.com.br', company: 'Vasques Representações', model: 'BYD Song Plus DM-i', budget: 229000, origin: 'WhatsApp' },
  { name: 'Cláudia Zanin', phone: '19987110044', email: 'claudia@zaninmodas.com.br', company: 'Zanin Atacado Têxtil', model: 'Toyota Corolla GLi 2023', budget: 122000, origin: 'Web' },
  { name: 'Murilo Pacheco', phone: '51987110045', email: 'murilo@pachecocereais.com.br', company: 'Pacheco Grãos & Cereais', model: 'VW Amarok V6 Extreme', budget: 315000, origin: 'Showroom' },
  { name: 'Kelly Morais', phone: '71987110046', email: 'kelly@moraisturismo.com.br', company: 'Morais Viagens e Receptivo', model: 'Citroën C3 Aircross 7 Lugares', budget: 129000, origin: 'Instagram' },
  { name: 'Arthur Bernardes', phone: '81987110047', email: 'arthur@bernardesclinica.com.br', company: 'Centro Cirúrgico Bernardes', model: 'Lexus NX 350h F-Sport', budget: 375000, origin: 'Indicação' },
  { name: 'Flávia Coimbra', phone: '11987110048', email: 'flavia@coimbrabrokers.com.br', company: 'Coimbra Investimentos', model: 'Porsche Macan 2.0 Turbo', budget: 410000, origin: 'Showroom' },
  { name: 'Samuel Linhares', phone: '21987110049', email: 'samuel@linharesseguranca.com.br', company: 'Linhares Segurança Privada', model: 'Chevrolet Spin Premier 7L', budget: 124000, origin: 'WhatsApp' },
  { name: 'Helena Portela', phone: '31987110050', email: 'helena@portelamedicina.com.br', company: 'Portela Diagnósticos por Imagem', model: 'Volvo XC60 T8 Recharge', budget: 395000, origin: 'Web' }
];

function seedAutoPrimeVeiculos(force = false) {
  const existingTenant = tenantsDB.findById(AUTOPRIME_TENANT_ID);
  if (existingTenant && !force) {
    return existingTenant;
  }

  // 1. Cria Tenant Auto Prime Veículos
  let tenant = existingTenant;
  if (!tenant) {
    tenant = tenantsDB.insert({
      id: AUTOPRIME_TENANT_ID,
      name: 'Auto Prime Veículos',
      segment: 'Concessionária e Revenda de Veículos',
      teamSize: '6-15',
      plan: 'business',
      status: 'active',
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      aiCredits: 25000,
      aiCreditsUsed: 2340,
      settings: {
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
        aiLevel: 'copiloto',
        autoRecoveryEnabled: true
      }
    });
  }

  // 2. Usuários (1 Admin Diretor + 3 Vendedores)
  const sellers = [
    {
      id: 'usr_autoprime_fernanda',
      tenantId: AUTOPRIME_TENANT_ID,
      name: 'Fernanda Lima',
      email: 'fernanda.vendas@autoprime.com.br',
      passwordHash: hashPassword('vendas123'),
      role: 'VENDEDOR',
      status: 'active',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Fernanda+Lima'
    },
    {
      id: 'usr_autoprime_rodrigo',
      tenantId: AUTOPRIME_TENANT_ID,
      name: 'Rodrigo Martins',
      email: 'rodrigo.vendas@autoprime.com.br',
      passwordHash: hashPassword('vendas123'),
      role: 'VENDEDOR',
      status: 'active',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Rodrigo+Martins'
    },
    {
      id: 'usr_autoprime_thiago',
      tenantId: AUTOPRIME_TENANT_ID,
      name: 'Thiago Oliveira',
      email: 'thiago.vendas@autoprime.com.br',
      passwordHash: hashPassword('vendas123'),
      role: 'VENDEDOR',
      status: 'active',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Thiago+Oliveira'
    }
  ];

  // Insere ou atualiza usuários
  sellers.forEach(s => {
    const existing = usersDB.findById(s.id);
    if (!existing) usersDB.insert(s);
  });

  const adminUser = usersDB.findById('usr_autoprime_admin');
  if (!adminUser) {
    usersDB.insert({
      id: 'usr_autoprime_admin',
      tenantId: AUTOPRIME_TENANT_ID,
      name: 'Carlos Eduardo (Diretor Comercial)',
      email: 'admin@autoprime.com.br',
      passwordHash: hashPassword('admin123456'),
      role: 'ADMINISTRADOR',
      status: 'active',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Carlos+Eduardo'
    });
  }

  // 3. Cadastra os 50 Leads
  const sellerNames = ['Fernanda Lima', 'Rodrigo Martins', 'Thiago Oliveira'];
  const createdLeads = [];

  LEADS_DATA.forEach((item, idx) => {
    const leadId = `lead_autoprime_${(idx + 1).toString().padStart(2, '0')}`;
    let l = leadsDB.findById(leadId);
    const assignedSeller = sellerNames[idx % 3];
    if (!l) {
      l = leadsDB.insert({
        id: leadId,
        tenantId: AUTOPRIME_TENANT_ID,
        name: item.name,
        company: item.company,
        role: 'Cliente Comprador',
        email: item.email,
        phone: item.phone,
        estimatedBudget: item.budget,
        assignedTo: assignedSeller,
        stage: idx < 25 ? 'qualificado' : 'novo',
        tags: ['Automotivo', item.model, item.origin],
        notes: `Interesse focado no veículo: ${item.model}. Orçamento previsto de R$ ${item.budget.toLocaleString('pt-BR')}. Origem: ${item.origin}.`
      });
    }
    createdLeads.push(l);
  });

  // 4. Cadastra as 20 Oportunidades em Aberto no Funil
  const OPEN_DEALS_CONFIG = [
    // 4 em prospeccao
    { title: 'Interesse Tracker Premier 1.2 Turbo - Dra. Vanessa Guimarães', value: 115000, stage: 'prospeccao', leadIdx: 1, seller: 'Fernanda Lima' },
    { title: 'Prospecção Hilux SRV 4x4 Diesel - Bruno Albuquerque', value: 245000, stage: 'prospeccao', leadIdx: 2, seller: 'Rodrigo Martins' },
    { title: 'Consulta Honda Civic G10 Touring - Patrícia Castro', value: 138000, stage: 'prospeccao', leadIdx: 3, seller: 'Thiago Oliveira' },
    { title: 'Interesse Nivus Highline 2023 - Ricardo Vasconcelos', value: 112000, stage: 'prospeccao', leadIdx: 4, seller: 'Fernanda Lima' },
    
    // 4 em qualificacao
    { title: 'Qualificação Fastback Limited 2023 - Larissa Fontes', value: 125000, stage: 'qualificacao', leadIdx: 5, seller: 'Rodrigo Martins' },
    { title: 'Avaliação Usado na Troca Pulse Abarth - Eduardo Fagundes', value: 135000, stage: 'qualificacao', leadIdx: 6, seller: 'Thiago Oliveira' },
    { title: 'Qualificação Creta Ultimate 2.0 - Camila Antunes', value: 148000, stage: 'qualificacao', leadIdx: 7, seller: 'Fernanda Lima' },
    { title: 'Simulação Financiamento Kicks Exclusive - Gustavo Nogueira', value: 119000, stage: 'qualificacao', leadIdx: 8, seller: 'Rodrigo Martins' },

    // 4 em apresentacao
    { title: 'Test-Drive Agendado Corolla Cross XRX - Mariana Peixoto', value: 185000, stage: 'apresentacao', leadIdx: 9, seller: 'Thiago Oliveira' },
    { title: 'Apresentação Showroom Taos Highline - Renato Figueiredo', value: 172000, stage: 'apresentacao', leadIdx: 10, seller: 'Fernanda Lima' },
    { title: 'Demonstração Técnica Ranger XLS 4x4 - André Siqueira', value: 228000, stage: 'apresentacao', leadIdx: 11, seller: 'Rodrigo Martins' },
    { title: 'Apresentação Presencial T-Cross Comfortline - Tatiana Meireles', value: 118000, stage: 'apresentacao', leadIdx: 12, seller: 'Thiago Oliveira' },

    // 4 em proposta
    { title: 'Proposta Enviada Commander Limited 2023 - Juliana Barreto', value: 215000, stage: 'proposta', leadIdx: 13, seller: 'Fernanda Lima' },
    { title: 'Orçamento Formalizado Tiggo 7 Pro Max - Felipe Dornelles', value: 159000, stage: 'proposta', leadIdx: 14, seller: 'Rodrigo Martins' },
    { title: 'Proposta Comercial Duster Iconic Plus - Aline Valente', value: 108000, stage: 'proposta', leadIdx: 15, seller: 'Thiago Oliveira' },
    { title: 'Minuta de Compra Audi Q3 Prestige Plus - Gabriel Medeiros', value: 258000, stage: 'proposta', leadIdx: 16, seller: 'Fernanda Lima' },

    // 4 em negociacao
    { title: 'Negociação de Entrada e Bônus Troca HR-V Touring - Priscila Rocha', value: 188000, stage: 'negociacao', leadIdx: 17, seller: 'Rodrigo Martins' },
    { title: 'Fechamento Condições Taxa Zero Yaris XLS - Leonardo Toledo', value: 105000, stage: 'negociacao', leadIdx: 18, seller: 'Thiago Oliveira' },
    { title: 'Alinhamento Final Financiamento Montana Premier - Bianca Esteves', value: 122000, stage: 'negociacao', leadIdx: 19, seller: 'Fernanda Lima' },
    { title: 'Aprovação de Crédito Bancário Toro Volcano - Lucas Pimentel', value: 158000, stage: 'negociacao', leadIdx: 20, seller: 'Rodrigo Martins' }
  ];

  const createdDeals = [];
  OPEN_DEALS_CONFIG.forEach((d, idx) => {
    const dealId = `deal_autoprime_open_${(idx + 1).toString().padStart(2, '0')}`;
    let deal = dealsDB.findById(dealId);
    const lead = createdLeads[d.leadIdx];
    if (!deal) {
      deal = dealsDB.insert({
        id: dealId,
        tenantId: AUTOPRIME_TENANT_ID,
        leadId: lead ? lead.id : null,
        title: d.title,
        value: d.value,
        stage: d.stage,
        assignedTo: d.seller,
        probability: d.stage === 'negociacao' ? 80 : (d.stage === 'proposta' ? 60 : 30),
        notes: `Veículo em negociação na Auto Prime Veículos por ${d.seller}.`
      });
    }
    createdDeals.push(deal);
  });

  // 5. Cadastra as 10 Propostas Comerciais com PIX EMV Oficial
  for (let i = 0; i < 10; i++) {
    const propId = `prop_autoprime_${(i + 1).toString().padStart(2, '0')}`;
    const deal = createdDeals[10 + i]; // Deals em apresentação, proposta e negociação
    if (!proposalsDB.findById(propId)) {
      const amount = deal ? deal.value : 120000;
      const pixPayload = generatePixPayload({
        pixKey: 'financeiro@autoprime.com.br',
        name: 'AUTO PRIME VEICULOS LTDA',
        city: 'SAO PAULO',
        amount: amount,
        txId: `PROP${(i + 1).toString().padStart(4, '0')}`
      });
      proposalsDB.insert({
        id: propId,
        tenantId: AUTOPRIME_TENANT_ID,
        dealId: deal ? deal.id : null,
        leadId: deal ? deal.leadId : null,
        amount,
        pixKey: 'financeiro@autoprime.com.br',
        pixPayload,
        qrCodeUrl: getPixQrCodeUrl(pixPayload),
        status: 'pendente',
        notes: `Proposta oficial com chave PIX do Banco Central emitida para ${deal ? deal.title : 'Veículo'}.`
      });
    }
  }

  // 6. Cadastra as 5 Vendas Fechadas/Ganha Iniciais (Total R$ 738.000,00)
  const WON_DEALS_CONFIG = [
    {
      id: 'deal_autoprime_won_01',
      title: 'Venda Concluída: Jeep Compass Limited 2023 - Dra. Juliana Mendes',
      value: 165000,
      seller: 'Fernanda Lima',
      leadId: createdLeads[0].id
    },
    {
      id: 'deal_autoprime_won_02',
      title: 'Venda Concluída: Toyota Corolla Altis Hybrid 2024 - Eng. Marcos Tavares',
      value: 178000,
      seller: 'Rodrigo Martins',
      leadId: createdLeads[1].id
    },
    {
      id: 'deal_autoprime_won_03',
      title: 'Venda Concluída: VW T-Cross Highline 2023 - Rafael Souza',
      value: 132000,
      seller: 'Thiago Oliveira',
      leadId: createdLeads[2].id
    },
    {
      id: 'deal_autoprime_won_04',
      title: 'Venda Concluída: Honda HR-V EXL 2023 - Camila Fonseca',
      value: 145000,
      seller: 'Fernanda Lima',
      leadId: createdLeads[3].id
    },
    {
      id: 'deal_autoprime_won_05',
      title: 'Venda Concluída: Chevrolet Tracker Premier 2022 - Dr. Bruno Rezende',
      value: 118000,
      seller: 'Rodrigo Martins',
      leadId: createdLeads[4].id
    }
  ];

  WON_DEALS_CONFIG.forEach(w => {
    if (!dealsDB.findById(w.id)) {
      dealsDB.insert({
        id: w.id,
        tenantId: AUTOPRIME_TENANT_ID,
        leadId: w.leadId,
        title: w.title,
        value: w.value,
        stage: 'ganho',
        assignedTo: w.seller,
        probability: 100,
        notes: `Venda faturada e entregue com sucesso pela concessionária Auto Prime Veículos por ${w.seller}.`
      });
    }
  });

  return tenant;
}

/**
 * Executa o fluxo de venda completo de ponta a ponta:
 * Lead -> Atendimento -> Qualificação -> Oportunidade -> Proposta -> Venda
 */
function executeFullSalesFlow() {
  const stepsAudit = [];

  // PASSO 1: Cadastro do Novo Lead (51º Lead)
  const leadId = 'lead_autoprime_51_villasboas';
  let lead = leadsDB.findById(leadId);
  if (lead) leadsDB.delete(leadId);

  lead = leadsDB.insert({
    id: leadId,
    tenantId: AUTOPRIME_TENANT_ID,
    name: 'Dr. André Villas-Bôas',
    company: 'Villas-Bôas Sociedade de Advogados',
    role: 'Sócio-Diretor',
    email: 'andre.villas@advocacia.com.br',
    phone: '11987654321',
    estimatedBudget: 340000,
    assignedTo: 'Fernanda Lima',
    stage: 'novo',
    tags: ['Automotivo', 'High-Ticket', 'BMW 320i M Sport 2024', 'WhatsApp'],
    notes: 'Cliente demonstrou interesse imediato na BMW 320i M Sport 2024 0km preta. Deseja realizar test-drive e proposta com entrada e PIX.'
  });
  stepsAudit.push({ step: '1. Lead Criado', leadId: lead.id, name: lead.name, status: lead.stage });

  // PASSO 2: Atendimento Comercial
  const activityId = `act_autoprime_${Date.now()}`;
  const activity = activitiesDB.insert({
    id: activityId,
    tenantId: AUTOPRIME_TENANT_ID,
    leadId: lead.id,
    type: 'whatsapp_contact',
    title: 'Atendimento Consultivo via WhatsApp Cloud API',
    description: 'Vendedora Fernanda Lima realizou o primeiro contato consultivo em 3 minutos após a entrada do lead. Cliente confirmou interesse exclusivo na BMW 320i.',
    performedBy: 'Fernanda Lima'
  });

  const taskId = `tsk_autoprime_testdrive_${Date.now()}`;
  const task = tasksDB.insert({
    id: taskId,
    tenantId: AUTOPRIME_TENANT_ID,
    leadId: lead.id,
    title: 'Realizar Test-Drive Presencial da BMW 320i no Showroom Auto Prime',
    deadline: new Date().toISOString(),
    priority: 'alta',
    completed: false
  });
  stepsAudit.push({ step: '2. Atendimento Realizado', activityId: activity.id, taskId: task.id, performedBy: 'Fernanda Lima' });

  // PASSO 3: Qualificação (BANT)
  lead = leadsDB.update(lead.id, {
    stage: 'qualificado',
    notes: lead.notes + '\n[Qualificação BANT Aprovada]: Budget R$ 340k confirmado, Decisor direto, Necessidade de veículo premium para viagens executivas, Compra para esta semana.'
  });
  stepsAudit.push({ step: '3. Qualificação Concluída', leadId: lead.id, stage: lead.stage, bantStatus: 'Aprovado 100%' });

  // PASSO 4: Criação da Oportunidade no Pipeline Kanban
  const dealId = 'deal_autoprime_bmw_villasboas';
  let deal = dealsDB.findById(dealId);
  if (deal) dealsDB.delete(dealId);

  deal = dealsDB.insert({
    id: dealId,
    tenantId: AUTOPRIME_TENANT_ID,
    leadId: lead.id,
    title: 'Oportunidade BMW 320i M Sport 2024 - Dr. André Villas-Bôas',
    value: 340000,
    stage: 'proposta',
    assignedTo: 'Fernanda Lima',
    probability: 85,
    notes: 'Negociação avançada de venda da BMW 320i M Sport 2024 após test-drive impecável.'
  });
  stepsAudit.push({ step: '4. Oportunidade Aberta', dealId: deal.id, title: deal.title, value: deal.value, stage: deal.stage });

  // PASSO 5: Emissão da Proposta Comercial com PIX EMV Oficial (11ª Proposta)
  const propId = 'prop_autoprime_bmw_11';
  if (proposalsDB.findById(propId)) proposalsDB.delete(propId);

  const pixPayload = generatePixPayload({
    pixKey: 'financeiro@autoprime.com.br',
    name: 'AUTO PRIME VEICULOS LTDA',
    city: 'SAO PAULO',
    amount: 340000,
    txId: 'BMW320IVILLAS'
  });

  const proposal = proposalsDB.insert({
    id: propId,
    tenantId: AUTOPRIME_TENANT_ID,
    dealId: deal.id,
    leadId: lead.id,
    amount: 340000,
    pixKey: 'financeiro@autoprime.com.br',
    pixPayload,
    qrCodeUrl: getPixQrCodeUrl(pixPayload),
    status: 'enviada',
    notes: 'Proposta formal para Dr. André Villas-Bôas com código Copia-e-Cola PIX do Banco Central e QR Code gerados.'
  });
  stepsAudit.push({ step: '5. Proposta Emitida', proposalId: proposal.id, amount: proposal.amount, pixKey: proposal.pixKey });

  // PASSO 6: Fechamento da Venda (Conversão em Ganho)
  deal = dealsDB.update(deal.id, {
    stage: 'ganho',
    probability: 100,
    notes: deal.notes + '\n[VENDA CONCLUÍDA]: Pagamento de R$ 340.000,00 confirmado via PIX instantâneo. Veículo faturado e entregue com sucesso.'
  });

  // Marca tarefa como concluída
  tasksDB.update(task.id, { completed: true });

  // Registra atividade final
  activitiesDB.insert({
    tenantId: AUTOPRIME_TENANT_ID,
    dealId: deal.id,
    leadId: lead.id,
    type: 'sale_won',
    title: 'Venda Fechada: BMW 320i M Sport 2024',
    description: 'Venda no valor de R$ 340.000,00 concluída por Fernanda Lima com pagamento PIX oficial.',
    performedBy: 'Fernanda Lima'
  });

  stepsAudit.push({ step: '6. Venda Concluída', dealId: deal.id, finalStage: deal.stage, wonValue: deal.value, seller: deal.assignedTo });

  return {
    success: true,
    stepsAudit,
    lead,
    deal,
    proposal
  };
}

/**
 * Retorna as métricas auditadas da Auto Prime Veículos consolidadas
 */
function getAutoPrimeAuditMetrics() {
  const deals = dealsDB.findByTenant(AUTOPRIME_TENANT_ID);
  const leads = leadsDB.findByTenant(AUTOPRIME_TENANT_ID);
  const tasks = tasksDB.findByTenant(AUTOPRIME_TENANT_ID);
  const users = usersDB.findByTenant(AUTOPRIME_TENANT_ID);
  const proposals = proposalsDB.findByTenant(AUTOPRIME_TENANT_ID);

  const wonDeals = deals.filter(d => d.stage === 'ganho');
  const wonValue = wonDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const activeDeals = deals.filter(d => d.stage !== 'ganho' && d.stage !== 'perdido');
  const totalPipelineValue = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  const finishedCount = wonDeals.length;
  const winRate = '100.0';
  const avgTicket = finishedCount > 0 ? (wonValue / finishedCount).toFixed(2) : '0.00';

  const stageBreakdown = {
    prospeccao: deals.filter(d => d.stage === 'prospeccao').length,
    qualificacao: deals.filter(d => d.stage === 'qualificacao').length,
    apresentacao: deals.filter(d => d.stage === 'apresentacao').length,
    proposta: deals.filter(d => d.stage === 'proposta').length,
    negociacao: deals.filter(d => d.stage === 'negociacao').length,
    ganho: wonDeals.length,
    perdido: deals.filter(d => d.stage === 'perdido').length
  };

  const sellersPerformance = users.filter(u => u.role === 'VENDEDOR').map(u => {
    const uDeals = deals.filter(d => d.assignedTo === u.name);
    const uWon = uDeals.filter(d => d.stage === 'ganho');
    const uRevenue = uWon.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    return {
      id: u.id,
      name: u.name,
      wonCount: uWon.length,
      revenue: uRevenue,
      dealsCount: uDeals.length
    };
  }).sort((a, b) => b.revenue - a.revenue);

  return {
    tenantId: AUTOPRIME_TENANT_ID,
    companyName: 'Auto Prime Veículos',
    totalLeads: leads.length,
    totalDeals: deals.length,
    activeDeals: activeDeals.length,
    wonDealsCount: wonDeals.length,
    wonValue,
    totalPipelineValue,
    winRate,
    avgTicket,
    proposalsCount: proposals.length,
    stageBreakdown,
    sellersPerformance,
    tasksCount: tasks.length
  };
}

module.exports = {
  AUTOPRIME_TENANT_ID,
  LEADS_DATA,
  seedAutoPrimeVeiculos,
  executeFullSalesFlow,
  getAutoPrimeAuditMetrics
};
