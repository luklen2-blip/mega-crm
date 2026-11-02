const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, '..', 'public', 'index.html');
const appJsPath = path.join(__dirname, '..', 'public', 'app.js');

let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
let appJs = fs.readFileSync(appJsPath, 'utf8');

// 1. Inserir botão "Disparador em Lote (25/dia)" no cabeçalho de Leads
const leadsBtnTarget = `<button onclick="openImportLeadsModal()" class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 hover:border-emerald-500/40 transition shadow-sm" title="Importar Leads via Planilha CSV">
              <i data-lucide="file-spreadsheet" class="h-4 w-4"></i>
              <span>Importar CSV</span>
            </button>`;

const newDispatcherBtn = `<button onclick="openWhatsAppDispatcherModal()" class="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-600/20" title="Disparador Inteligente em Lotes (25 oficinas com 60s de intervalo)">
              <i data-lucide="send" class="h-4 w-4"></i>
              <span>Disparador em Lote (25/dia)</span>
            </button>
            ${leadsBtnTarget}`;

if (indexHtml.includes(leadsBtnTarget) && !indexHtml.includes('openWhatsAppDispatcherModal()')) {
  indexHtml = indexHtml.replace(leadsBtnTarget, newDispatcherBtn);
  console.log('✅ Botão Disparador inserido no cabeçalho de Leads');
} else {
  console.log('ℹ️ Botão Disparador já presente ou alvo modificado.');
}

