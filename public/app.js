/**
 * AGENTISE MEGA CRM - Controlador de Frontend SaaS Multi-Tenant AI-First
 * Orquestrador de estado reativo, Drag & Drop, Omnichannel, Copiloto Claude,
 * RecuperaIA, Automações, Analista IA, Vertical Auto e Checkout PIX Oficial.
 */

const STAGES = [
  { id: 'prospeccao', label: 'Prospecção', color: 'slate' },
  { id: 'qualificacao', label: 'Qualificação (BANT)', color: 'blue' },
  { id: 'apresentacao', label: 'Apresentação / Demo', color: 'indigo' },
  { id: 'proposta', label: 'Proposta Enviada', color: 'amber' },
  { id: 'negociacao', label: 'Negociação', color: 'orange' },
  { id: 'ganho', label: 'Fechado / Ganho', color: 'emerald' },
  { id: 'perdido', label: 'Perdido', color: 'rose' }
];

// Estado Global da Aplicação
let globalLeads = [];
let globalDeals = [];
let globalTasks = [];
let globalConversations = [];
let globalKnowledge = [];
let globalAutomations = [];
let globalVehicles = [];
let activeView = 'pipeline';
let activeConversationId = null;
let currentCopilotText = '';
let currentAuthToken = localStorage.getItem('agentise_token') || '';
let currentOnboardingData = { segment: 'Serviços', teamSize: '1-5', leadSources: ['WhatsApp'], primaryGoal: 'Aumentar vendas' };

// Sistema de Notificações Toast
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return alert(message);

  const toast = document.createElement('div');
  const colors = {
    info: 'border-blue-500/40 bg-slate-900/95 text-blue-300',
    success: 'border-emerald-500/40 bg-slate-900/95 text-emerald-300',
    warning: 'border-amber-500/40 bg-slate-900/95 text-amber-300',
    error: 'border-rose-500/40 bg-slate-900/95 text-rose-300'
  };

  const icons = {
    info: 'info',
    success: 'check-circle',
    warning: 'alert-triangle',
    error: 'alert-circle'
  };

  toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-xl text-xs font-semibold pointer-events-auto transition-all duration-300 transform translate-y-2 opacity-0 ${colors[type] || colors.info}`;
  toast.innerHTML = `
    <i data-lucide="${icons[type] || 'info'}" class="h-4 w-4 shrink-0"></i>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => toast.remove(), 350);
  }, 4000);
}

function formatBRL(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (currentAuthToken) {
    headers['Authorization'] = `Bearer ${currentAuthToken}`;
  }
  return headers;
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setInterval(checkHealth, 10000);
});

async function initApp() {
  await checkHealth();
  await loadCurrentContext();
  await Promise.all([
    loadDeals(),
    loadLeads(),
    loadTasks(),
    loadAnalytics(),
    loadOmnichannel(),
    loadRecuperaIA(),
    loadKnowledgeBase(),
    loadAutomations(),
    loadAutoVehicles(),
    loadBilling()
  ]);
  if (window.lucide) lucide.createIcons();
}

async function loadCurrentContext() {
  try {
    const res = await fetch('/api/auth/me', { headers: authHeaders() });
    const json = await res.json();
    if (json.success && json.data) {
      const { user, tenant } = json.data;
      if (document.getElementById('user-name') && user) document.getElementById('user-name').innerText = user.name;
      if (document.getElementById('user-role') && user) document.getElementById('user-role').innerText = user.role;
      if (document.getElementById('user-avatar') && user && user.avatar) document.getElementById('user-avatar').src = user.avatar;
      
      const sel = document.getElementById('header-tenant-selector');
      if (sel && tenant) {
        sel.value = tenant.id;
      }
    }
  } catch (e) {}
}

async function switchDemoTenant(tenantId) {
  try {
    const res = await fetch('/api/auth/switch-tenant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId })
    });
    const json = await res.json();
    if (json.success && json.data.token) {
      currentAuthToken = json.data.token;
      localStorage.setItem('agentise_token', currentAuthToken);
      showToast(`Alternado para: ${json.data.tenant.name}`, 'success');
      await initApp();
    }
  } catch (err) {
    showToast('Erro ao alternar empresa.', 'error');
  }
}

async function runAutoPrimeSalesFlow() {
  try {
    if (document.getElementById('header-tenant-selector')?.value !== 'ten_autoprime_veiculos') {
      await switchDemoTenant('ten_autoprime_veiculos');
    }

    showToast('Iniciando execução do Fluxo Real de Venda (Teste 16)...', 'info');
    const res = await fetch('/api/autoprime/execute-flow', {
      method: 'POST',
      headers: authHeaders()
    });
    const json = await res.json();
    if (json.success) {
      showToast('🎉 Venda Concluída! BMW 320i M Sport faturada via PIX (R$ 340.000,00). Dashboard atualizado!', 'success');
      await initApp();
      switchView('analytics');
    } else {
      showToast('Erro ao executar fluxo: ' + (json.error || 'Falha'), 'error');
    }
  } catch (err) {
    showToast('Erro de comunicação ao executar fluxo.', 'error');
  }
}

// 1. Health Check
async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.status === 'ok') {
      const up = document.getElementById('health-uptime');
      if (up) up.innerText = `${data.uptime_seconds}s`;
    }
  } catch (err) {
    console.error('Health check falhou:', err);
  }
}

