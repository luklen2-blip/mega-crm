const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'public', 'app.js');
let content = fs.readFileSync(appPath, 'utf8');

// 1. Add normalizeWhatsAppPhone & getWhatsAppUrl at the top of utility functions if not present
if (!content.includes('function normalizeWhatsAppPhone')) {
  const insertBefore = 'function escapeHtml(str)';
  const helpers = `function normalizeWhatsAppPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') && digits.length >= 12 ? digits : ('55' + digits);
}

function getWhatsAppUrl(phone, leadName) {
  const waNumber = normalizeWhatsAppPhone(phone);
  if (!waNumber) return '#';
  const name = leadName || 'Amigo';
  const text = \`Olá, tudo bem? Falo com o responsável pela \${name}? Me chamo Luciano da Silva. Vi que vocês são referência em serviços automotivos na Zona Oeste e gostaria de apresentar nossa solução para acelerar o atendimento e orçamentos via WhatsApp.\`;
  return \`https://wa.me/\${waNumber}?text=\${encodeURIComponent(text)}\`;
}

`;
  content = content.replace(insertBefore, helpers + insertBefore);
}

// 2. Replace leads table WhatsApp link
const oldTableWa = /\$\{lead\.phone \? `\s*<a href="https:\/\/wa\.me\/55\$\{lead\.phone\.replace\(\/\\D\/g, ''\)\}\?text=\$\{encodeURIComponent\('Olá ' \+ lead\.name \+ ', tudo bem\? Aqui é da equipe comercial\.'\)\}" target="_blank"/g;
content = content.replace(oldTableWa, `\${lead.phone ? \`
          <a href="\${getWhatsAppUrl(lead.phone, lead.name)}" target="_blank"`);

// 3. Replace modal 360 link
const oldModalWa = /waLink\.href = `https:\/\/wa\.me\/55\$\{lead\.phone\.replace\(\/\\D\/g, ''\)\}\?text=\$\{encodeURIComponent\('Olá ' \+ lead\.name \+ ', tudo bem\? Aqui é da equipe comercial\.'\)\}`;/g;
content = content.replace(oldModalWa, `waLink.href = getWhatsAppUrl(lead.phone, lead.name);`);

// 4. Replace sendPitchWhatsApp
const oldPitchWa = /const url = `https:\/\/wa\.me\/55\$\{lead\.phone\.replace\(\/\\D\/g, ''\)\}\?text=\$\{encodeURIComponent\(text\)\}`;/g;
content = content.replace(oldPitchWa, `const url = \`https://wa.me/\${normalizeWhatsAppPhone(lead.phone)}?text=\${encodeURIComponent(text)}\`;`);

// 5. Replace sendPixWhatsApp
const oldPixWa = /const url = `https:\/\/wa\.me\/55\$\{phone\.replace\(\/\\D\/g, ''\)\}\?text=\$\{encodeURIComponent\(msg\)\}`;/g;
content = content.replace(oldPixWa, `const url = \`https://wa.me/\${normalizeWhatsAppPhone(phone)}?text=\${encodeURIComponent(msg)}\`;`);

fs.writeFileSync(appPath, content, 'utf8');
console.log('✅ public/app.js patched with robust WhatsApp helpers!');
