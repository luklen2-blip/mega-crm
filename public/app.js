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
let globalProposals = [];
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

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  await loadPipelines();
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
    loadBilling(),
    loadProposals()
  ]);
  checkCookieConsent();
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
  if (viewName === 'pix') loadProposals();

  if (window.lucide) lucide.createIcons();
}

// 3. PIPELINES MULTI-FUNIL & KANBAN (DRAG AND DROP)
let globalPipelines = [];
let selectedPipelineId = '';

async function loadPipelines() {
  try {
    const res = await fetch('/api/pipelines?includeStages=true', { headers: authHeaders() });
    const json = await res.json();
    globalPipelines = json.data || [];

    const select = document.getElementById('kanban-pipeline-selector');
    if (select) {
      select.innerHTML = '';
      globalPipelines.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.isDefault ? '⭐ ' : ''}${p.name}`;
        if (p.isDefault && !selectedPipelineId) {
          opt.selected = true;
          selectedPipelineId = p.id;
        }
        select.appendChild(opt);
      });
    }
  } catch (e) {
    console.error('Erro ao carregar pipelines:', e);
  }
}

async function onPipelineChange(pipeId) {
  selectedPipelineId = pipeId;
  const currentPipe = globalPipelines.find(p => p.id === pipeId);
  if (currentPipe && currentPipe.stages && currentPipe.stages.length > 0) {
    // Atualiza estágios dinâmicos do Kanban se houver customização
    STAGES = currentPipe.stages.map(s => ({
      id: s.key,
      label: s.name,
      color: s.color || 'blue'
    }));
  }
  await loadDeals();
}

async function loadDeals() {
  try {
    const url = selectedPipelineId ? `/api/deals?pipelineId=${selectedPipelineId}` : '/api/deals';
    const res = await fetch(url, { headers: authHeaders() });
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

  const leadName = escapeHtml(deal.lead ? deal.lead.name : (deal.leadName || 'Cliente Potencial'));
  const company = escapeHtml(deal.lead ? deal.lead.company : '');

  // Pontuação Preditiva AI Deal Score
  const score = deal.aiDealScore !== undefined && deal.aiDealScore !== null ? deal.aiDealScore : (deal.probability || 50);
  let scoreBadgeClass = 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  if (score >= 75) scoreBadgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  else if (score < 50) scoreBadgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/30';

  card.innerHTML = `
    <div class="flex items-start justify-between gap-1">
      <div class="text-xs font-bold text-white leading-tight">${escapeHtml(deal.title)}</div>
      <button onclick="openDealAiScoreModal('${deal.id}')" title="AI Deal Score: clique para ver análise" class="text-[10px] px-1.5 py-0.5 rounded-lg border font-black flex items-center gap-1 cursor-pointer hover:brightness-125 transition shrink-0 ${scoreBadgeClass}">
        <i data-lucide="cpu" class="h-2.5 w-2.5"></i>
        <span>${score}/100</span>
      </button>
    </div>
    <div class="text-[11px] text-slate-400 truncate">${leadName} ${company ? `· ${company}` : ''}</div>
    <div class="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
      <span class="font-bold text-emerald-400">${formatBRL(deal.value)}</span>
      <div class="flex items-center gap-1.5">
        <button onclick="openLead360('${deal.leadId}')" title="Visão 360° do Cliente" class="p-1 rounded hover:bg-indigo-500/20 text-indigo-400">
          <i data-lucide="compass" class="h-3.5 w-3.5"></i>
        </button>
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

let activeScoreDealId = null;

function openDealAiScoreModal(dealId) {
  const deal = globalDeals.find(d => d.id === dealId);
  if (!deal) return;
  activeScoreDealId = dealId;

  const leadName = deal.lead ? deal.lead.name : (deal.leadName || 'Cliente');
  const comp = deal.lead ? deal.lead.company : '';

  const titleEl = document.getElementById('modal-score-deal-title');
  const subEl = document.getElementById('modal-score-deal-sub');
  if (titleEl) titleEl.textContent = deal.title;
  if (subEl) subEl.textContent = `${leadName} ${comp ? `(${comp})` : ''} · Valor: ${formatBRL(deal.value)}`;
  
  const score = deal.aiDealScore !== undefined && deal.aiDealScore !== null ? deal.aiDealScore : (deal.probability || 50);
  const scoreEl = document.getElementById('modal-score-number');
  const classEl = document.getElementById('modal-score-classification');
  const ratEl = document.getElementById('modal-score-rationale');
  const driversUl = document.getElementById('modal-score-drivers');
  const risksUl = document.getElementById('modal-score-risks');

  if (scoreEl) scoreEl.textContent = `${score}/100`;
  if (classEl) classEl.textContent = deal.aiScoreClassification || (score >= 75 ? 'Alta Propensão de Fechamento' : score >= 50 ? 'Média Propensão' : 'Risco de Perda / Atenção');
  if (ratEl) ratEl.textContent = deal.aiScoreRationale || `Oportunidade calculada com score ${score}/100 com base em estágio, recência de interações e aderência do cliente.`;

  if (driversUl) {
    driversUl.innerHTML = '';
    const drivers = deal.aiScoreDrivers || ['Oportunidade ativa na esteira de negociação'];
    drivers.forEach(d => {
      const li = document.createElement('li');
      li.textContent = d;
      driversUl.appendChild(li);
    });
  }

  if (risksUl) {
    risksUl.innerHTML = '';
    const risks = deal.aiScoreRisks || [];
    if (risks.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Nenhum fator crítico de risco identificado.';
      li.className = 'text-slate-500';
      risksUl.appendChild(li);
    } else {
      risks.forEach(r => {
        const li = document.createElement('li');
        li.textContent = r;
        risksUl.appendChild(li);
      });
    }
  }

  openModal('modal-deal-ai-score');
  if (window.lucide) lucide.createIcons();
}

async function recalcDealAiScore() {
  if (!activeScoreDealId) return;
  const btn = document.getElementById('modal-score-recalc-btn');
  if (btn) btn.innerHTML = '<i data-lucide="loader-2" class="h-3.5 w-3.5 animate-spin"></i> Calculando...';

  try {
    const res = await fetch(`/api/deals/${activeScoreDealId}/ai-score`, {
      method: 'POST',
      headers: authHeaders()
    });
    const json = await res.json();
    if (res.ok) {
      showToast(`AI Deal Score recalculado: ${json.aiDealScore}/100`, 'success');
      await loadDeals();
      openDealAiScoreModal(activeScoreDealId);
    } else {
      showToast(json.error || 'Erro ao recalcular score.', 'error');
    }
  } catch (e) {
    showToast('Falha na comunicação ao recalcular score.', 'error');
  } finally {
    if (btn) btn.innerHTML = '<i data-lucide="refresh-cw" class="h-3.5 w-3.5"></i> Recalcular Score';
    if (window.lucide) lucide.createIcons();
  }
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
        <div class="font-bold text-white">${escapeHtml(lead.name)}</div>
        <div class="text-[10px] text-slate-400">${escapeHtml(lead.company || 'Pessoa Física')}</div>
      </td>
      <td class="p-3.5">
        <div class="text-slate-300">${escapeHtml(lead.role || 'Contato Comercial')}</div>
        <div class="text-[10px] text-slate-500">${escapeHtml(lead.phone || '-')} · ${escapeHtml(lead.email || '-')}</div>
      </td>
      <td class="p-3.5 font-bold text-emerald-400">
        ${formatBRL(lead.estimatedBudget)}
      </td>
      <td class="p-3.5">
        <div class="flex flex-wrap gap-1">
          ${(lead.tags || ['Qualificado']).map(t => `<span class="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">${escapeHtml(t)}</span>`).join('')}
        </div>
      </td>
      <td class="p-3.5 text-right space-x-1.5 whitespace-nowrap">
        <button onclick="openLead360('${escapeHtml(lead.id)}')" class="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 font-semibold transition">
          Visão 360°
        </button>
        ${lead.phone ? `
          <a href="https://wa.me/55${lead.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Olá ' + lead.name + ', tudo bem? Aqui é da equipe comercial.')}" target="_blank" class="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 font-semibold transition inline-flex items-center gap-1">
            <i data-lucide="message-circle" class="h-3 w-3"></i> WhatsApp
          </a>
        ` : ''}
        <button onclick="anonymizeLead('${escapeHtml(lead.id)}')" title="Anonimizar dados pessoais (Art. 18 LGPD)" class="px-2 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 font-semibold transition inline-flex items-center gap-1">
          <i data-lucide="shield-alert" class="h-3 w-3"></i> LGPD
        </button>
        <button onclick="deleteLead('${escapeHtml(lead.id)}')" title="Excluir Lead" class="px-2 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 font-semibold transition inline-flex items-center">
          <i data-lucide="trash-2" class="h-3 w-3"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (window.lucide) lucide.createIcons();
}

function filterLeads() {
  const q = (document.getElementById('leads-search')?.value || '').toLowerCase().trim();
  const rows = document.querySelectorAll('#leads-table-body tr');
  rows.forEach(r => {
    const text = r.innerText.toLowerCase();
    r.style.display = text.includes(q) ? '' : 'none';
  });
}

async function anonymizeLead(leadId) {
  if (!confirm('Deseja realmente anonimizar os dados pessoais deste lead conforme o Art. 18 da LGPD? Esta ação é irreversível.')) return;
  try {
    const res = await fetch('/api/lgpd/anonymize', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ leadId })
    });
    const json = await res.json();
    if (res.ok) {
      showToast('Dados do lead expurgados e anonimizados com sucesso.', 'success');
      await loadLeads();
    } else {
      showToast(json.error || 'Erro ao anonimizar lead.', 'error');
    }
  } catch (e) {
    showToast('Erro de comunicação ao anonimizar lead.', 'error');
  }
}

