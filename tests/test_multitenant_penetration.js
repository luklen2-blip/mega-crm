/**
 * AGENTISE MEGA CRM V2.0 - SUÍTE DE TESTES DE PENETRAÇÃO MULTI-TENANT
 * Validação rigorosa de isolamento estrito entre workspaces, anti-IDOR e anti-tampering.
 */

const http = require('http');
const assert = require('assert');
const crypto = require('crypto');
const server = require('../server');
const { registerTenant } = require('../services/authService');
const { leadsDB, dealsDB, tenantsDB } = require('../database/db');

const PEN_PORT = 3105;

function makeRequest({ method, path, token, body }) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: PEN_PORT,
      path,
      method,
      headers
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = {};
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = { raw: data };
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runPenetrationTests() {
  console.log('🛡️ ================================================================');
  console.log('🛡️ [Mega CRM V2] Iniciando Teste de Penetração Multi-Tenant');
  console.log('🛡️ ================================================================\n');

  await new Promise(resolve => server.listen(PEN_PORT, '127.0.0.1', resolve));

  try {
    // 1. SETUP: Criação de Tenant A (Vítima) e Tenant B (Atacante)
    const suffix = Date.now();
    const regA = registerTenant({
      companyName: `Tenant Alpha ${suffix}`,
      segment: 'consultoria',
      name: 'João Proprietário A',
      email: `alpha_${suffix}@corp.com`,
      password: 'SenhaForte123!@#'
    });
    const tokenA = regA.token;
    const tenantAId = regA.tenant.id;

    const regB = registerTenant({
      companyName: `Tenant Beta ${suffix}`,
      segment: 'varejo',
      name: 'Maria Atacante B',
      email: `beta_${suffix}@corp.com`,
      password: 'SenhaForte123!@#'
    });
    const tokenB = regB.token;
    const tenantBId = regB.tenant.id;

    console.log(`[Setup] Tenant A criado: ${tenantAId} (${regA.tenant.name})`);
    console.log(`[Setup] Tenant B criado: ${tenantBId} (${regB.tenant.name})\n`);

    // 2. Tenant A cria Lead "João" e Deal de R$ 10.000
    const createLeadRes = await makeRequest({
      method: 'POST',
      path: '/api/leads',
      token: tokenA,
      body: {
        name: 'João da Silva',
        phone: '11988887777',
        email: 'joao@silva.com',
        value: 10000
      }
    });
    assert.strictEqual(createLeadRes.status, 201, 'Lead de João deve ser criado com sucesso');
    const joaoLeadId = createLeadRes.body.data.id;

    const createDealRes = await makeRequest({
      method: 'POST',
      path: '/api/deals',
      token: tokenA,
      body: {
        title: 'Projeto Consultoria VIP',
        value: 10000,
        leadId: joaoLeadId,
        stage: 'proposta'
      }
    });
    assert.strictEqual(createDealRes.status, 201, 'Deal de R$ 10.000 deve ser criado com sucesso');
    const joaoDealId = createDealRes.body.data.id;
    console.log(`[Setup] Dados do Tenant A inseridos com sucesso: Lead=${joaoLeadId}, Deal=${joaoDealId} (R$ 10.000)\n`);

    let attackPassCount = 0;

    // VETOR 1: Tenant B tenta ler individualmente o lead de A via GET /api/leads/:id (IDOR)
    console.log('▶ Vetor 1: Tentativa de leitura IDOR de Lead de outro tenant (GET /api/leads/:id)...');
    const v1 = await makeRequest({
      method: 'GET',
      path: `/api/leads/${joaoLeadId}`,
      token: tokenB
    });
    assert.strictEqual(v1.status, 404, 'Deve retornar HTTP 404 ocultando existência do registro de outro tenant');
    console.log('  🛡️ Bloqueado: 404 Not Found (existência ocultada)');
    attackPassCount++;

    // VETOR 2: Tenant B lista leads via GET /api/leads (Validação de isolamento da lista)
    console.log('▶ Vetor 2: Tentativa de extração via listagem geral (GET /api/leads)...');
    const v2 = await makeRequest({
      method: 'GET',
      path: '/api/leads',
      token: tokenB
    });
    assert.strictEqual(v2.status, 200);
    const leakedLead = v2.body.data.find(l => l.id === joaoLeadId || l.name === 'João da Silva');
    assert.strictEqual(leakedLead, undefined, 'Lead do Tenant A NUNCA deve constar na listagem do Tenant B');
    console.log('  🛡️ Bloqueado: Listagem isolada estritamente pelo tenantId da sessão');
    attackPassCount++;

    // VETOR 3: Tenant B tenta ler a oportunidade de R$ 10.000 de A (GET /api/deals/:id)
    console.log('▶ Vetor 3: Tentativa de leitura IDOR de Oportunidade (GET /api/deals/:id)...');
    const v3 = await makeRequest({
      method: 'GET',
      path: `/api/deals/${joaoDealId}`,
      token: tokenB
    });
    assert.strictEqual(v3.status, 404, 'Deve retornar HTTP 404 ocultando existência do deal');
    console.log('  🛡️ Bloqueado: 404 Not Found');
    attackPassCount++;

    // VETOR 4: Tenant B tenta alterar dados do lead de A (PUT /api/leads/:id)
    console.log('▶ Vetor 4: Tentativa de alteração não autorizada de Lead (PUT /api/leads/:id)...');
    const v4 = await makeRequest({
      method: 'PUT',
      path: `/api/leads/${joaoLeadId}`,
      token: tokenB,
      body: { name: 'João Hackeado' }
    });
    assert.strictEqual(v4.status, 404, 'Deve retornar HTTP 404 e rejeitar mutação de dados de outro tenant');
    const originalLead = leadsDB.findById(joaoLeadId);
    assert.strictEqual(originalLead.name, 'João da Silva', 'Nome original deve ser preservado intacto');
    console.log('  🛡️ Bloqueado: 404 Not Found & Dados do Tenant A preservados');
    attackPassCount++;

    // VETOR 5: Tenant B tenta mover oportunidade de A no funil (PATCH /api/deals/:id/stage)
    console.log('▶ Vetor 5: Tentativa de mover oportunidade no funil (PATCH /api/deals/:id/stage)...');
    const v5 = await makeRequest({
      method: 'PATCH',
      path: `/api/deals/${joaoDealId}/stage`,
      token: tokenB,
      body: { stage: 'ganho' }
    });
    assert.strictEqual(v5.status, 404, 'Deve retornar HTTP 404');
    const originalDeal = dealsDB.findById(joaoDealId);
    assert.strictEqual(originalDeal.stage, 'proposta', 'Estágio da oportunidade não pode ter sido adulterado');
    console.log('  🛡️ Bloqueado: 404 Not Found & Pipeline inalterado');
    attackPassCount++;

    // VETOR 6: Tenant B tenta excluir oportunidade de A (DELETE /api/deals/:id)
    console.log('▶ Vetor 6: Tentativa de exclusão maliciosa de Oportunidade (DELETE /api/deals/:id)...');
    const v6 = await makeRequest({
      method: 'DELETE',
      path: `/api/deals/${joaoDealId}`,
      token: tokenB
    });
    assert.strictEqual(v6.status, 404, 'Deve retornar HTTP 404 e negar deleção');
    assert.ok(dealsDB.findById(joaoDealId), 'Oportunidade do Tenant A deve continuar existindo no banco');
    console.log('  🛡️ Bloqueado: 404 Not Found & Integridade do registro mantida');
    attackPassCount++;

    // VETOR 7: Tenant B tenta excluir lead de A (DELETE /api/leads/:id)
    console.log('▶ Vetor 7: Tentativa de exclusão maliciosa de Lead (DELETE /api/leads/:id)...');
    const v7 = await makeRequest({
      method: 'DELETE',
      path: `/api/leads/${joaoLeadId}`,
      token: tokenB
    });
    assert.strictEqual(v7.status, 404, 'Deve retornar HTTP 404');
    assert.ok(leadsDB.findById(joaoLeadId), 'Lead do Tenant A deve continuar existindo no banco');
    console.log('  🛡️ Bloqueado: 404 Not Found & Lead intacto');
    attackPassCount++;

    // VETOR 8: Parameter Spoofing - Tenant B envia payload com "tenantId" de A forçado no body (POST /api/leads)
    console.log('▶ Vetor 8: Parameter Spoofing (Injeção de tenantId do Tenant A no body de POST /api/leads)...');
    const v8 = await makeRequest({
      method: 'POST',
      path: '/api/leads',
      token: tokenB,
      body: {
        name: 'Lead Cavalo de Tróia',
        phone: '11900001111',
        tenantId: tenantAId
      }
    });
    assert.strictEqual(v8.status, 201);
    const createdTrojan = v8.body.data;
    assert.strictEqual(createdTrojan.tenantId, tenantBId, 'O servidor DEVE sobrepor o tenantId injetado pelo tenantId da sessão autenticada');
    const leadInDb = leadsDB.findById(createdTrojan.id);
    assert.strictEqual(leadInDb.tenantId, tenantBId, 'Banco deve persistir sob o workspace B estritamente');
    console.log('  🛡️ Bloqueado: Anti-spoofing ativo (tenantId sobrescrito com sucesso)');
    attackPassCount++;

    // VETOR 9: Parameter Spoofing em Oportunidades (POST /api/deals com tenantId de A forçado)
    console.log('▶ Vetor 9: Parameter Spoofing em Deals (POST /api/deals com tenantId de A)...');
    // Cria lead legítimo no Tenant B primeiro
    const leadBRes = await makeRequest({
      method: 'POST',
      path: '/api/leads',
      token: tokenB,
      body: { name: 'Cliente Legítimo B', phone: '11977776666' }
    });
    assert.strictEqual(leadBRes.status, 201);
    const leadBId = leadBRes.body.data.id;

    const v9 = await makeRequest({
      method: 'POST',
      path: '/api/deals',
      token: tokenB,
      body: {
        title: 'Deal Infiltrado',
        leadId: leadBId,
        value: 99999,
        tenantId: tenantAId
      }
    });
    assert.strictEqual(v9.status, 201);
    const createdDealTrojan = v9.body.data;
    assert.strictEqual(createdDealTrojan.tenantId, tenantBId, 'tenantId do deal deve ser forçado para tenantBId');
    console.log('  🛡️ Bloqueado: Anti-spoofing ativo em Deals (tenantId forçado para o do token)');
    attackPassCount++;

    // VETOR 10: Forged JWT Token (Assinatura HMAC com segredo inválido)
    console.log('▶ Vetor 10: Tentativa de acesso com Token JWT Forjado/Adulterado...');
    const fakeHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const fakePayload = Buffer.from(JSON.stringify({
      userId: 'usr_hacker',
      tenantId: tenantAId,
      role: 'PROPRIETARIO',
      name: 'Falso Proprietario',
      exp: Date.now() + 3600000
    })).toString('base64url');
    const fakeSignature = crypto.createHmac('sha256', 'chave_secreta_falsa_123456').update(`${fakeHeader}.${fakePayload}`).digest('base64url');
    const forgedToken = `${fakeHeader}.${fakePayload}.${fakeSignature}`;

    const v10 = await makeRequest({
      method: 'GET',
      path: `/api/leads/${joaoLeadId}`,
      token: forgedToken
    });
    assert.strictEqual(v10.status, 401, 'Token com assinatura não verificada deve ser rejeitado com HTTP 401');
    console.log('  🛡️ Bloqueado: 401 Unauthorized (Assinatura criptográfica HMAC-SHA256 íntegra)');
    attackPassCount++;

    // VETOR 11: Isolamento de Telemetria de IA (GET /api/ai/usage)
    console.log('▶ Vetor 11: Tentativa de espionagem de custos/telemetria de IA entre tenants...');
    const v11 = await makeRequest({
      method: 'GET',
      path: '/api/ai/usage',
      token: tokenB
    });
    assert.strictEqual(v11.status, 200);
    assert.ok(v11.body.data.every(r => r.tenantId === tenantBId), 'Nenhum registro de consumo de IA de outro tenant pode ser retornado');
    console.log('  🛡️ Bloqueado: Telemetria de IA 100% isolada por tenantId');
    attackPassCount++;

    // VETOR 12: Isolamento da Base de Conhecimento (Cérebro da Empresa)
    console.log('▶ Vetor 12: Tentativa de espionagem de Knowledge Base proprietária...');
    const kbRes = await makeRequest({
      method: 'POST',
      path: '/api/knowledge-base',
      token: tokenA,
      body: {
        category: 'Estratégia',
        title: 'Segredo Industrial da Alpha',
        content: 'Fórmula de precificação secreta R$ 10.000'
      }
    });
    assert.strictEqual(kbRes.status, 201);
    const secretKbId = kbRes.body.data.id;

    const v12 = await makeRequest({
      method: 'GET',
      path: '/api/knowledge-base',
      token: tokenB
    });
    assert.strictEqual(v12.status, 200);
    const leakedKb = v12.body.data.find(k => k.id === secretKbId);
    assert.strictEqual(leakedKb, undefined, 'Base de conhecimento da empresa A NUNCA deve ser visível para empresa B');
    console.log('  🛡️ Bloqueado: Knowledge Base isolada por tenantId\n');
    attackPassCount++;

    console.log('================================================================');
    console.log('🎉 TESTE DE PENETRAÇÃO MULTI-TENANT CONCLUÍDO COM SUCESSO!');
    console.log(`🛡️ Total de vetores de ataque avaliados: 12`);
    console.log(`🛡️ Total de ataques neutralizados/bloqueados: ${attackPassCount} (100% de sucesso)`);
    console.log('================================================================\n');

  } finally {
    server.close();
  }
}

if (require.main === module) {
  runPenetrationTests().catch(err => {
    console.error('❌ Falha no teste de penetração:', err);
    process.exit(1);
  });
}

module.exports = { runPenetrationTests };
