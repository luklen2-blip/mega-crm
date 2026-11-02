const http = require('http');
const assert = require('assert');
const server = require('../server');
const { generateToken } = require('../services/authService');
const TEST_PORT = 3098;

console.log('🧪 ========================================================');
console.log('🧪 Teste Automatizado: Importação de Leads em CSV & Multi-Tenant');
console.log('🧪 ========================================================\n');

const tokenTenant1 = generateToken({
  userId: 'usr_test_tenant1',
  name: 'Gestor Tenant 1',
  role: 'ADMINISTRADOR',
  tenantId: 'ten_demo_agentise'
});

const tokenTenant2 = generateToken({
  userId: 'usr_test_tenant2',
  name: 'Gestor Tenant 2',
  role: 'ADMINISTRADOR',
  tenantId: 'ten_autoprime_veiculos'
});

function makeRequest(path, method, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  try {
    await new Promise((resolve) => {
      server.listen(TEST_PORT, '127.0.0.1', resolve);
    });

    // 1. Rejeição de requisição sem corpo
    console.log('▶ [Teste 1] Rejeição de payload vazio em /api/leads/import-csv...');
    const resEmpty = await makeRequest('/api/leads/import-csv', 'POST', {}, tokenTenant1);
    assert.strictEqual(resEmpty.status, 400, 'Deveria retornar 400 para payload vazio');
    console.log('  ✅ Payload vazio rejeitado com 400 Bad Request');

    // 2. Importação via csvText (delimitador vírgula)
    console.log('▶ [Teste 2] Importação de Leads via csvText (delimitador vírgula)...');
    const csvComma = `Nome,Empresa,Cargo,E-mail,Telefone,Orçamento,Tags\n` +
      `Lucas Ferreira,Ferreira Tech,CEO,lucas@ferreira.tech,11999990001,45000,"SaaS, B2B"\n` +
      `Beatriz Lima,Lima Cosméticos,Gerente,beatriz@lima.com.br,21988880002,12000,Varejo`;

    const resComma = await makeRequest('/api/leads/import-csv', 'POST', { csvText: csvComma }, tokenTenant1);
    assert.strictEqual(resComma.status, 201, 'Deveria retornar 201 Created');
    assert.strictEqual(resComma.body.count, 2, 'Deveria importar 2 leads');
    assert.strictEqual(resComma.body.imported[0].name, 'Lucas Ferreira');
    assert.strictEqual(resComma.body.imported[0].tenantId, 'ten_demo_agentise', 'Tenant deve ser travado no token da sessão');
    console.log('  ✅ 2 leads importados com sucesso via CSV');

    // 3. Importação via csvText (delimitador ponto-e-vírgula padrão Excel BR)
    console.log('▶ [Teste 3] Importação de Leads via csvText (ponto-e-vírgula Excel BR)...');
    const csvSemicolon = `Nome Completo;Empresa;Cargo;WhatsApp;Valor Estimado\n` +
      `Roberto Santos;Santos Log;Diretor;11977770003;R$ 35.000,00`;

    const resSemi = await makeRequest('/api/leads/import-csv', 'POST', { csvText: csvSemicolon }, tokenTenant1);
    assert.strictEqual(resSemi.status, 201);
    assert.strictEqual(resSemi.body.count, 1);
    assert.strictEqual(resSemi.body.imported[0].estimatedBudget, 35000, 'Orçamento R$ 35.000,00 deve ser convertido para float 35000');
    console.log('  ✅ Suporte a delimitador ponto-e-vírgula e conversão de moeda R$ aprovado');

    // 3.1 Importação com colunas Nome, Lugar e Telefone
    console.log('▶ [Teste 3.1] Importação com colunas Nome, Lugar e Telefone...');
    const csvLugar = `Nome,Lugar,Telefone\n` +
      `Marcos Paulo,São Paulo - Jardins,11988887777`;
    const resLugar = await makeRequest('/api/leads/import-csv', 'POST', { csvText: csvLugar }, tokenTenant1);
    assert.strictEqual(resLugar.status, 201);
    assert.strictEqual(resLugar.body.imported[0].name, 'Marcos Paulo');
    assert.strictEqual(resLugar.body.imported[0].company, 'São Paulo - Jardins');
    assert.strictEqual(resLugar.body.imported[0].phone, '11988887777');
    console.log('  ✅ Colunas Nome, Lugar e Telefone mapeadas com sucesso');

    // 4. Isolamento Multi-Tenant Estrito (Tenant 2 NÃO pode ver leads do Tenant 1)
    console.log('▶ [Teste 4] Isolamento Multi-Tenant: Tenant 2 buscando leads em /api/leads...');
    const resTenant2Leads = await makeRequest('/api/leads', 'GET', null, tokenTenant2);
    assert.strictEqual(resTenant2Leads.status, 200);
    const tenant2Names = resTenant2Leads.body.data.map(l => l.name);
    assert(!tenant2Names.includes('Lucas Ferreira'), 'Tenant 2 NUNCA pode enxergar leads do Tenant 1');
    assert(!tenant2Names.includes('Beatriz Lima'), 'Tenant 2 NUNCA pode enxergar leads do Tenant 1');
    assert(!tenant2Names.includes('Roberto Santos'), 'Tenant 2 NUNCA pode enxergar leads do Tenant 1');
    console.log('  🛡️ Isolamento Multi-Tenant 100% verificado: Tenant 2 possui zero acesso aos leads do Tenant 1');

    // 5. Tentativa de Parameter Spoofing (Injeção de tenantId de terceiros)
    console.log('▶ [Teste 5] Tentativa de Parameter Spoofing (injetando tenantId forjado no payload)...');
    const spoofedLead = {
      leads: [
        {
          name: 'Hacker Spoofing',
          company: 'Invasor Inc',
          tenantId: 'ten_autoprime_veiculos' // Tentando injetar em outro tenant
        }
      ]
    };
    const resSpoof = await makeRequest('/api/leads/import-csv', 'POST', spoofedLead, tokenTenant1);
    assert.strictEqual(resSpoof.status, 201);
    assert.strictEqual(resSpoof.body.imported[0].tenantId, 'ten_demo_agentise', 'tenantId forjado deve ser ignorado e travado na sessão autenticada');
    console.log('  🛡️ Anti-Spoofing Ativo: Injeção de tenantId malicioso foi neutralizada');

    console.log('\n=============================================================');
    console.log('🎉 TODOS OS 5 TESTES DE IMPORTAÇÃO CSV & MULTI-TENANT APROVADOS (100%)!');
    console.log('=============================================================');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Falha nos testes:', err);
    try { server.close(); } catch (e) {}
    process.exit(1);
  }
}

runTests();
