/**
 * Testes Automatizados da Edição Self-Hosted / White-Label (V5)
 * Valida /guia-instalacao, /termos, /api/settings/test-connection e /api/settings/credits-governance
 */

const http = require('http');
const server = require('../server');
const TEST_PORT = 3097;

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

async function run() {
  console.log('🧪 Iniciando testes da Edição Self-Hosted / White-Label...');
  
  await new Promise((resolve) => {
    server.listen(TEST_PORT, '127.0.0.1', resolve);
  });

  // 1. Health check
  const healthRes = await makeRequest({ host: '127.0.0.1', port: TEST_PORT, path: '/api/health', method: 'GET' });
  if (healthRes.status !== 200 || healthRes.json?.status !== 'ok') {
    throw new Error(`Falha em /api/health: status ${healthRes.status}`);
  }
  console.log('  ✅ /api/health: 200 OK');

  // 2. /guia-instalacao route
  const guiaRes = await makeRequest({ host: '127.0.0.1', port: TEST_PORT, path: '/guia-instalacao', method: 'GET' });
  if (guiaRes.status !== 200 || !guiaRes.body.includes('Como Instalar o Agentise Mega CRM')) {
    throw new Error(`Falha em /guia-instalacao: status ${guiaRes.status}`);
  }
  console.log('  ✅ /guia-instalacao: 200 OK com layout interativo');

  // 3. /termos route includes Section 6
  const termosRes = await makeRequest({ host: '127.0.0.1', port: TEST_PORT, path: '/termos', method: 'GET' });
  if (termosRes.status !== 200 || !termosRes.body.includes('Licença Comercial Perpétua (Self-Hosted)')) {
    throw new Error(`Falha em /termos: Seção 6 não encontrada`);
  }
  console.log('  ✅ /termos: 200 OK com cláusula comercial R$ 900,00 as-is');

  // 4. Login as admin
  const loginRes = await makeRequest({
    host: '127.0.0.1', port: TEST_PORT, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@crm.com', password: 'Admin@1234' });
  
  const token = loginRes.json?.data?.token || loginRes.json?.token;
  if (loginRes.status !== 200 || !token) {
    throw new Error(`Falha no login do admin: status ${loginRes.status}`);
  }
  console.log('  ✅ Autenticação do Administrador OK');

  // 5. Test connection endpoint
  const testConnOpenAI = await makeRequest({
    host: '127.0.0.1', port: TEST_PORT, path: '/api/settings/test-connection', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  }, { type: 'openai', key: 'sk-test-valid-format-key-1234567890' });
  if (testConnOpenAI.status !== 200 || !testConnOpenAI.json?.success) {
    throw new Error(`Falha ao testar conexão OpenAI`);
  }

  const testConnPix = await makeRequest({
    host: '127.0.0.1', port: TEST_PORT, path: '/api/settings/test-connection', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  }, { type: 'pix', key: 'suaempresa@pix.com.br' });
  if (testConnPix.status !== 200 || !testConnPix.json?.success) {
    throw new Error(`Falha ao testar conexão PIX`);
  }
  console.log('  ✅ /api/settings/test-connection validado com sucesso');

  // 6. Test credits governance
  const govRes = await makeRequest({
    host: '127.0.0.1', port: TEST_PORT, path: '/api/settings/credits-governance', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  }, { limit: 75000, reset: true });
  if (govRes.status !== 200 || govRes.json?.data?.creditsLimit !== 75000 || govRes.json?.data?.creditsUsed !== 0) {
    throw new Error(`Falha em /api/settings/credits-governance: ${JSON.stringify(govRes.json)}`);
  }
  console.log('  ✅ /api/settings/credits-governance validado com sucesso');

  console.log('\n🎉 SUCESSO: Todos os testes específicos da Edição Self-Hosted foram APROVADOS (100%)!\n');
  server.close();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Erro no teste:', err.message);
  process.exit(1);
});
