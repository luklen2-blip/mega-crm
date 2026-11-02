const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const startTag = '<div class="space-y-1.5">';
const idxStart = html.indexOf(startTag, html.indexOf('id="modal-whatsapp-dispatcher"'));

const endMarker = '</textarea>';
const idxEnd = html.indexOf('</div>', html.indexOf(endMarker, idxStart)) + 6;

const replacement = `<div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <i data-lucide="edit-3" class="h-3.5 w-3.5 text-emerald-400"></i>
              <span>Texto da Mensagem (Personalização Automática):</span>
            </label>
            <span class="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
              <i data-lucide="sparkles" class="h-3 w-3"></i> O sistema troca os nomes sozinho!
            </span>
          </div>
          
          <textarea id="dispatcher-message-text" oninput="updateDispatcherPreview()" rows="3" class="w-full p-3 text-xs rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans leading-relaxed resize-none">Olá, tudo bem? Falo com o responsável pela {nome}? Me chamo Luciano da Silva. Vi que vocês são referência em serviços automotivos em {bairro} e gostaria de apresentar nossa solução para acelerar o atendimento e orçamentos via WhatsApp.</textarea>

          <!-- Badges de variáveis -->
          <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span class="text-[10px] text-slate-400 font-medium">Tags inteligentes:</span>
            <button type="button" onclick="insertDispatcherTag('{nome}')" class="px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer">
              + {nome} <span class="text-slate-400 font-normal">(Nome da Oficina)</span>
            </button>
            <button type="button" onclick="insertDispatcherTag('{bairro}')" class="px-2 py-0.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer">
              + {bairro} <span class="text-slate-400 font-normal">(Bangu, Campo Grande...)</span>
            </button>
          </div>

          <!-- Caixa de Prévia em Tempo Real -->
          <div class="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1">
            <div class="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <i data-lucide="eye" class="h-3 w-3"></i> Exemplo Real de como a oficina receberá:
            </div>
            <div id="dispatcher-preview-box" class="text-xs text-slate-300 italic bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/40">
              Olá, tudo bem? Falo com o responsável pela Oficina Viegas? Me chamo Luciano da Silva. Vi que vocês são referência em serviços automotivos em Bangu e gostaria de apresentar nossa solução para acelerar o atendimento e orçamentos via WhatsApp.
            </div>
          </div>
        </div>`;

if (idxStart !== -1 && idxEnd !== -1) {
  html = html.slice(0, idxStart) + replacement + html.slice(idxEnd);
  // Bump version to 2.7.0
  html = html.replace(/app\.js\?v=[\d\.]+/g, 'app.js?v=2.7.0');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('✅ public/index.html updated with preview and tag buttons!');
} else {
  console.log('Indices not found in index.html', { idxStart, idxEnd });
}

