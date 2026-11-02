const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
const appPath = path.join(__dirname, '..', 'public', 'app.js');
const scriptPath = path.join(__dirname, '..', 'scripts', 'disparo_whatsapp_lotes.js');

const KIWIFY_LINK = 'https://pay.kiwify.com.br/lh2MAxf';

// 1. Atualizar public/index.html
let indexHtml = fs.readFileSync(indexPath, 'utf8');

const defaultMsgHtml = `Olá, tudo bem? Falo com o responsável pela {nome}? Me chamo Luciano da Silva. Vi que vocês são referência em serviços automotivos em {bairro}.\n\nCriamos o Oficina Organizada, um sistema simples para acabar com fichas de papel, enviar orçamentos pelo WhatsApp e controlar ordens de serviço:\n👉 Conheça e teste grátis: ${KIWIFY_LINK}\n\nSe quiser liberar seu teste gratuito de 24 horas, me avise por aqui! Um abraço.`;

// Atualizar o valor dentro do textarea
indexHtml = indexHtml.replace(
  /<textarea id="dispatcher-message-text"[^>]*>[\s\S]*?<\/textarea>/,
  `<textarea id="dispatcher-message-text" oninput="updateDispatcherPreview()" rows="5" class="w-full p-3 text-xs rounded-xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans leading-relaxed resize-none">${defaultMsgHtml}</textarea>`
);

// Atualizar o texto da prévia inicial
const previewSample = `Olá, tudo bem? Falo com o responsável pela Oficina Viegas? Me chamo Luciano da Silva. Vi que vocês são referência em serviços automotivos em Bangu.\n\nCriamos o Oficina Organizada, um sistema simples para acabar com fichas de papel, enviar orçamentos pelo WhatsApp e controlar ordens de serviço:\n👉 Conheça e teste grátis: ${KIWIFY_LINK}\n\nSe quiser liberar seu teste gratuito de 24 horas, me avise por aqui! Um abraço.`;

indexHtml = indexHtml.replace(
  /<div id="dispatcher-preview-box"[^>]*>[\s\S]*?<\/div>/,
  `<div id="dispatcher-preview-box" class="text-xs text-slate-300 italic bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/40 whitespace-pre-line">${previewSample}</div>`
);

// Bump version
indexHtml = indexHtml.replace(/app\.js\?v=[\d\.]+/g, 'app.js?v=2.8.0');

fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log('✅ public/index.html atualizado com o link do Oficina Organizada!');

// 2. Atualizar public/app.js
let appJs = fs.readFileSync(appPath, 'utf8');

// Atualizar getWhatsAppUrl
const oldWaUrlFn = /function getWhatsAppUrl\(phone, leadName\) \{[\s\S]*?return `https:\/\/wa\.me\/\$\{waNumber\}\?text=\$\{encodeURIComponent\(text\)\}`;[\s\S]*?\}/;
const newWaUrlFn = `function getWhatsAppUrl(phone, leadName) {
  const waNumber = normalizeWhatsAppPhone(phone);
  if (!waNumber) return '#';
  const name = leadName || 'Amigo';
  const text = \`Olá, tudo bem? Falo com o responsável pela \${name}? Me chamo Luciano da Silva. Vi que vocês são referência em serviços automotivos na Zona Oeste.\\n\\nCriamos o Oficina Organizada, sistema simples para acabar com papel, enviar orçamentos pelo WhatsApp e gerenciar a oficina:\\n👉 Conheça e teste grátis: ${KIWIFY_LINK}\\n\\nSe quiser liberar seu teste grátis de 24 horas, me avise por aqui!\`;
  return \`https://wa.me/\${waNumber}?text=\${encodeURIComponent(text)}\`;
}`;

if (oldWaUrlFn.test(appJs)) {
  appJs = appJs.replace(oldWaUrlFn, newWaUrlFn);
}

// Atualizar fallback de template em processNextDispatcherItem
const oldTplFallback = /const tpl = document\.getElementById\('dispatcher-message-text'\)\?\.value \|\|[\s\S]*?;\r?\n/;
const newTplFallback = `const tpl = document.getElementById('dispatcher-message-text')?.value || 
    \`Olá, tudo bem? Falo com o responsável pela {nome}? Me chamo Luciano da Silva. Vi que vocês são referência em serviços automotivos em {bairro}.\\n\\nCriamos o Oficina Organizada, um sistema simples para acabar com fichas de papel, enviar orçamentos pelo WhatsApp e controlar ordens de serviço:\\n👉 Conheça e teste grátis: ${KIWIFY_LINK}\\n\\nSe quiser liberar seu teste gratuito de 24 horas, me avise por aqui! Um abraço.\`;\n`;

if (oldTplFallback.test(appJs)) {
  appJs = appJs.replace(oldTplFallback, newTplFallback);
}

fs.writeFileSync(appPath, appJs, 'utf8');
console.log('✅ public/app.js atualizado com o link oficial da Kiwify!');

// 3. Atualizar scripts/disparo_whatsapp_lotes.js
let scriptJs = fs.readFileSync(scriptPath, 'utf8');

const oldCliMsgFn = /function getMessageText\(leadOrName\) \{[\s\S]*?return `Olá[\s\S]*?;\r?\n\}/;
const newCliMsgFn = `function getMessageText(leadOrName) {
  let name = 'Amigo';
  let bairro = 'Zona Oeste';
  if (typeof leadOrName === 'string') {
    name = leadOrName;
  } else if (typeof leadOrName === 'object' && leadOrName) {
    name = leadOrName.name || 'Amigo';
    bairro = extractBairro(leadOrName);
  }
  return \`Olá, tudo bem? Falo com o responsável pela \${name}? Me chamo Luciano da Silva. Vi que vocês são referência em serviços automotivos em \${bairro}.\\n\\nCriamos o Oficina Organizada, um sistema simples para acabar com fichas de papel, enviar orçamentos pelo WhatsApp e controlar ordens de serviço:\\n👉 Conheça e teste grátis: ${KIWIFY_LINK}\\n\\nSe quiser liberar seu teste gratuito de 24 horas, me avise por aqui! Um abraço.\`;
}`;

if (oldCliMsgFn.test(scriptJs)) {
  scriptJs = scriptJs.replace(oldCliMsgFn, newCliMsgFn);
  fs.writeFileSync(scriptPath, scriptJs, 'utf8');
  console.log('✅ scripts/disparo_whatsapp_lotes.js atualizado com o link!');
}