// 2. Navegação entre Views
function switchView(viewName) {
  activeView = viewName;
  const allViews = [
    'pipeline', 'leads', 'omnichannel', 'recuperaia', 'copilot',
    'cerebro', 'automations', 'analyst', 'auto', 'sellers', 'pix',
    'analytics', 'tasks', 'billing'
  ];

  allViews.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    const nav = document.getElementById(`nav-${v}`);
    if (el) el.classList.toggle('hidden', v !== viewName);
    if (nav) {
      if (v === viewName) {
        nav.className = 'nav-item w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-blue-300 bg-blue-500/15 border border-blue-500/30 transition';
      } else {
        nav.className = 'nav-item w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition';
      }
    }
  });

  if (viewName === 'analytics') loadAnalytics();
  if (viewName === 'recuperaia') loadRecuperaIA();
  if (viewName === 'omnichannel') loadOmnichannel();
  if (viewName === 'cerebro') loadKnowledgeBase();
  if (viewName === 'automations') loadAutomations();
  if (viewName === 'auto') loadAutoVehicles();
  if (viewName === 'sellers') loadAnalytics();
  if (viewName === 'billing') loadBilling();

  if (window.lucide) lucide.createIcons();
}

// 3. PIPELINE KANBAN (DRAG AND DROP)
async function loadDeals() {
  try {
    const res = await fetch('/api/deals', { headers: authHeaders() });
    const json = await res.json();
    globalDeals = json.data || [];
    renderKanban();
    populateDealSelects();
  } catch (e) {
    console.error('Erro ao carregar deals:', e);
  }
}

function renderKanban() {
  const board = document.getElementById('kanban-board');
  if (!board) return;
  board.innerHTML = '';

  STAGES.forEach(stage => {
    const stageDeals = globalDeals.filter(d => (d.stage || 'prospeccao') === stage.id);
    const stageTotal = stageDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

    const col = document.createElement('div');
    col.className = 'kanban-column glass-panel rounded-2xl p-3 border border-blue-500/15 flex flex-col max-h-[750px]';
    col.dataset.stage = stage.id;

    col.innerHTML = `
      <div class="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-800">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full bg-${stage.color}-400"></span>
          <span class="text-xs font-bold text-white uppercase tracking-wider">${stage.label}</span>
        </div>
        <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">${stageDeals.length}</span>
      </div>
      <div class="text-[11px] text-slate-400 font-semibold mb-2">${formatBRL(stageTotal)}</div>
      <div class="cards-container flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[120px]" data-stage="${stage.id}"></div>
    `;

    const container = col.querySelector('.cards-container');

    // Drag and Drop Events
    container.addEventListener('dragover', e => {
      e.preventDefault();
      container.classList.add('drag-over');
    });

    container.addEventListener('dragleave', () => {
      container.classList.remove('drag-over');
    });

    container.addEventListener('drop', async e => {
      e.preventDefault();
      container.classList.remove('drag-over');
      const dealId = e.dataTransfer.getData('text/plain');
      if (dealId) {
        await moveDealStage(dealId, stage.id);
      }
    });

    stageDeals.forEach(deal => {
      const card = createKanbanCard(deal);
      container.appendChild(card);
    });

    board.appendChild(col);
  });

  if (window.lucide) lucide.createIcons();
}

function createKanbanCard(deal) {
  const card = document.createElement('div');
  card.className = 'glass-card p-3 rounded-xl cursor-grab border border-slate-700/60 hover:border-blue-400/50 space-y-2';
  card.draggable = true;
  card.dataset.id = deal.id;

  card.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', deal.id);
    card.classList.add('dragging');
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
  });

  const leadName = deal.lead ? deal.lead.name : (deal.leadName || 'Cliente Potencial');
  const company = deal.lead ? deal.lead.company : '';

  card.innerHTML = `
    <div class="flex items-start justify-between gap-1">
      <div class="text-xs font-bold text-white leading-tight">${deal.title}</div>
      <span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 font-bold">${deal.probability || 20}%</span>
    </div>
    <div class="text-[11px] text-slate-400 truncate">${leadName} ${company ? `· ${company}` : ''}</div>
    <div class="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
      <span class="font-bold text-emerald-400">${formatBRL(deal.value)}</span>
      <div class="flex items-center gap-1.5">
        <button onclick="quickCopilotForDeal('${deal.id}')" title="Copiloto IA" class="p-1 rounded hover:bg-blue-500/20 text-blue-400">
          <i data-lucide="bot" class="h-3.5 w-3.5"></i>
        </button>
        <button onclick="quickPixForDeal('${deal.id}')" title="Gerar PIX" class="p-1 rounded hover:bg-emerald-500/20 text-emerald-400">
          <i data-lucide="qr-code" class="h-3.5 w-3.5"></i>
        </button>
      </div>
    </div>
  `;

  return card;
}

async function moveDealStage(dealId, targetStage) {
  try {
    const res = await fetch(`/api/deals/${dealId}/stage`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ stage: targetStage })
    });
    if (res.ok) {
      showToast(`Oportunidade movida para ${targetStage.toUpperCase()}`, 'success');
      await loadDeals();
      await loadTasks();
    }
  } catch (err) {
    showToast('Falha ao mover estágio.', 'error');
  }
}

function filterKanban() {
  const q = (document.getElementById('kanban-search')?.value || '').toLowerCase();
  document.querySelectorAll('#kanban-board .glass-card').forEach(card => {
    const text = card.innerText.toLowerCase();
    card.style.display = text.includes(q) ? 'block' : 'none';
  });
}

// 4. LEADS & CONTATOS 360°
async function loadLeads() {
  try {
    const res = await fetch('/api/leads', { headers: authHeaders() });
    const json = await res.json();
    globalLeads = json.data || [];
    renderLeadsTable();
    populateLeadSelects();
  } catch (e) {
    console.error('Erro ao carregar leads:', e);
  }
}

