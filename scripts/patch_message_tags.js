const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
const appPath = path.join(__dirname, '..', 'public', 'app.js');
const scriptPath = path.join(__dirname, '..', 'scripts', 'disparo_whatsapp_lotes.js');

// 1. Atualizar index.html com Tags Clicáveis e Caixa de Prévia em Tempo Real
let indexHtml = fs.readFileSync(indexPath, 'utf8');

const oldTextareaBlock = `<div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <i data-lucide="edit-3" class="h-3.5 w-3.5 text-blue-400"></i>
              <span>Texto da Mensagem Comercial:</span>
            </label>
            <span class="text-[10px] text-slate-500">Usa a tag {nome} para o nome da oficina</span>
          </div>
          <textarea id="dispatcher-message-text" rows="3" class="w-full p-3 text-xs rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono resize-none">Olá, tudo bem? Falo com o responsável pela {nome}? Me chamo Luciano da Silva. Vi que vocês são referência em serviços automotivos na Zona Oeste e gostaria de apresentar nossa solução para acelerar o atendimento e orçamentos via WhatsApp.</textarea>
        </div>`;

const newTextareaBlock = `<div class="space-y-2">
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

          <!-- Badges de variáveis que o usuário pode clicar para inserir -->
          <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span class="text-[10px] text-slate-400 font-medium">Tags inteligentes:</span>
            <button type="button" onclick="insertDispatcherTag('{nome}')" class="px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold transition flex items-center gap-1">
              + {nome} <span class="text-slate-400 font-normal">(Nome da Oficina)</span>
            </button>
            <button type="button" onclick="insertDispatcherTag('{bairro}')" class="px-2 py-0.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold transition flex items-center gap-1">
              + {bairro} <span class="text-slate-400 font-normal">(Bangu, Campo Grande...)</span>
            </button>
          </div>

          <!-- Caixa de Prévia em Tempo Real -->
          <div class="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1">
            <div class="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <i data-lucide="eye" class="h-3 w-3"></i> Exemplo Real de como a oficina receberá:
            </div>
            <div id="dispatcher-preview-box" class="text-xs text-slate-300 italic bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/40">
              Carregando exemplo...
            </div>
          </div>
        </div>`;

if (indexHtml.includes(oldTextareaBlock)) {
  indexHtml = indexHtml.replace(oldTextareaBlock, newTextareaBlock);
  fs.writeFileSync(indexPath, indexHtml, 'utf8');
  console.log('✅ index.html atualizado com badges de tags e prévia em tempo real!');
} else {
  console.log('ℹ️ Bloco textarea já atualizado no index.html');
}

// 2. Atualizar app.js para formatar {nome} e {bairro} e atualizar a prévia
let appJs = fs.readFileSync(appPath, 'utf8');

const helperJs = `
function extractLeadBairro(lead) {
  if (!lead || !lead.notes) return 'Zona Oeste';
  const match = lead.notes.match(/Local:\\s*([^|\\-]+)/i);
  return match && match[1] ? match[1].trim() : 'Zona Oeste';
}

function formatMessageTemplate(tpl, lead) {
  const nome = (lead && lead.name) ? lead.name : 'sua oficina';
  const bairro = extractLeadBairro(lead);
  return tpl
    .replace(/{nome}/gi, nome)
    .replace(/{empresa}/gi, nome)
    .replace(/{oficina}/gi, nome)
    .replace(/{bairro}/gi, bairro)
    .replace(/{local}/gi, bairro)
    .replace(/{cidade}/gi, 'Rio de Janeiro');
}

function insertDispatcherTag(tag) {
  const el = document.getElementById('dispatcher-message-text');
  if (!el) return;
  const start = el.selectionStart || el.value.length;
  const end = el.selectionEnd || el.value.length;
  el.value = el.value.substring(0, start) + ' ' + tag + ' ' + el.value.substring(end);
  el.focus();
  updateDispatcherPreview();
}

function updateDispatcherPreview() {
  const previewBox = document.getElementById('dispatcher-preview-box');
  const tpl = document.getElementById('dispatcher-message-text')?.value || '';
  if (!previewBox) return;

  const sampleLead = (globalLeads && globalLeads.length > 0) 
    ? globalLeads.find(l => l.source === 'Google Maps Oficinas') || globalLeads[0]
    : { name: 'Oficina Viegas', notes: 'Local: Bangu - RJ' };

  previewBox.textContent = formatMessageTemplate(tpl, sampleLead);
}
`;

if (!appJs.includes('function formatMessageTemplate')) {
  // Inserir antes de openWhatsAppDispatcherModal
  const targetFn = 'function openWhatsAppDispatcherModal()';
  appJs = appJs.replace(targetFn, helperJs + '\n' + targetFn);
}

// Atualizar openWhatsAppDispatcherModal para chamar updateDispatcherPreview()
appJs = appJs.replace(
  "if (window.lucide) lucide.createIcons();\n}",
  "if (window.lucide) lucide.createIcons();\n  updateDispatcherPreview();\n}"
);

// Atualizar o disparo para usar formatMessageTemplate
appJs = appJs.replace(
  "const msgText = tpl.replace(/{nome}/g, lead.name);",
  "const msgText = formatMessageTemplate(tpl, lead);"
);

// Expor globalmente
if (!appJs.includes('window.insertDispatcherTag = insertDispatcherTag;')) {
  appJs += '\nwindow.insertDispatcherTag = insertDispatcherTag;\nwindow.updateDispatcherPreview = updateDispatcherPreview;\n';
}

fs.writeFileSync(appPath, appJs, 'utf8');
console.log('✅ app.js atualizado com substituição dinâmica de {nome} e {bairro}!');

// 3. Atualizar scripts/disparo_whatsapp_lotes.js para suportar bairro também
let scriptJs = fs.readFileSync(scriptPath, 'utf8');

const oldGetMsg = `function getMessageText(leadName) {
  const name = leadName || 'Amigo';
  return \`Olá, tudo bem? Falo com o responsável pela \${name}? Me chamo Luciano da Silva. Vi que vocês são referência em serviços automotivos na Zona Oeste e gostaria de apresentar nossa solução para acelerar o atendimento e orçamentos via WhatsApp.\`;
}`;

const newGetMsg = `function extractBairro(notes) {
  if (!notes) return 'Zona Oeste';
  const match = notes.match(/Local:\\s*([^|\\-]+)/i);
  return match && match[1] ? match[1].trim() : 'Zona Oeste';
}

function getMessageText(lead) {
  const name = (typeof lead === 'string' ? lead : (lead && lead.name)) || 'Amigo';
  const notes = (typeof lead === 'object' && lead) ? lead.notes : '';
  const bairro = extractBairro(notes);
  return \`Olá, tudo bem? Falo com o responsável pela \${name}? Me chamo Luciano da Silva. Vi que vocês são referência em serviços automotivos em \${bairro} e gostaria de apresentar nossa solução para acelerar o atendimento e orçamentos via WhatsApp.\`;
}`;

scriptJs = scriptJs.replace(oldGetMsg, newGetMsg);
scriptJs = scriptJs.replace("const msg = getMessageText(lead.name);", "const msg = getMessageText(lead);");

fs.writeFileSync(scriptPath, scriptJs, 'utf8');
console.log('✅ disparo_whatsapp_lotes.js atualizado com personalização de nome e bairro!');
