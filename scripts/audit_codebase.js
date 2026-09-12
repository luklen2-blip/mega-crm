const fs = require('fs');
const path = require('path');

console.log('🔍 ========================================================');
console.log('🔍 [AUDITORIA COMPLETA] Mega CRM AI-First');
console.log('🔍 ========================================================\n');

const projectRoot = path.resolve(__dirname, '..');
let issues = [];
let successes = [];

// 1. Auditoria do HTML e Funções JS
console.log('▶ 1. Auditando interface HTML e vinculação com app.js...');
const html = fs.readFileSync(path.join(projectRoot, 'public', 'index.html'), 'utf-8');
const appJs = fs.readFileSync(path.join(projectRoot, 'public', 'app.js'), 'utf-8');

const regex = /onclick=["']([a-zA-Z0-9_]+)\(/g;
let match;
const handlers = new Set();
while ((match = regex.exec(html)) !== null) {
  handlers.add(match[1]);
}

for (const fn of handlers) {
  const defined = appJs.includes(`function ${fn}`) || 
                  appJs.includes(`${fn} =`) || 
                  appJs.includes(`const ${fn}`) || 
                  appJs.includes(`let ${fn}`);
  if (!defined) {
    issues.push(`Função onclick "${fn}" chamada no HTML, mas NÃO definida em app.js`);
  } else {
    successes.push(`Handler "${fn}" devidamente implementado em app.js`);
  }
}

// 2. Auditoria de Endpoints da API REST
console.log('▶ 2. Auditando rotas e endpoints em server.js...');
const serverJs = fs.readFileSync(path.join(projectRoot, 'server.js'), 'utf-8');

// Verifica se /api/settings está implementado
if (!serverJs.includes('/api/settings')) {
  issues.push('Endpoint GET/POST /api/settings não está implementado em server.js');
} else {
  successes.push('Endpoint /api/settings configurado');
}

// Verifica path traversal protection em serveStatic
if (!serverJs.includes('path.normalize') && !serverJs.includes('..')) {
  issues.push('Proteção contra Directory Traversal (ex: ../../) em serveStatic pode ser endurecida');
}

// Verifica security headers
if (!serverJs.includes('X-Content-Type-Options')) {
  issues.push('Security headers recomendados (X-Content-Type-Options, X-Frame-Options) ausentes');
}

// Verifica rate limiting / body size limit
if (!serverJs.includes('MAX_BODY_SIZE') && !serverJs.includes('1e6')) {
  issues.push('Limite explícito de tamanho de payload (Body Parser limit) ausente');
}

// 3. Auditoria do Banco Atômico JsonDB
console.log('▶ 3. Auditando motor de persistência JsonDB...');
const dbJs = fs.readFileSync(path.join(projectRoot, 'database', 'db.js'), 'utf-8');
if (dbJs.includes('renameSync')) {
  successes.push('JsonDB utiliza substituição atômica via .tmp e renameSync');
} else {
  issues.push('JsonDB não está usando substituição atômica');
}

// 4. Auditoria de Serviços (PIX e Copilot)
console.log('▶ 4. Auditando serviços PIX e IA Copilot...');
const pixJs = fs.readFileSync(path.join(projectRoot, 'services', 'pixService.js'), 'utf-8');
if (pixJs.includes('0x1021') && pixJs.includes('0xFFFF')) {
  successes.push('Cálculo CRC-16 / CCITT-FALSE oficial do Banco Central presente');
} else {
  issues.push('Cálculo do CRC-16 do PIX divergente da norma Bacen');
}

const aiJs = fs.readFileSync(path.join(projectRoot, 'services', 'aiCopilotService.js'), 'utf-8');
if (aiJs.includes('analyzeBant') && aiJs.includes('generateSalesPitch')) {
  successes.push('Módulos de IA BANT e gerador de pitch ativos');
}

console.log('\n--------------------------------------------------------');
console.log(`✅ Acertos Identificados (${successes.length}):`);
successes.forEach(s => console.log(`  + ${s}`));

console.log('\n⚠️ Pontos de Retificação e Melhorias (${issues.length}):');
issues.forEach(i => console.log(`  - ${i}`));
console.log('--------------------------------------------------------\n');
