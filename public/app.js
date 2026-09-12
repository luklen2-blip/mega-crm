/**
 * Agentise Mega CRM - Frontend Controller (Auditado e Otimizado)
 * Arquitetura Reativa AI-First com suporte a Kanban Drag-and-Drop,
 * Copiloto Claude AI, PIX Oficial EMV, Notificações Toast e Visual Dark Glassmorphism.
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

let globalLeads = [];
let globalDeals = [];
let globalTasks = [];
let activeView = 'pipeline';
let selectedLeadId = null;
let currentCopilotText = '';

// Sistema de Notificações Toast Moderno
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

// Formatação BRL
function formatBRL(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setInterval(checkHealth, 10000);
});

async function initApp() {
  await Promise.all([
    checkHealth(),
    loadDeals(),
    loadLeads(),
    loadTasks(),
    loadAnalytics()
  ]);
  if (window.lucide) lucide.createIcons();
}

// 1. Monitoramento 24/7 de Saúde da Nuvem
async function checkHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.status === 'ok') {
      const up = document.getElementById('health-uptime');
      if (up) up.innerText = `${data.uptime_seconds}s`;
    }
  } catch (err) {
    console.error('Falha no health check:', err);
  }
}

// 2. Navegação entre Views
function switchView(viewName) {
  activeView = viewName;
  ['pipeline', 'leads', 'copilot', 'pix', 'analytics', 'tasks'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    const nav = document.getElementById(`nav-${v}`);
    if (el) el.classList.toggle('hidden', v !== viewName);
    if (nav) {
      if (v === viewName) {
        nav.className = 'nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-blue-300 bg-blue-500/15 border border-blue-500/30 transition';
      } else {
        nav.className = 'nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition';
      }
    }
  });

  if (viewName === 'analytics') loadAnalytics();
  if (window.lucide) lucide.createIcons();
}

// 3. Carregamento de Dados
async function loadDeals() {
  try {
    const res = await fetch('/api/deals');
    const json = await res.json();
    globalDeals = json.data || [];
    renderKanban();
    populateDealSelects();
    updatePipelineSummary();
  } catch (e) {
    console.error('Erro ao carregar deals:', e);
  }
}

async function loadLeads() {
  try {
    const res = await fetch('/api/leads');
    const json = await res.json();
    globalLeads = json.data || [];
    renderLeadsTable();
    populateLeadSelects();
  } catch (e) {
    console.error('Erro ao carregar leads:', e);
  }
}

async function loadTasks() {
  try {
    const res = await fetch('/api/tasks');
    const json = await res.json();
    globalTasks = json.data || [];
    renderTasks();
  } catch (e) {
    console.error('Erro ao carregar tarefas:', e);
  }
}

async function loadAnalytics() {
  try {
    const res = await fetch('/api/analytics');
    const json = await res.json();
    const d = json.data;

    document.getElementById('kpi-pipeline-val').innerText = formatBRL(d.totalPipelineValue);
    document.getElementById('kpi-won-val').innerText = formatBRL(d.wonValue);
    document.getElementById('kpi-win-rate').innerText = `${d.winRate}%`;
    document.getElementById('kpi-avg-ticket').innerText = formatBRL(d.avgTicket);

    const barsCont = document.getElementById('analytics-stages-bars');
    if (barsCont) {
      const maxCount = Math.max(...Object.values(d.stageBreakdown), 1);
      barsCont.innerHTML = Object.entries(d.stageBreakdown).map(([stg, count]) => {
        const pct = ((count / maxCount) * 100).toFixed(0);
        const stageObj = STAGES.find(s => s.id === stg) || { label: stg };
        return `
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="text-slate-300 font-semibold">${stageObj.label}</span>
              <span class="text-blue-400 font-bold">${count} deals (${pct}%)</span>
            </div>
            <div class="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-blue-600 to-indigo-500" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (e) {
    console.error('Erro ao carregar analytics:', e);
  }
}

function updatePipelineSummary() {
  const total = globalDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
  const count = globalDeals.length;
  const topVal = document.getElementById('topbar-pipeline-val');
  const countVal = document.getElementById('pipeline-deals-count');
  if (topVal) topVal.innerText = formatBRL(total);
  if (countVal) countVal.innerText = `${count} ${count === 1 ? 'oportunidade' : 'oportunidades'}`;
}

// 4. Renderização do Kanban Board
function renderKanban() {
  const board = document.getElementById('kanban-board');
  if (!board) return;

  const filter = (document.getElementById('kanban-search')?.value || '').toLowerCase();

  board.innerHTML = STAGES.map(stage => {
    const dealsInStage = globalDeals.filter(d => {
      if (d.stage !== stage.id) return false;
      if (!filter) return true;
      const title = (d.title || '').toLowerCase();
      const leadName = (d.lead?.name || '').toLowerCase();
      const company = (d.lead?.company || '').toLowerCase();
      return title.includes(filter) || leadName.includes(filter) || company.includes(filter);
    });

    const sumInStage = dealsInStage.reduce((acc, d) => acc + (Number(d.value) || 0), 0);

    return `
      <div class="kanban-column glass-panel p-3 rounded-2xl border border-slate-800/80 flex flex-col max-h-[calc(100vh-180px)]"
           ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event, '${stage.id}')">
        
        <!-- Column Header -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 shrink-0">
          <div class="flex items-center gap-2">
            <span class="h-2.5 w-2.5 rounded-full bg-${stage.color}-400"></span>
            <h3 class="text-xs font-bold text-slate-200 uppercase tracking-wider">${stage.label}</h3>
          </div>
          <span class="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
            ${dealsInStage.length}
          </span>
        </div>

        <div class="text-[11px] font-bold text-slate-400 mb-3 px-1">
          Subtotal: <span class="text-white">${formatBRL(sumInStage)}</span>
        </div>

        <!-- Cards Container -->
        <div class="space-y-3 overflow-y-auto flex-1 pr-1" id="column-${stage.id}">
          ${dealsInStage.map(renderDealCard).join('')}
          ${dealsInStage.length === 0 ? `
            <div class="py-8 text-center border border-dashed border-slate-800/80 rounded-xl text-[11px] text-slate-600">
              Nenhum negócio nesta fase
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function renderDealCard(deal) {
  const leadName = deal.lead?.name || 'Cliente';
  const company = deal.lead?.company || '';
  const phone = deal.lead?.phone || '';
  const cleanPhone = phone.replace(/\D/g, '');
  const destination = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  const whatsappUrl = `https://wa.me/${destination}?text=${encodeURIComponent(`Olá, ${leadName}! Tudo bem? Gostaria de falar sobre o projeto "${deal.title}".`)}`;

  return `
    <div class="glass-card p-3.5 rounded-xl cursor-grab active:cursor-grabbing border border-blue-500/15"
         draggable="true" ondragstart="onDragStart(event, '${deal.id}')" id="deal-${deal.id}">
      
      <!-- Top Badges -->
      <div class="flex items-center justify-between mb-2">
        <span class="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
          deal.priority === 'urgente' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
          deal.priority === 'alta' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
          'bg-blue-500/20 text-blue-300 border border-blue-500/30'
        }">${deal.priority || 'Média'}</span>

        <span class="text-xs font-bold text-emerald-400">${formatBRL(deal.value)}</span>
      </div>

      <!-- Title & Customer -->
      <h4 class="text-xs font-bold text-white mb-1 leading-snug hover:text-blue-400 transition cursor-pointer" onclick="openLead360('${deal.leadId}')">
        ${deal.title}
      </h4>
      <p class="text-[11px] text-slate-400 mb-3 flex items-center gap-1.5 truncate">
        <i data-lucide="building-2" class="h-3 w-3 text-slate-500 shrink-0"></i>
        <span>${leadName} ${company ? '· ' + company : ''}</span>
      </p>

      <!-- Action Buttons -->
      <div class="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
        <div class="flex items-center gap-1.5">
          ${phone ? `
            <a href="${whatsappUrl}" target="_blank" class="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 transition" title="Chamar no WhatsApp">
              <i data-lucide="message-circle" class="h-3.5 w-3.5"></i>
            </a>
          ` : ''}
          <button onclick="quickCopilotDeal('${deal.id}')" class="p-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 transition" title="Copiloto Claude AI">
            <i data-lucide="bot" class="h-3.5 w-3.5"></i>
          </button>
          <button onclick="quickPixDeal('${deal.id}')" class="p-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 transition" title="Gerar Proposta com PIX">
            <i data-lucide="qr-code" class="h-3.5 w-3.5"></i>
          </button>
        </div>

        <button onclick="advanceStage('${deal.id}')" class="text-[10px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-0.5">
          <span>Avançar</span>
          <i data-lucide="chevron-right" class="h-3 w-3"></i>
        </button>
      </div>
    </div>
  `;
}

// 5. Drag and Drop Handlers
let draggedDealId = null;

function onDragStart(e, dealId) {
  draggedDealId = dealId;
  e.dataTransfer.setData('text/plain', dealId);
  e.currentTarget.classList.add('dragging');
}

function onDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function onDrop(e, newStage) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!draggedDealId) return;

  const dealId = draggedDealId;
  draggedDealId = null;

  try {
    const res = await fetch(`/api/deals/${dealId}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage })
    });
    if (res.ok) {
      showToast('Estágio atualizado com sucesso!', 'success');
      await loadDeals();
      await loadTasks();
      await loadAnalytics();
    }
  } catch (err) {
    showToast('Erro ao movimentar card.', 'error');
  }
}

async function advanceStage(dealId) {
  const deal = globalDeals.find(d => d.id === dealId);
  if (!deal) return;
  const currentIdx = STAGES.findIndex(s => s.id === deal.stage);
  if (currentIdx >= 0 && currentIdx < STAGES.length - 2) {
    const nextStage = STAGES[currentIdx + 1].id;
    await fetch(`/api/deals/${dealId}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: nextStage })
    });
    showToast(`Oportunidade avançada para ${STAGES[currentIdx + 1].label}!`, 'success');
    await loadDeals();
    await loadTasks();
    await loadAnalytics();
  }
}

function filterKanban() {
  renderKanban();
}

// 6. Leads Table & Drawer 360°
function renderLeadsTable() {
  const tbody = document.getElementById('leads-table-body');
  if (!tbody) return;

  tbody.innerHTML = globalLeads.map(lead => {
    const phone = lead.phone || '-';
    const cleanPhone = phone.replace(/\D/g, '');
    const destination = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const whatsappUrl = phone ? `https://wa.me/${destination}` : '#';

    return `
      <tr class="hover:bg-slate-800/40 transition">
        <td class="px-4 py-3 font-semibold text-white cursor-pointer" onclick="openLead360('${lead.id}')">
          <div>${lead.name}</div>
          <span class="text-[10px] text-slate-400 font-normal">${lead.role || 'Cargo não informado'}</span>
        </td>
        <td class="px-4 py-3 text-slate-300 font-medium">${lead.company || '-'}</td>
        <td class="px-4 py-3 text-slate-400">
          <div>${lead.email || '-'}</div>
          <div class="text-[10px] text-slate-500">${phone}</div>
        </td>
        <td class="px-4 py-3">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            ${lead.estimatedBudget ? 'R$ ' + Number(lead.estimatedBudget).toLocaleString('pt-BR') : 'A Qualificar'}
          </span>
        </td>
        <td class="px-4 py-3">
          <div class="flex flex-wrap gap-1">
            ${(lead.tags || []).map(t => `<span class="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-400">${t}</span>`).join('')}
          </div>
        </td>
        <td class="px-4 py-3 text-right">
          <div class="flex items-center justify-end gap-1.5">
            ${phone ? `
              <a href="${whatsappUrl}" target="_blank" class="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400" title="Conversar no WhatsApp">
                <i data-lucide="message-circle" class="h-3.5 w-3.5"></i>
              </a>
            ` : ''}
            <button onclick="openLead360('${lead.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold">
              Ver 360°
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

async function openLead360(leadId) {
  selectedLeadId = leadId;
  const drawer = document.getElementById('drawer-lead360');
  const content = document.getElementById('drawer-lead-content');
  if (!drawer || !content) return;

  drawer.classList.remove('translate-x-full');
  content.innerHTML = '<div class="text-center py-10 text-slate-400">Carregando visão 360°...</div>';

  try {
    const res = await fetch(`/api/leads/${leadId}`);
    const json = await res.json();
    const lead = json.data;

    content.innerHTML = `
      <div class="space-y-4">
        <!-- Lead Header -->
        <div class="p-4 rounded-xl bg-slate-900 border border-blue-500/20 space-y-1">
          <h4 class="text-sm font-bold text-white">${lead.name}</h4>
          <p class="text-blue-400">${lead.role || ''} ${lead.company ? 'em ' + lead.company : ''}</p>
          <div class="text-[11px] text-slate-400 pt-1">
            <span>Email: ${lead.email || '-'}</span> · <span>WhatsApp: ${lead.phone || '-'}</span>
          </div>
        </div>

        <!-- Notes -->
        <div class="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notas & Dores Relatadas</span>
          <p class="text-slate-300 leading-relaxed">${lead.notes || 'Nenhuma observação registrada.'}</p>
        </div>

        <!-- Deals -->
        <div class="space-y-2">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Oportunidades (${(lead.deals || []).length})</span>
          ${(lead.deals || []).map(d => `
            <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <div class="font-bold text-white">${d.title}</div>
                <div class="text-[10px] text-blue-400 capitalize">Fase: ${d.stage}</div>
              </div>
              <div class="text-right">
                <div class="font-bold text-emerald-400">${formatBRL(d.value)}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Timeline Activities -->
        <div class="space-y-2">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Histórico de Atividades</span>
          <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
            ${(lead.activities || []).map(a => `
              <div class="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px]">
                <div class="font-semibold text-slate-200">${a.title}</div>
                <div class="text-slate-400">${a.description}</div>
                <div class="text-[9px] text-slate-500 mt-1">${new Date(a.timestamp).toLocaleString('pt-BR')}</div>
              </div>
            `).join('')}
            ${(lead.activities || []).length === 0 ? '<div class="text-slate-500 text-center py-2">Sem histórico recente.</div>' : ''}
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  } catch (e) {
    content.innerHTML = '<div class="text-rose-400">Falha ao carregar dados do lead.</div>';
  }
}

function closeLeadDrawer() {
  const drawer = document.getElementById('drawer-lead360');
  if (drawer) drawer.classList.add('translate-x-full');
}

async function anonymizeCurrentLead() {
  if (!selectedLeadId) return;
  if (!confirm('Atenção: Esta ação efetuará a anonimização permanente dos dados deste lead em conformidade com o Art. 18 da LGPD. Deseja prosseguir?')) return;

  try {
    const res = await fetch('/api/lgpd/anonymize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: selectedLeadId })
    });
    if (res.ok) {
      showToast('Dados anonimizados com sucesso.', 'success');
      closeLeadDrawer();
      await loadLeads();
      await loadDeals();
    }
  } catch (e) {
    showToast('Erro ao processar requisição LGPD.', 'error');
  }
}

// 7. Claude AI Copilot Hub
function populateDealSelects() {
  const select = document.getElementById('copilot-deal-select');
  const pixSelect = document.getElementById('pix-form-deal');
  const taskDealSelect = document.getElementById('task-new-deal');
  if (!select) return;

  const options = '<option value="">-- Selecione uma oportunidade --</option>' +
    globalDeals.map(d => `<option value="${d.id}">${d.title} (${d.lead?.name || 'Cliente'} - ${formatBRL(d.value)})</option>`).join('');

  select.innerHTML = options;
  if (pixSelect) pixSelect.innerHTML = '<option value="">-- Cobrança Avulsa --</option>' +
    globalDeals.map(d => `<option value="${d.id}">${d.title} - ${formatBRL(d.value)}</option>`).join('');

  if (taskDealSelect) taskDealSelect.innerHTML = '<option value="">-- Sem vínculo --</option>' +
    globalDeals.map(d => `<option value="${d.id}">${d.title}</option>`).join('');
}

function populateLeadSelects() {
  const select = document.getElementById('deal-new-lead');
  if (!select) return;
  select.innerHTML = globalLeads.map(l => `<option value="${l.id}">${l.name} (${l.company || 'Empresa'})</option>`).join('');
}

function loadCopilotContext() {
  const dealId = document.getElementById('copilot-deal-select')?.value;
  const card = document.getElementById('copilot-context-card');
  if (!card) return;

  if (!dealId) {
    card.classList.add('hidden');
    return;
  }

  const deal = globalDeals.find(d => d.id === dealId);
  if (!deal) return;

  card.classList.remove('hidden');
  card.innerHTML = `
    <div class="font-bold text-white">${deal.title}</div>
    <div class="text-blue-400">Cliente: ${deal.lead?.name || 'Cliente'} (${deal.lead?.role || ''})</div>
    <div class="text-slate-400">Valor: <strong class="text-emerald-400">${formatBRL(deal.value)}</strong> · Fase: <span class="capitalize">${deal.stage}</span></div>
    <div class="text-[11px] text-slate-400 italic">"${deal.lead?.notes || 'Sem observações'}"</div>
  `;
}

function quickCopilotDeal(dealId) {
  switchView('copilot');
  const select = document.getElementById('copilot-deal-select');
  if (select) {
    select.value = dealId;
    loadCopilotContext();
    runAiPitch('primeiro_contato');
  }
}

async function runAiBant() {
  const dealId = document.getElementById('copilot-deal-select')?.value;
  if (!dealId) return showToast('Selecione uma oportunidade primeiro.', 'warning');

  const deal = globalDeals.find(d => d.id === dealId);
  const lead = deal?.lead || {};

  setCopilotLoading('Calculando Score BANT da oportunidade...');

  try {
    const res = await fetch('/api/copilot/bant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: lead.id, dealId })
    });
    const json = await res.json();
    const data = json.data;

    currentCopilotText = `Avaliação BANT - ${lead.name}: Score Total: ${data.totalScore}/100 (${data.classification}). Insights: ${data.insights.join('; ')}`;

    renderCopilotResult(`
      <div class="space-y-4">
        <div class="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-blue-500/20">
          <div>
            <span class="text-[10px] uppercase font-bold tracking-wider text-slate-400">Classificação Comercial</span>
            <h3 class="text-base font-extrabold text-white mt-0.5">${data.classification}</h3>
          </div>
          <div class="text-2xl font-black text-blue-400">${data.totalScore} <span class="text-xs text-slate-500 font-normal">/ 100</span></div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div class="p-3 rounded-lg bg-slate-900 text-center border border-slate-800">
            <span class="text-[10px] text-slate-400 uppercase font-bold">Budget</span>
            <div class="text-base font-black text-emerald-400 mt-1">${data.breakdown.budget}/25</div>
          </div>
          <div class="p-3 rounded-lg bg-slate-900 text-center border border-slate-800">
            <span class="text-[10px] text-slate-400 uppercase font-bold">Authority</span>
            <div class="text-base font-black text-blue-400 mt-1">${data.breakdown.authority}/25</div>
          </div>
          <div class="p-3 rounded-lg bg-slate-900 text-center border border-slate-800">
            <span class="text-[10px] text-slate-400 uppercase font-bold">Need</span>
            <div class="text-base font-black text-purple-400 mt-1">${data.breakdown.need}/25</div>
          </div>
          <div class="p-3 rounded-lg bg-slate-900 text-center border border-slate-800">
            <span class="text-[10px] text-slate-400 uppercase font-bold">Timing</span>
            <div class="text-base font-black text-amber-400 mt-1">${data.breakdown.timing}/25</div>
          </div>
        </div>

        <div class="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <h4 class="font-bold text-slate-200 flex items-center gap-2">
            <i data-lucide="lightbulb" class="h-4 w-4 text-amber-400"></i>
            <span>Recomendações Estratégicas da IA:</span>
          </h4>
          <ul class="space-y-1.5 text-slate-300">
            ${data.insights.map(i => `<li class="flex items-start gap-2"><span class="text-blue-400">▸</span><span>${i}</span></li>`).join('')}
          </ul>
        </div>
      </div>
    `, null);
  } catch (e) {
    renderCopilotResult('<div class="text-rose-400">Erro ao executar análise BANT.</div>');
  }
}

async function runAiPitch(objective) {
  const dealId = document.getElementById('copilot-deal-select')?.value;
  if (!dealId) return showToast('Selecione uma oportunidade primeiro.', 'warning');

  const deal = globalDeals.find(d => d.id === dealId);
  const lead = deal?.lead || {};

  setCopilotLoading('Gerando abordagem comercial hiper-personalizada...');

  try {
    const res = await fetch('/api/copilot/pitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: lead.id, dealId, objective })
    });
    const json = await res.json();
    const data = json.data;

    currentCopilotText = data.text;

    renderCopilotResult(`
      <div class="space-y-4">
        <div class="p-3 rounded-xl bg-slate-900 border border-blue-500/20 flex items-center justify-between">
          <div>
            <span class="text-[10px] text-slate-400 uppercase font-bold">${data.type}</span>
            <div class="font-bold text-white text-xs mt-0.5">${data.subject}</div>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Pronto para WhatsApp</span>
        </div>

        <div class="p-4 rounded-xl bg-slate-900/90 border border-slate-800 whitespace-pre-line text-slate-200 text-xs font-mono leading-relaxed select-all">
          ${data.text}
        </div>
      </div>
    `, data.whatsappUrl);
  } catch (e) {
    renderCopilotResult('<div class="text-rose-400">Erro ao gerar pitch de vendas.</div>');
  }
}

async function runAiObjection(type) {
  const dealId = document.getElementById('copilot-deal-select')?.value;
  if (!dealId) return showToast('Selecione uma oportunidade primeiro.', 'warning');

  const deal = globalDeals.find(d => d.id === dealId);
  const lead = deal?.lead || {};

  setCopilotLoading('Desenvolvendo contorno tático de objeção...');

  try {
    const res = await fetch('/api/copilot/objection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: lead.id, type })
    });
    const json = await res.json();
    const data = json.data;

    currentCopilotText = data.respostaSugerida;

    renderCopilotResult(`
      <div class="space-y-4">
        <div class="p-3.5 rounded-xl bg-slate-900 border border-amber-500/20">
          <h4 class="font-bold text-amber-400">${data.titulo}</h4>
          <p class="text-slate-400 text-[11px] mt-1">Diagnóstico: ${data.analise}</p>
        </div>

        <div class="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <span class="text-[10px] uppercase font-bold text-slate-400">Resposta Recomendada ao Cliente:</span>
          <p class="text-slate-200 text-xs italic leading-relaxed">"${data.respostaSugerida}"</p>
        </div>

        <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs">
          <i data-lucide="check-circle" class="h-4 w-4 text-emerald-400"></i>
          <span class="text-slate-300">Próximo Passo Tático: <strong>${data.proximoPasso}</strong></span>
        </div>
      </div>
    `, null);
  } catch (e) {
    renderCopilotResult('<div class="text-rose-400">Erro ao processar contorno de objeção.</div>');
  }
}

function setCopilotLoading(msg) {
  const out = document.getElementById('copilot-output');
  const badge = document.getElementById('copilot-status-badge');
  const bar = document.getElementById('copilot-actions-bar');
  if (out) out.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-center py-12 space-y-3"><div class="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div><p class="text-xs text-blue-300 font-semibold">${msg}</p></div>`;
  if (badge) { badge.innerText = 'Processando...'; badge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 animate-pulse'; }
  if (bar) bar.classList.add('hidden');
}

function renderCopilotResult(html, whatsappUrl) {
  const out = document.getElementById('copilot-output');
  const badge = document.getElementById('copilot-status-badge');
  const bar = document.getElementById('copilot-actions-bar');
  const waBtn = document.getElementById('copilot-whatsapp-btn');

  if (out) out.innerHTML = html;
  if (badge) { badge.innerText = 'Concluído'; badge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400'; }
  if (bar) bar.classList.remove('hidden');

  if (waBtn) {
    if (whatsappUrl) {
      waBtn.href = whatsappUrl;
      waBtn.classList.remove('hidden');
    } else {
      waBtn.classList.add('hidden');
    }
  }

  if (window.lucide) lucide.createIcons();
}

function copyCopilotText() {
  if (!currentCopilotText) return;
  navigator.clipboard.writeText(currentCopilotText);
  showToast('Texto copiado com sucesso!', 'success');
}

// 8. Financeiro & PIX Oficial EMV
function quickPixDeal(dealId) {
  switchView('pix');
  const dealSelect = document.getElementById('pix-form-deal');
  if (dealSelect) {
    dealSelect.value = dealId;
    autofillPixDeal();
    generatePixProposal();
  }
}

function autofillPixDeal() {
  const dealId = document.getElementById('pix-form-deal')?.value;
  if (!dealId) return;

  const deal = globalDeals.find(d => d.id === dealId);
  if (!deal) return;

  document.getElementById('pix-form-name').value = deal.lead?.name || '';
  document.getElementById('pix-form-phone').value = deal.lead?.phone || '';
  document.getElementById('pix-form-amount').value = deal.value || 0;
  document.getElementById('pix-form-title').value = deal.title || '';
}

async function generatePixProposal() {
  const dealId = document.getElementById('pix-form-deal')?.value || null;
  const name = document.getElementById('pix-form-name')?.value || 'Cliente';
  const phone = document.getElementById('pix-form-phone')?.value || '';
  const amount = Number(document.getElementById('pix-form-amount')?.value || 0);
  const title = document.getElementById('pix-form-title')?.value || 'Proposta Comercial';

  if (!amount || amount <= 0) return showToast('Informe um valor válido para a proposta PIX.', 'warning');

  const resContainer = document.getElementById('pix-result-container');
  resContainer.innerHTML = '<div class="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div>';

  try {
    const res = await fetch('/api/pix/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dealId,
        customerName: name,
        customerPhone: phone,
        amount,
        dealTitle: title
      })
    });
    const json = await res.json();
    const d = json.data;

    resContainer.innerHTML = `
      <div class="w-full space-y-4">
        <div class="text-center">
          <span class="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Checkout PIX Banco Central</span>
          <h3 class="text-base font-black text-white mt-0.5">${title}</h3>
          <div class="text-xl font-black text-emerald-400 mt-1">${formatBRL(amount)}</div>
        </div>

        <div class="bg-white p-3 rounded-2xl inline-block shadow-lg mx-auto">
          <img src="${d.qrCodeUrl}" alt="QR Code PIX" class="h-44 w-44 rounded-lg object-contain">
        </div>

        <div class="space-y-1 text-left">
          <span class="text-[10px] font-bold text-slate-400">Código PIX Copia-e-Cola:</span>
          <div class="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all">
            ${d.payload}
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-2 pt-2">
          <button onclick="copyPixCode('${d.payload}')" class="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition">
            <i data-lucide="copy" class="h-3.5 w-3.5"></i>
            <span>Copiar Chave PIX</span>
          </button>
          ${d.whatsappUrl ? `
            <a href="${d.whatsappUrl}" target="_blank" class="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 transition">
              <i data-lucide="send" class="h-3.5 w-3.5"></i>
              <span>Enviar no WhatsApp</span>
            </a>
          ` : ''}
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    showToast('Proposta PIX gerada com sucesso!', 'success');
  } catch (e) {
    resContainer.innerHTML = '<div class="text-rose-400">Falha ao emitir PIX.</div>';
  }
}

function copyPixCode(code) {
  navigator.clipboard.writeText(code);
  showToast('Código PIX Copia-e-Cola copiado!', 'success');
}

// 9. Tarefas e Agenda
function renderTasks() {
  const container = document.getElementById('tasks-list-container');
  if (!container) return;

  if (globalTasks.length === 0) {
    container.innerHTML = '<div class="text-center py-8 text-slate-500 text-xs">Nenhuma tarefa pendente.</div>';
    return;
  }

  container.innerHTML = globalTasks.map(t => `
    <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 text-xs">
      <div class="flex items-center gap-3 flex-1">
        <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTask('${t.id}', this.checked)" class="h-4 w-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500 cursor-pointer">
        <div>
          <span class="${t.completed ? 'line-through text-slate-500' : 'text-slate-200 font-medium'}">${t.title}</span>
          ${t.deadline ? `<div class="text-[10px] text-slate-500 mt-0.5">Prazo: ${new Date(t.deadline).toLocaleString('pt-BR')}</div>` : ''}
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-[10px] px-2 py-0.5 rounded-full ${
          t.priority === 'urgente' ? 'bg-rose-500/20 text-rose-300' :
          t.priority === 'alta' ? 'bg-amber-500/20 text-amber-300' :
          'bg-slate-800 text-slate-400'
        }">${t.priority}</span>
        <button onclick="deleteTask('${t.id}')" class="text-slate-500 hover:text-rose-400 transition p-1"><i data-lucide="trash" class="h-3.5 w-3.5"></i></button>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

async function toggleTask(id, completed) {
  await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed })
  });
  showToast(completed ? 'Tarefa marcada como concluída.' : 'Tarefa reaberta.', 'info');
  await loadTasks();
}

async function deleteTask(id) {
  await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  showToast('Tarefa removida.', 'info');
  await loadTasks();
}

// 10. Modais de Criação e Configurações
function openNewDealModal() {
  populateLeadSelects();
  const m = document.getElementById('modal-deal');
  if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
}

function openNewLeadModal() {
  const m = document.getElementById('modal-lead');
  if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
}

function openNewTaskModal() {
  populateDealSelects();
  const m = document.getElementById('modal-task');
  if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
}

async function openSettingsModal() {
  const m = document.getElementById('modal-settings');
  if (!m) return;

  try {
    const res = await fetch('/api/settings');
    const json = await res.json();
    const s = json.data;

    document.getElementById('setting-company').value = s.companyName || '';
    document.getElementById('setting-pix-key').value = s.pixKey || '';
    document.getElementById('setting-pix-name').value = s.pixName || '';
    document.getElementById('setting-pix-city').value = s.pixCity || '';
    document.getElementById('setting-api-key').value = s.hasApiKey ? '••••••••••••••••' : '';
  } catch (e) {}

  m.classList.remove('hidden');
  m.classList.add('flex');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
}

async function submitNewDeal() {
  const title = document.getElementById('deal-new-title')?.value;
  const leadId = document.getElementById('deal-new-lead')?.value;
  const value = document.getElementById('deal-new-value')?.value;
  const stage = document.getElementById('deal-new-stage')?.value;
  const priority = document.getElementById('deal-new-priority')?.value;

  if (!title || !leadId) return showToast('Preencha título e selecione um lead.', 'warning');

  const res = await fetch('/api/deals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, leadId, value, stage, priority })
  });

  if (res.ok) {
    closeModal('modal-deal');
    showToast('Oportunidade criada com sucesso!', 'success');
    await loadDeals();
    await loadTasks();
    await loadAnalytics();
  }
}

async function submitNewLead() {
  const name = document.getElementById('lead-new-name')?.value;
  const company = document.getElementById('lead-new-company')?.value;
  const role = document.getElementById('lead-new-role')?.value;
  const phone = document.getElementById('lead-new-phone')?.value;
  const email = document.getElementById('lead-new-email')?.value;
  const notes = document.getElementById('lead-new-notes')?.value;

  if (!name) return showToast('Informe o nome do lead.', 'warning');

  const res = await fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, company, role, phone, email, notes, tags: ['Novo Lead'] })
  });

  if (res.ok) {
    closeModal('modal-lead');
    showToast('Lead cadastrado com sucesso!', 'success');
    await loadLeads();
  }
}

async function submitNewTask() {
  const title = document.getElementById('task-new-title')?.value;
  const dealId = document.getElementById('task-new-deal')?.value || null;
  const deadline = document.getElementById('task-new-deadline')?.value || null;
  const priority = document.getElementById('task-new-priority')?.value || 'media';

  if (!title) return showToast('Informe a descrição da tarefa.', 'warning');

  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, dealId, deadline, priority, completed: false })
  });

  if (res.ok) {
    closeModal('modal-task');
    showToast('Tarefa registrada com sucesso!', 'success');
    await loadTasks();
    document.getElementById('task-new-title').value = '';
  }
}

async function saveSettings() {
  const companyName = document.getElementById('setting-company')?.value;
  const pixKey = document.getElementById('setting-pix-key')?.value;
  const pixName = document.getElementById('setting-pix-name')?.value;
  const pixCity = document.getElementById('setting-pix-city')?.value;
  const apiKey = document.getElementById('setting-api-key')?.value;

  const payload = { companyName, pixKey, pixName, pixCity };
  if (apiKey && !apiKey.includes('••••')) {
    payload.apiKey = apiKey;
  }

  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    closeModal('modal-settings');
    showToast('Configurações salvas com sucesso!', 'success');
  }
}

function refreshData() {
  initApp();
  showToast('Dados atualizados com sucesso.', 'info');
}

function dismissLgpd() {
  const b = document.getElementById('lgpd-banner');
  if (b) b.remove();
}
