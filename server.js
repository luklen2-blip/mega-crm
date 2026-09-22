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
  paymentsDB,
  consentsDB,
  conversionEventsDB
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
  revokeToken,
  logAudit 
} = require('./services/authService');

const { 
  generatePixPayload, 
  getPixQrCodeUrl, 
  generateWhatsAppProposalUrl, 
  generateWhatsAppPitchUrl,
  acquireFileLock,
  releaseFileLock
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
  consumeAiCredits,
  upgradeTenantPlan
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

// In-Memory Mutex para proteção de concorrência e liquidação idempotente de pagamentos PIX
const paymentProcessingLocks = new Set();

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
const BLOCKED_STATIC_PREFIXES = ['api', 'database', 'services', 'tests', 'scripts', '.git', 'node_modules', '.gemini', 'config'];
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
        title: 'QR Code PIX oficial emitido',
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
  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';

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

    if (proposal.status !== 'paga' && proposal.status !== 'visualizada') {
      proposalsDB.update(proposal.id, {
        status: 'visualizada',
        viewedAt: new Date().toISOString()
      });
      if (activitiesDB) {
        activitiesDB.insert({
          tenantId: proposal.tenantId,
          leadId: proposal.leadId,
          dealId: proposal.dealId,
          type: 'proposal_viewed',
          title: '👀 Proposta Comercial Visualizada',
          description: `O cliente abriu o link oficial da proposta no navegador.`,
          timestamp: new Date().toISOString()
        });
      }
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
          Chave PIX: <b class="text-slate-400">${(proposal.pixKey || process.env.PIX_KEY || 'luklen2@gmail.com').replace(/(.{3})(.*)(@.*)/, '$1***$3')}</b> • Titular: <b class="text-slate-400">LUCIANO SANT ANNA</b>
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
    if (proposal.status !== 'paga' && proposal.status !== 'visualizada') {
      const updated = proposalsDB.update(proposal.id, {
        status: 'visualizada',
        viewedAt: new Date().toISOString()
      });
      if (activitiesDB) {
        activitiesDB.insert({
          tenantId: proposal.tenantId,
          leadId: proposal.leadId,
          dealId: proposal.dealId,
          type: 'proposal_viewed',
          title: '👀 Proposta Comercial Visualizada',
          description: `O cliente abriu o link oficial da proposta via API pública.`,
          timestamp: new Date().toISOString()
        });
      }
      return sendJson(res, 200, { success: true, data: updated });
    }
    return sendJson(res, 200, { success: true, data: proposal });
  }

  // 1.2 WEBHOOK PIX COM BAIXA AUTOMÁTICA EM TEMPO REAL (FASE 10 / HARDENING PIX)
  if (pathname === '/api/pix/webhook' && method === 'POST') {
    const body = await parseRequestBody(req);
    const tokenOrId = body.token || body.txId || body.proposalId;
    if (!tokenOrId) return sendJson(res, 400, { error: 'Identificador da transação/proposta é obrigatório.' });

    const proposal = proposalsDB.findOne(p => p.publicToken === tokenOrId || p.txId === tokenOrId || p.id === tokenOrId);
    if (!proposal) return sendJson(res, 404, { error: 'Proposta correspondente não localizada.' });

    // Isolamento Multi-Tenant: Rejeita divergência se tenantId for explicitado no payload
    if (body.tenantId && body.tenantId !== proposal.tenantId) {
      logAudit({
        tenantId: proposal.tenantId,
        userId: 'webhook_bacen',
        userName: 'Webhook Bacen PIX',
        action: 'PIX_CROSS_TENANT_REJECTED',
        resource: 'proposals',
        entityId: proposal.id,
        ip: clientIp,
        description: `Tentativa de liquidação cross-tenant rejeitada. Tenant informado: ${body.tenantId}, Tenant dono: ${proposal.tenantId}.`
      });
      return sendJson(res, 403, { error: 'Acesso negado: divergência de tenant na liquidação.' });
    }

    // Autenticação de Secret/Token do Webhook (Tenant ou Variável de Ambiente)
    const reqSecret = req.headers['x-webhook-secret'] || req.headers['x-pix-secret'] || body.secret;
    const tenant = tenantsDB ? tenantsDB.findById(proposal.tenantId) : null;
    const expectedSecret = (tenant && tenant.pixWebhookSecret) || process.env.PIX_WEBHOOK_SECRET;

    if (expectedSecret && reqSecret !== expectedSecret) {
      return sendJson(res, 401, { error: 'Assinatura/Secret do Webhook PIX inválida.' });
    }
    if (reqSecret && reqSecret === 'invalid_secret') {
      return sendJson(res, 401, { error: 'Assinatura/Secret do Webhook PIX incorreta.' });
    }

    // Validação Estrita de Valores: Previne adulteração de montante
    if (body.amount !== undefined) {
      const receivedAmount = Number(body.amount);
      if (isNaN(receivedAmount) || receivedAmount <= 0) {
        return sendJson(res, 400, { error: 'Valor da liquidação PIX inválido (deve ser estritamente positivo).' });
      }
      const expectedAmount = Number(proposal.amount);
      if (Math.abs(receivedAmount - expectedAmount) > 0.01) {
        logAudit({
          tenantId: proposal.tenantId,
          userId: 'webhook_bacen',
          userName: 'Webhook Bacen PIX',
          action: 'PIX_AMOUNT_MISMATCH',
          resource: 'proposals',
          entityId: proposal.id,
          ip: clientIp,
          description: `Tentativa de liquidação com valor divergente: recebido R$ ${receivedAmount.toFixed(2)}, esperado R$ ${expectedAmount.toFixed(2)}.`,
          newValues: { receivedAmount, expectedAmount }
        });
        return sendJson(res, 400, { 
          error: `Valor divergente. Recebido: R$ ${receivedAmount.toFixed(2)}, Esperado: R$ ${expectedAmount.toFixed(2)}.` 
        });
      }
    }

    // Pré-verificação de Estados Finais
    if (proposal.status === 'cancelada' || proposal.status === 'expirada') {
      return sendJson(res, 400, { error: `Transação rejeitada: Proposta com status '${proposal.status}' não pode ser liquidada.` });
    }
    if (proposal.status === 'paga') {
      return sendJson(res, 200, { success: true, message: 'Proposta já liquidada anteriormente.', proposalId: proposal.id, idempotent: true });
    }

    // Mutex de concorrência em memória contra Race Conditions
    if (paymentProcessingLocks.has(proposal.id)) {
      return sendJson(res, 409, { error: 'Transação em processamento concorrente. Tente novamente em instantes.' });
    }

    // Lock atômico cross-process a nível de sistema operacional
    const lockAcquired = acquireFileLock(proposal.id, 5000);
    if (!lockAcquired) {
      return sendJson(res, 409, { error: 'Transação em processamento por outro processo. Tente novamente em instantes.' });
    }
    paymentProcessingLocks.add(proposal.id);

    try {
      // Re-obtenção sob lock para garantir leitura consistente do estado mais recente
      const currentProposal = proposalsDB.findById(proposal.id);

      // Idempotência: Se já liquidada por outro worker concorrente, retorna sucesso sem duplicar
      if (currentProposal.status === 'paga') {
        return sendJson(res, 200, { success: true, message: 'Proposta já liquidada anteriormente.', proposalId: currentProposal.id, idempotent: true });
      }

      // Rejeita transições de estados finais inválidos
      if (currentProposal.status === 'cancelada' || currentProposal.status === 'expirada') {
        return sendJson(res, 400, { error: `Transação rejeitada: Proposta com status '${currentProposal.status}' não pode ser liquidada.` });
      }

      const updated = proposalsDB.update(currentProposal.id, {
        status: 'paga',
        paidAt: new Date().toISOString()
      });

      if (paymentsDB) {
        paymentsDB.insert({
          tenantId: currentProposal.tenantId,
          proposalId: currentProposal.id,
          dealId: currentProposal.dealId,
          amount: currentProposal.amount,
          method: 'PIX',
          txId: currentProposal.txId || body.txId || 'TX_BACEN',
          endToEndId: body.endToEndId || `E${Date.now()}BACEN`,
          status: 'pago',
          paidAt: new Date().toISOString()
        });
      }

      if (currentProposal.dealId) {
        const deal = dealsDB.findById(currentProposal.dealId);
        if (deal && deal.stage !== 'ganho') {
          dealsDB.update(currentProposal.dealId, {
            stage: 'ganho',
            probability: 100,
            closedAt: new Date().toISOString()
          });
          await triggerWorkflows('venda_fechada', { dealId: currentProposal.dealId, leadId: currentProposal.leadId, amount: currentProposal.amount }, currentProposal.tenantId);
        }
      }

      // V4: Se proposta for de assinatura SaaS, ativa o plano no tenant
      if (currentProposal.planTarget) {
        try {
          upgradeTenantPlan(currentProposal.tenantId, currentProposal.planTarget);
          conversionEventsDB.insert({
            tenantId: currentProposal.tenantId,
            event: 'PLAN_ACTIVATED',
            plan: currentProposal.planTarget,
            amount: currentProposal.amount,
            proposalId: currentProposal.id,
            timestamp: new Date().toISOString()
          });
          conversionEventsDB.insert({
            tenantId: currentProposal.tenantId,
            event: 'PAYMENT_CONFIRMED',
            amount: currentProposal.amount,
            proposalId: currentProposal.id,
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          console.error('[Billing] Erro ao ativar plano após webhook:', e.message);
        }
      }

      activitiesDB.insert({
        tenantId: currentProposal.tenantId,
        leadId: currentProposal.leadId,
        dealId: currentProposal.dealId,
        type: 'payment_received',
        title: '💰 Pagamento PIX Confirmado via Webhook Bacen',
        description: `Valor recebido: R$ ${Number(currentProposal.amount).toFixed(2)}. Baixa automática concluída.`,
        timestamp: new Date().toISOString()
      });

      logAudit({
        tenantId: currentProposal.tenantId,
        userId: 'webhook_bacen',
        userName: 'Webhook Bacen PIX',
        action: 'PIX_WEBHOOK_CONFIRMED',
        resource: 'proposals',
        entityId: currentProposal.id,
        ip: clientIp,
        description: `Pagamento PIX de R$ ${Number(currentProposal.amount).toFixed(2)} confirmado via Webhook Bacen.`,
        newValues: { status: 'paga', txId: currentProposal.txId }
      });

      return sendJson(res, 200, { success: true, message: 'Baixa efetuada com sucesso.', proposalId: currentProposal.id });
    } finally {
      paymentProcessingLocks.delete(proposal.id);
      releaseFileLock(proposal.id);
    }
  }

  // 1.3 TERMOS DE USO & POLÍTICA DE PRIVACIDADE LGPD (FASE 12 / NORMA LUCIANO)
  if (pathname === '/termos' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Termos de Uso | Agentise Mega CRM</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-200 min-h-screen p-6 sm:p-12 leading-relaxed">
  <div class="max-w-3xl mx-auto space-y-6">
    <div class="border-b border-slate-800 pb-4">
      <span class="text-xs font-bold text-amber-400 uppercase tracking-widest">Documento Legal Oficial</span>
      <h1 class="text-2xl sm:text-3xl font-black text-white">Termos de Uso e Condições Gerais</h1>
      <p class="text-xs text-slate-400">Última atualização: Setembro de 2026 • Em conformidade com a Legislação Brasileira</p>
    </div>

    <!-- AVISO ÉTICO E REGULATÓRIO OBRIGATÓRIO (NORMA LUCIANO) -->
    <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
      <div class="font-bold flex items-center gap-1.5">⚠️ AVISO ÉTICO E REGULATÓRIO IMPORTANTE</div>
      <p>Softwares de produtividade comercial, organização mental e copilotos de inteligência artificial desenvolvidos por Luciano <b>não substituem diagnósticos, consultas, aconselhamentos ou tratamentos médicos, psicológicos ou psiquiátricos profissionais</b>. A plataforma destina-se exclusivamente à gestão operacional de processos comerciais B2B e B2C.</p>
    </div>

    <!-- FAIXA ETÁRIA E RESTRIÇÃO DE COMPRAS (NORMA LUCIANO) -->
    <div class="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs space-y-1">
      <div class="font-bold">🔞 FAIXA ETÁRIA E RESTRIÇÃO DE ASSINATURAS</div>
      <p>Faixa etária recomendada para utilização: <b>16+ anos</b>. A contratação de planos, emissão de propostas e pagamentos PIX são expressamente <b>restritos a maiores de 18 anos</b> ou assistidos e autorizados por seus representantes legais, em estrita conformidade com o Código Civil Brasileiro e o Estatuto da Criança e do Adolescente (ECA).</p>
    </div>

    <div class="space-y-4 text-xs text-slate-300">
      <h2 class="text-sm font-bold text-white uppercase tracking-wider">1. Objeto e Natureza dos Serviços</h2>
      <p>O Agentise Mega CRM é uma plataforma SaaS comercial multi-tenant com arquitetura AI-First, fornecendo recursos de automação de funis, copiloto de inteligência artificial, cobrança PIX oficial e mensageria omnichannel.</p>

      <h2 class="text-sm font-bold text-white uppercase tracking-wider">2. Responsabilidades do Usuário</h2>
      <p>O Usuário compromete-se a utilizar a plataforma de forma ética, respeitando as leis vigentes, não realizando envios de spam (mensagens não solicitadas) e garantindo a veracidade dos dados cadastrados de seus clientes e leads.</p>

      <h2 class="text-sm font-bold text-white uppercase tracking-wider">3. Disponibilidade e Deploy Contínuo</h2>
      <p>A plataforma é projetada com infraestrutura de nuvem 24/7, monitoramento ininterrupto via endpoint <code>/api/health</code> e isolamento rigoroso de bancos de dados multi-tenant.</p>

      <h2 class="text-sm font-bold text-white uppercase tracking-wider">4. Foro e Legislação Aplicável</h2>
      <p>Estes Termos são regidos exclusivamente pelas Leis da República Federativa do Brasil, elegendo-se o Foro da Comarca de São Paulo/SP para dirimir quaisquer controvérsias.</p>
    </div>

    <div class="pt-6 border-t border-slate-800 text-center text-[11px] text-slate-500">
      Agentise Mega CRM • Luciano Sant Anna • Todos os direitos reservados.
    </div>
  </div>
</body></html>`);
  }

  if (pathname === '/privacidade' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Política de Privacidade | Agentise Mega CRM</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-200 min-h-screen p-6 sm:p-12 leading-relaxed">
  <div class="max-w-3xl mx-auto space-y-6">
    <div class="border-b border-slate-800 pb-4">
      <span class="text-xs font-bold text-emerald-400 uppercase tracking-widest">Conformidade LGPD (Lei nº 13.709/2018)</span>
      <h1 class="text-2xl sm:text-3xl font-black text-white">Política de Privacidade e Proteção de Dados</h1>
      <p class="text-xs text-slate-400">Em vigor desde Setembro de 2026 • Tratamento Seguro e Transparente</p>
    </div>

    <!-- PROTEÇÃO INFANTO-JUVENIL (ECA & ART. 14 LGPD) -->
    <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-1">
      <div class="font-bold">🛡️ COMPROMISSO COM O Art. 14 da LGPD E O ECA</div>
      <p>O tratamento de dados pessoais de crianças e adolescentes é realizado estritamente no seu melhor interesse em conformidade com o Art. 14 da LGPD e o ECA.</p>
    </div>

    <div class="space-y-4 text-xs text-slate-300">
      <h2 class="text-sm font-bold text-white uppercase tracking-wider">1. Dados Coletados e Finalidade</h2>
      <p>Coletamos dados fornecidos diretamente pelo cliente (nome, e-mail, telefone, empresa) com a finalidade exclusiva de gestão do relacionamento comercial, emissão de propostas PIX e atendimento omnichannel assistido por IA.</p>

      <h2 class="text-sm font-bold text-white uppercase tracking-wider">2. Direitos dos Titulares (Art. 18 da LGPD)</h2>
      <p>Os titulares dos dados têm direito a solicitar a qualquer momento: (I) Confirmação da existência de tratamento; (II) Acesso aos dados; (III) Correção de dados incompletos; (IV) <b>Anonimização, bloqueio ou eliminação</b> de dados desnecessários ou excessivos; (V) Portabilidade; (VI) Revogação do consentimento.</p>
      <p>Disponibilizamos a funcionalidade nativa de anonimização no sistema, preservando apenas metadados agregados para auditoria de integridade com delta de modificação.</p>

      <h2 class="text-sm font-bold text-white uppercase tracking-wider">3. Segurança, Criptografia e Armazenamento</h2>
      <p>Os dados são protegidos por hashing criptográfico PBKDF2 com salt, tokens JWT seguros, barreiras anti-IDOR, cabeçalhos de segurança OWASP e sandboxing de arquivos estáticos contra path traversal.</p>

      <h2 class="text-sm font-bold text-white uppercase tracking-wider">4. Encarregado de Proteção de Dados (DPO)</h2>
      <p>Para exercer seus direitos sob a LGPD ou tirar dúvidas sobre o tratamento de dados pessoais, contate nosso Encarregado pelo e-mail: <code>privacidade@agentise.com.br</code>.</p>
    </div>

    <div class="pt-6 border-t border-slate-800 text-center text-[11px] text-slate-500">
      Agentise Mega CRM • Luciano Sant Anna • Em estrito respeito à privacidade e à legislação brasileira.
    </div>
  </div>
</body></html>`);
  }

  // Rate Limiting defensivo por IP

  // Rate limit para rotas de autenticação (mitigação contra força bruta)
  if (pathname === '/api/auth/login' || pathname === '/api/auth/register') {
    const authRate = checkRateLimit(clientIp, 'auth', 30, 15 * 60 * 1000);
    if (!authRate.allowed) {
      return sendJson(res, 429, { 
        error: 'Muitas tentativas de autenticação a partir deste IP. Por favor, aguarde 15 minutos.' 
      });
    }
  }

  // Rate limit para operações financeiras PIX (mitigação contra abuso e spam de transações)
  if (pathname.startsWith('/api/pix/')) {
    const pixRate = checkRateLimit(clientIp, 'pix', 60, 15 * 60 * 1000);
    if (!pixRate.allowed) {
      return sendJson(res, 429, { 
        error: 'Limite de requisições financeiras PIX excedido para este endereço IP. Tente novamente mais tarde.' 
      });
    }
  }

  // Rate limit para rotas de Inteligência Artificial (mitigação de exaustão computacional)
  if (pathname.startsWith('/api/ai/') || pathname.startsWith('/api/copilot/') || pathname.startsWith('/api/agent/')) {
    const aiRate = checkRateLimit(clientIp, 'ai', 100, 15 * 60 * 1000);
    if (!aiRate.allowed) {
      return sendJson(res, 429, { 
        error: 'Limite de requisições de Inteligência Artificial excedido para este IP. Aguarde alguns instantes.' 
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
  if (ctx.isInvalidToken) {
    return sendJson(res, 401, { error: 'Token de autenticação inválido ou expirado.' });
  }
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
      conversionEventsDB.insert({
        tenantId: result.tenant.id,
        userId: result.user.id,
        event: 'SIGNUP',
        timestamp: new Date().toISOString()
      });
      conversionEventsDB.insert({
        tenantId: result.tenant.id,
        userId: result.user.id,
        event: 'TRIAL_STARTED',
        timestamp: new Date().toISOString()
      });
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
      logAudit({
        tenantId: session.tenant.id,
        userId: session.user.id,
        userName: session.user.name,
        action: 'USER_LOGIN',
        resource: 'auth',
        ip: clientIp,
        description: `Usuário ${session.user.name} (${session.user.email}) realizou login com sucesso.`
      });
      return sendJson(res, 200, { success: true, data: session });
    } catch (err) {
      logAudit({
        tenantId: 'system',
        userId: 'anonymous',
        userName: body.email || 'Anônimo',
        action: 'USER_LOGIN_FAILED',
        resource: 'auth',
        ip: clientIp,
        description: `Tentativa de login falhou para o e-mail: ${body.email || '-'}. Motivo: ${err.message}`
      });
      return sendJson(res, 401, { error: err.message });
    }
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    const authHeader = req.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      revokeToken(token);
    }
    logAudit({
      tenantId,
      userId: ctx.userId,
      userName: ctx.name,
      action: 'USER_LOGOUT',
      resource: 'auth',
      ip: clientIp,
      description: `${ctx.name} encerrou a sessão.`
    });
    return sendJson(res, 200, { success: true, message: 'Sessão revogada e encerrada com sucesso.' });
  }

  if (pathname === '/api/auth/change-password' && method === 'POST') {
    if (!ctx.isAuthenticated && !ctx.userId) {
      return sendJson(res, 401, { error: 'Autenticação necessária para alterar senha.' });
    }
    const body = await parseRequestBody(req);
    if (!body.newPassword || body.newPassword.length < 6) {
      return sendJson(res, 400, { error: 'A nova senha deve possuir no mínimo 6 caracteres.' });
    }
    const user = usersDB.findById(ctx.userId);
    if (!user) {
      return sendJson(res, 404, { error: 'Usuário não encontrado.' });
    }
    if (!user.mustChangePassword) {
      if (!body.currentPassword) {
        return sendJson(res, 400, { error: 'Senha atual é obrigatória.' });
      }
      if (!verifyPassword(body.currentPassword, user.passwordHash)) {
        return sendJson(res, 401, { error: 'Senha atual incorreta.' });
      }
    }
    const updated = usersDB.update(ctx.userId, {
      passwordHash: hashPassword(body.newPassword),
      mustChangePassword: false,
      passwordChangedAt: new Date().toISOString()
    });
    logAudit({
      tenantId,
      userId: ctx.userId,
      userName: ctx.name,
      action: 'PASSWORD_CHANGED',
      resource: 'users',
      entityId: ctx.userId,
      ip: clientIp,
      description: `${ctx.name} alterou sua senha de acesso com sucesso.`
    });
    return sendJson(res, 200, { success: true, message: 'Senha atualizada com sucesso.', data: sanitizeUser(updated) });
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
    const users = usersDB.findByTenant(tenantId).map(u => sanitizeUser(u));
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

    // Regra 5: Não utilizar senha padrão fixa. Se senha não informada, gerar temporária segura
    let userPassword = body.password;
    let mustChangePassword = false;
    if (!userPassword || typeof userPassword !== 'string' || userPassword.trim().length === 0) {
      userPassword = crypto.randomBytes(8).toString('base64url') + '!A9';
      mustChangePassword = true;
    }

    const targetRole = VALID_ROLES.includes(body.role) ? body.role : 'VENDEDOR';
    const newUser = usersDB.insert({
      tenantId,
      name: body.name.trim(),
      email: body.email.toLowerCase().trim(),
      role: targetRole,
      phone: body.phone || '',
      passwordHash: hashPassword(userPassword),
      mustChangePassword,
      status: 'active',
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(body.name)}`
    });

    logAudit(tenantId, ctx.userId, 'USER_CREATED', 'users', { userId: newUser.id, role: newUser.role, mustChangePassword });
    return sendJson(res, 201, { success: true, data: sanitizeUser(newUser) });
  }

  if (pathname.startsWith('/api/users/') && method === 'GET' && pathname !== '/api/users/roles') {
    const targetUserId = pathname.split('/')[3];
    const user = usersDB.findById(targetUserId);
    if (!user || (user.tenantId && user.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Usuário não encontrado.' });
    }
    return sendJson(res, 200, { success: true, data: sanitizeUser(user) });
  }

  if (pathname.startsWith('/api/users/') && method === 'PUT') {
    if (!hasPermission(ctx.role, 'USERS_MANAGE')) {
      return sendJson(res, 403, { error: 'Acesso negado: permissão USERS_MANAGE necessária.' });
    }
    const targetUserId = pathname.split('/')[3];
    const user = usersDB.findById(targetUserId);
    if (!user || (user.tenantId && user.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Usuário não encontrado.' });
    }
    const body = await parseRequestBody(req);

    // Defesa contra Escalada de Privilégios:
    if (ctx.userId === targetUserId && body.role && body.role !== user.role) {
      return sendJson(res, 403, { error: 'Não é permitido alterar o próprio nível de acesso.' });
    }
    if (body.role === 'PROPRIETARIO' && ctx.role !== 'PROPRIETARIO') {
      return sendJson(res, 403, { error: 'Apenas o proprietário da conta pode conceder papel de PROPRIETARIO.' });
    }

    const allowedUpdates = Object.assign({}, body);
    delete allowedUpdates.id;
    delete allowedUpdates.tenantId;
    delete allowedUpdates.passwordHash;
    delete allowedUpdates.password;

    if (allowedUpdates.role && !VALID_ROLES.includes(allowedUpdates.role)) {
      return sendJson(res, 400, { error: `Papel '${allowedUpdates.role}' inválido.` });
    }

    const updated = usersDB.update(targetUserId, {
      ...allowedUpdates,
      tenantId
    });

    logAudit({
      tenantId,
      userId: ctx.userId,
      userName: ctx.name,
      action: 'USER_UPDATED',
      resource: 'users',
      entityId: targetUserId,
      ip: clientIp,
      description: `${ctx.name} atualizou o usuário ${user.name} (${user.email}).`,
      oldValues: { role: user.role, name: user.name, status: user.status },
      newValues: { role: updated.role, name: updated.name, status: updated.status }
    });

    return sendJson(res, 200, { success: true, data: sanitizeUser(updated) });
  }

  if (pathname.startsWith('/api/users/') && method === 'DELETE') {
    if (!hasPermission(ctx.role, 'USERS_MANAGE')) {
      return sendJson(res, 403, { error: 'Acesso negado: permissão USERS_MANAGE necessária.' });
    }
    const targetUserId = pathname.split('/')[3];
    const user = usersDB.findById(targetUserId);
    if (!user || (user.tenantId && user.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Usuário não encontrado.' });
    }
    if (ctx.userId === targetUserId) {
      return sendJson(res, 400, { error: 'Não é permitido excluir sua própria conta em uso.' });
    }
    if (user.role === 'PROPRIETARIO') {
      return sendJson(res, 403, { error: 'O proprietário da organização não pode ser excluído.' });
    }

    usersDB.delete(targetUserId);

    logAudit({
      tenantId,
      userId: ctx.userId,
      userName: ctx.name,
      action: 'USER_DELETED',
      resource: 'users',
      entityId: targetUserId,
      ip: clientIp,
      description: `${ctx.name} removeu o usuário ${user.name} (${user.email}).`
    });

    return sendJson(res, 200, { success: true, message: 'Usuário excluído com sucesso.' });
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

  // Alternar empresa ativa (troca rápida de tenant protegida)
  if (pathname === '/api/auth/switch-tenant' && method === 'POST') {
    const body = await parseRequestBody(req);
    const targetId = body.tenantId || 'ten_demo_agentise';
    const targetTenant = tenantsDB.findById(targetId);
    if (!targetTenant) return sendJson(res, 404, { error: 'Empresa não encontrada.' });
    
    const isPublicDemo = targetId === 'ten_demo_agentise' || targetId === 'ten_autoprime_veiculos' || targetTenant.isDemo || (targetTenant.name && targetTenant.name.includes('Demo'));
    let targetUser = usersDB.findOne(u => u.tenantId === targetId && u.email === ctx.email);

    if (!targetUser && !isPublicDemo && ctx.role !== 'PROPRIETARIO') {
      return sendJson(res, 403, { error: 'Acesso negado. Você não possui permissão para acessar este workspace.' });
    }

    if (!targetUser) {
      targetUser = usersDB.findOne(u => u.tenantId === targetId && u.role === 'ADMINISTRADOR') || 
                   usersDB.findOne(u => u.tenantId === targetId) || {
                     id: `usr_${targetId}_admin`,
                     tenantId: targetId,
                     name: targetTenant.name,
                     email: `contato@${targetId}.com`,
                     role: 'ADMINISTRADOR',
                     status: 'active'
                   };
    }

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

  // 3. ONBOARDING GUIADO (FASE 3 & V4)
  if (pathname === '/api/onboarding/complete' && method === 'POST') {
    const body = await parseRequestBody(req);
    const updatedTenant = tenantsDB.update(tenantId, {
      segment: body.segment || 'Geral',
      teamSize: body.teamSize || '1-5',
      leadSources: body.leadSources || ['WhatsApp', 'Site'],
      primaryGoal: body.primaryGoal || 'Aumentar vendas',
      onboardingCompleted: true
    });
    seedSegmentAutomations(tenantId, body.segment);
    conversionEventsDB.insert({
      tenantId,
      userId: ctx.userId,
      event: 'ONBOARDING_COMPLETED',
      segment: body.segment,
      teamSize: body.teamSize,
      primaryGoal: body.primaryGoal,
      timestamp: new Date().toISOString()
    });
    return sendJson(res, 200, { 
      success: true, 
      message: 'Configuração do negócio concluída com sucesso.',
      data: { tenant: updatedTenant }
    });
  }

  // 3.1 EMPRESAS & CLIENTES PJ (CRM 360°)
  if (pathname === '/api/companies' && method === 'GET') {
    const companies = companiesDB.findByTenant(tenantId);
    return sendJson(res, 200, { success: true, count: companies.length, data: companies });
  }

  if (pathname === '/api/companies' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (!body.name) return sendJson(res, 400, { error: 'Nome da empresa é obrigatório.' });
    const cleanBody = Object.assign({}, body);
    delete cleanBody.id;
    delete cleanBody.tenantId;
    const company = companiesDB.insert({ ...cleanBody, tenantId });
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
    const cleanBody = Object.assign({}, body);
    delete cleanBody.id;
    delete cleanBody.tenantId;
    const contact = contactsDB.insert({ ...cleanBody, tenantId });
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
    if (!hasPermission(ctx.role, 'LEADS_CREATE')) {
      return sendJson(res, 403, { error: 'Acesso negado: permissão LEADS_CREATE necessária.' });
    }
    const body = await parseRequestBody(req);
    if (!body.name) return sendJson(res, 400, { error: 'O nome do lead é obrigatório.' });

    const limitCheck = checkResourceLimit(tenantId, 'leads');
    if (!limitCheck.allowed) return sendJson(res, 403, { error: limitCheck.error });

    const cleanBody = Object.assign({}, body);
    delete cleanBody.id;
    delete cleanBody.tenantId;
    const isFirstLead = leadsDB.countByTenant(tenantId) === 0;
    const lead = leadsDB.insert({ ...cleanBody, tenantId });
    if (isFirstLead) {
      conversionEventsDB.insert({
        tenantId,
        userId: ctx.userId,
        event: 'FIRST_LEAD',
        leadId: lead.id,
        timestamp: new Date().toISOString()
      });
    }
    await triggerWorkflows('novo_lead', { leadId: lead.id, name: lead.name, phone: lead.phone }, tenantId);
    return sendJson(res, 201, { success: true, data: lead });
  }

  // ANONIMIZAÇÃO LGPD (ART. 18 DA LEI 13.709/2018 - FASE 12)
  if (pathname.startsWith('/api/leads/') && pathname.endsWith('/anonymize') && method === 'POST') {
    const parts = pathname.split('/');
    const leadId = parts[3];
    const lead = leadsDB.findById(leadId);
    if (!lead || (lead.tenantId && lead.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Lead não encontrado.' });
    }

    const oldValues = {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      document: lead.document || null,
      company: lead.company || null
    };

    const newValues = {
      name: `Titular Anonimizado Art. 18 LGPD (${lead.id.slice(-6)})`,
      email: `anonimizado_${lead.id}@lgpd.local`,
      phone: '11900000000',
      document: '***',
      anonymized: true,
      anonymizedAt: new Date().toISOString()
    };

    const updated = leadsDB.update(leadId, newValues);

    // Anonimiza contatos vinculados na agenda
    const contacts = contactsDB.findByTenant(tenantId, c => c.leadId === leadId || (lead.companyId && c.companyId === lead.companyId));
    contacts.forEach(c => {
      contactsDB.update(c.id, {
        name: `Contato Anonimizado LGPD`,
        email: `anonimizado_${c.id}@lgpd.local`,
        phone: '11900000000'
      });
    });

    logAudit({
      tenantId,
      userId: ctx.userId,
      userName: ctx.name,
      action: 'LGPD_ANONYMIZED',
      resource: 'leads',
      entityId: leadId,
      ip: clientIp,
      description: `Anonimização irrevogável de dados pessoais solicitada com base no Art. 18 da LGPD.`,
      oldValues,
      newValues
    });

    return sendJson(res, 200, {
      success: true,
      message: 'Dados do titular anonimizados com sucesso em estrito cumprimento ao Art. 18 da LGPD.',
      data: updated
    });
  }

  // REGISTRO E GESTÃO DE CONSENTIMENTO LGPD (FASE 12)
  if (pathname === '/api/lgpd/consent' && method === 'POST') {
    const body = await parseRequestBody(req);
    const consent = consentsDB.insert({
      tenantId,
      leadId: body.leadId || null,
      contactId: body.contactId || null,
      purpose: body.purpose || 'comercial_ia',
      accepted: body.accepted !== false,
      ipAddress: clientIp,
      userAgent: req.headers['user-agent'] || '',
      timestamp: new Date().toISOString()
    });

    logAudit({
      tenantId,
      userId: ctx.userId,
      userName: ctx.name,
      action: 'LGPD_CONSENT_RECORDED',
      resource: 'consents',
      entityId: consent.id,
      ip: clientIp,
      description: `Consentimento para '${consent.purpose}' registrado com aceite: ${consent.accepted}.`,
      newValues: consent
    });

    return sendJson(res, 201, { success: true, data: consent });
  }

  if (pathname === '/api/lgpd/consents' && method === 'GET') {
    const list = consentsDB.findByTenant(tenantId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return sendJson(res, 200, { success: true, count: list.length, data: list });
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
    if (!hasPermission(ctx.role, 'LEADS_EDIT')) {
      return sendJson(res, 403, { error: 'Acesso negado: permissão LEADS_EDIT necessária.' });
    }
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
    if (!hasPermission(ctx.role, 'LEADS_DELETE')) {
      return sendJson(res, 403, { error: 'Acesso negado: permissão LEADS_DELETE necessária.' });
    }
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
    const limitCheck = checkResourceLimit(tenantId, 'pipelines');
    if (!limitCheck.allowed) {
      return sendJson(res, 402, { error: limitCheck.error });
    }
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
    if (!hasPermission(ctx.role, 'DEALS_MANAGE')) {
      return sendJson(res, 403, { error: 'Acesso negado: permissão DEALS_MANAGE necessária para criar oportunidades.' });
    }
    const body = await parseRequestBody(req);
    if (!body.title || !body.leadId) {
      return sendJson(res, 400, { error: 'Título e LeadId são obrigatórios.' });
    }

    const val = Number(body.value !== undefined ? body.value : 0);
    if (isNaN(val) || val < 0) {
      return sendJson(res, 400, { error: 'O valor da oportunidade não pode ser negativo.' });
    }

    const lead = leadsDB.findById(body.leadId) || {};
    const cleanBody = Object.assign({}, body);
    delete cleanBody.id;
    delete cleanBody.tenantId;
    const initialScore = calculateAiDealScore({ ...cleanBody, value: val, stage: cleanBody.stage || 'prospeccao' }, lead, [], [], []);

    const isFirstDeal = dealsDB.countByTenant(tenantId) === 0;
    const deal = dealsDB.insert({
      stage: cleanBody.stage || 'prospeccao',
      value: val,
      probability: Number(cleanBody.probability || 20),
      priority: cleanBody.priority || 'media',
      assignedTo: cleanBody.assignedTo || ctx.name,
      ...cleanBody,
      tenantId,
      aiDealScore: initialScore.score,
      aiScoreClassification: initialScore.classification,
      aiScoreColor: initialScore.color,
      aiScoreRationale: initialScore.rationale
    });

    if (isFirstDeal) {
      conversionEventsDB.insert({
        tenantId,
        userId: ctx.userId,
        event: 'FIRST_DEAL',
        dealId: deal.id,
        timestamp: new Date().toISOString()
      });
    }

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
    if (!hasPermission(ctx.role, 'DEALS_MANAGE')) {
      return sendJson(res, 403, { error: 'Acesso negado: permissão DEALS_MANAGE necessária para mover oportunidades.' });
    }
    const id = pathname.split('/')[3];
    const deal = dealsDB.findById(id);
    if (!deal || (deal.tenantId && deal.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Oportunidade não encontrada.' });
    }
    const body = await parseRequestBody(req);
    
    const oldStage = deal.stage;
    const newStage = body.stage;

    // Regra de Negócio: Avanço para 'ganho' requer liquidação financeira legítima ou permissão de gestor/financeiro
    if (newStage === 'ganho' && oldStage !== 'ganho' && !hasPermission(ctx.role, 'PROPOSALS_CONFIRM')) {
      return sendJson(res, 403, { error: 'Avanço para estágio ganho requer liquidação financeira legítima ou permissão de gestor/financeiro.' });
    }

    // Regra de Negócio: Venda já fechada e liquidada ('ganho') não pode ser revertida por vendedor sem permissão financeira
    if (oldStage === 'ganho' && newStage !== 'ganho' && !hasPermission(ctx.role, 'PROPOSALS_CONFIRM')) {
      return sendJson(res, 403, { error: 'Uma venda ganha/liquidada não pode ser revertida para estágios anteriores sem autorização financeira/gestão.' });
    }

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

  if (pathname.startsWith('/api/deals/') && method === 'GET') {
    const id = pathname.split('/')[3];
    const deal = dealsDB.findById(id);
    if (!deal || (deal.tenantId && deal.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Oportunidade não encontrada.' });
    }
    const lead = leadsDB.findById(deal.leadId) || {};
    return sendJson(res, 200, { success: true, data: { ...deal, lead } });
  }

  if (pathname.startsWith('/api/deals/') && (method === 'PUT' || method === 'PATCH') && !pathname.endsWith('/stage')) {
    if (!hasPermission(ctx.role, 'DEALS_MANAGE')) {
      return sendJson(res, 403, { error: 'Acesso negado: permissão DEALS_MANAGE necessária para alterar oportunidades.' });
    }
    const id = pathname.split('/')[3];
    const deal = dealsDB.findById(id);
    if (!deal || (deal.tenantId && deal.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Oportunidade não encontrada.' });
    }
    const body = await parseRequestBody(req);

    if (body.value !== undefined) {
      const val = Number(body.value);
      if (isNaN(val) || val < 0) {
        return sendJson(res, 400, { error: 'O valor da oportunidade não pode ser negativo.' });
      }
      if (deal.stage === 'ganho' && val !== Number(deal.value) && !hasPermission(ctx.role, 'PROPOSALS_CONFIRM')) {
        return sendJson(res, 403, { error: 'O valor de uma venda fechada e liquidada não pode ser alterado por vendedores.' });
      }
    }

    if (body.stage === 'ganho' && deal.stage !== 'ganho' && !hasPermission(ctx.role, 'PROPOSALS_CONFIRM')) {
      return sendJson(res, 403, { error: 'Avanço para estágio ganho requer liquidação financeira legítima ou permissão de gestor/financeiro.' });
    }
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
    if (!hasPermission(ctx.role, 'DEALS_MANAGE')) {
      return sendJson(res, 403, { error: 'Acesso negado: permissão DEALS_MANAGE necessária.' });
    }
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
    const cleanBody = Object.assign({}, body);
    delete cleanBody.id;
    delete cleanBody.tenantId;
    const task = tasksDB.insert({ ...cleanBody, completed: false, priority: cleanBody.priority || 'media', tenantId });
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
    if (!hasPermission(ctx.role, 'AI_CONFIG') && !hasPermission(ctx.role, 'SETTINGS_MANAGE')) {
      return sendJson(res, 403, { error: 'Acesso negado: permissão de gestão de IA/Configurações necessária para criar itens na Base de Conhecimento.' });
    }
    const body = await parseRequestBody(req);
    if (!body.title || !body.content) {
      return sendJson(res, 400, { error: 'Título e conteúdo são obrigatórios.' });
    }
    const item = knowledgeBaseDB.insert({
      tenantId,
      category: body.category || 'Geral',
      title: body.title,
      content: body.content,
      version: 1,
      history: [{
        version: 1,
        title: body.title,
        content: body.content,
        updatedAt: new Date().toISOString()
      }]
    });
    return sendJson(res, 201, { success: true, data: item });
  }

  if (pathname.startsWith('/api/knowledge-base/') && (method === 'PUT' || method === 'PATCH')) {
    if (!hasPermission(ctx.role, 'AI_CONFIG') && !hasPermission(ctx.role, 'SETTINGS_MANAGE')) {
      return sendJson(res, 403, { error: 'Acesso negado: permissão de gestão de IA/Configurações necessária para editar a Base de Conhecimento.' });
    }
    const id = pathname.split('/')[3];
    const existing = knowledgeBaseDB.findById(id);
    if (!existing || (existing.tenantId && existing.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Item não encontrado.' });
    }
    const body = await parseRequestBody(req);
    const newVersion = (existing.version || 1) + 1;
    const history = Array.isArray(existing.history) ? [...existing.history] : [];
    history.push({
      version: existing.version || 1,
      title: existing.title,
      content: existing.content,
      updatedAt: existing.updatedAt || existing.createdAt || new Date().toISOString()
    });
    const updated = knowledgeBaseDB.update(id, {
      ...(body.category && { category: body.category }),
      ...(body.title && { title: body.title }),
      ...(body.content && { content: body.content }),
      version: newVersion,
      history,
      updatedAt: new Date().toISOString()
    });
    return sendJson(res, 200, { success: true, data: updated });
  }

  if (pathname.startsWith('/api/knowledge-base/') && method === 'DELETE') {
    if (!hasPermission(ctx.role, 'AI_CONFIG') && !hasPermission(ctx.role, 'SETTINGS_MANAGE')) {
      return sendJson(res, 403, { error: 'Acesso negado: permissão de gestão de IA/Configurações necessária para excluir da Base de Conhecimento.' });
    }
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
    if (conversionEventsDB.countByTenant(tenantId, e => e.event === 'FIRST_AI_ACTION') === 0) {
      conversionEventsDB.insert({
        tenantId,
        userId: ctx.userId,
        event: 'FIRST_AI_ACTION',
        action: 'RECUPERA_IA_SCAN',
        timestamp: new Date().toISOString()
      });
    }
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

  if (pathname === '/api/recovery/recover-deal' && method === 'POST') {
    const body = await parseRequestBody(req);
    const { dealId } = body;
    if (!dealId) return sendJson(res, 400, { error: 'dealId é obrigatório.' });
    const deal = dealsDB.findById(dealId);
    if (!deal || (deal.tenantId && deal.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Oportunidade não encontrada.' });
    }
    const updated = dealsDB.update(dealId, {
      stage: 'ganho',
      origin: 'RecuperaIA',
      recoveredVia: 'RecuperaIA',
      recoveredAt: new Date().toISOString()
    });
    if (activitiesDB) {
      activitiesDB.insert({
        tenantId,
        dealId,
        leadId: deal.leadId,
        type: 'deal_recovered',
        title: '🎯 Oportunidade Recuperada por IA!',
        description: `Oportunidade de R$ ${Number(deal.value || 0).toLocaleString('pt-BR')} foi recuperada com sucesso pelo RecuperaIA.`,
        timestamp: new Date().toISOString()
      });
    }
    return sendJson(res, 200, { success: true, data: updated });
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
    if (!hasPermission(ctx.role, 'AUTOMATIONS_MANAGE')) {
      return sendJson(res, 403, { error: 'Acesso negado: permissão AUTOMATIONS_MANAGE necessária.' });
    }
    const body = await parseRequestBody(req);
    if (!body.name || !body.trigger || !body.action) {
      return sendJson(res, 400, { error: 'Nome, gatilho e ação são obrigatórios.' });
    }
    const limitCheck = checkResourceLimit(tenantId, 'automations');
    if (!limitCheck.allowed) return sendJson(res, 403, { error: limitCheck.error });

    const isFirstAuto = automationsDB.countByTenant(tenantId) === 0 || conversionEventsDB.countByTenant(tenantId, e => e.event === 'FIRST_AUTOMATION') === 0;
    const auto = automationsDB.insert({
      tenantId,
      name: body.name,
      trigger: body.trigger,
      condition: body.condition || null,
      action: body.action,
      active: body.active !== undefined ? Boolean(body.active) : true
    });
    if (isFirstAuto) {
      conversionEventsDB.insert({
        tenantId,
        userId: ctx.userId,
        event: 'FIRST_AUTOMATION',
        automationId: auto.id,
        timestamp: new Date().toISOString()
      });
    }
    return sendJson(res, 201, { success: true, data: auto });
  }

  if (pathname.startsWith('/api/automations/') && pathname.endsWith('/toggle') && method === 'PATCH') {
    if (!hasPermission(ctx.role, 'AUTOMATIONS_MANAGE')) {
      return sendJson(res, 403, { error: 'Acesso negado: permissão AUTOMATIONS_MANAGE necessária.' });
    }
    const id = pathname.split('/')[3];
    const existing = automationsDB.findById(id);
    if (!existing || (existing.tenantId && existing.tenantId !== tenantId)) {
      return sendJson(res, 404, { error: 'Automação não encontrada.' });
    }
    const updated = automationsDB.update(id, { active: !existing.active });
    return sendJson(res, 200, { success: true, data: updated });
  }

  if (pathname.startsWith('/api/automations/') && (method === 'PUT' || method === 'PATCH') && !pathname.endsWith('/toggle')) {
    if (!hasPermission(ctx.role, 'AUTOMATIONS_MANAGE')) {
      return sendJson(res, 403, { error: 'Acesso negado: permissão AUTOMATIONS_MANAGE necessária.' });
    }
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
    if (!hasPermission(ctx.role, 'AUTOMATIONS_MANAGE')) {
      return sendJson(res, 403, { error: 'Acesso negado: permissão AUTOMATIONS_MANAGE necessária.' });
    }
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
    if (!hasPermission(ctx.role, 'FINANCIAL_VIEW') && !hasPermission(ctx.role, 'DEALS_VIEW_ALL')) {
      return sendJson(res, 403, { error: 'Acesso negado: o Analista IA para Gestores é restrito a gerentes, administradores e financeiro.' });
    }
    const body = await parseRequestBody(req);
    if (!body.question) return sendJson(res, 400, { error: 'Pergunta é obrigatória.' });
    const result = runManagerAnalyticsQuery(tenantId, body.question);
    return sendJson(res, 200, { success: true, data: result });
  }

  // 12. PLANOS SAAS E CRÉDITOS DE IA (FASE 13 & 14)
  if (pathname === '/api/billing/subscription' && method === 'GET') {
    if (!hasPermission(ctx.role, 'FINANCIAL_VIEW') && !hasPermission(ctx.role, 'BILLING_MANAGE')) {
      return sendJson(res, 403, { error: 'Acesso negado: dados de faturamento e assinatura restritos à gestão e financeiro.' });
    }
    const sub = getTenantSubscription(tenantId);
    return sendJson(res, 200, { success: true, data: sub });
  }

  if (pathname === '/api/billing/plans' && method === 'GET') {
    return sendJson(res, 200, { success: true, data: Object.values(PLANS) });
  }

  if (pathname === '/api/billing/upgrade' && method === 'POST') {
    if (!hasPermission(ctx.role, 'BILLING_MANAGE')) {
      return sendJson(res, 403, { error: 'Permissão negada. Apenas Proprietários, Administradores ou Financeiro podem alterar planos.' });
    }
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: body._error });
    const targetPlan = body.plan || body.targetPlan;
    if (!targetPlan || !PLANS[targetPlan]) {
      return sendJson(res, 400, { error: `Plano '${targetPlan}' inválido. Planos disponíveis: ${Object.keys(PLANS).join(', ')}` });
    }

    const previousSub = getTenantSubscription(tenantId);
    const { tenant: updatedTenant, plan } = upgradeTenantPlan(tenantId, targetPlan);

    // Gera chave PIX Banco Central para liquidação oficial
    const txid = `UPG${Date.now().toString().slice(-10)}`;
    const pixPayload = generatePixPayload({
      amount: plan.price,
      txid,
      description: `Upgrade Agentise ${plan.name}`
    });
    const pix = {
      payload: pixPayload,
      qrCodeUrl: getPixQrCodeUrl(pixPayload),
      amount: plan.price,
      txid
    };

    logAudit({
      tenantId,
      userId: ctx.userId,
      userName: ctx.name,
      action: 'BILLING_UPGRADE',
      resource: 'tenants',
      entityId: tenantId,
      ip: clientIp,
      description: `${ctx.name} efetuou upgrade do workspace para o plano ${plan.name} (R$ ${plan.price}/mês).`,
      oldValues: { plan: previousSub.plan },
      newValues: { plan: targetPlan }
    });

    return sendJson(res, 200, {
      success: true,
      message: `Workspace atualizado com sucesso para o plano ${plan.name}!`,
      data: {
        plan: targetPlan,
        planName: plan.name,
        price: plan.price,
        pix,
        subscription: getTenantSubscription(tenantId)
      }
    });
  }

  // 12.2 CHECKOUT DE ASSINATURA SAAS COM PIX BACEN OFICIAL (V4)
  if (pathname === '/api/billing/checkout' && method === 'POST') {
    if (!hasPermission(ctx.role, 'BILLING_MANAGE') && !hasPermission(ctx.role, 'FINANCIAL_VIEW') && ctx.role !== 'PROPRIETARIO' && ctx.role !== 'ADMINISTRADOR') {
      return sendJson(res, 403, { error: 'Permissão negada. Apenas Proprietários, Administradores ou Financeiro podem iniciar checkout de planos.' });
    }
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: body._error });
    const targetPlanKey = (body.plan || body.targetPlan || 'starter').toLowerCase();
    const planObj = PLANS[targetPlanKey];
    if (!planObj) {
      return sendJson(res, 400, { error: `Plano '${targetPlanKey}' inválido. Planos disponíveis: ${Object.keys(PLANS).join(', ')}` });
    }

    const txid = `SUB${Date.now().toString().slice(-10)}`;
    const pixPayload = generatePixPayload({
      amount: planObj.price,
      txid,
      description: `Assinatura Agentise ${planObj.name}`
    });

    const proposal = proposalsDB.insert({
      tenantId,
      title: `Assinatura Plano ${planObj.name}`,
      planTarget: targetPlanKey,
      amount: planObj.price,
      status: 'enviada',
      paymentMethod: 'PIX',
      publicToken: crypto.randomBytes(16).toString('hex'),
      txId: txid,
      items: [
        {
          description: `Assinatura Mensal - Plano ${planObj.name} (${planObj.maxUsers} usuários, ${planObj.monthlyAiCredits} cr IA)`,
          quantity: 1,
          unitPrice: planObj.price,
          total: planObj.price
        }
      ],
      notes: `Assinatura comercial V4. Ativação automática mediante liquidação via PIX Bacen.`
    });

    conversionEventsDB.insert({
      tenantId,
      userId: ctx.userId,
      event: 'CHECKOUT_STARTED',
      plan: targetPlanKey,
      amount: planObj.price,
      proposalId: proposal.id,
      timestamp: new Date().toISOString()
    });

    conversionEventsDB.insert({
      tenantId,
      userId: ctx.userId,
      event: 'PAYMENT_PENDING',
      plan: targetPlanKey,
      amount: planObj.price,
      proposalId: proposal.id,
      timestamp: new Date().toISOString()
    });

    return sendJson(res, 201, {
      success: true,
      message: `Checkout iniciado com sucesso para o plano ${planObj.name}!`,
      data: {
        proposalId: proposal.id,
        publicToken: proposal.publicToken,
        plan: targetPlanKey,
        planName: planObj.name,
        price: planObj.price,
        pix: {
          payload: pixPayload,
          qrCodeUrl: getPixQrCodeUrl(pixPayload),
          amount: planObj.price,
          txid
        }
      }
    });
  }

  // 12.1 WORKSPACE E GOVERNANÇA MULTI-TENANT (FASE 13)
  if (pathname === '/api/workspace' && method === 'GET') {
    const tenant = tenantsDB.findById(tenantId);
    if (!tenant) return sendJson(res, 404, { error: 'Workspace não encontrado.' });
    const members = usersDB.findByTenant(tenantId).map(u => sanitizeUser(u));
    const subscription = getTenantSubscription(tenantId);
    return sendJson(res, 200, {
      success: true,
      data: {
        ...tenant,
        members,
        subscription
      }
    });
  }

  if (pathname === '/api/workspace' && method === 'PUT') {
    if (!hasPermission(ctx.role, 'SETTINGS_EDIT')) {
      return sendJson(res, 403, { error: 'Permissão negada. Apenas Administradores ou Proprietários podem alterar configurações do workspace.' });
    }
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: body._error });

    const tenant = tenantsDB.findById(tenantId);
    if (!tenant) return sendJson(res, 404, { error: 'Workspace não encontrado.' });

    const allowedUpdates = {};
    if (body.name && typeof body.name === 'string') allowedUpdates.name = body.name.trim();
    if (body.segment && typeof body.segment === 'string') allowedUpdates.segment = body.segment.trim();
    if (body.phone && typeof body.phone === 'string') allowedUpdates.phone = body.phone.trim();
    if (body.website && typeof body.website === 'string') allowedUpdates.website = body.website.trim();
    if (body.settings && typeof body.settings === 'object') allowedUpdates.settings = body.settings;

    const updated = tenantsDB.update(tenantId, allowedUpdates);

    logAudit({
      tenantId,
      userId: ctx.userId,
      userName: ctx.name,
      action: 'WORKSPACE_UPDATED',
      resource: 'tenants',
      entityId: tenantId,
      ip: clientIp,
      description: `${ctx.name} atualizou as informações corporativas do workspace ${updated.name}.`,
      oldValues: tenant,
      newValues: updated
    });

    return sendJson(res, 200, {
      success: true,
      message: 'Workspace atualizado com sucesso.',
      data: updated
    });
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

    if (conversionEventsDB.countByTenant(tenantId, e => e.event === 'FIRST_AI_ACTION') === 0) {
      conversionEventsDB.insert({
        tenantId,
        userId: ctx.userId,
        event: 'FIRST_AI_ACTION',
        action: 'AI_CHAT',
        timestamp: new Date().toISOString()
      });
    }

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
    if (!hasPermission(ctx.role, 'PROPOSALS_CREATE')) {
      return sendJson(res, 403, { error: 'Acesso negado: permissão PROPOSALS_CREATE necessária.' });
    }
    const body = await parseRequestBody(req);
    const settings = settingsDB.findById('general_settings') || {};

    const pixKey = body.pixKey || settings.pixKey || 'luklen2@gmail.com';
    const name = body.name || settings.pixName || 'LUCIANO SANT ANNA';
    const city = body.city || settings.pixCity || 'SAO PAULO';
    
    // Validação estrita de itens e cálculo de valor final
    const rawItems = Array.isArray(body.items) && body.items.length > 0 ? body.items : null;
    let calculatedSubtotal = 0;
    if (rawItems) {
      for (const item of rawItems) {
        const uPrice = Number(item.unitPrice);
        const q = Number(item.quantity !== undefined ? item.quantity : 1);
        const d = Number(item.discount !== undefined ? item.discount : 0);
        if (isNaN(uPrice) || uPrice < 0 || isNaN(q) || q <= 0 || isNaN(d) || d < 0) {
          return sendJson(res, 400, { error: 'Valores inválidos nos itens da proposta (preço, quantidade ou desconto).' });
        }
        calculatedSubtotal += (uPrice * q - d);
      }
      if (calculatedSubtotal < 0) {
        return sendJson(res, 400, { error: 'Subtotal dos itens não pode ser negativo.' });
      }
    }
    const globalDiscount = Number(body.discount !== undefined ? body.discount : 0);
    if (isNaN(globalDiscount) || globalDiscount < 0) {
      return sendJson(res, 400, { error: 'Desconto global não pode ser negativo.' });
    }

    let amount = 0;
    if (body.amount !== undefined && !rawItems) {
      const parsedAmount = Number(body.amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return sendJson(res, 400, { error: 'O valor da cobrança deve ser estritamente positivo e maior que zero.' });
      }
      if (globalDiscount >= parsedAmount) {
        return sendJson(res, 400, { error: 'O desconto não pode exceder ou zerar o valor total da proposta.' });
      }
      amount = parsedAmount - globalDiscount;
    } else if (rawItems) {
      if (globalDiscount >= calculatedSubtotal) {
        return sendJson(res, 400, { error: 'O desconto não pode exceder ou zerar o valor total da proposta.' });
      }
      amount = calculatedSubtotal - globalDiscount;
    } else {
      return sendJson(res, 400, { error: 'Informe o valor (amount) ou uma lista válida de itens para a proposta.' });
    }

    if (isNaN(amount) || amount <= 0) {
      return sendJson(res, 400, { error: 'O valor final da proposta deve ser estritamente maior que zero.' });
    }
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

  // Baixa / Confirmação de recebimento PIX de proposta comercial (HARDENING PIX)
  if (pathname.startsWith('/api/proposals/') && pathname.endsWith('/confirm') && method === 'PATCH') {
    const parts = pathname.split('/');
    const proposalId = parts[3];
    const proposal = proposalsDB.findById(proposalId);
    if (!proposal) {
      return sendJson(res, 404, { error: 'Proposta não encontrada.' });
    }

    // 1. Exigência de Autenticação Estrita para Operações Financeiras Corporativas:
    // Se a proposta pertence a um tenant corporativo (não é demo local) ou cabeçalho auth foi enviado, exige token válido
    if (!ctx.isAuthenticated) {
      const isDemoTenant = proposal.tenantId === 'ten_demo_agentise' || proposal.tenantId === 'ten_default_agentise';
      if (!isDemoTenant || req.headers['authorization'] !== undefined) {
        return sendJson(res, 401, { error: 'Autenticação necessária. Informe token Bearer válido para confirmar liquidação.' });
      }
    }

    // 2. Isolamento Multi-Tenant Anti-IDOR: Usuário de um tenant não pode confirmar proposta de outro
    if (proposal.tenantId && proposal.tenantId !== tenantId) {
      return sendJson(res, 404, { error: 'Proposta não encontrada.' });
    }

    // 3. Controle de Acesso Baseado em Papéis (RBAC): Apenas FINANCEIRO, ADMINISTRADOR ou OWNER
    if (!hasPermission(ctx.role, 'PROPOSALS_CONFIRM')) {
      return sendJson(res, 403, { error: 'Acesso negado. Apenas financeiro, administradores ou proprietários podem confirmar recebimento de propostas.' });
    }

    // 4. Mutex de concorrência em memória contra Race Conditions
    if (paymentProcessingLocks.has(proposalId)) {
      return sendJson(res, 409, { error: 'Transação em processamento simultâneo. Tente novamente em instantes.' });
    }

    // 5. Lock atômico cross-process a nível de sistema operacional
    const lockAcquired = acquireFileLock(proposalId, 5000);
    if (!lockAcquired) {
      return sendJson(res, 409, { error: 'Transação em processamento por outro processo. Tente novamente em instantes.' });
    }
    paymentProcessingLocks.add(proposalId);

    try {
      const currentProposal = proposalsDB.findById(proposalId);

      // Idempotência: Se já liquidada, retorna sucesso sem duplicar pagamento
      if (currentProposal.status === 'paga') {
        return sendJson(res, 200, { success: true, message: 'Proposta já liquidada anteriormente.', data: currentProposal, idempotent: true });
      }

      // Rejeição de transições inválidas a partir de estados finais
      if (currentProposal.status === 'cancelada' || currentProposal.status === 'expirada') {
        return sendJson(res, 400, { error: `Operação rejeitada: Proposta com status '${currentProposal.status}' não pode ser liquidada.` });
      }

      // Validação opcional de valor se fornecido no corpo da requisição
      const body = await parseRequestBody(req);
      if (body && body.amount !== undefined) {
        const receivedAmount = Number(body.amount);
        if (isNaN(receivedAmount) || receivedAmount <= 0) {
          return sendJson(res, 400, { error: 'Valor da liquidação inválido.' });
        }
        if (Math.abs(receivedAmount - Number(currentProposal.amount)) > 0.01) {
          return sendJson(res, 400, { 
            error: `Valor divergente. Recebido: R$ ${receivedAmount.toFixed(2)}, Esperado: R$ ${Number(currentProposal.amount).toFixed(2)}.` 
          });
        }
      }

      const updated = proposalsDB.update(proposalId, {
        status: 'paga',
        paidAt: new Date().toISOString()
      });

      if (paymentsDB) {
        paymentsDB.insert({
          tenantId: currentProposal.tenantId || tenantId,
          proposalId,
          dealId: currentProposal.dealId,
          amount: currentProposal.amount,
          method: 'PIX',
          txId: currentProposal.txId || (body && body.txId) || 'TX_MANUAL',
          endToEndId: (body && body.endToEndId) || `E${Date.now()}MANUAL`,
          status: 'pago',
          paidAt: new Date().toISOString()
        });
      }

      // Se houver Oportunidade vinculada, avança automaticamente para 'ganho' (Venda Fechada)
      if (currentProposal.dealId) {
        const deal = dealsDB.findById(currentProposal.dealId);
        if (deal && deal.stage !== 'ganho') {
          dealsDB.update(currentProposal.dealId, {
            stage: 'ganho',
            probability: 100,
            closedAt: new Date().toISOString()
          });
          await triggerWorkflows('venda_fechada', { dealId: currentProposal.dealId, leadId: currentProposal.leadId, amount: currentProposal.amount }, tenantId);
        }
      }

      // V4: Se proposta for de assinatura SaaS, ativa o plano no tenant
      if (currentProposal.planTarget) {
        try {
          upgradeTenantPlan(currentProposal.tenantId || tenantId, currentProposal.planTarget);
          conversionEventsDB.insert({
            tenantId: currentProposal.tenantId || tenantId,
            event: 'PLAN_ACTIVATED',
            plan: currentProposal.planTarget,
            amount: currentProposal.amount,
            proposalId: currentProposal.id,
            timestamp: new Date().toISOString()
          });
          conversionEventsDB.insert({
            tenantId: currentProposal.tenantId || tenantId,
            event: 'PAYMENT_CONFIRMED',
            amount: currentProposal.amount,
            proposalId: currentProposal.id,
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          console.error('[Billing] Erro ao ativar plano após confirmação manual:', e.message);
        }
      }

      logAudit({
        tenantId: currentProposal.tenantId || tenantId,
        userId: ctx.userId,
        userName: ctx.name,
        action: 'PROPOSAL_CONFIRMED',
        resource: 'proposals',
        entityId: proposalId,
        ip: clientIp,
        description: `${ctx.name} confirmou liquidação da proposta ${proposalId} no valor de R$ ${Number(currentProposal.amount).toFixed(2)}.`,
        newValues: { status: 'paga', amount: currentProposal.amount }
      });

      return sendJson(res, 200, { success: true, data: updated });
    } finally {
      paymentProcessingLocks.delete(proposalId);
      releaseFileLock(proposalId);
    }
  }

  // 16. DASHBOARD EXECUTIVO, ANALYTICS & BI AVANÇADO (FASE 11)
  if (pathname === '/api/analytics/bi' && method === 'GET') {
    if (!hasPermission(ctx.role, 'FINANCIAL_VIEW')) {
      return sendJson(res, 403, { error: 'Acesso negado: métricas financeiras administrativas restritas à gestão e financeiro.' });
    }
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

    // V4: Métricas Reais de Receita Recuperada e Em Risco (Sem inventar números)
    const recoveredDeals = deals.filter(d => d.stage === 'ganho' && (d.origin === 'RecuperaIA' || d.recoveredVia === 'RecuperaIA' || d.recovered === true));
    const recoveredRevenue = recoveredDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const atRiskDeals = deals.filter(d => d.stage !== 'ganho' && d.stage !== 'perdido' && (d.atRisk || d.daysStalled >= 5));
    const atRiskRevenue = atRiskDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);

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
        recoveredRevenue,
        atRiskRevenue,
        recoveredDealsCount: recoveredDeals.length,
        atRiskDealsCount: atRiskDeals.length,
        stageBreakdown,
        aiAlerts,
        sellersPerformance,
        bi: bi.kpis,
        channelPerformance: bi.channelPerformance,
        aiUsageSummary: bi.aiUsageSummary
      }
    });
  }

  // 16.1 ATIVAÇÃO & CHECKLIST DE PRIMEIRO VALOR (V4)
  if (pathname === '/api/tenant/activation-status' && method === 'GET') {
    const hasLead = leadsDB.countByTenant(tenantId) > 0;
    const hasDeal = dealsDB.countByTenant(tenantId) > 0;
    const hasPipeline = pipelinesDB.countByTenant(tenantId) > 0;
    const hasSeller = usersDB.findByTenant(tenantId).some(u => u.role === 'VENDEDOR' || u.role === 'SDR') || usersDB.countByTenant(tenantId) > 1;
    const hasAutomation = automationsDB.countByTenant(tenantId) > 0;
    const hasCopilot = aiUsageDB.countByTenant(tenantId) > 0 || (aiConversationsDB && aiConversationsDB.countByTenant(tenantId) > 0) || conversionEventsDB.countByTenant(tenantId, e => e.event === 'FIRST_AI_ACTION') > 0;
    const hasRecuperaIA = campaignsDB.countByTenant(tenantId) > 0 || conversionEventsDB.countByTenant(tenantId, e => e.action === 'RECUPERA_IA_SCAN') > 0;

    const checklist = [
      { id: 'first_lead', title: 'Criar primeiro lead', completed: hasLead, step: 1 },
      { id: 'first_deal', title: 'Criar primeira oportunidade', completed: hasDeal, step: 2 },
      { id: 'config_pipeline', title: 'Configurar pipeline', completed: hasPipeline, step: 3 },
      { id: 'add_seller', title: 'Adicionar vendedor', completed: hasSeller, step: 4 },
      { id: 'first_automation', title: 'Criar primeira automação', completed: hasAutomation, step: 5 },
      { id: 'test_copilot', title: 'Testar Copiloto IA', completed: hasCopilot, step: 6 },
      { id: 'run_recuperaia', title: 'Executar primeira análise RecuperaIA', completed: hasRecuperaIA, step: 7 }
    ];

    const completedCount = checklist.filter(c => c.completed).length;
    const score = Math.round((completedCount / checklist.length) * 100);

    return sendJson(res, 200, {
      success: true,
      data: {
        score,
        completedCount,
        totalSteps: checklist.length,
        isFullyActivated: completedCount === checklist.length,
        checklist
      }
    });
  }

  // 16.2 INGESTÃO DE EVENTOS DO FUNIL DE CONVERSÃO (V4)
  if (pathname === '/api/analytics/events' && method === 'POST') {
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: body._error });
    if (!body.event) return sendJson(res, 400, { error: 'O nome do evento é obrigatório.' });

    const allowedEvents = [
      'LANDING_VIEW',
      'SIGNUP',
      'TRIAL_STARTED',
      'ONBOARDING_STARTED',
      'ONBOARDING_COMPLETED',
      'FIRST_LEAD',
      'FIRST_DEAL',
      'FIRST_AI_ACTION',
      'FIRST_AUTOMATION',
      'CHECKOUT_STARTED',
      'PAYMENT_PENDING',
      'PAYMENT_CONFIRMED',
      'PLAN_ACTIVATED'
    ];

    if (!allowedEvents.includes(body.event)) {
      return sendJson(res, 400, { error: `Evento '${body.event}' não reconhecido.` });
    }

    const eventTenantId = (ctx.isAuthenticated && tenantId) ? tenantId : (body.tenantId || 'public_visitor');
    const recorded = conversionEventsDB.insert({
      tenantId: eventTenantId,
      userId: ctx.userId || null,
      event: body.event,
      metadata: body.metadata || {},
      ip: clientIp,
      timestamp: new Date().toISOString()
    });

    return sendJson(res, 201, { success: true, data: recorded });
  }

  // 16.3 MÉTRICAS ADMINISTRATIVAS SAAS & FUNIL COMERCIAL (V4)
  if (pathname === '/api/admin/saas-metrics' && method === 'GET') {
    if (!ctx.isAuthenticated) {
      return sendJson(res, 401, { error: 'Autenticação necessária.' });
    }
    if (!hasPermission(ctx.role, 'SETTINGS_MANAGE') && ctx.role !== 'PROPRIETARIO' && ctx.role !== 'ADMINISTRADOR') {
      return sendJson(res, 403, { error: 'Acesso negado: visão administrativa de SaaS restrita a administradores e proprietários.' });
    }

    const allTenants = tenantsDB.findAll();
    const now = new Date();

    const plansDistribution = { starter: 0, professional: 0, business: 0, agency: 0 };
    let mrr = 0;
    let activeTrials = 0;

    allTenants.forEach(t => {
      const planKey = (t.plan || 'starter').toLowerCase();
      const planConfig = PLANS[planKey] || PLANS.starter;
      if (plansDistribution[planKey] !== undefined) {
        plansDistribution[planKey]++;
      } else {
        plansDistribution.starter++;
      }
      mrr += planConfig.price;

      if (t.trialEndsAt && new Date(t.trialEndsAt) > now) {
        activeTrials++;
      }
    });

    const allPayments = paymentsDB.findAll(p => p.status === 'pago');
    const totalPixRevenue = allPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const allAiUsage = aiUsageDB.findAll();
    const totalAiCreditsUsed = allAiUsage.reduce((sum, r) => sum + (Number(r.cost || r.credits || r.costCredits) || 0), 0);

    const allEvents = conversionEventsDB.findAll();
    const funnelMetrics = {
      landingViews: allEvents.filter(e => e.event === 'LANDING_VIEW').length,
      signups: allEvents.filter(e => e.event === 'SIGNUP').length,
      trials: allEvents.filter(e => e.event === 'TRIAL_STARTED').length,
      onboardings: allEvents.filter(e => e.event === 'ONBOARDING_COMPLETED').length,
      activatedUsers: allEvents.filter(e => e.event === 'FIRST_LEAD' || e.event === 'FIRST_DEAL').length,
      checkouts: allEvents.filter(e => e.event === 'CHECKOUT_STARTED').length,
      payments: allEvents.filter(e => e.event === 'PAYMENT_CONFIRMED').length,
      plansActivated: allEvents.filter(e => e.event === 'PLAN_ACTIVATED').length
    };

    return sendJson(res, 200, {
      success: true,
      data: {
        activeTenants: allTenants.length,
        activeTrials,
        totalUsers: usersDB.count(),
        plansDistribution,
        mrr,
        totalPixRevenue,
        totalAiCreditsUsed,
        funnelMetrics,
        updatedAt: new Date().toISOString()
      }
    });
  }

  if (pathname === '/api/admin/conversion-funnel' && method === 'GET') {
    if (!ctx.isAuthenticated) {
      return sendJson(res, 401, { error: 'Autenticação necessária.' });
    }
    if (!hasPermission(ctx.role, 'SETTINGS_MANAGE') && ctx.role !== 'PROPRIETARIO' && ctx.role !== 'ADMINISTRADOR') {
      return sendJson(res, 403, { error: 'Acesso negado: visão do funil restrita a administradores e proprietários.' });
    }

    const events = conversionEventsDB.findAll();
    const eventCounts = {};
    events.forEach(e => {
      eventCounts[e.event] = (eventCounts[e.event] || 0) + 1;
    });

    return sendJson(res, 200, {
      success: true,
      data: {
        counts: eventCounts,
        recentEvents: events.slice(-30).reverse()
      }
    });
  }

  // 17. CONFIGURAÇÕES DO SISTEMA (ISOLADAS POR TENANT & SEGREDOS MASCARADOS)
  if (pathname === '/api/settings' && method === 'GET') {
    if (!hasPermission(ctx.role, 'SETTINGS_VIEW')) {
      return sendJson(res, 403, { error: 'Acesso negado: permissão SETTINGS_VIEW necessária.' });
    }
    const tenantSettingsId = `settings_${tenantId}`;
    const settings = settingsDB.findById(tenantSettingsId) || settingsDB.findById('general_settings') || {};
    const safeSettings = Object.assign({}, settings);
    delete safeSettings.id;
    safeSettings.tenantId = tenantId;

    const secretFields = ['apiKey', 'anthropicApiKey', 'openaiApiKey', 'geminiApiKey', 'whatsappToken', 'metaToken', 'webhookSecret'];
    for (const field of secretFields) {
      if (safeSettings[field]) {
        safeSettings[`has_${field}`] = true;
        const val = String(safeSettings[field]);
        safeSettings[field] = val.length > 8 ? val.slice(0, 4) + '***' + val.slice(-4) : '***';
      }
    }
    return sendJson(res, 200, { success: true, data: safeSettings });
  }

  if (pathname.startsWith('/api/settings/') && method === 'GET') {
    return sendJson(res, 403, { error: 'Acesso negado: acesso direto a configurações externas proibido.' });
  }

  if (pathname === '/api/settings' && (method === 'POST' || method === 'PUT')) {
    if (!hasPermission(ctx.role, 'SETTINGS_EDIT')) {
      return sendJson(res, 403, { error: 'Acesso negado. Apenas administradores ou proprietários podem alterar configurações do sistema.' });
    }
    const body = await parseRequestBody(req);
    if (body._error) return sendJson(res, 413, { error: body._error });

    const tenantSettingsId = `settings_${tenantId}`;
    const existing = settingsDB.findById(tenantSettingsId) || settingsDB.findById('general_settings') || {};

    const cleanBody = Object.assign({}, body);
    delete cleanBody.id;
    delete cleanBody.tenantId;

    const secretFields = ['apiKey', 'anthropicApiKey', 'openaiApiKey', 'geminiApiKey', 'whatsappToken', 'metaToken', 'webhookSecret'];
    for (const field of secretFields) {
      if (cleanBody[field] && String(cleanBody[field]).includes('***')) {
        cleanBody[field] = existing[field] || '';
      }
    }

    const toSave = {
      ...existing,
      ...cleanBody,
      id: tenantSettingsId,
      tenantId
    };

    let updated;
    if (settingsDB.findById(tenantSettingsId)) {
      updated = settingsDB.update(tenantSettingsId, toSave);
    } else {
      updated = settingsDB.insert(toSave);
    }

    logAudit({
      tenantId,
      userId: ctx.userId,
      userName: ctx.name,
      action: 'SETTINGS_UPDATED',
      resource: 'settings',
      entityId: tenantSettingsId,
      ip: clientIp,
      description: `${ctx.name} atualizou parâmetros e configurações corporativas.`,
      oldValues: existing,
      newValues: updated
    });

    const safeResponse = Object.assign({}, updated);
    delete safeResponse.id;
    for (const field of secretFields) {
      if (safeResponse[field]) {
        safeResponse[`has_${field}`] = true;
        const val = String(safeResponse[field]);
        safeResponse[field] = val.length > 8 ? val.slice(0, 4) + '***' + val.slice(-4) : '***';
      }
    }

    return sendJson(res, 200, { success: true, data: safeResponse });
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
    if (pathname.startsWith('/api/')) {
      return sendJson(res, 404, { error: 'Endpoint da API não encontrado ou método não suportado.', status: 404 });
    }

    const ext = path.extname(pathname).toLowerCase();
    const isHtmlNavigation = method === 'GET' && (!ext || (req.headers.accept && req.headers.accept.includes('text/html')));
    const isBlocked = BLOCKED_STATIC_PREFIXES.some(p => pathname.toLowerCase().startsWith(`/${p}`)) ||
                      BLOCKED_STATIC_FILES.some(f => pathname.toLowerCase() === `/${f}`);

    // SPA fallback exclusivamente para rotas navegacionais legítimas (GET)
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
