const assert = require('assert');
const http = require('http');
const server = require('../server');
const { usersDB } = require('../database/db');
const { generateToken } = require('../services/authService');

const TEST_PORT = 3096;

async function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      res.setEncoding('utf8');
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, body: data, json });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTest() {
  console.log('🧪 Iniciando teste de integridade da tela Agente Comercial IA...');

  server.listen(TEST_PORT, async () => {
    try {
      // 1. Testa carregamento do index.html
      const htmlRes = await makeRequest({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/',
        method: 'GET'
      });

      const html = htmlRes.body;
      assert.ok(html.includes('id="view-copilot"'), 'view-copilot deve estar presente no HTML');
      assert.ok(html.includes('id="copilot-subtab-agents"'), 'Sub-aba de agentes deve estar presente');
      assert.ok(html.includes('id="copilot-subtab-simulator"'), 'Sub-aba do simulador deve estar presente');
      assert.ok(html.includes('id="copilot-subtab-bant"'), 'Sub-aba do BANT deve estar presente');
      assert.ok(html.includes('id="modal-new-ai-agent"'), 'Modal de novo agente deve estar presente');
      assert.ok(html.includes('id="simulator-agent-select"'), 'Seletor do simulador deve estar presente');
      assert.ok(html.includes('id="simulator-handover-alert"'), 'Banner de transbordo deve estar presente');
      console.log('  ✅ Estrutura HTML da tela Agente Comercial IA 100% íntegra');

      // 2. Testa listagem de agentes com token JWT
      const admin = usersDB.findOne(u => u.role === 'PROPRIETARIO') || usersDB.findAll()[0];
      const token = generateToken(admin);

      const agentsRes = await makeRequest({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/ai/agents',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      assert.strictEqual(agentsRes.status, 200, 'GET /api/ai/agents deve responder 200');
      assert.ok(agentsRes.json && agentsRes.json.data.length >= 2, 'Deve retornar ao menos Sofia e Lucas');
      console.log(`  ✅ Listagem de Agentes de IA operando (${agentsRes.json.data.length} agentes encontrados)`);

      const firstAgent = agentsRes.json.data[0];
      const interactRes = await makeRequest({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: `/api/ai/agents/${firstAgent.id}/interact`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }, { message: 'Quero falar com um humano agora', channel: 'whatsapp' });

      assert.strictEqual(interactRes.status, 200, 'POST /api/ai/agents/:id/interact deve responder 200');
      assert.strictEqual(interactRes.json.handover, true, 'Deve acionar transbordo para palavra "humano"');
      console.log('  ✅ Simulador do Agente Comercial e Transbordo Humano validados');

      console.log('\n🎉 TODOS OS TESTES DA TELA AGENTE COMERCIAL APROVADOS COM SUCESSO!\n');
      server.close();
      process.exit(0);
    } catch (err) {
      console.error('❌ Falha no teste:', err);
      server.close();
      process.exit(1);
    }
  });
}

runTest();