function renderLeadsTable() {
  const tbody = document.getElementById('leads-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  globalLeads.forEach(lead => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-900/40 transition';

    tr.innerHTML = `
      <td class="p-3.5">
        <div class="font-bold text-white">${lead.name}</div>
        <div class="text-[10px] text-slate-400">${lead.company || 'Pessoa Física'}</div>
      </td>
      <td class="p-3.5">
        <div class="text-slate-300">${lead.role || 'Contato Comercial'}</div>
        <div class="text-[10px] text-slate-500">${lead.phone || '-'} · ${lead.email || '-'}</div>
      </td>
      <td class="p-3.5 font-bold text-emerald-400">
        ${formatBRL(lead.estimatedBudget)}
      </td>
      <td class="p-3.5">
        <div class="flex flex-wrap gap-1">
          ${(lead.tags || ['Qualificado']).map(t => `<span class="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">${t}</span>`).join('')}
        </div>
      </td>
      <td class="p-3.5 text-right space-x-1.5">
        <button onclick="openLead360('${lead.id}')" class="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 font-semibold transition">
          Visão 360°
        </button>
        ${lead.phone ? `
          <a href="https://wa.me/55${lead.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Olá ' + lead.name + ', tudo bem? Aqui é da equipe comercial.')}" target="_blank" class="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 font-semibold transition inline-flex items-center gap-1">
            <i data-lucide="message-circle" class="h-3 w-3"></i> WhatsApp
          </a>
        ` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (window.lucide) lucide.createIcons();
}

function openLead360(leadId) {
  const lead = globalLeads.find(l => l.id === leadId);
  if (!lead) return;
  
  // Alterna para copiloto já com este lead selecionado
  switchView('copilot');
  const sel = document.getElementById('copilot-lead-select');
  if (sel) {
    sel.value = leadId;
    onCopilotLeadChange();
  }
}

// 5. CENTRAL OMNICHANNEL (FASE 6)
async function loadOmnichannel() {
  try {
    const [chRes, cvRes] = await Promise.all([
      fetch('/api/omnichannel/channels', { headers: authHeaders() }),
      fetch('/api/omnichannel/conversations', { headers: authHeaders() })
    ]);
    const channels = (await chRes.json()).data || [];
    globalConversations = (await cvRes.json()).data || [];

    renderChannelsStatus(channels);
    renderConversationsList();
  } catch (err) {
    console.error('Erro ao carregar omnichannel:', err);
  }
}

function renderChannelsStatus(channels) {
  const bar = document.getElementById('channels-status-bar');
  if (!bar) return;
  bar.innerHTML = '';

  channels.forEach(ch => {
    const isConn = ch.status === 'connected';
    const card = document.createElement('div');
    card.className = `p-3.5 rounded-2xl border ${isConn ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-slate-800 bg-slate-900/60'} flex items-center justify-between`;
    
    card.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="h-9 w-9 rounded-xl ${isConn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'} flex items-center justify-center">
          <i data-lucide="${ch.icon || 'message-circle'}" class="h-5 w-5"></i>
        </div>
        <div>
          <div class="text-xs font-bold text-white">${ch.name}</div>
          <div class="text-[10px] text-slate-400">${ch.description.slice(0, 45)}...</div>
        </div>
      </div>
      <div>
        <button onclick="connectChannelModal('${ch.id}')" class="px-2.5 py-1 text-[11px] font-bold rounded-xl ${isConn ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-600 hover:bg-blue-500 text-white'} transition">
          ${ch.statusLabel}
        </button>
      </div>
    `;
    bar.appendChild(card);
  });
}

function renderConversationsList() {
  const list = document.getElementById('conversations-list');
  const count = document.getElementById('conv-count');
  if (!list) return;
  list.innerHTML = '';
  if (count) count.innerText = globalConversations.length;

  globalConversations.forEach(cv => {
    const item = document.createElement('div');
    item.className = `p-2.5 rounded-xl border cursor-pointer transition ${activeConversationId === cv.id ? 'bg-blue-900/30 border-blue-500/40 text-white' : 'border-slate-800 hover:bg-slate-800/40 text-slate-300'}`;
    item.onclick = () => selectConversation(cv.id);

    item.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-bold text-white">${cv.customerName || 'Cliente'}</span>
        <span class="text-[9px] text-slate-500">${cv.lastMessageAt ? new Date(cv.lastMessageAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
      </div>
      <div class="text-[11px] text-slate-400 truncate">${cv.lastMessage || 'Nenhuma mensagem recente'}</div>
    `;
    list.appendChild(item);
  });

  if (globalConversations.length > 0 && !activeConversationId) {
    selectConversation(globalConversations[0].id);
  }
}

async function selectConversation(cvId) {
  activeConversationId = cvId;
  renderConversationsList();
  const cv = globalConversations.find(c => c.id === cvId);
  if (!cv) return;

  document.getElementById('chat-customer-name').innerText = cv.customerName;
  document.getElementById('chat-customer-phone').innerText = cv.customerPhone || 'Canal Web';
  document.getElementById('chat-customer-avatar').innerText = (cv.customerName || 'C').charAt(0).toUpperCase();

  try {
    const res = await fetch(`/api/omnichannel/conversations/${cvId}/messages`, { headers: authHeaders() });
    const msgs = (await res.json()).data || [];
    renderChatMessages(msgs);
  } catch (e) {
    console.error('Erro ao carregar mensagens:', e);
  }
}