// 2. Inserir modal-whatsapp-dispatcher antes do modal-new-lead
const modalTarget = '  <!-- MODAL: NOVO LEAD -->';
const modalHtml = `  <!-- MODAL: DISPARADOR WHATSAPP EM LOTES (ANTI-BAN) -->
  <div id="modal-whatsapp-dispatcher" class="fixed inset-0 z-50 modal-backdrop hidden flex items-center justify-center p-3 sm:p-4">
    <div class="glass-panel p-5 sm:p-6 rounded-3xl max-w-2xl w-full border border-emerald-500/30 space-y-4 bg-slate-950 text-white shadow-2xl overflow-y-auto max-h-[92vh]">
      <!-- Cabeçalho -->
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <i data-lucide="message-circle" class="h-6 w-6"></i>
          </div>
          <div>
            <h3 class="text-base font-black text-white flex items-center gap-2">
              <span>Disparador Cadenciado WhatsApp</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Anti-Ban 60s</span>
            </h3>
            <p class="text-xs text-slate-400">Envio para 25 oficinas hoje e 25 amanhã com intervalo seguro de 1 minuto.</p>
          </div>
        </div>
        <button onclick="closeModal('modal-whatsapp-dispatcher')" class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-900 transition">
          <i data-lucide="x" class="h-5 w-5"></i>
        </button>
      </div>

      <!-- Configuração de Lote (Quando Inativo) -->
      <div id="dispatcher-config-view" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- Card Lote 1 (Hoje) -->
          <label class="relative flex flex-col p-4 rounded-2xl border-2 border-emerald-500/50 bg-emerald-950/20 hover:bg-emerald-950/30 cursor-pointer transition">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <i data-lucide="calendar" class="h-3.5 w-3.5"></i> Lote 1 (Hoje)
              </span>
              <input type="radio" name="dispatcher-batch" value="1" checked class="text-emerald-500 focus:ring-emerald-500">
            </div>
            <div class="text-sm font-bold text-white">25 Primeiras Oficinas</div>
            <p class="text-[11px] text-slate-400 mt-1">Oficinas 1 a 25: Bangu, Senador Vasconcelos, Santa Cruz, Santíssimo e Campo Grande.</p>
            <div class="mt-3 flex items-center gap-1.5 text-[10px] text-emerald-300 font-semibold">
              <i data-lucide="clock" class="h-3 w-3"></i> ~25 minutos de execução (1 a cada 60s)
            </div>
          </label>

          <!-- Card Lote 2 (Amanhã) -->
          <label class="relative flex flex-col p-4 rounded-2xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 hover:border-blue-500/50 cursor-pointer transition">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-black text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <i data-lucide="calendar-check" class="h-3.5 w-3.5"></i> Lote 2 (Amanhã)
              </span>
              <input type="radio" name="dispatcher-batch" value="2" class="text-blue-500 focus:ring-blue-500">
            </div>
            <div class="text-sm font-bold text-white">25 Oficinas Restantes</div>
            <p class="text-[11px] text-slate-400 mt-1">Oficinas 26 a 50: Santa Cruz, Realengo, Paciência, Bangu e Campo Grande.</p>
            <div class="mt-3 flex items-center gap-1.5 text-[10px] text-blue-300 font-semibold">
              <i data-lucide="clock" class="h-3 w-3"></i> Agendado para o dia seguinte
            </div>
          </label>
        </div>

        <!-- Intervalo e Parâmetros -->
        <div class="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <i data-lucide="timer" class="h-3.5 w-3.5 text-amber-400"></i>
              <span>Intervalo entre Mensagens:</span>
            </label>
            <span class="text-xs font-bold text-amber-400">60 segundos (1 minuto)</span>
          </div>
          <p class="text-[11px] text-slate-400 leading-relaxed">
            O intervalo de 60 segundos simula comportamento humano real no WhatsApp, protegendo o seu número contra bloqueios automáticos do algoritmo da Meta.
          </p>
        </div>

        <!-- Mensagem Comercial Pré-configurada -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <i data-lucide="edit-3" class="h-3.5 w-3.5 text-blue-400"></i>
              <span>Texto da Mensagem Comercial:</span>
            </label>
            <span class="text-[10px] text-slate-500">Usa a tag {nome} para o nome da oficina</span>
          </div>
          <textarea id="dispatcher-message-text" rows="3" class="w-full p-3 text-xs rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono resize-none">Olá, tudo bem? Falo com o responsável pela {nome}? Me chamo Luciano da Silva. Vi que vocês são referência em serviços automotivos na Zona Oeste e gostaria de apresentar nossa solução para acelerar o atendimento e orçamentos via WhatsApp.</textarea>
        </div>

        <!-- Botão Iniciar -->
        <div class="pt-2 flex items-center justify-end gap-2">
          <button type="button" onclick="closeModal('modal-whatsapp-dispatcher')" class="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 transition text-xs font-semibold">Fechar</button>
          <button type="button" onclick="startWhatsAppBatch()" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black transition flex items-center gap-2 shadow-lg shadow-emerald-600/30 text-xs">
            <i data-lucide="play" class="h-4 w-4"></i>
            <span>Iniciar Disparo dos 25 Contatos</span>
          </button>
        </div>
      </div>

      <!-- Painel de Execução em Tempo Real (Quando Ativo) -->
      <div id="dispatcher-running-view" class="hidden space-y-4">
        <!-- Card do Lead Atual -->
        <div class="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-900/80 border border-emerald-500/40 space-y-3">
          <div class="flex items-center justify-between">
            <span id="dispatcher-progress-label" class="text-xs font-black text-emerald-400 uppercase tracking-wider">Oficina 1 de 25</span>
            <span id="dispatcher-status-badge" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 animate-pulse">Disparo em Andamento</span>
          </div>
          
          <div class="space-y-1">
            <div id="dispatcher-current-name" class="text-base font-black text-white">Carregando...</div>
            <div id="dispatcher-current-info" class="text-xs text-slate-300">WhatsApp: ...</div>
          </div>

          <!-- Barra de Progresso do Lote -->
          <div class="space-y-1 pt-1">
            <div class="flex justify-between text-[10px] text-slate-400">
              <span>Progresso do Lote</span>
              <span id="dispatcher-progress-pct">0%</span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div id="dispatcher-progress-bar" class="h-full bg-emerald-500 transition-all duration-300" style="width: 0%"></div>
            </div>
          </div>
        </div>

        <!-- Cronômetro Regressivo de 60s -->
        <div class="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col items-center justify-center space-y-2">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
            <i data-lucide="hourglass" class="h-3.5 w-3.5 text-amber-400"></i>
            <span id="dispatcher-timer-label">Aguardando intervalo anti-ban para a próxima oficina</span>
          </div>
          <div id="dispatcher-timer-display" class="text-4xl font-black text-amber-400 font-mono tracking-tight">00:59</div>
          <p class="text-[10px] text-slate-500 text-center max-w-sm">
            A aba da oficina atual já foi chamada no seu WhatsApp. Ao zerar o contador, a próxima oficina será aberta automaticamente.
          </p>
        </div>

        <!-- Botões de Controle em Tempo Real -->
        <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
          <button type="button" onclick="stopWhatsAppBatch()" class="px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition flex items-center gap-1">
            <i data-lucide="square" class="h-3.5 w-3.5"></i>
            <span>Parar / Concluir</span>
          </button>
          
          <div class="flex items-center gap-2">
            <button type="button" id="btn-dispatcher-pause" onclick="togglePauseWhatsAppBatch()" class="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition flex items-center gap-1">
              <i data-lucide="pause" class="h-3.5 w-3.5"></i>
              <span id="btn-dispatcher-pause-text">Pausar</span>
            </button>
            <button type="button" onclick="skipWhatsAppBatchItem()" class="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-md shadow-emerald-600/20">
              <i data-lucide="fast-forward" class="h-3.5 w-3.5"></i>
              <span>Abrir Próxima Agora</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

${modalTarget}`;

