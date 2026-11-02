const fs = require('fs');
const path = require('path');

const scriptPath = path.join(__dirname, '..', 'scripts', 'disparo_whatsapp_lotes.js');
let s = fs.readFileSync(scriptPath, 'utf8');

const oldFn = `function getMessageText(leadName) {
  const name = leadName || 'Amigo';
  return \`Olá, tudo bem? Falo com o responsável pela \${name}? Me chamo Luciano da Silva. Vi que vocês são referência em serviços automotivos na Zona Oeste e gostaria de apresentar nossa solução para acelerar o atendimento e orçamentos via WhatsApp.\`;
}`;

const newFn = `function extractBairro(lead) {
  const notes = (typeof lead === 'object' && lead) ? (lead.notes || '') : '';
  const match = notes.match(/Local:\\s*([^|\\-]+)/i);
  return match && match[1] ? match[1].trim() : 'Zona Oeste';
}

function getMessageText(leadOrName) {
  let name = 'Amigo';
  let bairro = 'Zona Oeste';
  if (typeof leadOrName === 'string') {
    name = leadOrName;
  } else if (typeof leadOrName === 'object' && leadOrName) {
    name = leadOrName.name || 'Amigo';
    bairro = extractBairro(leadOrName);
  }
  return \`Olá, tudo bem? Falo com o responsável pela \${name}? Me chamo Luciano da Silva. Vi que vocês são referência em serviços automotivos em \${bairro} e gostaria de apresentar nossa solução para acelerar o atendimento e orçamentos via WhatsApp.\`;
}`;

if (s.includes(oldFn)) {
  s = s.replace(oldFn, newFn);
} else {
  // Regex fallback
  s = s.replace(/function getMessageText[\s\S]*?\}\r?\n/, newFn + '\r\n');
}

// Ensure caller passes lead
s = s.replace('const msg = getMessageText(lead.name);', 'const msg = getMessageText(lead);');

fs.writeFileSync(scriptPath, s, 'utf8');
console.log('✅ disparo_whatsapp_lotes.js fixed with robust getMessageText!');