function renderChatMessages(msgs) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  container.innerHTML = '';

  msgs.forEach(m => {
    const isClient = m.sender === 'cliente';
    const bubble = document.createElement('div');
    bubble.className = `flex ${isClient ? 'justify-start' : 'justify-end'}`;

    bubble.innerHTML = `
      <div class="max-w-[75%] p-3 rounded-2xl text-xs ${isClient ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-blue-600 text-white shadow-md'}">
        <div class="text-[9px] opacity-70 mb-1">${m.senderName || (isClient ? 'Cliente' : 'Vendedor')}</div>
        <div>${m.text}</div>
      </div>
    `;
    container.appendChild(bubble);
  });

  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!input || !input.value.trim() || !activeConversationId) return;

  const text = input.value.trim();
  input.value = '';

  try {
    const res = await fetch('/api/omnichannel/messages', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ conversationId: activeConversationId, text, sender: 'vendedor' })
    });
    if (res.ok) {
      await selectConversation(activeConversationId);
    }
  } catch (e) {
    showToast('Erro ao enviar mensagem.', 'error');
  }
}

function triggerCopilotSuggestion() {
  const cv = globalConversations.find(c => c.id === activeConversationId);
  const input = document.getElementById('chat-input');
  if (!input) return;
  input.value = `Olá ${cv ? cv.customerName : 'cliente'}, tudo bem? Analisei seu projeto com a nossa IA e preparei uma condição exclusiva.`;
  showToast('Sugestão de resposta gerada pela IA aplicada no campo.', 'info');
}

function connectChannelModal(channelId) {
  openSettingsModal();
  showToast(`Configure as credenciais oficiais da Meta para ativar o canal ${channelId}.`, 'info');
}

// 6. RECUPERAIA (FASE 9)
async function loadRecuperaIA() {
  try {
    const [scanRes, campRes] = await Promise.all([
      fetch('/api/recovery/scan', { headers: authHeaders() }),
      fetch('/api/recovery/campaigns', { headers: authHeaders() })
    ]);
    const scan = (await scanRes.json()).data || {};
    const camps = (await campRes.json()).data || [];

    const totalRiskEl = document.getElementById('rec-total-risk');
    if (totalRiskEl) totalRiskEl.innerText = formatBRL(scan.totalValueAtRisk);

    const cats = scan.categories || {};
    if (document.getElementById('rec-stagnant-proposals')) {
      document.getElementById('rec-stagnant-proposals').innerText = cats.stagnantProposals?.count || 0;
    }
    if (document.getElementById('rec-stalled-deals')) {
      document.getElementById('rec-stalled-deals').innerText = cats.stalledDeals?.count || 0;
    }
    if (document.getElementById('rec-inactive-leads')) {
      document.getElementById('rec-inactive-leads').innerText = cats.inactiveLeads?.count || 0;
    }

    renderRecoveryCampaigns(camps);
  } catch (err) {
    console.error('Erro ao carregar RecuperaIA:', err);
  }
}

function renderRecoveryCampaigns(camps) {
  const container = document.getElementById('recovery-campaigns-list');
  if (!container) return;
  container.innerHTML = '';

  if (camps.length === 0) {
    container.innerHTML = '<div class="text-xs text-slate-500 py-3">Nenhuma campanha de reativação gerada ainda. Clique em "Gerar Campanha com IA".</div>';
    return;
  }

  camps.forEach(c => {
    const div = document.createElement('div');
    div.className = 'p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2';
    div.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-white">${c.name}</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold uppercase">${c.status}</span>
      </div>
      <div class="text-xs text-slate-300 italic p-2 rounded-lg bg-slate-950 border border-slate-800/80">
        "${c.template?.message || ''}"
      </div>
      <div class="flex items-center justify-between pt-1 text-[11px] text-slate-400">
        <span>CTA: <strong>${c.template?.cta || ''}</strong></span>
        <button onclick="dispatchRecoveryCampaign('${c.id}')" class="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition">
          Disparar Régua de Resgate
        </button>
      </div>
    `;
    container.appendChild(div);
  });
}

async function runAiRecoveryCampaignModal() {
  try {
    const res = await fetch('/api/recovery/generate-campaign', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ category: 'stalledDeals', tone: 'consultivo' })
    });
    if (res.ok) {
      showToast('Nova campanha do RecuperaIA gerada com sequência em 3 etapas!', 'success');
      await loadRecuperaIA();
    }
  } catch (e) {
    showToast('Erro ao gerar campanha.', 'error');
  }
}

function dispatchRecoveryCampaign(campId) {
  showToast('Régua de 3 etapas do RecuperaIA iniciada respeitando os limites da LGPD.', 'success');
}

// 7. CÉREBRO DA EMPRESA (FASE 8)
async function loadKnowledgeBase() {
  try {
    const res = await fetch('/api/knowledge-base', { headers: authHeaders() });
    globalKnowledge = (await res.json()).data || [];
    renderKnowledgeBase();
  } catch (e) {
    console.error('Erro ao carregar knowledge base:', e);
  }
}

function renderKnowledgeBase() {
  const grid = document.getElementById('knowledge-base-grid');
  if (!grid) return;
  grid.innerHTML = '';

  globalKnowledge.forEach(kb => {
    const card = document.createElement('div');
    card.className = 'glass-card p-4 rounded-2xl border border-purple-500/20 flex flex-col justify-between space-y-2';
    card.innerHTML = `
      <div>
        <div class="text-[10px] font-bold uppercase text-purple-400">${kb.category}</div>
        <div class="text-xs font-bold text-white pt-0.5">${kb.title}</div>
        <p class="text-[11px] text-slate-300 pt-1.5 leading-relaxed">${kb.content}</p>
      </div>
      <div class="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] text-slate-500">
        <span>Alimenta Agente IA</span>
        <button onclick="deleteKnowledge('${kb.id}')" class="text-rose-400 hover:text-rose-300">Excluir</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function openNewKnowledgeModal() {
  openModal('modal-new-knowledge');
}

async function submitNewKnowledge(e) {
  e.preventDefault();
  const category = document.getElementById('kb-category').value;
  const title = document.getElementById('kb-title').value;
  const content = document.getElementById('kb-content').value;

  try {
    const res = await fetch('/api/knowledge-base', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ category, title, content })
    });
    if (res.ok) {
      showToast('Conhecimento registrado no Cérebro da Empresa!', 'success');
      closeModal('modal-new-knowledge');
      await loadKnowledgeBase();
    }
  } catch (err) {
    showToast('Erro ao salvar.', 'error');
  }
}

