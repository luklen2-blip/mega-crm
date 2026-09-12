/**
 * AGENTISE MEGA CRM - Servidor Comercial SaaS Multi-Tenant AI-First
 * Arquitetura resiliente 24/7 com persistência atômica, RBAC, PIX oficial EMV e Copiloto Claude AI.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Módulos do Sistema
const { 
  tenantsDB, 
  usersDB, 
  leadsDB, 
  dealsDB, 
  activitiesDB, 
  tasksDB, 
  proposalsDB, 
  settingsDB,
  knowledgeBaseDB,
  conversationsDB,
  messagesDB,
  automationsDB,
  campaignsDB,
  vehiclesDB
} = require('./database/db');

const { runSeeds } = require('./database/seeds');
const { 
  registerTenant, 
  login, 
  getRequestContext, 
  logAudit 
} = require('./services/authService');

const { 
  generatePixPayload, 
  getPixQrCodeUrl, 
  generateWhatsAppProposalUrl, 
  generateWhatsAppPitchUrl 
} = require('./services/pixService');

const { 
  analyzeBant, 
  generateSalesPitch, 
  handleObjection, 
  runManagerAnalyticsQuery 
} = require('./services/aiCopilotService');

const { 
  TRIGGERS, 
  ACTIONS, 
  triggerWorkflows, 
  seedSegmentAutomations 
} = require('./services/workflowEngine');

const { 
  getChannelsStatus, 
  getConversations, 
  getConversationMessages, 
  sendMessage 
} = require('./services/omnichannelService');

const { 
  scanRecoverableOpportunities, 
  generateRecoveryCampaign 
} = require('./services/recoveryService');

const { 
  PLANS, 
  getTenantSubscription, 
  checkResourceLimit, 
  consumeAiCredits 
} = require('./services/billingService');

const { 
  getVehicles, 
  calculateFinancing 
} = require('./services/autoVerticalService');

// Inicializa sementes caso necessário
runSeeds();

const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const APP_NAME = process.env.APP_NAME || 'Agentise Mega CRM';
const MAX_BODY_SIZE = 1024 * 1024; // 1 MB

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Helper para parsing seguro de JSON
function parseRequestBody(req) {
  return new Promise((resolve) => {
    let body = '';
    let size = 0;

    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        return resolve({ _error: 'Payload excessivo.' });
      }
      body += chunk;
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });

    req.on('error', () => resolve({}));
  });
}

// Helper para envio de JSON com cabeçalhos OWASP
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token'
  });
  res.end(JSON.stringify(data));
}

// Resolução de arquivos estáticos com suporte a SPA fallback
function serveStatic(req, res, targetFile) {
  const sanitized = path.normalize(targetFile).replace(/^(\.\.[\/\\])+/, '');
  const candidatePaths = [
    path.join(__dirname, 'public', sanitized),
    path.join(__dirname, sanitized),
    path.join(process.cwd(), 'public', sanitized),
    path.join(process.cwd(), sanitized)
  ];

  const filePath = candidatePaths.find(p => {
    try {
      return fs.existsSync(p) && fs.statSync(p).isFile();
    } catch (e) {
      return false;
    }
  });

  if (filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN'
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS Pre-flight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end();
    return;
  }

  // 1. HEALTH CHECK 24/7 (Norma Global Obrigatória)
  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'ok',
      app: APP_NAME,
      version: '2.0.0',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  }

  // Identificação do Contexto da Requisição (Tenant + Usuário)
  const ctx = getRequestContext(req);
  const tenantId = ctx.tenantId;

  // 2. AUTENTICAÇÃO E GESTÃO DE USUÁRIOS
  if (pathname === '/api/auth/register' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (!body.email || !body.password || !body.companyName) {
      return sendJson(res, 400, { error: 'Nome da empresa, e-mail e senha são obrigatórios.' });
    }
    try {
      const result = registerTenant(body);
      seedSegmentAutomations(result.tenant.id, body.segment || 'Geral');
      return sendJson(res, 201, { success: true, data: result });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (!body.email || !body.password) {
      return sendJson(res, 400, { error: 'Informe e-mail e senha.' });
    }
    try {
      const session = login(body.email, body.password);
      return sendJson(res, 200, { success: true, data: session });
    } catch (err) {
      return sendJson(res, 401, { error: err.message });
    }
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = usersDB.findById(ctx.userId);
    const tenant = tenantsDB.findById(tenantId);
    return sendJson(res, 200, {
      success: true,
      data: {
        user: user ? { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar } : ctx,
        tenant: tenant || { id: tenantId, name: 'Empresa Principal' }
      }
    });
  }

  if (pathname === '/api/users' && method === 'GET') {
    const users = usersDB.findByTenant(tenantId).map(u => {
      const { passwordHash, ...safe } = u;
      return safe;
    });
    return sendJson(res, 200, { success: true, count: users.length, data: users });
  }

  // 3. ONBOARDING GUIADO (FASE 3)
  if (pathname === '/api/onboarding/complete' && method === 'POST') {
    const body = await parseRequestBody(req);
    tenantsDB.update(tenantId, {
      segment: body.segment || 'Geral',
      teamSize: body.teamSize || '1-5',
      leadSources: body.leadSources || ['WhatsApp', 'Site'],
      primaryGoal: body.primaryGoal || 'Aumentar vendas',
      onboardingCompleted: true
    });
    seedSegmentAutomations(tenantId, body.segment);
    return sendJson(res, 200, { success: true, message: 'Configuração do negócio concluída com sucesso.' });
  }

  // 4. LEADS (COM ISOLAMENTO MULTI-TENANT)
  if (pathname === '/api/leads' && method === 'GET') {
    const leads = leadsDB.findByTenant(tenantId);
    return sendJson(res, 200, { success: true, count: leads.length, data: leads });
  }

  if (pathname === '/api/leads' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (!body.name) return sendJson(res, 400, { error: 'O nome do lead é obrigatório.' });

    const limitCheck = checkResourceLimit(tenantId, 'leads');
    if (!limitCheck.allowed) return sendJson(res, 403, { error: limitCheck.error });

    const lead = leadsDB.insert({ ...body, tenantId });
    await triggerWorkflows('novo_lead', { leadId: lead.id, name: lead.name, phone: lead.phone }, tenantId);
    return sendJson(res, 201, { success: true, data: lead });
  }

  if (pathname.startsWith('/api/leads/') && method === 'GET') {
    const id = pathname.split('/')[3];
    const lead = leadsDB.findById(id);
    if (!lead || (lead.tenantId && lead.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Lead não encontrado.' });
    }
    const deals = dealsDB.findByTenant(tenantId, d => d.leadId === id);
    const activities = activitiesDB.findByTenant(tenantId, a => a.leadId === id);
    const tasks = tasksDB.findByTenant(tenantId, t => t.leadId === id);
    return sendJson(res, 200, { success: true, data: { ...lead, deals, activities, tasks } });
  }

  if (pathname.startsWith('/api/leads/') && method === 'PUT') {
    const id = pathname.split('/')[3];
    const existing = leadsDB.findById(id);
    if (!existing || (existing.tenantId && existing.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Lead não encontrado.' });
    }
    const body = await parseRequestBody(req);
    const updated = leadsDB.update(id, { ...body, tenantId });
    return sendJson(res, 200, { success: true, data: updated });
  }

  if (pathname.startsWith('/api/leads/') && method === 'DELETE') {
    const id = pathname.split('/')[3];
    const existing = leadsDB.findById(id);
    if (!existing || (existing.tenantId && existing.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Lead não encontrado.' });
    }
    const deleted = leadsDB.delete(id);
    return sendJson(res, 200, { success: deleted });
  }

  // 5. DEALS (OPORTUNIDADES DO PIPELINE)
  if (pathname === '/api/deals' && method === 'GET') {
    const deals = dealsDB.findByTenant(tenantId);
    const enriched = deals.map(deal => {
      const lead = leadsDB.findById(deal.leadId) || {};
      return { ...deal, lead };
    });
    return sendJson(res, 200, { success: true, count: enriched.length, data: enriched });
  }

  if (pathname === '/api/deals' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (!body.title || !body.leadId) {
      return sendJson(res, 400, { error: 'Título e LeadId são obrigatórios.' });
    }
    const deal = dealsDB.insert({
      tenantId,
      stage: body.stage || 'prospeccao',
      value: Number(body.value || 0),
      probability: Number(body.probability || 20),
      priority: body.priority || 'media',
      assignedTo: body.assignedTo || ctx.name,
      ...body
    });

    activitiesDB.insert({
      tenantId,
      dealId: deal.id,
      leadId: deal.leadId,
      type: 'deal_created',
      title: `Oportunidade criada: ${deal.title}`,
      description: `Valor inicial: R$ ${deal.value.toFixed(2)} - Responsável: ${deal.assignedTo}`,
      timestamp: new Date().toISOString()
    });

    return sendJson(res, 201, { success: true, data: deal });
  }

  if (pathname.startsWith('/api/deals/') && pathname.endsWith('/stage') && (method === 'PATCH' || method === 'PUT')) {
    const id = pathname.split('/')[3];
    const deal = dealsDB.findById(id);
    if (!deal || (deal.tenantId && deal.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Oportunidade não encontrada.' });
    }
    const body = await parseRequestBody(req);
    
    const oldStage = deal.stage;
    const newStage = body.stage;
    const updated = dealsDB.update(id, { stage: newStage });

    // Workflow automático e registro de atividade
    activitiesDB.insert({
      tenantId,
      dealId: deal.id,
      leadId: deal.leadId,
      type: 'stage_change',
      title: `Oportunidade movida para ${newStage.toUpperCase()}`,
      description: `Estágio alterado de "${oldStage}" para "${newStage}"`,
      timestamp: new Date().toISOString()
    });

    if (newStage === 'ganho') {
      await triggerWorkflows('venda_fechada', { dealId: deal.id, leadId: deal.leadId, value: deal.value }, tenantId);
    } else if (newStage === 'perdido') {
      await triggerWorkflows('lead_perdido', { dealId: deal.id, leadId: deal.leadId, reason: body.reason || 'Não informado' }, tenantId);
    } else {
      await triggerWorkflows('mudanca_estagio', { dealId: deal.id, leadId: deal.leadId, stage: newStage }, tenantId);
    }

    return sendJson(res, 200, { success: true, data: updated });
  }

  if (pathname.startsWith('/api/deals/') && method === 'PUT') {
    const id = pathname.split('/')[3];
    const deal = dealsDB.findById(id);
    if (!deal || (deal.tenantId && deal.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Oportunidade não encontrada.' });
    }
    const body = await parseRequestBody(req);
    const updated = dealsDB.update(id, { ...body, tenantId });
    return sendJson(res, 200, { success: true, data: updated });
  }

  if (pathname.startsWith('/api/deals/') && method === 'DELETE') {
    const id = pathname.split('/')[3];
    const deal = dealsDB.findById(id);
    if (!deal || (deal.tenantId && deal.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Oportunidade não encontrada.' });
    }
    const deleted = dealsDB.delete(id);
    return sendJson(res, 200, { success: deleted });
  }

  // 6. TAREFAS
  if (pathname === '/api/tasks' && method === 'GET') {
    const tasks = tasksDB.findByTenant(tenantId);
    return sendJson(res, 200, { success: true, count: tasks.length, data: tasks });
  }

  if (pathname === '/api/tasks' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (!body.title) return sendJson(res, 400, { error: 'Título da tarefa é obrigatório.' });
    const task = tasksDB.insert({ tenantId, completed: false, priority: 'media', ...body });
    return sendJson(res, 201, { success: true, data: task });
  }

  if (pathname.startsWith('/api/tasks/') && method === 'PATCH') {
    const id = pathname.split('/')[3];
    const existing = tasksDB.findById(id);
    if (!existing || (existing.tenantId && existing.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Tarefa não encontrada.' });
    }
    const body = await parseRequestBody(req);
    const updated = tasksDB.update(id, body);
    return sendJson(res, 200, { success: true, data: updated });
  }

  if (pathname.startsWith('/api/tasks/') && method === 'DELETE') {
    const id = pathname.split('/')[3];
    const existing = tasksDB.findById(id);
    if (!existing || (existing.tenantId && existing.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Tarefa não encontrada.' });
    }
    const deleted = tasksDB.delete(id);
    return sendJson(res, 200, { success: deleted });
  }

  // 7. CENTRAL DE ATENDIMENTO OMNICHANNEL (FASE 6)
  if (pathname === '/api/omnichannel/channels' && method === 'GET') {
    const channels = getChannelsStatus(tenantId);
    return sendJson(res, 200, { success: true, data: channels });
  }

  if (pathname === '/api/omnichannel/conversations' && method === 'GET') {
    const convs = getConversations(tenantId);
    return sendJson(res, 200, { success: true, count: convs.length, data: convs });
  }

  if (pathname.startsWith('/api/omnichannel/conversations/') && pathname.endsWith('/messages') && method === 'GET') {
    const convId = pathname.split('/')[4];
    const msgs = getConversationMessages(convId);
    return sendJson(res, 200, { success: true, count: msgs.length, data: msgs });
  }

  if (pathname === '/api/omnichannel/messages' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (!body.conversationId || !body.text) {
      return sendJson(res, 400, { error: 'ID da conversa e mensagem são obrigatórios.' });
    }
    const msg = sendMessage({
      tenantId,
      conversationId: body.conversationId,
      text: body.text,
      sender: body.sender || 'vendedor',
      senderName: ctx.name
    });
    return sendJson(res, 201, { success: true, data: msg });
  }

  // 8. CÉREBRO DA EMPRESA (KNOWLEDGE BASE - FASE 8)
  if (pathname === '/api/knowledge-base' && method === 'GET') {
    const items = knowledgeBaseDB.findByTenant(tenantId);
    return sendJson(res, 200, { success: true, count: items.length, data: items });
  }

  if (pathname === '/api/knowledge-base' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (!body.title || !body.content) {
      return sendJson(res, 400, { error: 'Título e conteúdo são obrigatórios.' });
    }
    const item = knowledgeBaseDB.insert({
      tenantId,
      category: body.category || 'Geral',
      title: body.title,
      content: body.content
    });
    return sendJson(res, 201, { success: true, data: item });
  }

  if (pathname.startsWith('/api/knowledge-base/') && method === 'DELETE') {
    const id = pathname.split('/')[3];
    const existing = knowledgeBaseDB.findById(id);
    if (!existing || (existing.tenantId && existing.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Item não encontrado.' });
    }
    const deleted = knowledgeBaseDB.delete(id);
    return sendJson(res, 200, { success: deleted });
  }

  // 9. RECUPERAIA (RECUPERAÇÃO DE VENDAS - FASE 9)
  if (pathname === '/api/recovery/scan' && method === 'GET') {
    const audit = scanRecoverableOpportunities(tenantId);
    return sendJson(res, 200, { success: true, data: audit });
  }

  if (pathname === '/api/recovery/generate-campaign' && method === 'POST') {
    const body = await parseRequestBody(req);
    const campaign = generateRecoveryCampaign(tenantId, body.category || 'stalledDeals', body.tone || 'consultivo');
    return sendJson(res, 201, { success: true, data: campaign });
  }

  if (pathname === '/api/recovery/campaigns' && method === 'GET') {
    const list = campaignsDB.findByTenant(tenantId);
    return sendJson(res, 200, { success: true, count: list.length, data: list });
  }

  // 10. AUTOMAÇÕES (FASE 10)
  if (pathname === '/api/automations' && method === 'GET') {
    const list = automationsDB.findByTenant(tenantId);
    return sendJson(res, 200, { 
      success: true, 
      count: list.length, 
      data: list,
      availableTriggers: TRIGGERS,
      availableActions: ACTIONS
    });
  }

  if (pathname === '/api/automations' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (!body.name || !body.trigger || !body.action) {
      return sendJson(res, 400, { error: 'Nome, gatilho e ação são obrigatórios.' });
    }
    const limitCheck = checkResourceLimit(tenantId, 'automations');
    if (!limitCheck.allowed) return sendJson(res, 403, { error: limitCheck.error });

    const auto = automationsDB.insert({
      tenantId,
      name: body.name,
      trigger: body.trigger,
      condition: body.condition || null,
      action: body.action,
      active: true
    });
    return sendJson(res, 201, { success: true, data: auto });
  }

  if (pathname.startsWith('/api/automations/') && pathname.endsWith('/toggle') && method === 'PATCH') {
    const id = pathname.split('/')[3];
    const existing = automationsDB.findById(id);
    if (!existing || (existing.tenantId && existing.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Automação não encontrada.' });
    }
    const updated = automationsDB.update(id, { active: !existing.active });
    return sendJson(res, 200, { success: true, data: updated });
  }

  // 11. ANALISTA IA PARA GESTORES (FASE 11)
  if (pathname === '/api/copilot/analyst' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (!body.question) return sendJson(res, 400, { error: 'Pergunta é obrigatória.' });
    const result = runManagerAnalyticsQuery(tenantId, body.question);
    return sendJson(res, 200, { success: true, data: result });
  }

  // 12. PLANOS SAAS E CRÉDITOS DE IA (FASE 13 & 14)
  if (pathname === '/api/billing/subscription' && method === 'GET') {
    const sub = getTenantSubscription(tenantId);
    return sendJson(res, 200, { success: true, data: sub });
  }

  if (pathname === '/api/billing/plans' && method === 'GET') {
    return sendJson(res, 200, { success: true, data: Object.values(PLANS) });
  }

  // 13. VERTICAL AUTOMOTIVO (AGENTISE AUTO - FASE 18)
  if (pathname === '/api/auto/vehicles' && method === 'GET') {
    const vehicles = getVehicles(tenantId);
    return sendJson(res, 200, { success: true, count: vehicles.length, data: vehicles });
  }

  if (pathname === '/api/auto/financing' && method === 'POST') {
    const body = await parseRequestBody(req);
    const result = calculateFinancing(body);
    return sendJson(res, 200, { success: true, data: result });
  }

  // 14. CLAUDE AI COPILOT ENDPOINTS EXISTENTES
  if (pathname === '/api/copilot/bant' && method === 'POST') {
    const body = await parseRequestBody(req);
    const lead = body.leadId ? (leadsDB.findById(body.leadId) || body) : body;
    const deal = body.dealId ? (dealsDB.findById(body.dealId) || {}) : (body.deal || {});
    consumeAiCredits(tenantId, 'copilot_bant', 5);
    const result = analyzeBant(lead, deal);
    return sendJson(res, 200, { success: true, data: result });
  }

  if (pathname === '/api/copilot/pitch' && method === 'POST') {
    const body = await parseRequestBody(req);
    const lead = body.leadId ? (leadsDB.findById(body.leadId) || body) : body;
    const deal = body.dealId ? (dealsDB.findById(body.dealId) || {}) : (body.deal || {});
    const objective = body.objective || 'primeiro_contato';
    consumeAiCredits(tenantId, 'copilot_pitch', 10);
    const pitch = await generateSalesPitch(lead, deal, objective, tenantId);
    const whatsappUrl = generateWhatsAppPitchUrl({
      phone: lead.phone,
      customerName: lead.name,
      pitchText: pitch.text
    });
    return sendJson(res, 200, { success: true, data: { ...pitch, whatsappUrl } });
  }

  if (pathname === '/api/copilot/objection' && method === 'POST') {
    const body = await parseRequestBody(req);
    const objectionType = body.type || 'caro';
    const lead = body.leadId ? (leadsDB.findById(body.leadId) || body) : body;
    consumeAiCredits(tenantId, 'copilot_objection', 5);
    const result = handleObjection(objectionType, lead);
    return sendJson(res, 200, { success: true, data: result });
  }

  // 15. PIX OFICIAL EMV & PROPOSTAS
  if (pathname === '/api/pix/generate' && method === 'POST') {
    const body = await parseRequestBody(req);
    const settings = settingsDB.findById('general_settings') || {};

    const pixKey = body.pixKey || settings.pixKey || 'luciano.contato@crm.ia.br';
    const name = body.name || settings.pixName || 'MEGA CRM AGENTISE';
    const city = body.city || settings.pixCity || 'SAO PAULO';
    const amount = body.amount || 0;
    const txId = body.txId || 'CRM' + Date.now().toString().slice(-6);

    const payload = generatePixPayload({ pixKey, name, city, amount, txId });
    const qrCodeUrl = getPixQrCodeUrl(payload);

    let whatsappUrl = '';
    if (body.customerPhone) {
      whatsappUrl = generateWhatsAppProposalUrl({
        phone: body.customerPhone,
        customerName: body.customerName || 'Cliente',
        dealTitle: body.dealTitle || 'Proposta Comercial',
        amount,
        pixPayload: payload
      });
    }

    const proposal = proposalsDB.insert({
      tenantId,
      dealId: body.dealId || null,
      leadId: body.leadId || null,
      amount,
      pixKey,
      pixPayload: payload,
      qrCodeUrl,
      status: 'pendente'
    });

    await triggerWorkflows('proposta_criada', { dealId: body.dealId, leadId: body.leadId, amount }, tenantId);

    return sendJson(res, 200, {
      success: true,
      data: {
        proposalId: proposal.id,
        payload,
        qrCodeUrl,
        whatsappUrl,
        txId,
        amount
      }
    });
  }

  // 16. DASHBOARD EXECUTIVO & ANALYTICS (FASE 4 & 12)
  if (pathname === '/api/analytics' && method === 'GET') {
    const deals = dealsDB.findByTenant(tenantId);
    const leads = leadsDB.findByTenant(tenantId);
    const tasks = tasksDB.findByTenant(tenantId);
    const users = usersDB.findByTenant(tenantId);
    const proposals = proposalsDB.findByTenant(tenantId);

    const totalPipelineValue = deals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    const wonDeals = deals.filter(d => d.stage === 'ganho');
    const wonValue = wonDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    const lostDeals = deals.filter(d => d.stage === 'perdido');
    
    const finishedDealsCount = wonDeals.length + lostDeals.length;
    const winRate = finishedDealsCount > 0 ? ((wonDeals.length / finishedDealsCount) * 100).toFixed(1) : '100.0';
    const avgTicket = deals.length > 0 ? (totalPipelineValue / deals.length).toFixed(2) : '0.00';

    const stageBreakdown = {
      prospeccao: deals.filter(d => d.stage === 'prospeccao').length,
      qualificacao: deals.filter(d => d.stage === 'qualificacao').length,
      apresentacao: deals.filter(d => d.stage === 'apresentacao').length,
      proposta: deals.filter(d => d.stage === 'proposta').length,
      negociacao: deals.filter(d => d.stage === 'negociacao').length,
      ganho: wonDeals.length,
      perdido: lostDeals.length
    };

    // Alertas da IA baseados em dados reais do sistema
    const stalledDeals = deals.filter(d => {
      const ageDays = (Date.now() - new Date(d.updatedAt || d.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return (d.stage === 'proposta' || d.stage === 'negociacao') && ageDays >= 5;
    });

    const pendingProposals = proposals.filter(p => p.status === 'pendente');
    const leadsWithoutTask = leads.filter(l => !tasks.some(t => t.leadId === l.id && !t.completed));

    const aiAlerts = [];
    if (leadsWithoutTask.length > 0) {
      aiAlerts.push({
        type: 'warning',
        icon: 'users',
        title: `${leadsWithoutTask.length} leads estão sem atendimento agendado`,
        action: 'Criar tarefas imediatas de primeiro contato.'
      });
    }

    if (stalledDeals.length > 0) {
      const atRisk = stalledDeals.reduce((s, d) => s + Number(d.value || 0), 0);
      aiAlerts.push({
        type: 'danger',
        icon: 'alert-triangle',
        title: `R$ ${atRisk.toLocaleString('pt-BR')} em propostas paradas há mais de 5 dias`,
        action: 'Acionar campanha do RecuperaIA.'
      });
    }

    if (pendingProposals.length > 0) {
      aiAlerts.push({
        type: 'info',
        icon: 'clock',
        title: `${pendingProposals.length} propostas com PIX pendente de confirmação`,
        action: 'Fazer follow-up para aceleração de fechamento.'
      });
    }

    // Ranking de Vendedores
    const sellersPerformance = users.map(u => {
      const uDeals = deals.filter(d => d.assignedTo === u.name || d.assignedTo === u.id);
      const uWon = uDeals.filter(d => d.stage === 'ganho');
      const uWonVal = uWon.reduce((s, d) => s + Number(d.value || 0), 0);
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        avatar: u.avatar,
        dealsCount: uDeals.length,
        wonCount: uWon.length,
        revenue: uWonVal,
        conversionRate: uDeals.length > 0 ? ((uWon.length / uDeals.length) * 100).toFixed(1) : '0.0'
      };
    }).sort((a, b) => b.revenue - a.revenue);

    return sendJson(res, 200, {
      success: true,
      data: {
        totalPipelineValue,
        wonValue,
        winRate,
        avgTicket,
        totalLeads: leads.length,
        activeDeals: deals.length - wonDeals.length - lostDeals.length,
        pendingTasks: tasks.filter(t => !t.completed).length,
        stageBreakdown,
        aiAlerts,
        sellersPerformance
      }
    });
  }

  // 17. CONFIGURAÇÕES DO SISTEMA
  if (pathname === '/api/settings' && method === 'GET') {
    const settings = settingsDB.findById('general_settings') || {};
    const safeSettings = { ...settings };
    if (safeSettings.apiKey) {
      safeSettings.hasApiKey = true;
      safeSettings.apiKey = safeSettings.apiKey.slice(0, 4) + '...' + safeSettings.apiKey.slice(-4);
    }
    return sendJson(res, 200, { success: true, data: safeSettings });
  }

  if (pathname === '/api/settings' && method === 'POST') {
    const body = await parseRequestBody(req);
    const existing = settingsDB.findById('general_settings') || {};
    const updated = settingsDB.update('general_settings', {
      ...existing,
      ...body,
      id: 'general_settings'
    });
    return sendJson(res, 200, { success: true, data: updated });
  }

  // 18. LGPD
  if (pathname === '/api/lgpd/export' && method === 'GET') {
    const data = {
      empresa: APP_NAME,
      politica: 'LGPD Lei nº 13.709/2018',
      dataExtracao: new Date().toISOString(),
      leads: leadsDB.findByTenant(tenantId),
      deals: dealsDB.findByTenant(tenantId)
    };
    return sendJson(res, 200, { success: true, data });
  }

  if (pathname === '/api/lgpd/anonymize' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (!body.leadId) return sendJson(res, 400, { error: 'LeadId é obrigatório' });
    const lead = leadsDB.findById(body.leadId);
    if (!lead) return sendJson(res, 404, { error: 'Lead não encontrado' });

    const anonymized = leadsDB.update(body.leadId, {
      name: `Anonimizado ${lead.id.slice(-4)}`,
      email: 'anonimizado@lgpd.crm',
      phone: '00000000000',
      company: 'Empresa Anonimizada',
      notes: '[DADOS PESSOAIS EXPURGADOS CONFORME ART. 18 LGPD]'
    });

    return sendJson(res, 200, { success: true, data: anonymized });
  }

  // 19. ARQUIVOS ESTÁTICOS & SPA FALLBACK
  let targetFile = pathname === '/' ? 'index.html' : pathname.slice(1);
  const served = serveStatic(req, res, targetFile);

  if (!served) {
    const fallbackServed = serveStatic(req, res, 'index.html');
    if (!fallbackServed) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
  }
});

function startServer(portToTry) {
  const onError = (err) => {
    if (err.code === 'EADDRINUSE' && !process.env.PORT) {
      console.log(`⚠️ Porta ${portToTry} ocupada. Alternando para ${portToTry + 1}...`);
      server.removeListener('listening', onListening);
      startServer(portToTry + 1);
    } else {
      console.error('Erro no servidor HTTP:', err.message);
    }
  };

  const onListening = () => {
    server.removeListener('error', onError);
    console.log(`\n======================================================`);
    console.log(`🚀 [${APP_NAME}] operacional na porta ${portToTry}`);
    console.log(`🌐 Local:        http://localhost:${portToTry}`);
    console.log(`🩺 Health Check: http://localhost:${portToTry}/api/health`);
    console.log(`📦 Status:       SaaS Multi-Tenant Ativo (24/7 Cloud Ready)`);
    console.log(`======================================================\n`);
  };

  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(portToTry, '0.0.0.0');
}

if (require.main === module) {
  startServer(DEFAULT_PORT);
}

module.exports = server;