async function deleteLead(leadId) {
  if (!confirm('Deseja excluir permanentemente este lead do sistema?')) return;
  try {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (res.ok) {
      showToast('Lead removido com sucesso.', 'info');
      await loadLeads();
      await loadDeals();
    } else {
      showToast('Erro ao remover lead.', 'error');
    }
  } catch (e) {
    showToast('Erro de comunicação ao excluir lead.', 'error');
  }
}

let current360Lead = null;

async function openLead360(leadId) {
  try {
    const res = await fetch(`/api/leads/${leadId}/timeline`, { headers: authHeaders() });
    if (!res.ok) {
      showToast('Não foi possível carregar a Visão 360° do cliente.', 'error');
      return;
    }
    const json = await res.json();
    const timelineData = json.data;
    if (!timelineData || !timelineData.lead) {
      showToast('Lead não encontrado.', 'error');
      return;
    }

    current360Lead = timelineData.lead;
    const lead = timelineData.lead;

    // Preenche cabeçalho do modal
    const nameEl = document.getElementById('modal-360-lead-name');
    const badgeEl = document.getElementById('modal-360-stage-badge');
    const compEl = document.getElementById('modal-360-company');
    const contactEl = document.getElementById('modal-360-contact');
    const budgetEl = document.getElementById('modal-360-budget');
    const eventsCountEl = document.getElementById('modal-360-events-count');
    const hiddenLeadId = document.getElementById('activity-lead-id');

    if (nameEl) nameEl.textContent = lead.name || 'Lead sem nome';
    if (badgeEl) {
      badgeEl.textContent = timelineData.currentStage?.label || 'Em Atendimento';
      badgeEl.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300';
    }
    if (compEl) compEl.innerHTML = `<i data-lucide="building-2" class="h-3.5 w-3.5 text-slate-500"></i> ${escapeHtml(lead.company || 'Pessoa Física')}`;
    if (contactEl) contactEl.innerHTML = `<i data-lucide="phone" class="h-3.5 w-3.5 text-slate-500"></i> ${escapeHtml(lead.phone || '-')} · ${escapeHtml(lead.email || '-')}`;
    if (budgetEl) budgetEl.innerHTML = `<i data-lucide="dollar-sign" class="h-3.5 w-3.5"></i> ${formatBRL(lead.estimatedBudget || 0)}`;
    if (eventsCountEl) eventsCountEl.textContent = `${timelineData.eventsCount || 0} eventos registrados`;
    if (hiddenLeadId) hiddenLeadId.value = lead.id;

    // Configura botão do WhatsApp
    const waLink = document.getElementById('modal-360-whatsapp-link');
    if (waLink) {
      if (lead.phone) {
        waLink.href = `https://wa.me/55${lead.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Olá ' + lead.name + ', tudo bem? Aqui é da equipe comercial.')}`;
        waLink.classList.remove('hidden');
        waLink.classList.add('inline-flex');
      } else {
        waLink.classList.add('hidden');
        waLink.classList.remove('inline-flex');
      }
    }

    // Renderiza a esteira de 10 estágios
    renderTimelineStagesTrack(timelineData.stages || []);

    // Renderiza os eventos
    renderTimelineEventsFeed(timelineData.events || []);

    openModal('modal-client-360');
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Erro ao abrir CRM 360:', err);
    showToast('Falha de conexão ao carregar linha do tempo.', 'error');
  }
}