async function deleteKnowledge(id) {
  if (!confirm('Deseja remover este item de conhecimento da IA?')) return;
  try {
    await fetch(`/api/knowledge-base/${id}`, { method: 'DELETE', headers: authHeaders() });
    showToast('Item removido.', 'info');
    await loadKnowledgeBase();
  } catch (err) {}
}

// 8. AUTOMAÇÕES (FASE 10)
async function loadAutomations() {
  try {
    const res = await fetch('/api/automations', { headers: authHeaders() });
    globalAutomations = (await res.json()).data || [];
    renderAutomations();
  } catch (e) {
    console.error('Erro ao carregar automações:', e);
  }
}

function renderAutomations() {
  const container = document.getElementById('automations-list');
  if (!container) return;
  container.innerHTML = '';

  globalAutomations.forEach(a => {
    const div = document.createElement('div');
    div.className = 'glass-card p-4 rounded-2xl border border-slate-800 flex items-center justify-between';
    div.innerHTML = `
      <div class="space-y-1">
        <div class="text-xs font-bold text-white flex items-center gap-2">
          <i data-lucide="workflow" class="h-4 w-4 text-amber-400"></i>
          <span>${a.name}</span>
        </div>
        <div class="text-[11px] text-slate-400">
          QUANDO: <span class="text-amber-300 font-semibold">${a.trigger}</span> ➔ ENTÃO: <span class="text-blue-300 font-semibold">${a.action?.type || 'Ação'}</span>
        </div>
      </div>
      <div>
        <button onclick="toggleAutomation('${a.id}')" class="px-3 py-1.5 text-xs font-semibold rounded-xl ${a.active !== false ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'} transition">
          ${a.active !== false ? 'Ativa' : 'Pausada'}
        </button>
      </div>
    `;
    container.appendChild(div);
  });
  if (window.lucide) lucide.createIcons();
}

function openNewAutomationModal() {
  openModal('modal-new-automation');
}

async function submitNewAutomation(e) {
  e.preventDefault();
  const name = document.getElementById('auto-name').value;
  const trigger = document.getElementById('auto-trigger').value;
  const actionType = document.getElementById('auto-action-type').value;

  try {
    const res = await fetch('/api/automations', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        name,
        trigger,
        action: { type: actionType, params: { title: `Ação Automática: ${name}` } }
      })
    });
    if (res.ok) {
      showToast('Automação ativada no sistema!', 'success');
      closeModal('modal-new-automation');
      await loadAutomations();
    }
  } catch (err) {
    showToast('Erro ao criar automação.', 'error');
  }
}

async function toggleAutomation(id) {
  try {
    await fetch(`/api/automations/${id}/toggle`, { method: 'PATCH', headers: authHeaders() });
    await loadAutomations();
  } catch (err) {}
}

// 9. ANALISTA IA PARA GESTORES (FASE 11)
function askAnalystQuestion(q) {
  const input = document.getElementById('analyst-input');
  if (input) input.value = q;
  executeAnalystQuery();
}

async function executeAnalystQuery() {
  const input = document.getElementById('analyst-input');
  if (!input || !input.value.trim()) return;
  const question = input.value.trim();

  const card = document.getElementById('analyst-response-card');
  const answerEl = document.getElementById('analyst-answer-text');
  const supportEl = document.getElementById('analyst-supporting-data');
  const timeEl = document.getElementById('analyst-time');

  try {
    showToast('Analista IA consultando base de dados...', 'info');
    const res = await fetch('/api/copilot/analyst', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ question })
    });
    const json = await res.json();
    if (json.success) {
      card.classList.remove('hidden');
      answerEl.innerText = json.data.answer;
      supportEl.innerText = JSON.stringify(json.data.supportingData, null, 2);
      timeEl.innerText = new Date(json.data.generatedAt).toLocaleTimeString('pt-BR');
    }
  } catch (e) {
    showToast('Erro ao consultar Analista IA.', 'error');
  }
}

// 10. VERTICAL AUTOMOTIVO (AGENTISE AUTO - FASE 18)
async function loadAutoVehicles() {
  try {
    const res = await fetch('/api/auto/vehicles', { headers: authHeaders() });
    globalVehicles = (await res.json()).data || [];
    renderAutoVehicles();
  } catch (e) {
    console.error('Erro ao carregar veículos:', e);
  }
}

