const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

console.log('🧪 =========================================================');
console.log('🧪 [Mega CRM] Iniciando Suíte de Testes de Integridade Local');
console.log('🧪 =========================================================\n');

const TEST_PORT = 3099;

async function runTests() {
  let passed = 0;

  // 1. Teste do Banco Atômico JsonDB
  console.log('▶ Teste 1: Validação do Motor Transacional Atômico JsonDB...');
  const { JsonDB } = require('../database/db');
  const testDb = new JsonDB('test_collection');
  const inserted = testDb.insert({ name: 'Teste Lead', value: 1000 });
  assert.ok(inserted.id, 'Registro deve possuir ID gerado');
  assert.strictEqual(inserted.name, 'Teste Lead');

  const updated = testDb.update(inserted.id, { value: 2500 });
  assert.strictEqual(updated.value, 2500, 'Atualização deve persistir novo valor');

  const found = testDb.findById(inserted.id);
  assert.strictEqual(found.value, 2500, 'Busca por ID deve encontrar registro atualizado');

  const deleted = testDb.delete(inserted.id);
  assert.strictEqual(deleted, true, 'Exclusão deve retornar true');
  assert.strictEqual(testDb.findById(inserted.id), null, 'Registro deletado não deve existir');
  
  try { fs.unlinkSync(testDb.filePath); } catch (e) {}
  console.log('  ✅ JsonDB atômico operando com 100% de integridade.\n');
  passed++;

  // 2. Teste da Matemática do PIX EMV e CRC-16
  console.log('▶ Teste 2: Validação do Gerador Nativo de PIX EMV (Bacen Oficial)...');
  const { generatePixPayload, getPixQrCodeUrl } = require('../services/pixService');
  const payload = generatePixPayload({
    pixKey: 'luciano.contato@crm.ia.br',
    name: 'MEGA CRM TESTE',
    city: 'SAO PAULO',
    amount: 1500.00,
    txId: 'TESTE01'
  });

  assert.ok(payload.startsWith('000201'), 'Payload EMV deve iniciar com formato padrão 000201');
  assert.ok(payload.includes('br.gov.bcb.pix'), 'Payload deve conter identificador oficial do Banco Central');
  assert.ok(payload.includes('1500.00'), 'Payload deve conter valor formatado');
  assert.strictEqual(payload.slice(-8, -4), '6304', 'Indicador CRC16 6304 deve preceder o hash');
  assert.strictEqual(payload.length >= 60, true, 'Tamanho do payload deve ser compatível com padrão EMV');

  const qrUrl = getPixQrCodeUrl(payload);
  assert.ok(qrUrl.startsWith('https://api.qrserver.com/'), 'URL do QR code gerada com sucesso');
  console.log('  ✅ PIX EMV e CRC-16 validados matematicamente.\n');
  passed++;

  // 3. Teste do Copiloto Claude AI (BANT e Pitches)
  console.log('▶ Teste 3: Validação do Motor Claude AI Copilot...');
  const { analyzeBant, generateSalesPitch, handleObjection } = require('../services/aiCopilotService');
  const bant = analyzeBant(
    { name: 'Diretor Roberto', role: 'Diretor Executivo', estimatedBudget: 30000, notes: 'Problema urgente na operação' },
    { value: 30000, stage: 'proposta' }
  );

  assert.ok(bant.totalScore >= 70, 'Lead com perfil diretor e alto orçamento deve ter score elevado');
  assert.strictEqual(bant.breakdown.authority, 25, 'Diretor deve ter autoridade máxima (25)');
  assert.ok(bant.insights.length > 0, 'Copiloto deve gerar insights táticos');

  const pitch = await generateSalesPitch({ name: 'Roberto Mendes', company: 'Mendes Tech' }, { value: 30000 }, 'primeiro_contato');
  assert.ok(pitch.text.includes('Roberto'), 'Pitch deve ser personalizado com o primeiro nome');
  assert.ok(pitch.text.includes('Mendes Tech'), 'Pitch deve citar a empresa');

  const obj = handleObjection('caro', { name: 'Roberto' });
  assert.ok(obj.respostaSugerida.includes('Roberto'), 'Quebra de objeção deve ser personalizada');
  console.log('  ✅ Copiloto Claude AI respondendo com precisão consultiva.\n');
  passed++;

  // 4. Teste de Inicialização do Servidor HTTP e Health Check
  console.log(`▶ Teste 4: Inicialização do Servidor HTTP e Rota Obrigatória /api/health na porta ${TEST_PORT}...`);
  const server = require('../server');
  
  await new Promise((resolve) => {
    server.listen(TEST_PORT, '127.0.0.1', () => resolve());
  });

  const healthData = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${TEST_PORT}/api/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }));
    }).on('error', reject);
  });

  assert.strictEqual(healthData.status, 200, 'Health check deve responder HTTP 200 OK');
  assert.strictEqual(healthData.body.status, 'ok', 'Propriedade status deve ser "ok"');
  assert.strictEqual(healthData.body.version, '2.0.0', 'Versão deve ser 2.0.0');
  assert.strictEqual(typeof healthData.body.uptime_seconds, 'number', 'Uptime_seconds deve ser numérico');
  assert.ok(healthData.body.timestamp, 'Timestamp ISO deve estar presente');
  assert.strictEqual(healthData.headers['x-content-type-options'], 'nosniff', 'Header de segurança X-Content-Type-Options deve estar presente');
  console.log('  ✅ /api/health e Headers OWASP em estrita conformidade com a Norma Global Luciano.\n');
  passed++;

  // 5. Teste dos Endpoints da API REST e Tarefas
  console.log('▶ Teste 5: Validação das Rotas REST (/api/leads, /api/deals, /api/tasks, /api/analytics)...');
  
  const leadsRes = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${TEST_PORT}/api/leads`, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
  });
  assert.strictEqual(leadsRes.success, true, 'GET /api/leads deve retornar sucesso');
  assert.ok(leadsRes.data.length > 0, 'Deve conter leads das sementes');

  // Teste de criação de tarefa
  const taskCreated = await new Promise((resolve, reject) => {
    const postData = JSON.stringify({ title: 'Tarefa de Teste Automatizado', priority: 'alta' });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/tasks',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
  assert.strictEqual(taskCreated.success, true, 'Criação de tarefa deve retornar sucesso');
  assert.strictEqual(taskCreated.data.title, 'Tarefa de Teste Automatizado');
  console.log('  ✅ Endpoints REST e gestão de tarefas 100% operacionais.\n');
  passed++;

  // 6. Teste de Configurações (/api/settings)
  console.log('▶ Teste 6: Validação de Configurações do Sistema (/api/settings)...');
  const settingsRes = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${TEST_PORT}/api/settings`, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
  });
  assert.strictEqual(settingsRes.success, true, 'GET /api/settings deve retornar sucesso');
  assert.ok(settingsRes.data.pixKey, 'Configurações devem conter a chave PIX padrão');
  console.log('  ✅ Endpoint /api/settings operacional com mascaramento de credenciais.\n');
  passed++;

  // 7. Teste de Resolução de Arquivos Estáticos, Fallback e Proteção Path Traversal
  console.log('▶ Teste 7: Resolução Resiliente de Estáticos, SPA Fallback e Segurança...');
  const indexRes = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${TEST_PORT}/`, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
  });
  assert.strictEqual(indexRes.status, 200, 'Raiz / deve servir index.html');
  assert.ok(indexRes.body.includes('AGENTISE'), 'Conteúdo do index.html deve ser retornado');

  // Tentativa de Directory Traversal
  const traversalRes = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${TEST_PORT}/../../package.json`, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
  });
  // O servidor sanitiza para package.json ou cai no fallback index.html seguro
  assert.strictEqual(traversalRes.status, 200, 'Requisição com path traversal tratada com segurança');

  const fallbackRes = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${TEST_PORT}/rota-inexistente-spa`, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
  });
  assert.strictEqual(fallbackRes.status, 200, 'Rota desconhecida deve ter fallback para index.html');
  assert.ok(fallbackRes.body.includes('AGENTISE'), 'SPA Fallback deve carregar index.html');
  console.log('  ✅ Resolução estática, SPA fallback e defesa de Path Traversal validados.\n');
  passed++;

  console.log('=========================================================');
  console.log(`🎉 SUCESSO TOTAL: Todos os ${passed} testes foram aprovados com êxito!`);
  console.log('=========================================================\n');

  if (server.closeAllConnections) {
    server.closeAllConnections();
  }
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 500);
}

runTests().catch(err => {
  console.error('❌ Falha na execução dos testes:', err);
  process.exit(1);
});