function renderTimelineStagesTrack(stages) {
  const track = document.getElementById('modal-360-stages-track');
  if (!track) return;
  track.innerHTML = '';

  stages.forEach((stg, idx) => {
    const isCompleted = stg.completed;
    const isCurrent = stg.current;

    let bgClass = 'bg-slate-800 text-slate-400 border-slate-700';
    let iconName = 'circle';
    if (isCompleted && !isCurrent) {
      bgClass = 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
      iconName = 'check-circle-2';
    } else if (isCurrent) {
      bgClass = 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30 ring-2 ring-blue-400/40';
      iconName = 'compass';
    }

    const stageItem = document.createElement('div');
    stageItem.className = `flex-1 min-w-[70px] flex flex-col items-center text-center p-1.5 rounded-xl border text-[10px] transition ${bgClass}`;
    stageItem.innerHTML = `
      <i data-lucide="${iconName}" class="h-3.5 w-3.5 mb-1"></i>
      <span class="font-bold leading-tight truncate w-full" title="${escapeHtml(stg.label)}">${escapeHtml(stg.label)}</span>
    `;
    track.appendChild(stageItem);
  });
}

function renderTimelineEventsFeed(events) {
  const feed = document.getElementById('modal-360-events-feed');
  if (!feed) return;
  feed.innerHTML = '';

  if (events.length === 0) {
    feed.innerHTML = `
      <div class="text-center py-6 text-slate-500 text-xs">
        <i data-lucide="history" class="h-8 w-8 mx-auto mb-2 opacity-40"></i>
        Nenhuma interação registrada ainda para este lead.
      </div>
    `;
    return;
  }

  events.forEach(evt => {
    const card = document.createElement('div');
    card.className = 'p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-blue-500/20 transition text-xs space-y-1';
    
    const timeStr = evt.timestamp ? new Date(evt.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Agora';

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="p-1 rounded-lg bg-blue-500/15 text-blue-400">
            <i data-lucide="${evt.icon || 'calendar'}" class="h-3.5 w-3.5"></i>
          </span>
          <span class="font-bold text-white">${escapeHtml(evt.title || 'Evento')}</span>
          <span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-semibold">${escapeHtml(evt.stageLabel || evt.stage || '')}</span>
        </div>
        <span class="text-[10px] text-slate-500">${timeStr}</span>
      </div>
      ${evt.description ? `<p class="text-slate-300 text-[11px] pl-7 leading-relaxed">${escapeHtml(evt.description)}</p>` : ''}
      <div class="text-[10px] text-slate-500 pl-7 flex items-center gap-1 pt-0.5">
        <i data-lucide="user" class="h-3 w-3"></i>
        <span>Responsável: <strong>${escapeHtml(evt.author || 'Equipe')}</strong></span>
      </div>
    `;
    feed.appendChild(card);
  });
}

async function submitTimelineActivity(e) {
  e.preventDefault();
  const leadId = document.getElementById('activity-lead-id')?.value;
  const type = document.getElementById('activity-type')?.value;
  const title = document.getElementById('activity-title')?.value;
  const description = document.getElementById('activity-description')?.value;

  if (!leadId || !title) {
    showToast('Preencha os campos obrigatórios.', 'warning');
    return;
  }

  try {
    const res = await fetch(`/api/leads/${leadId}/activities`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ type, title, description })
    });
    const json = await res.json();
    if (res.ok) {
      showToast('Interação registrada na Linha do Tempo 360°!', 'success');
      document.getElementById('activity-title').value = '';
      document.getElementById('activity-description').value = '';
      // Recarrega a timeline 360 do lead
      await openLead360(leadId);
    } else {
      showToast(json.error || 'Erro ao registrar interação.', 'error');
    }
  } catch (err) {
    showToast('Falha na comunicação ao registrar interação.', 'error');
  }
}

function openPixModalFrom360() {
  if (!current360Lead) return;
  closeModal('modal-client-360');
  switchView('pix');
  if (document.getElementById('pix-amount')) document.getElementById('pix-amount').value = current360Lead.estimatedBudget || 5000;
  if (document.getElementById('pix-desc')) document.getElementById('pix-desc').value = `Proposta Comercial - ${current360Lead.name}`;
  if (document.getElementById('pix-phone') && current360Lead.phone) {
    document.getElementById('pix-phone').value = current360Lead.phone;
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
        <span class="text-xs font-bold text-white">${escapeHtml(cv.customerName || 'Cliente')}</span>
        <span class="text-[9px] text-slate-500">${cv.lastMessageAt ? new Date(cv.lastMessageAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
      </div>
      <div class="text-[11px] text-slate-400 truncate">${escapeHtml(cv.lastMessage || 'Nenhuma mensagem recente')}</div>
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

  document.getElementById('chat-customer-name').innerText = cv.customerName || 'Cliente';
  document.getElementById('chat-customer-phone').innerText = cv.customerPhone || 'Canal Web';
  document.getElementById('chat-customer-avatar').innerText = (cv.customerName || 'C').charAt(0).toUpperCase();

  const modeSelector = document.getElementById('chat-mode-selector');
  if (modeSelector) {
    modeSelector.value = cv.mode || 'copiloto';
  }

  try {
    const res = await fetch(`/api/omnichannel/conversations/${cvId}/messages`, { headers: authHeaders() });
    const msgs = (await res.json()).data || [];
    renderChatMessages(msgs);
  } catch (e) {
    console.error('Erro ao carregar mensagens:', e);
  }
}

async function changeActiveChatMode(mode) {
  if (!activeConversationId) return;
  try {
    const res = await fetch(`/api/inbox/conversations/${activeConversationId}/mode`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ mode })
    });
    if (res.ok) {
      const cv = globalConversations.find(c => c.id === activeConversationId);
      if (cv) cv.mode = mode;
      showToast(`Modo alterado para ${mode.toUpperCase()}`, 'success');
    }
  } catch (e) {
    showToast('Erro ao alterar modo da conversa.', 'error');
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
        <div class="text-[9px] opacity-70 mb-1">${escapeHtml(m.senderName || (isClient ? 'Cliente' : 'Vendedor'))}</div>
        <div>${escapeHtml(m.text)}</div>
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
    const res = await fetch(`/api/inbox/conversations/${activeConversationId}/messages`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ text, sender: 'vendedor', approvedByHuman: true })
    });
    if (res.ok) {
      await selectConversation(activeConversationId);
    }
  } catch (e) {
    showToast('Erro ao enviar mensagem.', 'error');
  }
}

async function triggerCopilotSuggestion() {
  if (!activeConversationId) {
    showToast('Selecione uma conversa ativa primeiro.', 'warning');
    return;
  }
  const btn = document.getElementById('btn-suggest-ia');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="h-3 w-3 animate-spin"></i><span>Pensando...</span>';
    if (window.lucide) lucide.createIcons();
  }

  try {
    const res = await fetch(`/api/inbox/conversations/${activeConversationId}/suggest`, {
      method: 'POST',
      headers: authHeaders()
    });
    const data = await res.json();
    if (res.ok && data.suggestion) {
      const input = document.getElementById('chat-input');
      if (input) input.value = data.suggestion;
      showToast(`Sugestão gerada com ${data.modelUsed || 'IA'} (${data.latencyMs || 0}ms)`, 'info');
    } else {
      showToast(data.error || 'Não foi possível gerar sugestão.', 'warning');
    }
  } catch (e) {
    showToast('Erro ao consultar IA para sugestão.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      if (window.lucide) lucide.createIcons();
    }
  }
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
        <span class="text-xs font-bold text-white">${escapeHtml(c.name)}</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold uppercase">${escapeHtml(c.status)}</span>
      </div>
      <div class="text-xs text-slate-300 italic p-2 rounded-lg bg-slate-950 border border-slate-800/80">
        "${escapeHtml(c.template?.message || '')}"
      </div>
      <div class="flex items-center justify-between pt-1 text-[11px] text-slate-400">
        <span>CTA: <strong>${escapeHtml(c.template?.cta || '')}</strong></span>
        <button onclick="dispatchRecoveryCampaign('${escapeHtml(c.id)}')" class="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition">
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
        <div class="text-[10px] font-bold uppercase text-purple-400">${escapeHtml(kb.category)}</div>
        <div class="text-xs font-bold text-white pt-0.5">${escapeHtml(kb.title)}</div>
        <p class="text-[11px] text-slate-300 pt-1.5 leading-relaxed">${escapeHtml(kb.content)}</p>
      </div>
      <div class="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] text-slate-500">
        <span>Alimenta Agente IA</span>
        <button onclick="deleteKnowledge('${escapeHtml(kb.id)}')" class="text-rose-400 hover:text-rose-300">Excluir</button>
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

  if (globalAutomations.length === 0) {
    container.innerHTML = '<div class="text-center py-8 text-slate-500 text-xs">Nenhuma regra de automação configurada. Clique em "Nova Automação" para começar.</div>';
    return;
  }

  globalAutomations.forEach(a => {
    const div = document.createElement('div');
    div.className = 'glass-card p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-3';
    
    let condBadge = '';
    if (a.condition && a.condition.field) {
      condBadge = `<span class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px]">SE ${escapeHtml(a.condition.field)} ${escapeHtml(a.condition.operator)} ${escapeHtml(String(a.condition.value))}</span>`;
    }

    div.innerHTML = `
      <div class="space-y-1">
        <div class="text-xs font-bold text-white flex items-center gap-2">
          <i data-lucide="workflow" class="h-4 w-4 text-amber-400"></i>
          <span>${escapeHtml(a.name)}</span>
          ${condBadge}
        </div>
        <div class="text-[11px] text-slate-400">
          QUANDO: <span class="text-amber-300 font-semibold">${escapeHtml(a.trigger)}</span> ➔ ENTÃO: <span class="text-blue-300 font-semibold">${escapeHtml(a.action?.type || a.action?.id || 'Ação')}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="toggleAutomation('${escapeHtml(a.id)}')" class="px-3 py-1.5 text-xs font-semibold rounded-xl ${a.active !== false ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'} transition">
          ${a.active !== false ? 'Ativa' : 'Pausada'}
        </button>
        <button onclick="deleteAutomation('${escapeHtml(a.id)}')" title="Excluir Automação" class="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition">
          <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
        </button>
      </div>
    `;
    container.appendChild(div);
  });
  if (window.lucide) lucide.createIcons();
}