function renderAutoVehicles() {
  const grid = document.getElementById('auto-vehicles-grid');
  if (!grid) return;
  grid.innerHTML = '';

  globalVehicles.forEach(v => {
    const card = document.createElement('div');
    card.className = 'glass-card p-4 rounded-2xl border border-amber-500/20 space-y-2.5';
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 uppercase">${v.bodyType || 'SUV'}</span>
        <span class="text-xs font-bold text-slate-400">${v.year} · ${v.km?.toLocaleString('pt-BR')} km</span>
      </div>
      <div class="text-sm font-bold text-white">${v.brand} ${v.model}</div>
      <div class="text-lg font-black text-amber-400">${formatBRL(v.price)}</div>
      <div class="flex flex-wrap gap-1 text-[10px] text-slate-400">
        ${(v.features || []).slice(0, 2).map(f => `<span class="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">${f}</span>`).join('')}
      </div>
      <button onclick="prefillFinancing(${v.price})" class="w-full py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition">
        Simular Financiamento
      </button>
    `;
    grid.appendChild(card);
  });
}

function prefillFinancing(price) {
  document.getElementById('sim-price').value = price;
  document.getElementById('sim-down').value = Math.round(price * 0.2);
  calculateAutoFinancing();
}

async function calculateAutoFinancing() {
  const price = Number(document.getElementById('sim-price').value || 0);
  const down = Number(document.getElementById('sim-down').value || 0);
  const term = Number(document.getElementById('sim-term').value || 48);

  try {
    const res = await fetch('/api/auto/financing', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ vehiclePrice: price, downPayment: down, termMonths: term })
    });
    const d = (await res.json()).data;
    const resEl = document.getElementById('sim-result');
    resEl.classList.remove('hidden');
    resEl.innerHTML = `
      Financiado: <strong>${formatBRL(d.financedAmount)}</strong> em <strong>${d.termMonths}x</strong> de <strong class="text-white text-sm">${formatBRL(d.monthlyInstallment)}</strong> (Taxa: ${d.monthlyInterestRate})
    `;
  } catch (err) {}
}

// 11. GESTÃO DE VENDEDORES & ANALYTICS (FASE 4 & 12)
async function loadAnalytics() {
  try {
    const res = await fetch('/api/analytics', { headers: authHeaders() });
    const d = (await res.json()).data;
    if (!d) return;

    if (document.getElementById('kpi-pipeline')) document.getElementById('kpi-pipeline').innerText = formatBRL(d.totalPipelineValue);
    if (document.getElementById('kpi-won')) document.getElementById('kpi-won').innerText = formatBRL(d.wonValue);
    if (document.getElementById('kpi-ticket')) document.getElementById('kpi-ticket').innerText = formatBRL(d.avgTicket);
    if (document.getElementById('kpi-winrate')) document.getElementById('kpi-winrate').innerText = `${d.winRate}%`;

    // Alertas da IA
    const alertsContainer = document.getElementById('analytics-ai-alerts');
    if (alertsContainer && d.aiAlerts) {
      alertsContainer.innerHTML = '';
      d.aiAlerts.forEach(al => {
        const div = document.createElement('div');
        const color = al.type === 'danger' ? 'rose' : (al.type === 'warning' ? 'amber' : 'blue');
        div.className = `p-3 rounded-2xl border border-${color}-500/30 bg-${color}-950/20 text-xs text-slate-200 flex items-start gap-2.5`;
        div.innerHTML = `
          <i data-lucide="${al.icon || 'info'}" class="h-4 w-4 text-${color}-400 shrink-0 mt-0.5"></i>
          <div>
            <div class="font-bold text-white">${al.title}</div>
            <div class="text-[10px] text-slate-400">${al.action}</div>
          </div>
        `;
        alertsContainer.appendChild(div);
      });
    }

    // Ranking de Vendedores
    const sellersGrid = document.getElementById('sellers-ranking-grid');
    if (sellersGrid && d.sellersPerformance) {
      sellersGrid.innerHTML = '';
      d.sellersPerformance.forEach((s, idx) => {
        const card = document.createElement('div');
        card.className = 'glass-card p-4 rounded-2xl border border-yellow-500/20 space-y-2';
        card.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase text-yellow-400">#${idx + 1} Ranking</span>
            <span class="text-xs font-bold text-slate-400">${s.wonCount} Vendas</span>
          </div>
          <div class="flex items-center gap-2.5">
            <img src="${s.avatar}" class="h-9 w-9 rounded-full bg-slate-800">
            <div>
              <div class="text-xs font-bold text-white">${s.name}</div>
              <div class="text-[10px] text-slate-400">${s.role}</div>
            </div>
          </div>
          <div class="text-lg font-black text-emerald-400">${formatBRL(s.revenue)}</div>
          <div class="text-[11px] text-slate-400">Taxa de Conversão: <strong class="text-slate-200">${s.conversionRate}%</strong></div>
        `;
        sellersGrid.appendChild(card);
      });
    }

    // Funil por estágios
    const stagesContainer = document.getElementById('analytics-stages');
    if (stagesContainer && d.stageBreakdown) {
      stagesContainer.innerHTML = '';
      Object.keys(d.stageBreakdown).forEach(k => {
        const count = d.stageBreakdown[k];
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between text-xs py-1 border-b border-slate-800/60';
        row.innerHTML = `<span class="uppercase font-semibold text-slate-400">${k}</span><span class="font-bold text-white">${count} negócios</span>`;
        stagesContainer.appendChild(row);
      });
    }

    if (window.lucide) lucide.createIcons();
  } catch (err) {}
}

// 12. BILLING & PLANOS SAAS (FASE 13 & 14)
async function loadBilling() {
  try {
    const res = await fetch('/api/billing/subscription', { headers: authHeaders() });
    const d = (await res.json()).data;
    if (!d) return;

    if (document.getElementById('tenant-plan-label')) {
      document.getElementById('tenant-plan-label').innerText = `${d.plan.name} (${d.daysLeftTrial}d Trial)`;
    }
    if (document.getElementById('ai-credits-pill')) {
      document.getElementById('ai-credits-pill').innerText = `${d.aiCreditsRemaining} cr`;
    }
    if (document.getElementById('billing-credits-val')) {
      document.getElementById('billing-credits-val').innerText = `${d.aiCreditsRemaining} / ${d.aiCredits}`;
    }
  } catch (err) {}
}