if (indexHtml.includes(modalTarget) && !indexHtml.includes('id="modal-whatsapp-dispatcher"')) {
  indexHtml = indexHtml.replace(modalTarget, modalHtml);
  console.log('✅ modal-whatsapp-dispatcher inserido no HTML');
} else {
  console.log('ℹ️ modal-whatsapp-dispatcher já presente no HTML');
}

fs.writeFileSync(indexHtmlPath, indexHtml, 'utf8');

// 3. Adicionar controlador JavaScript no app.js
const dispatcherJs = `
// ========================================================
// DISPARADOR CADENCIADO WHATSAPP EM LOTES (ANTI-BAN 60S)
// ========================================================
let dispatcherActive = false;
let dispatcherPaused = false;
let dispatcherTimer = null;
let dispatcherSecondsRemaining = 60;
let dispatcherBatchIndex = 0;
let dispatcherCurrentBatch = [];
let dispatcherBatchNumber = 1;

function playNotificationChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Silencioso se bloqueado pelo navegador
  }
}

function openWhatsAppDispatcherModal() {
  // Reset de visual
  const configView = document.getElementById('dispatcher-config-view');
  const runningView = document.getElementById('dispatcher-running-view');
  if (configView) configView.classList.remove('hidden');
  if (runningView) runningView.classList.add('hidden');
  openModal('modal-whatsapp-dispatcher');
  if (window.lucide) lucide.createIcons();
}

function startWhatsAppBatch() {
  // Carrega leads da base ordenados
  const realOficinas = globalLeads.filter(l => 
    l.source === 'Google Maps Oficinas' || (Array.isArray(l.tags) && l.tags.includes('Zona Oeste RJ'))
  );

  const leadsPool = realOficinas.length > 0 ? realOficinas : globalLeads;
  if (leadsPool.length === 0) {
    return showToast('Nenhum lead encontrado para disparo.', 'warning');
  }

  // Verifica o lote selecionado
  const batchRadios = document.getElementsByName('dispatcher-batch');
  let selectedBatch = '1';
  for (const r of batchRadios) {
    if (r.checked) { selectedBatch = r.value; break; }
  }

  dispatcherBatchNumber = parseInt(selectedBatch, 10);
  if (dispatcherBatchNumber === 1) {
    dispatcherCurrentBatch = leadsPool.slice(0, 25);
  } else {
    dispatcherCurrentBatch = leadsPool.slice(25, 50);
  }

  if (dispatcherCurrentBatch.length === 0) {
    return showToast('Nenhum lead disponível no lote selecionado.', 'warning');
  }

  dispatcherActive = true;
  dispatcherPaused = false;
  dispatcherBatchIndex = 0;

  const configView = document.getElementById('dispatcher-config-view');
  const runningView = document.getElementById('dispatcher-running-view');
  if (configView) configView.classList.add('hidden');
  if (runningView) runningView.classList.remove('hidden');

  processNextDispatcherItem();
}

function processNextDispatcherItem() {
  if (!dispatcherActive) return;

  if (dispatcherBatchIndex >= dispatcherCurrentBatch.length) {
    finishWhatsAppBatch();
    return;
  }

  const lead = dispatcherCurrentBatch[dispatcherBatchIndex];
  const tpl = document.getElementById('dispatcher-message-text')?.value || 
    'Olá, tudo bem? Falo com o responsável pela {nome}? Me chamo Luciano da Silva. Vi que vocês são referência em serviços automotivos na Zona Oeste e gostaria de apresentar nossa solução para acelerar o atendimento e orçamentos via WhatsApp.';

  const cleanPhone = normalizeWhatsAppPhone(lead.phone);
  const msgText = tpl.replace(/{nome}/g, lead.name);

  // Atualiza painel visual
  const labelEl = document.getElementById('dispatcher-progress-label');
  const nameEl = document.getElementById('dispatcher-current-name');
  const infoEl = document.getElementById('dispatcher-current-info');
  const pctEl = document.getElementById('dispatcher-progress-pct');
  const barEl = document.getElementById('dispatcher-progress-bar');

  const currentNum = dispatcherBatchIndex + 1;
  const total = dispatcherCurrentBatch.length;
  const pct = Math.round((currentNum / total) * 100);

  if (labelEl) labelEl.textContent = \`Oficina \${currentNum} de \${total} (Lote \${dispatcherBatchNumber})\`;
  if (nameEl) nameEl.textContent = lead.name;
  if (infoEl) infoEl.textContent = \`WhatsApp: \${cleanPhone} · \${lead.notes ? lead.notes.split('|')[0].trim() : 'Zona Oeste RJ'}\`;
  if (pctEl) pctEl.textContent = \`\${pct}%\`;
  if (barEl) barEl.style.width = \`\${pct}%\`;

  // Toca som de notificação
  playNotificationChime();

  // Abre conversa no WhatsApp
  if (cleanPhone) {
    const waUrl = \`https://wa.me/\${cleanPhone}?text=\${encodeURIComponent(msgText)}\`;
    window.open(waUrl, '_blank');
  }

  // Registra atividade no CRM
  fetch(\`/api/leads/\${lead.id}/activities\`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      type: 'WHATSAPP',
      title: \`Disparo WhatsApp (Lote \${dispatcherBatchNumber})\`,
      description: \`Mensagem comercial enviada para \${lead.name} com intervalo de 60s.\`
    })
  }).catch(() => {});

  // Se for a última, finaliza após breve intervalo
  if (dispatcherBatchIndex === dispatcherCurrentBatch.length - 1) {
    setTimeout(() => {
      finishWhatsAppBatch();
    }, 3000);
    return;
  }

  // Inicia o timer de 60 segundos
  startDispatcherTimer();
}

function startDispatcherTimer() {
  if (dispatcherTimer) clearInterval(dispatcherTimer);
  dispatcherSecondsRemaining = 60;
  updateTimerDisplay();

  dispatcherTimer = setInterval(() => {
    if (!dispatcherActive) {
      clearInterval(dispatcherTimer);
      return;
    }
    if (dispatcherPaused) return;

    dispatcherSecondsRemaining--;
    updateTimerDisplay();

    if (dispatcherSecondsRemaining <= 0) {
      clearInterval(dispatcherTimer);
      dispatcherBatchIndex++;
      processNextDispatcherItem();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const display = document.getElementById('dispatcher-timer-display');
  if (display) {
    const mins = Math.floor(dispatcherSecondsRemaining / 60).toString().padStart(2, '0');
    const secs = (dispatcherSecondsRemaining % 60).toString().padStart(2, '0');
    display.textContent = \`\${mins}:\${secs}\`;
  }
}

function togglePauseWhatsAppBatch() {
  dispatcherPaused = !dispatcherPaused;
  const btnText = document.getElementById('btn-dispatcher-pause-text');
  const badge = document.getElementById('dispatcher-status-badge');
  if (dispatcherPaused) {
    if (btnText) btnText.textContent = 'Retomar';
    if (badge) {
      badge.textContent = 'Disparo Pausado';
      badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300';
    }
  } else {
    if (btnText) btnText.textContent = 'Pausar';
    if (badge) {
      badge.textContent = 'Disparo em Andamento';
      badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 animate-pulse';
    }
  }
}

function skipWhatsAppBatchItem() {
  if (!dispatcherActive) return;
  if (dispatcherTimer) clearInterval(dispatcherTimer);
  dispatcherBatchIndex++;
  processNextDispatcherItem();
}

function stopWhatsAppBatch() {
  dispatcherActive = false;
  if (dispatcherTimer) clearInterval(dispatcherTimer);
  showToast('Fila de disparos interrompida.', 'info');
  openWhatsAppDispatcherModal();
}

function finishWhatsAppBatch() {
  dispatcherActive = false;
  if (dispatcherTimer) clearInterval(dispatcherTimer);
  playNotificationChime();
  
  const msg = dispatcherBatchNumber === 1 
    ? '🎉 Parabéns! As 25 oficinas do Lote 1 de hoje foram disparadas com sucesso. Amanhã inicie o Lote 2!'
    : '🏆 Parabéns! As 25 oficinas restantes do Lote 2 foram concluídas com sucesso. Todas as 50 oficinas foram contatadas!';
  
  showToast(msg, 'success');
  openWhatsAppDispatcherModal();
  loadLeads();
}
`;

if (!appJs.includes('function openWhatsAppDispatcherModal')) {
  appJs += '\n' + dispatcherJs;
  fs.writeFileSync(appJsPath, appJs, 'utf8');
  console.log('✅ Controlador JavaScript do Disparador adicionado ao app.js');
} else {
  console.log('ℹ️ Controlador do Disparador já presente no app.js');
}