function switchAutomationTab(tab) {
  const rulesList = document.getElementById('automations-list');
  const runsList = document.getElementById('automations-runs-list');
  const tabRules = document.getElementById('tab-auto-rules');
  const tabRuns = document.getElementById('tab-auto-runs');

  if (tab === 'rules') {
    if (rulesList) rulesList.classList.remove('hidden');
    if (runsList) runsList.classList.add('hidden');
    if (tabRules) tabRules.className = 'px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30';
    if (tabRuns) tabRuns.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-slate-400 border border-slate-800 hover:text-white';
  } else {
    if (rulesList) rulesList.classList.add('hidden');
    if (runsList) runsList.classList.remove('hidden');
    if (tabRuns) tabRuns.className = 'px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30';
    if (tabRules) tabRules.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-slate-400 border border-slate-800 hover:text-white';
    loadAutomationRuns();
  }
}

async function loadAutomationRuns() {
  const container = document.getElementById('automations-runs-list');
  if (!container) return;
  container.innerHTML = '<div class="text-center py-6 text-slate-500 text-xs">Carregando execuções...</div>';

  try {
    const res = await fetch('/api/automations/runs', { headers: authHeaders() });
    const data = await res.json();
    const runs = data.data || [];

    if (runs.length === 0) {
      container.innerHTML = '<div class="text-center py-8 text-slate-500 text-xs">Nenhuma execução registrada até o momento.</div>';
      return;
    }

    container.innerHTML = '';
    runs.forEach(run => {
      const card = document.createElement('div');
      card.className = 'glass-card p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs';
      const isOk = run.status === 'success';
      card.innerHTML = `
        <div class="space-y-0.5">
          <div class="font-bold text-white flex items-center gap-2">
            <span class="h-2 w-2 rounded-full ${isOk ? 'bg-emerald-400' : 'bg-rose-400'}"></span>
            <span>${escapeHtml(run.automationName || 'Automação')}</span>
            <span class="text-[10px] text-slate-500">(${escapeHtml(run.triggerType)})</span>
          </div>
          <div class="text-[11px] text-slate-400">
            Ações: ${run.actionsExecuted ? run.actionsExecuted.length : 0} executada(s)
          </div>
        </div>
        <div class="text-[10px] text-slate-500">
          ${run.executedAt ? new Date(run.executedAt).toLocaleString('pt-BR') : '-'}
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = '<div class="text-center py-6 text-rose-400 text-xs">Erro ao carregar histórico de execuções.</div>';
  }
}

async function testActiveAutomations() {
  try {
    const res = await fetch('/api/automations/test-trigger', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        triggerType: 'novo_lead',
        context: { name: 'Lead Teste Automação', title: 'Oportunidade Teste', value: 10000 }
      })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Disparo de teste concluído: ${(data.executedActions || []).length} ação(ões) executadas!`, 'success');
      await loadAutomations();
      if (!document.getElementById('automations-runs-list')?.classList.contains('hidden')) {
        await loadAutomationRuns();
      }
    }
  } catch (e) {
    showToast('Erro ao testar disparo.', 'error');
  }
}