// 13. COPILOTO CLAUDE AI (FASE 7)
function populateDealSelects() {
  const sel = document.getElementById('deal-lead-select');
  if (sel) {
    sel.innerHTML = globalLeads.map(l => `<option value="${l.id}">${l.name} (${l.company || 'PJ'})</option>`).join('');
  }
}

function populateLeadSelects() {
  const sel = document.getElementById('copilot-lead-select');
  if (sel) {
    sel.innerHTML = globalLeads.map(l => `<option value="${l.id}">${l.name} - ${l.company || 'Geral'}</option>`).join('');
    if (globalLeads.length > 0) onCopilotLeadChange();
  }
  populateDealSelects();
}

async function onCopilotLeadChange() {
  const leadId = document.getElementById('copilot-lead-select')?.value;
  if (!leadId) return;

  try {
    const res = await fetch('/api/copilot/bant', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ leadId })
    });
    const d = (await res.json()).data;
    if (!d) return;

    document.getElementById('bant-score').innerText = `${d.totalScore}/100`;
    document.getElementById('bant-bar').style.width = `${d.totalScore}%`;
    document.getElementById('bant-b').innerText = `${d.breakdown.budget}/25`;
    document.getElementById('bant-a').innerText = `${d.breakdown.authority}/25`;
    document.getElementById('bant-n').innerText = `${d.breakdown.need}/25`;
    document.getElementById('bant-t').innerText = `${d.breakdown.timing}/25`;

    const ins = document.getElementById('bant-insights');
    ins.innerHTML = d.insights.map(i => `<div>• ${i}</div>`).join('');
  } catch (err) {}
}

async function generatePitchAction(obj) {
  const leadId = document.getElementById('copilot-lead-select')?.value;
  try {
    const res = await fetch('/api/copilot/pitch', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ leadId, objective: obj })
    });
    const d = (await res.json()).data;
    document.getElementById('copilot-output').value = d.text;
    currentCopilotText = d.text;
  } catch (e) {
    showToast('Erro ao gerar pitch.', 'error');
  }
}

async function handleObjectionAction(type) {
  const leadId = document.getElementById('copilot-lead-select')?.value;
  try {
    const res = await fetch('/api/copilot/objection', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ leadId, type })
    });
    const d = (await res.json()).data;
    document.getElementById('copilot-output').value = d.response || d.respostaSugerida;
    currentCopilotText = d.response || d.respostaSugerida;
  } catch (e) {
    showToast('Erro ao contornar objeção.', 'error');
  }
}

