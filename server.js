const http = require('http');
const path = require('path');
const fs = require('fs');

const {
  leadsDB,
  dealsDB,
  activitiesDB,
  tasksDB,
  proposalsDB,
  settingsDB
} = require('./database/db');

const { runSeeds } = require('./database/seeds');
const { generatePixPayload, getPixQrCodeUrl, generateWhatsAppProposalUrl, generateWhatsAppPitchUrl } = require('./services/pixService');
const { analyzeBant, generateSalesPitch, handleObjection, extractMeetingNotes } = require('./services/aiCopilotService');
const { onStageChange } = require('./services/workflowService');

// Inicializa sementes caso necessário
runSeeds();

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const APP_NAME = process.env.APP_NAME || 'Agentise Mega CRM';
const MAX_BODY_SIZE = 1024 * 1024; // 1MB de limite estrito contra ataques de negação de serviço (DoS)

// Mime types suportados
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

// Helper seguro para parsing de JSON no body com limite de bytes
function parseRequestBody(req) {
  return new Promise((resolve) => {
    let body = '';
    let size = 0;

    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        return resolve({ _error: 'Payload Too Large' });
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

// Helper para resposta JSON com cabeçalhos de segurança (OWASP)
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// Resolução universal de arquivos estáticos com proteção contra Directory Traversal
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

  // Trata OPTIONS (CORS pre-flight)
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end();
    return;
  }

  // 1. HEALTH CHECK OBRIGATÓRIO (Luciano Standard)
  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'ok',
      app: APP_NAME,
      version: '2.0.0',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  }

  // 2. ROTAS DA API REST (/api/...)

  // CONFIGURAÇÕES DO SISTEMA (/api/settings)
  if (pathname === '/api/settings' && method === 'GET') {
    const settings = settingsDB.findById('general_settings') || {
      id: 'general_settings',
      companyName: 'Agentise Empreendimentos',
      pixKey: 'luciano.contato@crm.ia.br',
      pixName: 'MEGA CRM AGENTISE',
      pixCity: 'SAO PAULO',
      currency: 'BRL',
      language: 'pt-BR'
    };
    const safeSettings = { ...settings };
    if (safeSettings.apiKey) {
      safeSettings.hasApiKey = true;
      safeSettings.apiKey = safeSettings.apiKey.slice(0, 4) + '...' + safeSettings.apiKey.slice(-4);
    }
    return sendJson(res, 200, { success: true, data: safeSettings });
  }

  if (pathname === '/api/settings' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: 'Payload excessivo.' });
    
    const existing = settingsDB.findById('general_settings') || {};
    const updated = settingsDB.update('general_settings', {
      ...existing,
      ...body,
      id: 'general_settings'
    });
    return sendJson(res, 200, { success: true, data: updated });
  }

  // LEADS
  if (pathname === '/api/leads' && method === 'GET') {
    const leads = leadsDB.findAll();
    return sendJson(res, 200, { success: true, count: leads.length, data: leads });
  }

  if (pathname === '/api/leads' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: 'Payload excessivo.' });
    if (!body.name) return sendJson(res, 400, { error: 'O nome do lead é obrigatório.' });
    const lead = leadsDB.insert(body);
    return sendJson(res, 201, { success: true, data: lead });
  }

  if (pathname.startsWith('/api/leads/') && method === 'GET') {
    const id = pathname.split('/')[3];
    const lead = leadsDB.findById(id);
    if (!lead) return sendJson(res, 404, { error: 'Lead não encontrado.' });
    const deals = dealsDB.findAll(d => d.leadId === id);
    const activities = activitiesDB.findAll(a => a.leadId === id);
    const tasks = tasksDB.findAll(t => t.leadId === id);
    return sendJson(res, 200, { success: true, data: { ...lead, deals, activities, tasks } });
  }

  if (pathname.startsWith('/api/leads/') && method === 'PUT') {
    const id = pathname.split('/')[3];
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: 'Payload excessivo.' });
    const updated = leadsDB.update(id, body);
    if (!updated) return sendJson(res, 404, { error: 'Lead não encontrado.' });
    return sendJson(res, 200, { success: true, data: updated });
  }

  if (pathname.startsWith('/api/leads/') && method === 'DELETE') {
    const id = pathname.split('/')[3];
    const deleted = leadsDB.delete(id);
    return sendJson(res, deleted ? 200 : 404, { success: deleted });
  }

  // DEALS (OPORTUNIDADES DO PIPELINE)
  if (pathname === '/api/deals' && method === 'GET') {
    const deals = dealsDB.findAll();
    const enriched = deals.map(deal => {
      const lead = leadsDB.findById(deal.leadId) || {};
      return { ...deal, lead };
    });
    return sendJson(res, 200, { success: true, count: enriched.length, data: enriched });
  }

  if (pathname === '/api/deals' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: 'Payload excessivo.' });
    if (!body.title || !body.leadId) {
      return sendJson(res, 400, { error: 'Título e LeadId são obrigatórios.' });
    }
    const deal = dealsDB.insert({
      stage: body.stage || 'prospeccao',
      value: Number(body.value || 0),
      probability: Number(body.probability || 20),
      priority: body.priority || 'media',
      ...body
    });

    activitiesDB.insert({
      dealId: deal.id,
      leadId: deal.leadId,
      type: 'deal_created',
      title: `Oportunidade criada: ${deal.title}`,
      description: `Valor inicial: R$ ${deal.value.toFixed(2)}`,
      timestamp: new Date().toISOString()
    });

    return sendJson(res, 201, { success: true, data: deal });
  }

  if (pathname.startsWith('/api/deals/') && pathname.endsWith('/stage') && (method === 'PATCH' || method === 'PUT')) {
    const id = pathname.split('/')[3];
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: 'Payload excessivo.' });
    const deal = dealsDB.findById(id);
    if (!deal) return sendJson(res, 404, { error: 'Oportunidade não encontrada.' });
    
    const oldStage = deal.stage;
    const newStage = body.stage;
    const updated = dealsDB.update(id, { stage: newStage });

    onStageChange(updated, oldStage, newStage);

    return sendJson(res, 200, { success: true, data: updated });
  }

  if (pathname.startsWith('/api/deals/') && method === 'PUT') {
    const id = pathname.split('/')[3];
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: 'Payload excessivo.' });
    const updated = dealsDB.update(id, body);
    if (!updated) return sendJson(res, 404, { error: 'Oportunidade não encontrada.' });
    return sendJson(res, 200, { success: true, data: updated });
  }

  if (pathname.startsWith('/api/deals/') && method === 'DELETE') {
    const id = pathname.split('/')[3];
    const deleted = dealsDB.delete(id);
    return sendJson(res, deleted ? 200 : 404, { success: deleted });
  }

  // TAREFAS
  if (pathname === '/api/tasks' && method === 'GET') {
    const tasks = tasksDB.findAll();
    return sendJson(res, 200, { success: true, count: tasks.length, data: tasks });
  }

  if (pathname === '/api/tasks' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: 'Payload excessivo.' });
    if (!body.title) return sendJson(res, 400, { error: 'Título da tarefa é obrigatório.' });
    const task = tasksDB.insert({ completed: false, priority: 'media', ...body });
    return sendJson(res, 201, { success: true, data: task });
  }

  if (pathname.startsWith('/api/tasks/') && method === 'PATCH') {
    const id = pathname.split('/')[3];
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: 'Payload excessivo.' });
    const updated = tasksDB.update(id, body);
    if (!updated) return sendJson(res, 404, { error: 'Tarefa não encontrada.' });
    return sendJson(res, 200, { success: true, data: updated });
  }

  if (pathname.startsWith('/api/tasks/') && method === 'DELETE') {
    const id = pathname.split('/')[3];
    const deleted = tasksDB.delete(id);
    return sendJson(res, deleted ? 200 : 404, { success: deleted });
  }

  // CLAUDE AI COPILOT ENDPOINTS
  if (pathname === '/api/copilot/bant' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: 'Payload excessivo.' });
    const lead = body.leadId ? (leadsDB.findById(body.leadId) || body) : body;
    const deal = body.dealId ? (dealsDB.findById(body.dealId) || {}) : (body.deal || {});
    const result = analyzeBant(lead, deal);
    return sendJson(res, 200, { success: true, data: result });
  }

  if (pathname === '/api/copilot/pitch' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: 'Payload excessivo.' });
    const lead = body.leadId ? (leadsDB.findById(body.leadId) || body) : body;
    const deal = body.dealId ? (dealsDB.findById(body.dealId) || {}) : (body.deal || {});
    const objective = body.objective || 'primeiro_contato';
    const pitch = await generateSalesPitch(lead, deal, objective);
    const whatsappUrl = generateWhatsAppPitchUrl({
      phone: lead.phone,
      customerName: lead.name,
      pitchText: pitch.text
    });
    return sendJson(res, 200, { success: true, data: { ...pitch, whatsappUrl } });
  }

  if (pathname === '/api/copilot/objection' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: 'Payload excessivo.' });
    const objectionType = body.type || 'caro';
    const lead = body.leadId ? (leadsDB.findById(body.leadId) || body) : body;
    const result = handleObjection(objectionType, lead);
    return sendJson(res, 200, { success: true, data: result });
  }

  if (pathname === '/api/copilot/notes' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: 'Payload excessivo.' });
    const result = extractMeetingNotes(body.rawNotes);
    return sendJson(res, 200, { success: true, data: result });
  }

  // PIX OFICIAL EMV & PROPOSTAS
  if (pathname === '/api/pix/generate' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: 'Payload excessivo.' });
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
      dealId: body.dealId || null,
      leadId: body.leadId || null,
      amount,
      pixKey,
      pixPayload: payload,
      qrCodeUrl,
      status: 'pendente'
    });

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

  // ANALYTICS & DASHBOARD KPIS
  if (pathname === '/api/analytics' && method === 'GET') {
    const deals = dealsDB.findAll();
    const leads = leadsDB.findAll();
    const tasks = tasksDB.findAll();

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
        stageBreakdown
      }
    });
  }

  // LGPD CONFORMIDADE
  if (pathname === '/api/lgpd/export' && method === 'GET') {
    const data = {
      empresa: 'Agentise Mega CRM',
      politica: 'LGPD Lei nº 13.709/2018',
      dataExtracao: new Date().toISOString(),
      leads: leadsDB.findAll(),
      deals: dealsDB.findAll()
    };
    return sendJson(res, 200, { success: true, data });
  }

  if (pathname === '/api/lgpd/anonymize' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: 'Payload excessivo.' });
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

  // 3. ARQUIVOS ESTÁTICOS & SPA FALLBACK COM TRATAMENTO DE ERROS
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

// Inicialização com Fallback Automático e Silencioso de Porta (ex: 3000 -> 3001)
function startServer(portToTry) {
  const onError = (err) => {
    if (err.code === 'EADDRINUSE' && !process.env.PORT) {
      console.log(`⚠️ Porta ${portToTry} ocupada por outro processo local. Alternando para porta ${portToTry + 1}...`);
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
    console.log(`📦 Status:       Pronto para Deploy Contínuo 24/7`);
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
