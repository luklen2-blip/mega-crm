const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
const indexPath = path.join(__dirname, '..', 'public', 'index.html');
const appPath = path.join(__dirname, '..', 'public', 'app.js');

// 1. Atualizar server.js para anti-cache de .js e .css
let serverJs = fs.readFileSync(serverPath, 'utf8');
const oldAntiCache = "const isAntiCache = baseName === 'sw.js' || ext === '.html' || baseName === 'manifest.json';";
const newAntiCache = "const isAntiCache = baseName === 'sw.js' || ext === '.html' || baseName === 'manifest.json' || ext === '.js' || ext === '.css';";

if (serverJs.includes(oldAntiCache)) {
  serverJs = serverJs.replace(oldAntiCache, newAntiCache);
  fs.writeFileSync(serverPath, serverJs, 'utf8');
  console.log('✅ server.js atualizado com anti-cache para .js e .css');
} else {
  console.log('ℹ️ server.js já possui anti-cache');
}

// 2. Atualizar public/index.html
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// 2.1 Bump version de app.js
indexHtml = indexHtml.replace(/app\.js\?v=[\d\.]+/g, 'app.js?v=2.6.0');

// 2.2 Botão do Disparador no topo de Leads com fallback robusto
const oldBtn = /<button onclick="openWhatsAppDispatcherModal\(\)"[^>]*>[\s\S]*?<span>Disparador em Lote \(25\/dia\)<\/span>[\s\S]*?<\/button>/;
const robustBtn = `<button onclick="openWhatsAppDispatcherModal();" id="btn-open-dispatcher" class="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white transition shadow-lg shadow-emerald-600/30 cursor-pointer" title="Disparador Inteligente em Lotes (25 oficinas com 60s de intervalo)">
              <i data-lucide="send" class="h-4 w-4"></i>
              <span>Disparador em Lote (25/dia)</span>
            </button>`;

if (oldBtn.test(indexHtml)) {
  indexHtml = indexHtml.replace(oldBtn, robustBtn);
  console.log('✅ Botão Disparador no index.html atualizado com fallback');
}

// 2.3 Inserir o botão de ação direta dentro do dispatcher-running-view se ainda não existir
if (!indexHtml.includes('id="dispatcher-current-walink"')) {
  const insertTarget = '        <!-- Cronômetro Regressivo de 60s -->';
  const actionButtonHtml = `        <!-- BOTÃO DE AÇÃO DIRETA 100% GARANTIDO (IMUNE A BLOQUEADOR DE POP-UP) -->
        <div class="space-y-2">
          <a id="dispatcher-current-walink" href="#" target="_blank" rel="noopener noreferrer" class="w-full py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-center text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition cursor-pointer">
            <i data-lucide="message-circle" class="h-5 w-5"></i>
            <span id="dispatcher-walink-text">👉 ABRIR WHATSAPP DESTA OFICINA AGORA</span>
          </a>
          <div id="dispatcher-popup-warning" class="hidden p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-[11px] flex items-center gap-2">
            <i data-lucide="info" class="h-4 w-4 shrink-0 text-amber-400"></i>
            <span>Se a aba não abriu automaticamente, clique no botão verde acima para iniciar a conversa!</span>
          </div>
        </div>

`;
  indexHtml = indexHtml.replace(insertTarget, actionButtonHtml + insertTarget);
  console.log('✅ Botão de ação direta inserido dentro do modal de disparo');
}

fs.writeFileSync(indexPath, indexHtml, 'utf8');

// 3. Atualizar public/app.js
let appJs = fs.readFileSync(appPath, 'utf8');

// Garantir que openWhatsAppDispatcherModal seja exposto globalmente em window
const globalExports = `
// Exposição global das funções do disparador para o escopo window
window.openWhatsAppDispatcherModal = openWhatsAppDispatcherModal;
window.startWhatsAppBatch = startWhatsAppBatch;
window.togglePauseWhatsAppBatch = togglePauseWhatsAppBatch;
window.skipWhatsAppBatchItem = skipWhatsAppBatchItem;
window.stopWhatsAppBatch = stopWhatsAppBatch;
window.getWhatsAppUrl = getWhatsAppUrl;
`;

if (!appJs.includes('window.openWhatsAppDispatcherModal = openWhatsAppDispatcherModal;')) {
  appJs += globalExports;
  console.log('✅ Funções do disparador exportadas explicitamente em window');
}

// Atualizar processNextDispatcherItem para sincronizar o botão direto do modal
const oldProcessTarget = `  // Abre conversa no WhatsApp
  if (cleanPhone) {
    const waUrl = \`https://wa.me/\${cleanPhone}?text=\${encodeURIComponent(msgText)}\`;
    window.open(waUrl, '_blank');
  }`;

const newProcessReplacement = `  const waUrl = cleanPhone ? \`https://wa.me/\${cleanPhone}?text=\${encodeURIComponent(msgText)}\` : '#';
  const waLinkEl = document.getElementById('dispatcher-current-walink');
  const waLinkTextEl = document.getElementById('dispatcher-walink-text');
  const warningEl = document.getElementById('dispatcher-popup-warning');
  
  if (waLinkEl) {
    waLinkEl.href = waUrl;
  }
  if (waLinkTextEl) {
    waLinkTextEl.textContent = \`👉 ABRIR WHATSAPP: \${lead.name}\`;
  }

  // Tenta abrir no navegador
  if (cleanPhone) {
    try {
      const win = window.open(waUrl, '_blank');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        if (warningEl) warningEl.classList.remove('hidden');
      } else {
        if (warningEl) warningEl.classList.add('hidden');
      }
    } catch (e) {
      if (warningEl) warningEl.classList.remove('hidden');
    }
  }`;

if (appJs.includes(oldProcessTarget)) {
  appJs = appJs.replace(oldProcessTarget, newProcessReplacement);
  console.log('✅ processNextDispatcherItem atualizado com suporte a popup detection');
}

// Atualizar botão da tabela de leads para visual verde sólido de alta visibilidade
const oldTableBtn = /<a href="\$\{getWhatsAppUrl\(lead\.phone, lead\.name\)\}" target="_blank"[^>]*>/g;
const newTableBtn = `<a href="\${getWhatsAppUrl(lead.phone, lead.name)}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold transition inline-flex items-center gap-1 shadow-sm cursor-pointer" title="Abrir conversa no WhatsApp">`;

appJs = appJs.replace(oldTableBtn, newTableBtn);

fs.writeFileSync(appPath, appJs, 'utf8');
console.log('✅ public/app.js atualizado com sucesso!');