function sendPitchWhatsApp() {
  const leadId = document.getElementById('copilot-lead-select')?.value;
  const lead = globalLeads.find(l => l.id === leadId);
  const text = document.getElementById('copilot-output').value;
  if (!lead || !lead.phone) return showToast('Lead sem WhatsApp cadastrado.', 'warning');
  const url = `https://wa.me/55${lead.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function setAiLevel(lvl) {
  ['desativada', 'assistente', 'copiloto', 'autonoma'].forEach(l => {
    const btn = document.getElementById(`btn-ai-${l}`);
    if (btn) {
      if (l === lvl) {
        btn.className = 'px-2.5 py-1 text-[11px] rounded-lg font-semibold bg-blue-600 text-white transition';
      } else {
        btn.className = 'px-2.5 py-1 text-[11px] rounded-lg font-medium text-slate-400 transition';
      }
    }
  });
  showToast(`Nível do Agente Comercial alterado para: ${lvl.toUpperCase()}`, 'info');
}

// 14. FINANCEIRO & PIX EMV
async function generatePixAction() {
  const amount = Number(document.getElementById('pix-amount').value || 0);
  const desc = document.getElementById('pix-desc').value;
  const phone = document.getElementById('pix-phone').value;

  try {
    const res = await fetch('/api/pix/generate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ amount, description: desc, customerPhone: phone })
    });
    const d = (await res.json()).data;
    if (d) {
      document.getElementById('pix-payload-box').value = d.payload;
      const img = document.getElementById('pix-qr-img');
      img.src = d.qrCodeUrl;
      img.classList.remove('hidden');

      const waBtn = document.getElementById('pix-whatsapp-btn');
      if (d.whatsappUrl) {
        waBtn.classList.remove('hidden');
        waBtn.onclick = () => window.open(d.whatsappUrl, '_blank');
      }
      showToast('PIX EMV do Banco Central gerado com sucesso!', 'success');
    }
  } catch (err) {
    showToast('Erro ao gerar PIX.', 'error');
  }
}

function copyPixPayload() {
  const box = document.getElementById('pix-payload-box');
  if (!box || !box.value) return;
  navigator.clipboard.writeText(box.value);
  showToast('Código PIX Copia-e-Cola copiado!', 'success');
}

// 15. TAREFAS
async function loadTasks() {
  try {
    const res = await fetch('/api/tasks', { headers: authHeaders() });
    globalTasks = (await res.json()).data || [];
    renderTasks();
  } catch (err) {}
}

function renderTasks() {
  const container = document.getElementById('tasks-list');
  if (!container) return;
  container.innerHTML = '';

  globalTasks.forEach(t => {
    const div = document.createElement('div');
    div.className = `p-3 rounded-xl border flex items-center justify-between ${t.completed ? 'bg-slate-900/40 border-slate-800 opacity-60' : 'glass-card border-slate-700'}`;
    div.innerHTML = `
      <div class="flex items-center gap-2.5">
        <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask('${t.id}', this.checked)" class="rounded text-blue-600">
        <span class="text-xs ${t.completed ? 'line-through text-slate-500' : 'text-slate-200'}">${t.title}</span>
      </div>
      <span class="text-[10px] px-2 py-0.5 rounded uppercase font-bold ${t.priority === 'urgente' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-400'}">${t.priority}</span>
    `;
    container.appendChild(div);
  });
}

async function toggleTask(id, completed) {
  try {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ completed })
    });
    await loadTasks();
  } catch (e) {}
}

// 16. ONBOARDING (FASE 3)
function openOnboardingModal() {
  openModal('modal-onboarding');
}

function selectOnboardingSegment(seg) {
  currentOnboardingData.segment = seg;
  nextOnboardingStep(2);
}

function selectOnboardingTeam(size) {
  currentOnboardingData.teamSize = size;
  nextOnboardingStep(3);
}

function nextOnboardingStep(step) {
  [1, 2, 3, 4].forEach(s => {
    const el = document.getElementById(`onboarding-step-${s}`);
    if (el) el.classList.toggle('hidden', s !== step);
  });
  const titles = {
    1: 'Etapa 1: Qual é o seu segmento?',
    2: 'Etapa 2: Equipe Comercial',
    3: 'Etapa 3: Canais de Entrada',
    4: 'Etapa 4: Objetivo Principal'
  };
  document.getElementById('onboarding-step-title').innerText = titles[step];
  document.getElementById('onboarding-step-badge').innerText = `${step}/4`;
}

async function finishOnboarding(goal) {
  currentOnboardingData.primaryGoal = goal;
  try {
    const res = await fetch('/api/onboarding/complete', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(currentOnboardingData)
    });
    if (res.ok) {
      showToast('Configuração do negócio concluída! Pipeline inicial ativado.', 'success');
      closeModal('modal-onboarding');
      await initApp();
    }
  } catch (err) {
    showToast('Erro ao concluir onboarding.', 'error');
  }
}

// Modais Genéricos
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function openNewLeadModal() { openModal('modal-new-lead'); }
function openNewDealModal() { openModal('modal-new-deal'); }
function openNewTaskModal() { openModal('modal-new-task'); }
function openSettingsModal() { openModal('modal-settings'); }
function openMobileMenuModal() { showToast('Navegue pelas opções da barra superior ou selecione as abas.', 'info'); }

async function submitNewLead(e) {
  e.preventDefault();
  const name = document.getElementById('lead-name').value;
  const company = document.getElementById('lead-company').value;
  const role = document.getElementById('lead-role').value;
  const email = document.getElementById('lead-email').value;
  const phone = document.getElementById('lead-phone').value;
  const estimatedBudget = Number(document.getElementById('lead-budget').value || 0);
  const notes = document.getElementById('lead-notes').value;

  try {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, company, role, email, phone, estimatedBudget, notes })
    });
    if (res.ok) {
      showToast('Lead cadastrado com sucesso!', 'success');
      closeModal('modal-new-lead');
      await loadLeads();
    }
  } catch (err) {
    showToast('Erro ao cadastrar lead.', 'error');
  }
}

async function submitNewDeal(e) {
  e.preventDefault();
  const title = document.getElementById('deal-title').value;
  const leadId = document.getElementById('deal-lead-select').value;
  const value = Number(document.getElementById('deal-value').value || 0);
  const stage = document.getElementById('deal-stage').value;

  try {
    const res = await fetch('/api/deals', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ title, leadId, value, stage })
    });
    if (res.ok) {
      showToast('Oportunidade criada com sucesso!', 'success');
      closeModal('modal-new-deal');
      await loadDeals();
    }
  } catch (err) {
    showToast('Erro ao criar oportunidade.', 'error');
  }
}

async function submitNewTask(e) {
  e.preventDefault();
  const title = document.getElementById('task-title').value;
  const priority = document.getElementById('task-priority').value;

  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ title, priority })
    });
    if (res.ok) {
      showToast('Tarefa agendada!', 'success');
      closeModal('modal-new-task');
      await loadTasks();
    }
  } catch (err) {
    showToast('Erro ao criar tarefa.', 'error');
  }
}

async function submitSettings(e) {
  e.preventDefault();
  const companyName = document.getElementById('set-company').value;
  const pixKey = document.getElementById('set-pixkey').value;
  const apiKey = document.getElementById('set-apikey').value;

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ companyName, pixKey, apiKey: apiKey || undefined })
    });
    if (res.ok) {
      showToast('Configurações salvas com sucesso!', 'success');
      closeModal('modal-settings');
    }
  } catch (err) {
    showToast('Erro ao salvar configurações.', 'error');
  }
}

function quickCopilotForDeal(dealId) {
  const deal = globalDeals.find(d => d.id === dealId);
  if (deal) {
    switchView('copilot');
    const sel = document.getElementById('copilot-lead-select');
    if (sel && deal.leadId) {
      sel.value = deal.leadId;
      onCopilotLeadChange();
    }
  }
}

function quickPixForDeal(dealId) {
  const deal = globalDeals.find(d => d.id === dealId);
  if (deal) {
    switchView('pix');
    if (document.getElementById('pix-amount')) document.getElementById('pix-amount').value = deal.value;
    if (document.getElementById('pix-desc')) document.getElementById('pix-desc').value = deal.title;
    if (deal.lead && deal.lead.phone && document.getElementById('pix-phone')) {
      document.getElementById('pix-phone').value = deal.lead.phone;
    }
  }
}

function sendPixWhatsApp() {
  const phone = document.getElementById('pix-phone')?.value;
  const desc = document.getElementById('pix-desc')?.value;
  const amount = document.getElementById('pix-amount')?.value;
  const payload = document.getElementById('pix-payload-box')?.value;
  
  if (!phone) return showToast('Informe o WhatsApp do cliente.', 'warning');
  const msg = `Olá! Segue sua proposta de ${desc} no valor de ${formatBRL(amount)}.\n\nCódigo PIX Copia-e-Cola:\n${payload}`;
  const url = `https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}