function openNewAutomationModal() {
  openModal('modal-new-automation');
}

async function submitNewAutomation(e) {
  e.preventDefault();
  const name = document.getElementById('auto-name').value;
  const trigger = document.getElementById('auto-trigger').value;
  const actionType = document.getElementById('auto-action-type').value;

  const condField = document.getElementById('auto-cond-field')?.value;
  const condOp = document.getElementById('auto-cond-op')?.value;
  const condVal = document.getElementById('auto-cond-val')?.value;

  let condition = null;
  if (condField && condVal) {
    condition = { field: condField, operator: condOp || 'greater_than', value: condVal };
  }

  try {
    const res = await fetch('/api/automations', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        name,
        trigger,
        condition,
        action: { type: actionType, id: actionType, params: { title: `Ação Automática: ${name}` } }
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

async function deleteAutomation(id) {
  if (!confirm('Deseja realmente excluir esta automação comercial?')) return;
  try {
    const res = await fetch(`/api/automations/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (res.ok) {
      showToast('Automação removida com sucesso.', 'info');
      await loadAutomations();
    }
  } catch (err) {
    showToast('Erro ao excluir automação.', 'error');
  }
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
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 uppercase">${escapeHtml(v.bodyType || 'SUV')}</span>
        <span class="text-xs font-bold text-slate-400">${escapeHtml(v.year)} · ${Number(v.km || 0).toLocaleString('pt-BR')} km</span>
      </div>
      <div class="text-sm font-bold text-white">${escapeHtml(v.brand)} ${escapeHtml(v.model)}</div>
      <div class="text-lg font-black text-amber-400">${formatBRL(v.price)}</div>
      <div class="flex flex-wrap gap-1 text-[10px] text-slate-400">
        ${(v.features || []).slice(0, 2).map(f => `<span class="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">${escapeHtml(f)}</span>`).join('')}
      </div>
      <button onclick="prefillFinancing(${Number(v.price) || 0})" class="w-full py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition">
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
          <i data-lucide="${escapeHtml(al.icon || 'info')}" class="h-4 w-4 text-${color}-400 shrink-0 mt-0.5"></i>
          <div>
            <div class="font-bold text-white">${escapeHtml(al.title)}</div>
            <div class="text-[10px] text-slate-400">${escapeHtml(al.action)}</div>
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
            <img src="${escapeHtml(s.avatar)}" class="h-9 w-9 rounded-full bg-slate-800" alt="Avatar">
            <div>
              <div class="text-xs font-bold text-white">${escapeHtml(s.name)}</div>
              <div class="text-[10px] text-slate-400">${escapeHtml(s.role)}</div>
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

let pendingUpgradePlan = null;

async function loadWorkspaceSettings() {
  try {
    const res = await fetch('/api/workspace', { headers: authHeaders() });
    const json = await res.json();
    if (json.success && json.data) {
      const ws = json.data;
      if (document.getElementById('ws-name-input')) document.getElementById('ws-name-input').value = ws.name || '';
      if (document.getElementById('ws-segment-input')) document.getElementById('ws-segment-input').value = ws.segment || '';
      if (document.getElementById('ws-phone-input')) document.getElementById('ws-phone-input').value = ws.phone || '';
    }
  } catch (err) {}
}

async function saveWorkspaceSettings() {
  const name = (document.getElementById('ws-name-input') || {}).value;
  const segment = (document.getElementById('ws-segment-input') || {}).value;
  const phone = (document.getElementById('ws-phone-input') || {}).value;

  try {
    const res = await fetch('/api/workspace', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ name, segment, phone })
    });
    const json = await res.json();
    if (json.success) {
      showToast('Configurações do workspace salvas com sucesso!', 'success');
      if (json.data && json.data.name) {
        const logoName = document.getElementById('company-name-display');
        if (logoName) logoName.innerText = json.data.name;
      }
    } else {
      showToast(json.error || 'Erro ao salvar configurações.', 'error');
    }
  } catch (err) {
    showToast('Erro ao atualizar workspace.', 'error');
  }
}

async function openPlanUpgradeModal(planKey, planName, planPrice) {
  pendingUpgradePlan = planKey;
  const titleEl = document.getElementById('modal-upgrade-plan-title');
  const priceEl = document.getElementById('modal-upgrade-plan-price');
  const qrImg = document.getElementById('modal-upgrade-pix-qr');
  const codeBox = document.getElementById('modal-upgrade-pix-code');

  if (titleEl) titleEl.innerText = `Plano ${planName}`;
  if (priceEl) priceEl.innerHTML = `R$ ${planPrice},00<span class="text-xs font-normal text-slate-400">/mês</span>`;

  try {
    const res = await fetch('/api/pix/generate', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        amount: planPrice,
        description: `Assinatura Agentise ${planName}`
      })
    });
    const d = (await res.json()).data;
    if (d) {
      if (qrImg) qrImg.src = d.qrCodeUrl;
      if (codeBox) codeBox.value = d.payload;
    }
  } catch (e) {}

  openModal('modal-plan-upgrade');
}

function copyUpgradePixCode() {
  const box = document.getElementById('modal-upgrade-pix-code');
  if (!box || !box.value) return;
  navigator.clipboard.writeText(box.value);
  showToast('Código PIX Copia-e-Cola copiado com sucesso!', 'success');
}

async function confirmPlanUpgrade() {
  if (!pendingUpgradePlan) return;
  try {
    const res = await fetch('/api/billing/upgrade', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ plan: pendingUpgradePlan })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Plano atualizado com sucesso!', 'success');
      closeModal('modal-plan-upgrade');
      await loadBilling();
    } else {
      showToast(data.error || 'Erro ao realizar upgrade.', 'error');
    }
  } catch (err) {
    showToast('Falha na comunicação ao realizar upgrade.', 'error');
  }
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
    if (document.getElementById('billing-plan-badge')) {
      document.getElementById('billing-plan-badge').innerText = `Plano ${d.plan.name} (${d.daysLeftTrial}d restantes)`;
    }
    if (document.getElementById('billing-trial-title')) {
      document.getElementById('billing-trial-title').innerText = d.isTrialActive 
        ? `Você está no período de Demonstração (${d.daysLeftTrial} dias restantes)` 
        : `Plano Ativo: ${d.plan.name}`;
    }

    // Atualiza Quotas Visuais
    if (d.quotas) {
      // Leads
      const leadsQ = d.quotas.leads || {};
      const leadsTxt = document.getElementById('quota-leads-text');
      const leadsBar = document.getElementById('quota-leads-bar');
      const leadsPct = document.getElementById('quota-leads-pct');
      if (leadsTxt) leadsTxt.innerText = `${leadsQ.current || 0} / ${(leadsQ.limit || 0).toLocaleString('pt-BR')}`;
      if (leadsBar) leadsBar.style.width = `${leadsQ.percent || 0}%`;
      if (leadsPct) leadsPct.innerText = `${leadsQ.percent || 0}% utilizado`;

      // Usuários
      const usersQ = d.quotas.users || {};
      const usersTxt = document.getElementById('quota-users-text');
      const usersBar = document.getElementById('quota-users-bar');
      const usersPct = document.getElementById('quota-users-pct');
      if (usersTxt) usersTxt.innerText = `${usersQ.current || 0} / ${usersQ.limit || 0}`;
      if (usersBar) usersBar.style.width = `${usersQ.percent || 0}%`;
      if (usersPct) usersPct.innerText = `${usersQ.percent || 0}% utilizado`;

      // Pipelines
      const pipesQ = d.quotas.pipelines || {};
      const pipesTxt = document.getElementById('quota-pipelines-text');
      const pipesBar = document.getElementById('quota-pipelines-bar');
      const pipesPct = document.getElementById('quota-pipelines-pct');
      if (pipesTxt) pipesTxt.innerText = `${pipesQ.current || 0} / ${pipesQ.limit || 0}`;
      if (pipesBar) pipesBar.style.width = `${pipesQ.percent || 0}%`;
      if (pipesPct) pipesPct.innerText = `${pipesQ.percent || 0}% utilizado`;

      // Automações
      const autoQ = d.quotas.automations || {};
      const autoTxt = document.getElementById('quota-automations-text');
      const autoBar = document.getElementById('quota-automations-bar');
      const autoPct = document.getElementById('quota-automations-pct');
      if (autoTxt) autoTxt.innerText = `${autoQ.current || 0} / ${autoQ.limit || 0}`;
      if (autoBar) autoBar.style.width = `${autoQ.percent || 0}%`;
      if (autoPct) autoPct.innerText = `${autoQ.percent || 0}% utilizado`;

      // Créditos IA
      const aiQ = d.quotas.aiCredits || {};
      const aiTxt = document.getElementById('quota-credits-text');
      const aiBar = document.getElementById('quota-credits-bar');
      const aiPct = document.getElementById('quota-credits-pct');
      if (aiTxt) aiTxt.innerText = `${(aiQ.current || 0).toLocaleString('pt-BR')} / ${(aiQ.limit || 0).toLocaleString('pt-BR')}`;
      if (aiBar) aiBar.style.width = `${aiQ.percent || 0}%`;
      if (aiPct) aiPct.innerText = `${aiQ.percent || 0}% consumido`;
    }

    // Destaca o plano ativo e ajusta botões
    const planKeys = ['starter', 'professional', 'business', 'enterprise'];
    planKeys.forEach(pk => {
      const btn = document.getElementById(`btn-upgrade-${pk}`);
      if (btn) {
        if (d.plan.id === pk || (pk === 'enterprise' && d.plan.id === 'enterprise')) {
          btn.innerText = 'Plano Atual';
          btn.className = 'w-full mt-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg cursor-default';
          btn.onclick = null;
        } else {
          const names = { starter: 'Starter', professional: 'Professional', business: 'Business', enterprise: 'Agency Enterprise' };
          const prices = { starter: 97, professional: 197, business: 397, enterprise: 897 };
          btn.innerText = `Selecionar ${names[pk]}`;
          btn.className = 'w-full mt-5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition';
          btn.onclick = () => openPlanUpgradeModal(pk, names[pk], prices[pk]);
        }
      }
    });

    await loadWorkspaceSettings();
    if (window.lucide) lucide.createIcons();
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
    ins.innerHTML = d.insights.map(i => `<div>• ${escapeHtml(i)}</div>`).join('');
  } catch (err) {}
}

async function sendFreeformCopilotPrompt() {
  const input = document.getElementById('copilot-freeform-input');
  const prompt = input?.value?.trim();
  if (!prompt) return showToast('Digite uma mensagem ou pergunta para o Copiloto.', 'warning');

  const leadId = document.getElementById('copilot-lead-select')?.value;
  const lead = globalLeads.find(l => l.id === leadId);
  const modelPreference = document.getElementById('ai-model-selector')?.value || 'auto';
  
  const btn = document.getElementById('btn-send-freeform');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        prompt: lead ? `Contexto do Lead:\nNome: ${lead.name}\nEmpresa: ${lead.company || '-'}\nCargo: ${lead.role || '-'}\nOrçamento: ${formatBRL(lead.estimatedBudget || 0)}\n\nPergunta do Vendedor: ${prompt}` : prompt,
        taskType: 'chat',
        modelPreference
      })
    });
    const json = await res.json();
    if (json.success && json.text) {
      document.getElementById('copilot-output').value = json.text;
      currentCopilotText = json.text;
      if (document.getElementById('copilot-used-model')) document.getElementById('copilot-used-model').textContent = json.modelUsed;
      if (document.getElementById('copilot-latency')) document.getElementById('copilot-latency').textContent = `${json.latencyMs}ms${json.cached ? ' (cache)' : ''}`;
      input.value = '';
      showToast('Resposta gerada pelo AI Gateway!', 'success');
    } else {
      showToast(json.error || 'Erro ao processar resposta com IA.', 'error');
    }
  } catch (err) {
    showToast('Falha na comunicação com o Gateway de IA.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
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
    if (document.getElementById('copilot-used-model')) document.getElementById('copilot-used-model').textContent = 'claude-3-5-sonnet';
    if (document.getElementById('copilot-latency')) document.getElementById('copilot-latency').textContent = '220ms';
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
    if (document.getElementById('copilot-used-model')) document.getElementById('copilot-used-model').textContent = 'heuristic-core';
    if (document.getElementById('copilot-latency')) document.getElementById('copilot-latency').textContent = '1ms';
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
      await loadProposals();
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
        <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask('${escapeHtml(t.id)}', this.checked)" class="rounded text-blue-600">
        <span class="text-xs ${t.completed ? 'line-through text-slate-500' : 'text-slate-200'}">${escapeHtml(t.title)}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] px-2 py-0.5 rounded uppercase font-bold ${t.priority === 'urgente' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-400'}">${escapeHtml(t.priority)}</span>
        <button onclick="deleteTask('${escapeHtml(t.id)}')" title="Excluir tarefa" class="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition">
          <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
        </button>
      </div>
    `;
    container.appendChild(div);
  });
  if (window.lucide) lucide.createIcons();
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

async function deleteTask(id) {
  try {
    await fetch(`/api/tasks/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    showToast('Tarefa removida.', 'info');
    await loadTasks();
  } catch (e) {
    showToast('Erro ao remover tarefa.', 'error');
  }
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

// 17. GESTÃO DE PROPOSTAS & COBRANÇAS PIX
async function loadProposals() {
  try {
    const res = await fetch('/api/proposals', { headers: authHeaders() });
    const json = await res.json();
    globalProposals = json.data || [];
    renderProposalsTable();
  } catch (e) {
    console.error('Erro ao carregar propostas:', e);
  }
}

function renderProposalsTable() {
  const tbody = document.getElementById('proposals-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (globalProposals.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-4 text-center text-slate-500 text-xs">
          Nenhuma proposta comercial emitida até o momento. Utilize o formulário acima para gerar cobranças instantâneas PIX EMV.
        </td>
      </tr>
    `;
    return;
  }

  globalProposals.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-900/40 transition';
    const isPaid = p.status === 'paga';

    tr.innerHTML = `
      <td class="p-3">
        <div class="font-bold text-white">${escapeHtml(p.dealTitle || 'Proposta Comercial')}</div>
        <div class="text-[10px] text-slate-500 font-mono">ID: ${escapeHtml(p.id)}</div>
      </td>
      <td class="p-3">
        <div class="text-slate-200">${escapeHtml(p.customerName || 'Cliente')}</div>
        <div class="text-[10px] text-slate-400">${escapeHtml(p.customerPhone || '-')}</div>
      </td>
      <td class="p-3 font-bold text-emerald-400">
        ${formatBRL(p.amount)}
      </td>
      <td class="p-3">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${isPaid ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}">
          ${isPaid ? '✓ Paga / Faturada' : '⏳ Pendente'}
        </span>
      </td>
      <td class="p-3 text-[11px] text-slate-400">
        ${p.createdAt ? new Date(p.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
      </td>
      <td class="p-3 text-right">
        ${!isPaid ? `
          <button onclick="confirmProposalPayment('${escapeHtml(p.id)}')" class="px-2.5 py-1 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition shadow-md shadow-emerald-600/20 inline-flex items-center gap-1">
            <i data-lucide="check-circle" class="h-3.5 w-3.5"></i>
            <span>Confirmar PIX</span>
          </button>
        ` : `
          <span class="text-[11px] text-emerald-400 font-medium inline-flex items-center gap-1">
            <i data-lucide="check" class="h-3 w-3"></i> Baixa Confirmada
          </span>
        `}
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (window.lucide) lucide.createIcons();
}

async function confirmProposalPayment(proposalId) {
  try {
    const res = await fetch(`/api/proposals/${proposalId}/confirm`, {
      method: 'PATCH',
      headers: authHeaders()
    });
    const json = await res.json();
    if (res.ok) {
      showToast('🎉 Pagamento PIX Confirmado! Oportunidade faturada como GANHO e métricas atualizadas!', 'success');
      await Promise.all([
        loadProposals(),
        loadDeals(),
        loadAnalytics()
      ]);
    } else {
      showToast(json.error || 'Erro ao confirmar proposta.', 'error');
    }
  } catch (e) {
    showToast('Erro de comunicação ao confirmar recebimento.', 'error');
  }
}

// 18. GESTÃO E CONVITE DE VENDEDORES
function openNewSellerModal() {
  openModal('modal-new-seller');
}

async function submitNewSeller(e) {
  e.preventDefault();
  const name = document.getElementById('seller-name')?.value;
  const email = document.getElementById('seller-email')?.value;
  const role = document.getElementById('seller-role')?.value || 'VENDEDOR';
  const phone = document.getElementById('seller-phone')?.value || '';
  const password = document.getElementById('seller-password')?.value || 'Mudar@1234';

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, email, role, phone, password })
    });
    const json = await res.json();
    if (res.ok) {
      showToast(`Vendedor ${name} cadastrado com sucesso na equipe!`, 'success');
      closeModal('modal-new-seller');
      e.target.reset();
      await loadAnalytics();
    } else {
      showToast(json.error || 'Erro ao cadastrar vendedor.', 'error');
    }
  } catch (err) {
    showToast('Erro de comunicação ao cadastrar vendedor.', 'error');
  }
}

// 19. EXPORTAÇÃO LGPD & BACKUP DE CONTINGÊNCIA
async function exportLgpdData() {
  try {
    showToast('Gerando pacote de exportação LGPD (Art. 18)...', 'info');
    const res = await fetch('/api/lgpd/export', { headers: authHeaders() });
    const json = await res.json();
    if (json.success) {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(json.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `agentise_lgpd_export_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Exportação de dados LGPD baixada com sucesso!', 'success');
    }
  } catch (e) {
    showToast('Erro ao exportar dados LGPD.', 'error');
  }
}

async function downloadTenantBackup() {
  try {
    showToast('Gerando backup consolidado do sistema...', 'info');
    const res = await fetch('/api/backup', { headers: authHeaders() });
    const json = await res.json();
    if (json.success) {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(json.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `agentise_backup_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Backup completo baixado com sucesso!', 'success');
    } else {
      showToast(json.error || 'Erro ao gerar backup.', 'error');
    }
  } catch (e) {
    showToast('Erro ao baixar backup da empresa.', 'error');
  }
}

// 20. CONSENTIMENTO DE COOKIES & PRIVACIDADE LGPD
function checkCookieConsent() {
  const consent = localStorage.getItem('agentise_cookie_consent');
  const banner = document.getElementById('cookie-consent-banner');
  if (!consent && banner) {
    banner.classList.remove('hidden');
  }
}

function acceptCookieConsent() {
  localStorage.setItem('agentise_cookie_consent', 'accepted_' + new Date().toISOString());
  const banner = document.getElementById('cookie-consent-banner');
  if (banner) {
    banner.classList.add('hidden');
  }
  showToast('Preferências de privacidade salvas.', 'info');
}
