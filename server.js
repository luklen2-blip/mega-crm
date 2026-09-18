/**
 * AGENTISE MEGA CRM - Servidor Comercial SaaS Multi-Tenant AI-First
 * Arquitetura resiliente 24/7 com persistência atômica, RBAC, PIX oficial EMV e Copiloto Claude AI.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Módulos do Sistema
const { 
  tenantsDB, 
  usersDB, 
  companiesDB,
  contactsDB,
  leadsDB, 
  dealsDB, 
  activitiesDB, 
  tasksDB, 
  proposalsDB, 
  pipelinesDB,
  pipelineStagesDB,
  settingsDB,
  knowledgeBaseDB,
  conversationsDB,
  messagesDB,
  automationsDB,
  campaignsDB,
  vehiclesDB,
  auditLogsDB,
  aiUsageDB,
  aiAgentsDB,
  aiConversationsDB,
  workflowRunsDB,
  paymentsDB
} = require('./database/db');

const { 
  DEFAULT_SALES_STAGES, 
  ensureTenantPipelines, 
  calculateAiDealScore 
} = require('./services/pipelineService');

const { calculateAdvancedBi } = require('./services/analyticsBiService');

const { runSeeds } = require('./database/seeds');
const { 
  ROLES,
  VALID_ROLES,
  PERMISSIONS,
  hasPermission,
  registerTenant, 
  login, 
  generateToken,
  sanitizeUser,
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
  generateAIResponse, 
  listAvailableModels 
} = require('./services/aiGatewayService');

const { 
  ensureTenantAgents, 
  checkHandoverRequired, 
  processAgentInteraction 
} = require('./services/aiAgentService');

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
  sendMessage,
  generateSuggestedResponse,
  setConversationMode 
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

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

// In-Memory Rate Limiter nativo e de alta performance (sem dependências externas)
const rateLimitMap = new Map();

function checkRateLimit(ip, bucketName, maxRequests, windowMs) {
  const now = Date.now();
  const key = `${bucketName}:${ip}`;
  let record = rateLimitMap.get(key);

  if (!record || (now - record.resetTime > windowMs)) {
    record = { count: 1, resetTime: now };
    rateLimitMap.set(key, record);
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (record.count >= maxRequests) {
    return { 
      allowed: false, 
      retryAfterSeconds: Math.ceil((record.resetTime + windowMs - now) / 1000) 
    };
  }

  record.count++;
  return { allowed: true, remaining: maxRequests - record.count };
}

// Limpeza automática de registros expirados no rate limit a cada 10 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now - record.resetTime > 15 * 60 * 1000) {
      rateLimitMap.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

// Helper para envio de JSON com cabeçalhos OWASP rigorosos
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token'
  });
  res.end(JSON.stringify(data));
}

// Resolução segura de arquivos estáticos com isolamento e blindagem contra Directory Traversal
const BLOCKED_STATIC_PREFIXES = ['database', 'services', 'tests', 'scripts', '.git', 'node_modules', '.gemini', 'config'];
const BLOCKED_STATIC_FILES = ['server.js', 'package.json', 'package-lock.json', 'render.yaml', 'Dockerfile', '.gitignore', '.dockerignore', '.env'];

function serveStatic(req, res, targetFile) {
  const cleanTarget = (targetFile || '').replace(/\\/g, '/');
  
  // Rejeita explicitamente qualquer tentativa de path traversal
  if (cleanTarget.includes('..') || cleanTarget.includes('\0')) {
    return false;
  }

  const sanitized = path.normalize(targetFile).replace(/^(\.\.[\/\\])+/, '');
  const segments = sanitized.split(/[\\\/]/).filter(Boolean);
  const firstSegment = segments[0] ? segments[0].toLowerCase() : '';
  const baseName = path.basename(sanitized).toLowerCase();

  // Bloqueio categórico de infraestrutura, código backend e dados privados
  if (BLOCKED_STATIC_PREFIXES.includes(firstSegment) || BLOCKED_STATIC_FILES.includes(baseName) || baseName.startsWith('.')) {
    return false;
  }

  const publicDir = path.resolve(__dirname, 'public');
  const candidatePaths = [
    path.join(publicDir, sanitized),
    path.join(publicDir, `${sanitized}.html`),
    path.join(process.cwd(), 'public', sanitized),
    path.join(process.cwd(), 'public', `${sanitized}.html`)
  ];

  // Permite arquivos estáticos seguros se existirem na raiz
  if (['index.html', 'favicon.ico', 'manifest.json', 'robots.txt'].includes(baseName)) {
    candidatePaths.push(path.join(__dirname, sanitized));
    candidatePaths.push(path.join(process.cwd(), sanitized));
  }

  const filePath = candidatePaths.find(p => {
    try {
      const resolved = path.resolve(p);
      const isInsidePublic = resolved.startsWith(publicDir);
      const isAllowedRoot = (resolved === path.resolve(__dirname, baseName) || resolved === path.resolve(process.cwd(), baseName)) && 
                            ['index.html', 'favicon.ico', 'manifest.json', 'robots.txt'].includes(baseName);
      
      if (!isInsidePublic && !isAllowedRoot) return false;
      return fs.existsSync(resolved) && fs.statSync(resolved).isFile();
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
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }
  return false;
}

// 10 Estágios Padronizados da Timeline CRM 360° (Agentise V2.0)
const TIMELINE_STAGES = [
  { id: 'lead_criado', label: 'Lead Criado', order: 1, icon: 'user-plus' },
  { id: 'contato', label: 'Contato Inicial', order: 2, icon: 'phone-call' },
  { id: 'conversa', label: 'Conversa Inbox', order: 3, icon: 'message-square' },
  { id: 'qualificacao', label: 'Qualificação BANT', order: 4, icon: 'award' },
  { id: 'proposta', label: 'Proposta Emitida', order: 5, icon: 'file-text' },
  { id: 'follow_up', label: 'Follow-up Realizado', order: 6, icon: 'clock' },
  { id: 'pix', label: 'PIX Gerado', order: 7, icon: 'qr-code' },
  { id: 'pagamento', label: 'Pagamento Confirmado', order: 8, icon: 'check-circle' },
  { id: 'venda', label: 'Venda Concluída', order: 9, icon: 'trophy' },
  { id: 'pos_venda', label: 'Pós-Venda / Retenção', order: 10, icon: 'heart-handshake' }
];

function buildClientTimeline(lead, tenantId) {
  const events = [];

  // 1. Criação do Lead
  events.push({
    id: `ev_created_${lead.id}`,
    stage: 'lead_criado',
    stageLabel: 'Lead Criado',
    icon: 'user-plus',
    title: `Lead cadastrado no CRM 360°`,
    description: `Origem: ${lead.origin || 'Direta'} | Score inicial: ${lead.score || 50}`,
    timestamp: lead.createdAt,
    author: lead.assignedTo || 'Sistema'
  });

  // 2. Qualificação BANT (se houver)
  if (lead.bantData && Object.keys(lead.bantData).length > 0) {
    events.push({
      id: `ev_bant_${lead.id}`,
      stage: 'qualificacao',
      stageLabel: 'Qualificação BANT',
      icon: 'award',
      title: `Qualificação BANT pela IA`,
      description: `Score BANT: ${lead.bantData.score || lead.score || 70}/100 - Autoridade: ${lead.bantData.authority || 'Mapeado'}`,
      timestamp: lead.updatedAt || lead.createdAt,
      author: 'Claude AI Copilot'
    });
  }

  // 3. Atividades registradas
  const activities = activitiesDB.findByTenant(tenantId, a => a.leadId === lead.id);
  activities.forEach(act => {
    let stage = 'contato';
    let icon = 'phone-call';
    if (act.type === 'meeting') { stage = 'qualificacao'; icon = 'calendar'; }
    else if (act.type === 'whatsapp' || act.type === 'email') { stage = 'conversa'; icon = 'message-square'; }
    else if (act.type === 'follow_up') { stage = 'follow_up'; icon = 'clock'; }
    else if (act.type === 'stage_change') { stage = 'follow_up'; icon = 'git-commit'; }
    else if (act.type === 'deal_created') { stage = 'qualificacao'; icon = 'briefcase'; }

    events.push({
      id: act.id,
      stage,
      stageLabel: stage.replace('_', ' ').toUpperCase(),
      icon,
      title: act.title || act.type,
      description: act.description || '',
      timestamp: act.timestamp || act.createdAt,
      author: act.author || 'Equipe Comercial'
    });
  });

  // 4. Tarefas e Follow-ups
  const tasks = tasksDB.findByTenant(tenantId, t => t.leadId === lead.id);
  tasks.forEach(task => {
    events.push({
      id: task.id,
      stage: 'follow_up',
      stageLabel: 'Follow-up',
      icon: task.completed ? 'check-circle' : 'clock',
      title: `Tarefa: ${task.title}`,
      description: `Prioridade: ${(task.priority || 'media').toUpperCase()} | Status: ${task.completed ? 'Concluída' : 'Pendente'}`,
      timestamp: task.createdAt,
      author: task.assignedTo || 'Equipe'
    });
  });

  // 5. Propostas e Cobranças PIX
  const proposals = proposalsDB.findByTenant(tenantId, p => p.leadId === lead.id);
  proposals.forEach(p => {
    events.push({
      id: p.id,
      stage: 'proposta',
      stageLabel: 'Proposta Emitida',
      icon: 'file-text',
      title: `Proposta de R$ ${Number(p.amount).toLocaleString('pt-BR')}`,
      description: `Status: ${(p.status || 'pendente').toUpperCase()} | TXID: ${p.txId || 'CRM'}`,
      timestamp: p.createdAt,
      author: 'Financeiro'
    });

    if (p.pixPayload) {
      events.push({
        id: `${p.id}_pix`,
        stage: 'pix',
        stageLabel: 'PIX Gerado',
        icon: 'qr-code',
        title: `QR Code PIX gerado (luklen2@gmail.com)`,
        description: `Payload EMV Oficial Banco Central emitido no valor de R$ ${Number(p.amount).toLocaleString('pt-BR')}`,
        timestamp: p.createdAt,
        author: 'Sistema PIX'
      });
    }

    if (p.status === 'paga' || p.paidAt) {
      events.push({
        id: `${p.id}_paid`,
        stage: 'pagamento',
        stageLabel: 'Pagamento Confirmado',
        icon: 'check-circle-2',
        title: `PIX Confirmado - R$ ${Number(p.amount).toLocaleString('pt-BR')}`,
        description: `Baixa financeira realizada com sucesso`,
        timestamp: p.paidAt || p.updatedAt,
        author: 'Financeiro'
      });
    }
  });

  // 6. Oportunidades e Vendas
  const deals = dealsDB.findByTenant(tenantId, d => d.leadId === lead.id);
  deals.forEach(d => {
    if (d.stage === 'ganho') {
      events.push({
        id: `${d.id}_won`,
        stage: 'venda',
        stageLabel: 'Venda Concluída',
        icon: 'trophy',
        title: `Venda Fechada: ${d.title}`,
        description: `Receita gerada: R$ ${Number(d.value).toLocaleString('pt-BR')} faturada com sucesso!`,
        timestamp: d.closedAt || d.updatedAt,
        author: d.assignedTo || 'Equipe'
      });
      events.push({
        id: `${d.id}_pos`,
        stage: 'pos_venda',
        stageLabel: 'Pós-Venda / Retenção',
        icon: 'heart-handshake',
        title: `Ativação de Pós-Venda & Onboarding`,
        description: `Cliente migrado para a esteira de retenção e acompanhamento contínuo.`,
        timestamp: d.closedAt || d.updatedAt,
        author: 'Customer Success'
      });
    }
  });

  // Ordena eventos do mais recente para o mais antigo
  events.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

  // Determina estágio atual com base nos eventos
  const stagesReached = new Set(events.map(e => e.stage));
  let currentStageIndex = 0;
  TIMELINE_STAGES.forEach((s, idx) => {
    if (stagesReached.has(s.id)) currentStageIndex = Math.max(currentStageIndex, idx);
  });

  return {
    lead,
    stages: TIMELINE_STAGES.map((s, idx) => ({
      ...s,
      completed: idx <= currentStageIndex,
      current: idx === currentStageIndex
    })),
    currentStage: TIMELINE_STAGES[currentStageIndex],
    eventsCount: events.length,
    events
  };
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

  // 1.1 CHECKOUT PÚBLICO DE PROPOSTAS COMERCIAIS & PIX BACEN (FASE 10)
  if (pathname.startsWith('/p/') && method === 'GET') {
    const token = pathname.split('/')[2];
    const proposal = proposalsDB.findOne(p => p.publicToken === token || p.id === token);
    if (!proposal) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`<!DOCTYPE html><html lang="pt-BR" class="dark"><head><meta charset="UTF-8"><title>Proposta Não Encontrada</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-slate-950 text-white min-h-screen flex items-center justify-center p-4"><div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4"><div class="h-14 w-14 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center text-2xl font-bold">✕</div><h1 class="text-xl font-bold">Proposta não encontrada</h1><p class="text-xs text-slate-400">O link informado é inválido ou expirou.</p></div></body></html>`);
    }

    const tenant = tenantsDB.findById(proposal.tenantId) || { name: 'Agentise Mega CRM' };
    const deal = proposal.dealId ? dealsDB.findById(proposal.dealId) : null;
    const lead = proposal.leadId ? leadsDB.findById(proposal.leadId) : (deal && deal.leadId ? leadsDB.findById(deal.leadId) : null);
    const clientName = lead ? lead.name : (proposal.customerName || 'Cliente');
    const items = proposal.items || [{ description: deal ? deal.title : 'Serviços Comerciais', quantity: 1, unitPrice: proposal.amount, discount: 0 }];
    const formattedTotal = Number(proposal.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const isPaid = proposal.status === 'paga';

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposta Comercial | ${escapeHtml(tenant.name)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col justify-between p-4 sm:p-6">
  <div class="max-w-xl w-full mx-auto space-y-6 pt-4 pb-12">
    <div class="flex items-center justify-between border-b border-slate-800 pb-4">
      <div>
        <div class="text-xs uppercase tracking-widest text-emerald-400 font-bold">Proposta Comercial Oficial</div>
        <h1 class="text-xl font-black text-white">${escapeHtml(tenant.name)}</h1>
      </div>
      <div>
        <span class="px-3 py-1 rounded-full text-xs font-bold ${isPaid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}">
          ${isPaid ? '✓ PAGAMENTO CONFIRMADO' : 'AGUARDANDO PAGAMENTO'}
        </span>
      </div>
    </div>

    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex justify-between items-center text-xs">
      <div><span class="text-slate-400">Destinatário:</span><div class="text-sm font-bold text-white">${escapeHtml(clientName)}</div></div>
      <div class="text-right"><span class="text-slate-400">Data de Emissão:</span><div class="text-slate-200">${proposal.createdAt ? new Date(proposal.createdAt).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}</div></div>
    </div>

    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div class="text-xs font-bold text-slate-300 uppercase tracking-wider">Itens do Projeto</div>
      <div class="divide-y divide-slate-800 text-xs">
        ${items.map(item => `
          <div class="py-2 flex justify-between items-center">
            <div>
              <div class="font-semibold text-white">${escapeHtml(item.description)}</div>
              <div class="text-[11px] text-slate-400">Qtd: ${item.quantity || 1} x ${Number(item.unitPrice || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
            </div>
            <div class="font-bold text-white">${Number((item.quantity || 1) * (item.unitPrice || 0) - (item.discount || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          </div>
        `).join('')}
      </div>
      <div class="border-t border-slate-800 pt-3 flex justify-between items-center text-sm font-black">
        <span class="text-white">Valor Total:</span>
        <span class="text-emerald-400 text-lg">${formattedTotal}</span>
      </div>
    </div>

    ${!isPaid ? `
      <div class="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-6 text-center space-y-4 shadow-xl">
        <div class="text-emerald-400 font-bold text-sm">Pague com PIX Oficial Banco Central</div>
        <div class="inline-block p-3 bg-white rounded-2xl shadow-md">
          <img src="${proposal.qrCodeUrl}" alt="QR Code PIX" class="w-44 h-44 mx-auto" />
        </div>
        <div class="space-y-2 text-left">
          <label class="block text-[11px] text-slate-400 font-medium">PIX Copia e Cola:</label>
          <div class="flex gap-2">
            <input type="text" id="pix-emv" readonly value="${proposal.pixPayload}" class="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-300 font-mono select-all">
            <button onclick="navigator.clipboard.writeText(document.getElementById('pix-emv').value); alert('Chave PIX copiada!');" class="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white">Copiar</button>
          </div>
        </div>
        <div class="text-[11px] text-slate-500 pt-2">
          Chave PIX: <b class="text-slate-400">${proposal.pixKey || 'luklen2@gmail.com'}</b> • Titular: <b class="text-slate-400">LUCIANO SANT ANNA</b>
        </div>
      </div>
    ` : `
      <div class="bg-emerald-950/40 border border-emerald-500/40 rounded-3xl p-8 text-center space-y-3">
        <div class="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center text-xl font-bold">✓</div>
        <h2 class="text-lg font-bold text-white">Pagamento Confirmado!</h2>
        <p class="text-xs text-slate-300">Obrigado! Seu projeto foi formalizado com sucesso.</p>
      </div>
    `}
  </div>
</body></html>`);
  }

  if (pathname.startsWith('/api/public/proposals/') && method === 'GET') {
    const token = pathname.split('/')[4];
    const proposal = proposalsDB.findOne(p => p.publicToken === token || p.id === token);
    if (!proposal) return sendJson(res, 404, { error: 'Proposta não encontrada.' });
    return sendJson(res, 200, { success: true, data: proposal });
  }

  // 1.2 WEBHOOK PIX COM BAIXA AUTOMÁTICA EM TEMPO REAL (FASE 10)
  if (pathname === '/api/pix/webhook' && method === 'POST') {
    const body = await parseRequestBody(req);
    const tokenOrId = body.token || body.txId || body.proposalId;
    if (!tokenOrId) return sendJson(res, 400, { error: 'Identificador da transação/proposta é obrigatório.' });

    const proposal = proposalsDB.findOne(p => p.publicToken === tokenOrId || p.txId === tokenOrId || p.id === tokenOrId);
    if (!proposal) return sendJson(res, 404, { error: 'Proposta correspondente não localizada.' });

    const updated = proposalsDB.update(proposal.id, {
      status: 'paga',
      paidAt: new Date().toISOString()
    });

    if (paymentsDB) {
      paymentsDB.insert({
        tenantId: proposal.tenantId,
        proposalId: proposal.id,
        dealId: proposal.dealId,
        amount: proposal.amount,
        method: 'PIX',
        txId: proposal.txId || body.txId || 'TX_BACEN',
        endToEndId: body.endToEndId || `E${Date.now()}BACEN`,
        status: 'pago',
        paidAt: new Date().toISOString()
      });
    }

    if (proposal.dealId) {
      const deal = dealsDB.findById(proposal.dealId);
      if (deal && deal.stage !== 'ganho') {
        dealsDB.update(proposal.dealId, {
          stage: 'ganho',
          probability: 100,
          closedAt: new Date().toISOString()
        });
        await triggerWorkflows('venda_fechada', { dealId: proposal.dealId, leadId: proposal.leadId, amount: proposal.amount }, proposal.tenantId);
      }
    }

    activitiesDB.insert({
      tenantId: proposal.tenantId,
      leadId: proposal.leadId,
      dealId: proposal.dealId,
      type: 'payment_received',
      title: '💰 Pagamento PIX Confirmado via Webhook Bacen',
      description: `Valor recebido: R$ ${Number(proposal.amount).toFixed(2)}. Baixa automática concluída.`,
      timestamp: new Date().toISOString()
    });

    return sendJson(res, 200, { success: true, message: 'Baixa efetuada com sucesso.', proposalId: proposal.id });
  }

  // Identificação do IP do cliente e aplicação de Rate Limiting defensivo
  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';

  // Rate limit para rotas de autenticação (mitigação contra força bruta)
  if (pathname === '/api/auth/login' || pathname === '/api/auth/register') {
    const authRate = checkRateLimit(clientIp, 'auth', 30, 15 * 60 * 1000);
    if (!authRate.allowed) {
      return sendJson(res, 429, { 
        error: 'Muitas tentativas de autenticação a partir deste IP. Por favor, aguarde 15 minutos.' 
      });
    }
  }

  // Rate limit global para chamadas de API
  if (pathname.startsWith('/api/')) {
    const globalRate = checkRateLimit(clientIp, 'global', 600, 15 * 60 * 1000);
    if (!globalRate.allowed) {
      return sendJson(res, 429, { 
        error: 'Limite de requisições por minuto atingido. Tente novamente mais tarde.' 
      });
    }
  }

  // Identificação do Contexto da Requisição (Tenant + Usuário)
  const ctx = getRequestContext(req);
  const tenantId = ctx.tenantId;

  // 2. AUTENTICAÇÃO E GESTÃO DE USUÁRIOS
  if (pathname === '/api/auth/register' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: body._error });
    if (!body.email || !body.password || !body.companyName) {
      return sendJson(res, 400, { error: 'Nome da empresa, e-mail e senha são obrigatórios.' });
    }
    if (body.password.length < 8) {
      return sendJson(res, 400, { error: 'A senha deve conter no mínimo 8 caracteres para garantir a segurança da conta.' });
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
    if (body._error) return sendJson(res, 413, { error: body._error });
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

  if (pathname === '/api/users/roles' && method === 'GET') {
    return sendJson(res, 200, { success: true, count: VALID_ROLES.length, data: VALID_ROLES, roles: ROLES });
  }

  if (pathname === '/api/users' && method === 'GET') {
    const users = usersDB.findByTenant(tenantId).map(u => {
      const { passwordHash, ...safe } = u;
      return safe;
    });
    return sendJson(res, 200, { success: true, count: users.length, data: users });
  }

  if (pathname === '/api/users' && method === 'POST') {
    if (!hasPermission(ctx.role, 'USERS_MANAGE')) {
      return sendJson(res, 403, { error: 'Apenas administradores ou proprietários podem cadastrar novos membros ou vendedores na equipe.' });
    }
    const limitCheck = checkResourceLimit(tenantId, 'users');
    if (!limitCheck.allowed) {
      return sendJson(res, 402, { error: limitCheck.error });
    }
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: body._error });
    if (!body.name || !body.email) {
      return sendJson(res, 400, { error: 'Nome e e-mail são obrigatórios.' });
    }

    const { hashPassword } = require('./services/authService');
    const existing = usersDB.findOne(u => u.email.toLowerCase() === body.email.toLowerCase().trim());
    if (existing) {
      return sendJson(res, 409, { error: 'Já existe um usuário com este e-mail cadastrado.' });
    }

    const defaultPassword = body.password || 'Mudar@1234';
    const targetRole = VALID_ROLES.includes(body.role) ? body.role : 'VENDEDOR';
    const newUser = usersDB.insert({
      tenantId,
      name: body.name.trim(),
      email: body.email.toLowerCase().trim(),
      role: targetRole,
      phone: body.phone || '',
      passwordHash: hashPassword(defaultPassword),
      status: 'active',
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(body.name)}`
    });

    logAudit(tenantId, ctx.userId, 'USER_CREATED', 'users', { userId: newUser.id, role: newUser.role });
    const { passwordHash, ...safe } = newUser;
    return sendJson(res, 201, { success: true, data: safe });
  }

  // Listagem de empresas multi-tenant disponíveis
  if (pathname === '/api/auth/tenants' && method === 'GET') {
    const list = tenantsDB.findAll().map(t => ({
      id: t.id,
      name: t.name,
      segment: t.segment,
      plan: t.plan
    }));
    return sendJson(res, 200, { success: true, count: list.length, data: list });
  }

  // Alternar empresa ativa (troca rápida de tenant)
  if (pathname === '/api/auth/switch-tenant' && method === 'POST') {
    const body = await parseRequestBody(req);
    const targetId = body.tenantId || 'ten_demo_agentise';
    const targetTenant = tenantsDB.findById(targetId);
    if (!targetTenant) return sendJson(res, 404, { error: 'Empresa não encontrada.' });
    
    const targetUser = usersDB.findOne(u => u.tenantId === targetId && u.role === 'ADMINISTRADOR') || 
                       usersDB.findOne(u => u.tenantId === targetId) || {
                         id: `usr_${targetId}_admin`,
                         tenantId: targetId,
                         name: targetTenant.name,
                         email: `contato@${targetId}.com`,
                         role: 'ADMINISTRADOR',
                         status: 'active'
                       };

    const token = generateToken({
      userId: targetUser.id,
      tenantId: targetTenant.id,
      role: targetUser.role,
      name: targetUser.name,
      email: targetUser.email
    });

    return sendJson(res, 200, {
      success: true,
      data: {
        token,
        user: sanitizeUser(targetUser),
        tenant: targetTenant
      }
    });
  }

  // Endpoints específicos para o Teste 16 (Fluxo Real de Venda - Auto Prime Veículos)
  if (pathname === '/api/autoprime/execute-flow' && method === 'POST') {
    const { executeFullSalesFlow, getAutoPrimeAuditMetrics } = require('./services/autoPrimeService');
    const flow = executeFullSalesFlow();
    const metrics = getAutoPrimeAuditMetrics();
    return sendJson(res, 200, {
      success: true,
      data: {
        flow,
        metrics
      }
    });
  }

  if (pathname === '/api/autoprime/metrics' && method === 'GET') {
    const { getAutoPrimeAuditMetrics } = require('./services/autoPrimeService');
    const metrics = getAutoPrimeAuditMetrics();
    return sendJson(res, 200, { success: true, data: metrics });
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

  // 3.1 EMPRESAS & CLIENTES PJ (CRM 360°)
  if (pathname === '/api/companies' && method === 'GET') {
    const companies = companiesDB.findByTenant(tenantId);
    return sendJson(res, 200, { success: true, count: companies.length, data: companies });
  }

  if (pathname === '/api/companies' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (!body.name) return sendJson(res, 400, { error: 'Nome da empresa é obrigatório.' });
    const company = companiesDB.insert({ ...body, tenantId });
    logAudit({
      tenantId,
      userId: ctx.userId,
      userName: ctx.name,
      action: 'COMPANY_CREATED',
      resource: 'companies',
      entityId: company.id,
      ip: clientIp,
      description: `${ctx.name} cadastrou a empresa '${company.name}'.`
    });
    return sendJson(res, 201, { success: true, data: company });
  }

  // 3.2 CONTATOS & DECISORES (CRM 360°)
  if (pathname === '/api/contacts' && method === 'GET') {
    const contacts = contactsDB.findByTenant(tenantId);
    return sendJson(res, 200, { success: true, count: contacts.length, data: contacts });
  }

  if (pathname === '/api/contacts' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (!body.name) return sendJson(res, 400, { error: 'Nome do contato é obrigatório.' });
    const contact = contactsDB.insert({ ...body, tenantId });
    logAudit({
      tenantId,
      userId: ctx.userId,
      userName: ctx.name,
      action: 'CONTACT_CREATED',
      resource: 'contacts',
      entityId: contact.id,
      ip: clientIp,
      description: `${ctx.name} cadastrou o contato '${contact.name}'.`
    });
    return sendJson(res, 201, { success: true, data: contact });
  }

  // 4. LEADS & CRM 360° (COM ISOLAMENTO MULTI-TENANT)
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

  // Linha do Tempo CRM 360° (10 Estágios Padronizados)
  if ((pathname.startsWith('/api/leads/') || pathname.startsWith('/api/clients/')) && pathname.endsWith('/timeline') && method === 'GET') {
    const parts = pathname.split('/');
    const id = parts[3];
    const lead = leadsDB.findById(id);
    if (!lead || (lead.tenantId && lead.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Cliente/Lead não encontrado.' });
    }
    const timeline = buildClientTimeline(lead, tenantId);
    return sendJson(res, 200, { success: true, data: timeline });
  }

  // Registro de Atividade / Interação na Timeline
  if (pathname.startsWith('/api/leads/') && pathname.endsWith('/activities') && method === 'POST') {
    const id = pathname.split('/')[3];
    const lead = leadsDB.findById(id);
    if (!lead || (lead.tenantId && lead.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Lead não encontrado.' });
    }
    const body = await parseRequestBody(req);
    if (!body.description && !body.title) {
      return sendJson(res, 400, { error: 'Título ou descrição da atividade é obrigatório.' });
    }
    const activity = activitiesDB.insert({
      tenantId,
      leadId: lead.id,
      dealId: body.dealId || null,
      type: body.type || 'note',
      title: body.title || 'Interação registrada',
      description: body.description || '',
      author: ctx.name,
      timestamp: new Date().toISOString()
    });
    return sendJson(res, 201, { success: true, data: activity });
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

  // 4.9 PIPELINES & ESTÁGIOS CUSTOMIZÁVEIS (FASE 5)
  if (pathname === '/api/pipelines' && method === 'GET') {
    const pipelines = ensureTenantPipelines(tenantId);
    const includeStages = parsedUrl.searchParams.get('includeStages') === 'true';
    const data = pipelines.map(p => {
      if (!includeStages) return p;
      const stages = pipelineStagesDB.findByTenant(tenantId, s => s.pipelineId === p.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      return { ...p, stages };
    });
    return sendJson(res, 200, { success: true, count: data.length, data });
  }

  if (pathname === '/api/pipelines' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (!body.name) return sendJson(res, 400, { error: 'Nome do funil/pipeline é obrigatório.' });
    const pipeline = pipelinesDB.insert({
      tenantId,
      name: body.name,
      description: body.description || '',
      isDefault: Boolean(body.isDefault),
      createdAt: new Date().toISOString()
    });

    if (Array.isArray(body.stages)) {
      body.stages.forEach((s, idx) => {
        pipelineStagesDB.insert({
          tenantId,
          pipelineId: pipeline.id,
          key: s.key || s.id || `stg_${idx}`,
          name: s.name,
          probability: Number(s.probability || 20),
          slaDays: Number(s.slaDays || 3),
          color: s.color || '#3b82f6',
          order: idx + 1
        });
      });
    }

    logAudit({
      tenantId,
      userId: ctx.userId,
      userName: ctx.name,
      action: 'PIPELINE_CREATED',
      resource: 'pipelines',
      entityId: pipeline.id,
      ip: clientIp,
      description: `${ctx.name} criou o pipeline '${pipeline.name}'.`
    });

    return sendJson(res, 201, { success: true, data: pipeline });
  }

  if (pathname.startsWith('/api/pipelines/') && pathname.endsWith('/stages') && method === 'GET') {
    const pipeId = pathname.split('/')[3];
    const stages = pipelineStagesDB.findByTenant(tenantId, s => s.pipelineId === pipeId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    return sendJson(res, 200, { success: true, count: stages.length, data: stages });
  }

  if (pathname.startsWith('/api/pipelines/') && pathname.endsWith('/stages') && method === 'POST') {
    const pipeId = pathname.split('/')[3];
    const pipe = pipelinesDB.findById(pipeId);
    if (!pipe || (pipe.tenantId && pipe.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Pipeline não encontrado.' });
    }
    const body = await parseRequestBody(req);
    if (!body.name) return sendJson(res, 400, { error: 'Nome do estágio é obrigatório.' });
    const existingStages = pipelineStagesDB.findByTenant(tenantId, s => s.pipelineId === pipeId);
    const stage = pipelineStagesDB.insert({
      tenantId,
      pipelineId: pipe.id,
      key: body.key || `stg_${Date.now()}`,
      name: body.name,
      probability: Number(body.probability || 50),
      slaDays: Number(body.slaDays || 3),
      color: body.color || '#3b82f6',
      order: existingStages.length + 1
    });
    return sendJson(res, 201, { success: true, data: stage });
  }

  // 5. DEALS (OPORTUNIDADES DO PIPELINE COM AI DEAL SCORE ENRIQUECIDO)
  if (pathname === '/api/deals' && method === 'GET') {
    const deals = dealsDB.findByTenant(tenantId);
    const pipelineIdFilter = parsedUrl.searchParams.get('pipelineId');
    const filteredDeals = pipelineIdFilter ? deals.filter(d => d.pipelineId === pipelineIdFilter) : deals;

    const enriched = filteredDeals.map(deal => {
      const lead = leadsDB.findById(deal.leadId) || {};
      let scoreInfo = {
        score: deal.aiDealScore,
        classification: deal.aiScoreClassification,
        color: deal.aiScoreColor,
        rationale: deal.aiScoreRationale,
        drivers: deal.aiScoreDrivers,
        risks: deal.aiScoreRisks
      };

      if (scoreInfo.score === undefined || scoreInfo.score === null) {
        const activities = activitiesDB.findByTenant(tenantId, a => a.leadId === deal.leadId || a.dealId === deal.id);
        const tasks = tasksDB.findByTenant(tenantId, t => t.leadId === deal.leadId);
        const proposals = proposalsDB.findByTenant(tenantId, p => p.leadId === deal.leadId || p.dealId === deal.id);
        const calc = calculateAiDealScore(deal, lead, activities, tasks, proposals);
        scoreInfo = calc;
      }

      return {
        ...deal,
        lead,
        aiDealScore: scoreInfo.score,
        aiScoreClassification: scoreInfo.classification,
        aiScoreColor: scoreInfo.color,
        aiScoreRationale: scoreInfo.rationale,
        aiScoreDrivers: scoreInfo.drivers,
        aiScoreRisks: scoreInfo.risks
      };
    });
    return sendJson(res, 200, { success: true, count: enriched.length, data: enriched });
  }

  if (pathname === '/api/deals' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (!body.title || !body.leadId) {
      return sendJson(res, 400, { error: 'Título e LeadId são obrigatórios.' });
    }

    const lead = leadsDB.findById(body.leadId) || {};
    const initialScore = calculateAiDealScore({ ...body, stage: body.stage || 'prospeccao' }, lead, [], [], []);

    const deal = dealsDB.insert({
      tenantId,
      stage: body.stage || 'prospeccao',
      value: Number(body.value || 0),
      probability: Number(body.probability || 20),
      priority: body.priority || 'media',
      assignedTo: body.assignedTo || ctx.name,
      aiDealScore: initialScore.score,
      aiScoreClassification: initialScore.classification,
      aiScoreColor: initialScore.color,
      aiScoreRationale: initialScore.rationale,
      ...body
    });

    activitiesDB.insert({
      tenantId,
      dealId: deal.id,
      leadId: deal.leadId,
      type: 'deal_created',
      title: `Oportunidade criada: ${deal.title}`,
      description: `Valor inicial: R$ ${deal.value.toFixed(2)} - Responsável: ${deal.assignedTo} | AI Score: ${initialScore.score}/100`,
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

    // Auditoria de Governança com Delta
    logAudit({
      tenantId,
      userId: ctx.userId,
      userName: ctx.name,
      action: 'DEAL_STAGE_CHANGED',
      resource: 'deals',
      entityId: id,
      ip: clientIp,
      description: `${ctx.name} moveu a oportunidade '${deal.title}' do estágio "${oldStage}" para "${newStage}".`,
      oldValues: { stage: oldStage },
      newValues: { stage: newStage }
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

  if (pathname.startsWith('/api/deals/') && (method === 'PUT' || method === 'PATCH') && !pathname.endsWith('/stage')) {
    const id = pathname.split('/')[3];
    const deal = dealsDB.findById(id);
    if (!deal || (deal.tenantId && deal.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Oportunidade não encontrada.' });
    }
    const body = await parseRequestBody(req);
    const oldValues = {
      title: deal.title,
      value: deal.value,
      stage: deal.stage,
      assignedTo: deal.assignedTo
    };
    const updated = dealsDB.update(id, { ...body, tenantId });
    const newValues = {
      title: updated.title,
      value: updated.value,
      stage: updated.stage,
      assignedTo: updated.assignedTo
    };

    // Auditoria de Governança com Delta (Valor Anterior vs Novo)
    let description = `${ctx.name} atualizou a oportunidade #${id.slice(-4)} (${updated.title})`;
    if (oldValues.value !== newValues.value) {
      description = `${ctx.name} alterou oportunidade #${id.slice(-4)} de R$ ${Number(oldValues.value).toLocaleString('pt-BR')} para R$ ${Number(newValues.value).toLocaleString('pt-BR')}.`;
    }

    logAudit({
      tenantId,
      userId: ctx.userId,
      userName: ctx.name,
      action: 'DEAL_UPDATED',
      resource: 'deals',
      entityId: id,
      ip: clientIp,
      description,
      oldValues,
      newValues,
      details: { dealTitle: updated.title }
    });

    return sendJson(res, 200, { success: true, data: updated });
  }

  if (pathname.startsWith('/api/deals/') && method === 'DELETE') {
    const id = pathname.split('/')[3];
    const deal = dealsDB.findById(id);
    if (!deal || (deal.tenantId && deal.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Oportunidade não encontrada.' });
    }
    logAudit({
      tenantId,
      userId: ctx.userId,
      userName: ctx.name,
      action: 'DEAL_DELETED',
      resource: 'deals',
      entityId: id,
      ip: clientIp,
      description: `${ctx.name} removeu a oportunidade '${deal.title}' (R$ ${Number(deal.value).toLocaleString('pt-BR')}).`,
      oldValues: { title: deal.title, value: deal.value, stage: deal.stage }
    });
    const deleted = dealsDB.delete(id);
    return sendJson(res, 200, { success: deleted });
  }

  // 5.1 AI DEAL SCORE (CÁLCULO E REAVALIAÇÃO PREDITIVA COM EXPLICABILIDADE BANT)
  if (pathname.startsWith('/api/deals/') && pathname.endsWith('/ai-score') && method === 'POST') {
    const id = pathname.split('/')[3];
    const deal = dealsDB.findById(id);
    if (!deal || (deal.tenantId && deal.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Oportunidade não encontrada.' });
    }
    const lead = leadsDB.findById(deal.leadId) || {};
    const activities = activitiesDB.findByTenant(tenantId, a => a.leadId === deal.leadId || a.dealId === deal.id);
    const tasks = tasksDB.findByTenant(tenantId, t => t.leadId === deal.leadId);
    const proposals = proposalsDB.findByTenant(tenantId, p => p.leadId === deal.leadId || p.dealId === deal.id);

    const scoreResult = calculateAiDealScore(deal, lead, activities, tasks, proposals);
    const updated = dealsDB.update(deal.id, {
      aiDealScore: scoreResult.score,
      aiScoreClassification: scoreResult.classification,
      aiScoreColor: scoreResult.color,
      aiScoreRationale: scoreResult.rationale,
      aiScoreDrivers: scoreResult.drivers,
      aiScoreRisks: scoreResult.risks,
      aiScoreCalculatedAt: new Date().toISOString()
    });

    logAudit({
      tenantId,
      userId: ctx.userId,
      userName: ctx.name,
      action: 'DEAL_AI_SCORE_CALCULATED',
      resource: 'deals',
      entityId: deal.id,
      ip: clientIp,
      description: `${ctx.name} calculou AI Deal Score (${scoreResult.score}/100) para oportunidade '${deal.title}'.`,
      newValues: { aiDealScore: scoreResult.score, classification: scoreResult.classification }
    });

    return sendJson(res, 200, {
      success: true,
      aiDealScore: scoreResult.score,
      rationale: scoreResult.rationale,
      data: updated
    });
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

  // 7.1 INBOX MULTICANAL COM IA & HUMAN-IN-THE-LOOP (FASE 8)
  if (pathname === '/api/inbox/conversations' && method === 'GET') {
    let convs = getConversations(tenantId);
    const statusFilter = parsedUrl.searchParams.get('status');
    const channelFilter = parsedUrl.searchParams.get('channel');
    if (statusFilter) convs = convs.filter(c => c.status === statusFilter || c.mode === statusFilter);
    if (channelFilter) convs = convs.filter(c => c.channel === channelFilter);

    const enriched = convs.map(c => {
      const lead = leadsDB.findById(c.leadId) || {};
      const recentMsgs = getConversationMessages(c.id).slice(-2);
      return { ...c, lead, recentMessages: recentMsgs };
    });

    return sendJson(res, 200, { success: true, count: enriched.length, data: enriched });
  }

  if (pathname.startsWith('/api/inbox/conversations/') && pathname.endsWith('/suggest') && method === 'POST') {
    const convId = pathname.split('/')[4];
    try {
      const result = await generateSuggestedResponse({ conversationId: convId, tenantId });
      return sendJson(res, 200, { success: true, ...result });
    } catch (err) {
      return sendJson(res, 404, { error: err.message });
    }
  }

  if (pathname.startsWith('/api/inbox/conversations/') && pathname.endsWith('/messages') && method === 'POST') {
    const convId = pathname.split('/')[4];
    const body = await parseRequestBody(req);
    if (!body.text) return sendJson(res, 400, { error: 'Mensagem é obrigatória.' });

    try {
      const msg = sendMessage({
        tenantId,
        conversationId: convId,
        text: body.text,
        sender: body.sender || 'vendedor',
        senderName: body.approvedByHuman ? `${ctx.name} (Aprovado IA)` : ctx.name
      });
      return sendJson(res, 201, { success: true, data: msg });
    } catch (err) {
      return sendJson(res, 404, { error: err.message });
    }
  }

  if (pathname.startsWith('/api/inbox/conversations/') && pathname.endsWith('/mode') && (method === 'PATCH' || method === 'PUT')) {
    const convId = pathname.split('/')[4];
    const body = await parseRequestBody(req);
    try {
      const updated = setConversationMode({ conversationId: convId, tenantId, mode: body.mode });
      return sendJson(res, 200, { success: true, data: updated });
    } catch (err) {
      return sendJson(res, 404, { error: err.message });
    }
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

  // 10. AUTOMAÇÕES COMERCIAIS VISUAL & MOTOR DE REGRAS (FASE 9)
  if (pathname === '/api/automations/runs' && method === 'GET') {
    const runs = (workflowRunsDB ? workflowRunsDB.findByTenant(tenantId) : []).sort((a, b) => {
      return new Date(b.executedAt) - new Date(a.executedAt);
    });
    return sendJson(res, 200, { success: true, count: runs.length, data: runs.slice(0, 50) });
  }

  if (pathname === '/api/automations/test-trigger' && method === 'POST') {
    const body = await parseRequestBody(req);
    const triggerType = body.triggerType || 'novo_lead';
    const context = body.context || {};
    try {
      const executed = await triggerWorkflows(triggerType, context, tenantId);
      return sendJson(res, 200, { success: true, triggerType, executedActions: executed });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

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
      active: body.active !== undefined ? Boolean(body.active) : true
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

  if (pathname.startsWith('/api/automations/') && (method === 'PUT' || method === 'PATCH') && !pathname.endsWith('/toggle')) {
    const id = pathname.split('/')[3];
    const existing = automationsDB.findById(id);
    if (!existing || (existing.tenantId && existing.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Automação não encontrada.' });
    }
    const body = await parseRequestBody(req);
    const updated = automationsDB.update(id, {
      ...(body.name && { name: body.name }),
      ...(body.trigger && { trigger: body.trigger }),
      ...(body.condition !== undefined && { condition: body.condition }),
      ...(body.action && { action: body.action }),
      ...(body.active !== undefined && { active: Boolean(body.active) })
    });
    return sendJson(res, 200, { success: true, data: updated });
  }

  if (pathname.startsWith('/api/automations/') && method === 'DELETE') {
    const id = pathname.split('/')[3];
    const existing = automationsDB.findById(id);
    if (!existing || (existing.tenantId && existing.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Automação não encontrada.' });
    }
    automationsDB.delete(id);
    return sendJson(res, 200, { success: true, message: 'Automação excluída com sucesso.' });
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

  // 13.9 AI GATEWAY MULTI-LLM & TELEMETRIA (FASE 6)
  if (pathname === '/api/ai/models' && method === 'GET') {
    const models = listAvailableModels();
    return sendJson(res, 200, { success: true, count: models.length, data: models });
  }

  if (pathname === '/api/ai/chat' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (!body.prompt) {
      return sendJson(res, 400, { error: 'Prompt é obrigatório.' });
    }

    const aiResponse = await generateAIResponse({
      prompt: body.prompt,
      systemPrompt: body.systemPrompt,
      taskType: body.taskType || 'chat',
      modelPreference: body.modelPreference || 'auto',
      tenantId,
      userId: ctx.userId
    });

    return sendJson(res, 200, { success: true, ...aiResponse });
  }

  if (pathname === '/api/ai/usage' && method === 'GET') {
    const usageRecords = aiUsageDB.findByTenant(tenantId);
    const totalCredits = usageRecords.reduce((sum, r) => sum + (Number(r.costCredits || r.credits) || 0), 0);
    const cachedCalls = usageRecords.filter(r => r.cached).length;
    const byModel = {};
    usageRecords.forEach(r => {
      const m = r.model || 'outros';
      byModel[m] = (byModel[m] || 0) + 1;
    });

    const summary = {
      totalCalls: usageRecords.length,
      totalCreditsUsed: totalCredits,
      cachedCalls,
      byModel
    };

    return sendJson(res, 200, { success: true, summary, count: usageRecords.length, data: usageRecords });
  }

  // 13.10 AGENTES DE IA COMERCIAIS & TRANSBORDO HUMANO (FASE 7)
  if (pathname === '/api/ai/agents' && method === 'GET') {
    const agents = ensureTenantAgents(tenantId);
    return sendJson(res, 200, { success: true, count: agents.length, data: agents });
  }

  if (pathname === '/api/ai/agents' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (!body.name) return sendJson(res, 400, { error: 'Nome do agente de IA é obrigatório.' });
    const agent = aiAgentsDB.insert({
      tenantId,
      name: body.name,
      role: body.role || 'SDR',
      autonomyLevel: body.autonomyLevel || 'copiloto',
      tone: body.tone || 'consultivo_estrategico',
      systemPrompt: body.systemPrompt || 'Você é um assistente comercial inteligente focado em ajudar o cliente.',
      maxDealAutonomy: Number(body.maxDealAutonomy || 25000),
      handoverKeywords: body.handoverKeywords || ['humano', 'atendente', 'gerente'],
      active: body.active !== false,
      createdAt: new Date().toISOString()
    });

    logAudit({
      tenantId,
      userId: ctx.userId,
      userName: ctx.name,
      action: 'AI_AGENT_CREATED',
      resource: 'ai_agents',
      entityId: agent.id,
      ip: clientIp,
      description: `${ctx.name} criou o agente de IA '${agent.name}'.`
    });

    return sendJson(res, 201, { success: true, data: agent });
  }

  if (pathname.startsWith('/api/ai/agents/') && pathname.endsWith('/interact') && method === 'POST') {
    const agentId = pathname.split('/')[4];
    const body = await parseRequestBody(req);
    if (!body.message) {
      return sendJson(res, 400, { error: 'Mensagem do cliente é obrigatória.' });
    }

    try {
      const interactionResult = await processAgentInteraction({
        agentId,
        leadId: body.leadId,
        dealId: body.dealId,
        message: body.message,
        tenantId,
        channel: body.channel || 'whatsapp',
        userId: ctx.userId
      });

      return sendJson(res, 200, { success: true, ...interactionResult });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname === '/api/ai/conversations' && method === 'GET') {
    const convs = aiConversationsDB.findByTenant(tenantId)
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    return sendJson(res, 200, { success: true, count: convs.length, data: convs });
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

  // 15. PIX OFICIAL EMV & PROPOSTAS COM ITENS & CHECKOUT (FASE 10)
  if ((pathname === '/api/pix/generate' || pathname === '/api/proposals') && method === 'POST') {
    const body = await parseRequestBody(req);
    const settings = settingsDB.findById('general_settings') || {};

    const pixKey = body.pixKey || settings.pixKey || 'luklen2@gmail.com';
    const name = body.name || settings.pixName || 'LUCIANO SANT ANNA';
    const city = body.city || settings.pixCity || 'SAO PAULO';
    
    // Cálculo de itens e valor final
    const rawItems = Array.isArray(body.items) && body.items.length > 0 ? body.items : null;
    let calculatedSubtotal = 0;
    if (rawItems) {
      calculatedSubtotal = rawItems.reduce((acc, item) => acc + ((Number(item.unitPrice) || 0) * (Number(item.quantity) || 1) - (Number(item.discount) || 0)), 0);
    }
    const globalDiscount = Number(body.discount) || 0;
    const amount = body.amount !== undefined && !rawItems ? Number(body.amount) : Math.max(0, calculatedSubtotal - globalDiscount);
    const txId = body.txId || 'CRM' + Date.now().toString().slice(-6);

    const payload = generatePixPayload({ pixKey, name, city, amount, txId });
    const qrCodeUrl = getPixQrCodeUrl(payload);

    const publicToken = crypto.randomBytes(16).toString('hex');
    const checkoutUrl = `/p/${publicToken}`;

    let whatsappUrl = '';
    if (body.customerPhone) {
      whatsappUrl = generateWhatsAppProposalUrl({
        phone: body.customerPhone,
        customerName: body.customerName || 'Cliente',
        dealTitle: body.dealTitle || 'Proposta Comercial',
        amount,
        pixPayload: payload,
        checkoutUrl
      });
    }

    const items = rawItems || [{
      description: body.dealTitle || 'Serviços Comerciais de Alta Performance',
      quantity: 1,
      unitPrice: amount,
      discount: 0
    }];

    const proposal = proposalsDB.insert({
      tenantId,
      dealId: body.dealId || null,
      leadId: body.leadId || null,
      items,
      subtotal: calculatedSubtotal || amount,
      discount: globalDiscount,
      amount,
      notes: body.notes || '',
      validUntil: body.validUntil || new Date(Date.now() + 7 * 86400000).toISOString(),
      publicToken,
      checkoutUrl,
      pixKey,
      pixPayload: payload,
      qrCodeUrl,
      status: 'pendente',
      txId
    });

    await triggerWorkflows('proposta_criada', { dealId: body.dealId, leadId: body.leadId, amount }, tenantId);

    return sendJson(res, 200, {
      success: true,
      data: {
        proposalId: proposal.id,
        publicToken,
        checkoutUrl,
        payload,
        qrCodeUrl,
        whatsappUrl,
        txId,
        amount,
        items: proposal.items,
        validUntil: proposal.validUntil
      }
    });
  }

  // Consulta proposta individual
  if (pathname.startsWith('/api/proposals/') && !pathname.endsWith('/confirm') && method === 'GET') {
    const proposalId = pathname.split('/')[3];
    const proposal = proposalsDB.findById(proposalId);
    if (!proposal || (proposal.tenantId && proposal.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Proposta não encontrada.' });
    }
    return sendJson(res, 200, { success: true, data: proposal });
  }

  // Listagem de propostas do tenant
  if (pathname === '/api/proposals' && method === 'GET') {
    const proposals = proposalsDB.findByTenant(tenantId).map(p => {
      const deal = p.dealId ? dealsDB.findById(p.dealId) : null;
      const lead = p.leadId ? leadsDB.findById(p.leadId) : (deal && deal.leadId ? leadsDB.findById(deal.leadId) : null);
      return {
        ...p,
        dealTitle: deal ? deal.title : 'Proposta Avulsa',
        customerName: lead ? lead.name : (p.customerName || 'Cliente'),
        customerPhone: lead ? lead.phone : (p.customerPhone || '-')
      };
    }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return sendJson(res, 200, { success: true, count: proposals.length, data: proposals });
  }

  // Baixa / Confirmação de recebimento PIX de proposta comercial
  if (pathname.startsWith('/api/proposals/') && pathname.endsWith('/confirm') && method === 'PATCH') {
    if (!hasPermission(ctx.role, 'PROPOSALS_CONFIRM')) {
      return sendJson(res, 403, { error: 'Acesso negado. Apenas financeiro, administradores ou proprietários podem confirmar recebimento de propostas.' });
    }
    const parts = pathname.split('/');
    const proposalId = parts[3];
    const proposal = proposalsDB.findById(proposalId);
    if (!proposal || (proposal.tenantId && proposal.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Proposta não encontrada.' });
    }

    const updated = proposalsDB.update(proposalId, {
      status: 'paga',
      paidAt: new Date().toISOString()
    });

    if (paymentsDB) {
      paymentsDB.insert({
        tenantId,
        proposalId,
        dealId: proposal.dealId,
        amount: proposal.amount,
        method: 'PIX',
        txId: proposal.txId || 'TX_MANUAL',
        status: 'pago',
        paidAt: new Date().toISOString()
      });
    }

    // Se houver Oportunidade vinculada, avança automaticamente para 'ganho' (Venda Fechada)
    if (proposal.dealId) {
      const deal = dealsDB.findById(proposal.dealId);
      if (deal && deal.stage !== 'ganho') {
        dealsDB.update(proposal.dealId, {
          stage: 'ganho',
          probability: 100,
          closedAt: new Date().toISOString()
        });
        await triggerWorkflows('venda_fechada', { dealId: proposal.dealId, leadId: proposal.leadId, amount: proposal.amount }, tenantId);
      }
    }

    logAudit(tenantId, ctx.userId, 'PROPOSAL_CONFIRMED', 'proposals', { proposalId, amount: proposal.amount });
    return sendJson(res, 200, { success: true, data: updated });
  }

  // 16. DASHBOARD EXECUTIVO, ANALYTICS & BI AVANÇADO (FASE 11)
  if (pathname === '/api/analytics/bi' && method === 'GET') {
    const biData = calculateAdvancedBi(tenantId);
    return sendJson(res, 200, { success: true, data: biData });
  }

  if (pathname === '/api/analytics' && method === 'GET') {
    const deals = dealsDB.findByTenant(tenantId);
    const leads = leadsDB.findByTenant(tenantId);
    const tasks = tasksDB.findByTenant(tenantId);
    const users = usersDB.findByTenant(tenantId);
    const proposals = proposalsDB.findByTenant(tenantId);

    const bi = calculateAdvancedBi(tenantId);

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
        sellersPerformance,
        bi: bi.kpis,
        channelPerformance: bi.channelPerformance,
        aiUsageSummary: bi.aiUsageSummary
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
    if (!hasPermission(ctx.role, 'SETTINGS_EDIT')) {
      return sendJson(res, 403, { error: 'Acesso negado. Apenas administradores ou proprietários podem alterar configurações do sistema.' });
    }
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: body._error });
    const existing = settingsDB.findById('general_settings') || {};
    const updated = settingsDB.update('general_settings', {
      ...existing,
      ...body,
      id: 'general_settings'
    });

    logAudit({
      tenantId,
      userId: ctx.userId,
      userName: ctx.name,
      action: 'SETTINGS_UPDATED',
      resource: 'settings',
      entityId: 'general_settings',
      ip: clientIp,
      description: `${ctx.name} atualizou parâmetros e configurações corporativas.`,
      oldValues: existing,
      newValues: updated
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
    if (body._error) return sendJson(res, 413, { error: body._error });
    if (!body.leadId) return sendJson(res, 400, { error: 'LeadId é obrigatório' });
    const lead = leadsDB.findById(body.leadId);
    if (!lead || (lead.tenantId && lead.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Lead não encontrado.' });
    }

    const anonymized = leadsDB.update(body.leadId, {
      name: `Anonimizado ${lead.id.slice(-4)}`,
      email: 'anonimizado@lgpd.crm',
      phone: '00000000000',
      company: 'Empresa Anonimizada',
      notes: '[DADOS PESSOAIS EXPURGADOS CONFORME ART. 18 LGPD]'
    });

    return sendJson(res, 200, { success: true, data: anonymized });
  }

  // Backup Completo de Dados da Empresa (Contingência e Arquivamento)
  if (pathname === '/api/backup' && method === 'GET') {
    if (!hasPermission(ctx.role, 'BACKUP_DOWNLOAD')) {
      return sendJson(res, 403, { error: 'Apenas administradores ou proprietários podem baixar o backup completo da empresa.' });
    }

    const backupData = {
      empresa: tenantsDB.findById(tenantId),
      exportadoEm: new Date().toISOString(),
      versao: '2.0.0',
      totalRegistros: {
        leads: leadsDB.countByTenant(tenantId),
        deals: dealsDB.countByTenant(tenantId),
        tasks: tasksDB.countByTenant(tenantId),
        proposals: proposalsDB.countByTenant(tenantId)
      },
      dados: {
        leads: leadsDB.findByTenant(tenantId),
        deals: dealsDB.findByTenant(tenantId),
        tasks: tasksDB.findByTenant(tenantId),
        proposals: proposalsDB.findByTenant(tenantId),
        knowledgeBase: knowledgeBaseDB.findByTenant(tenantId),
        automations: automationsDB.findByTenant(tenantId),
        settings: settingsDB.findByTenant(tenantId)
      }
    };

    return sendJson(res, 200, { success: true, data: backupData });
  }

  // 18.2 TRILHA DE AUDITORIA & GOVERNANÇA (DELTA ANTES/DEPOIS)
  if (pathname === '/api/audit-logs' && method === 'GET') {
    if (!hasPermission(ctx.role, 'AUDIT_VIEW')) {
      return sendJson(res, 403, { error: 'Acesso restrito. Apenas administradores e proprietários têm permissão para auditar os logs do sistema.' });
    }
    let logs = auditLogsDB.findByTenant(tenantId);
    
    // Filtros opcionais via query string
    const resourceFilter = parsedUrl.searchParams.get('resource');
    const actionFilter = parsedUrl.searchParams.get('action');
    if (resourceFilter) {
      logs = logs.filter(l => l.resource === resourceFilter);
    }
    if (actionFilter) {
      logs = logs.filter(l => l.action === actionFilter);
    }
    
    logs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    return sendJson(res, 200, {
      success: true,
      count: logs.length,
      data: logs
    });
  }

  // 19. ARQUIVOS ESTÁTICOS & SPA FALLBACK
  let targetFile = pathname === '/' ? 'index.html' : pathname.slice(1);
  const served = serveStatic(req, res, targetFile);

  if (!served) {
    const ext = path.extname(pathname).toLowerCase();
    const isHtmlNavigation = !ext || (req.headers.accept && req.headers.accept.includes('text/html'));
    const isBlocked = BLOCKED_STATIC_PREFIXES.some(p => pathname.toLowerCase().startsWith(`/${p}`)) ||
                      BLOCKED_STATIC_FILES.some(f => pathname.toLowerCase() === `/${f}`);

    // SPA fallback exclusivamente para rotas navegacionais legítimas
    if (isHtmlNavigation && !isBlocked) {
      const fallbackServed = serveStatic(req, res, 'index.html');
      if (fallbackServed) return;
    }

    res.writeHead(404, { 
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN'
    });
    res.end(JSON.stringify({ error: 'Recurso não encontrado ou acesso restrito.', status: 404 }));
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
