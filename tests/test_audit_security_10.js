/**
 * AGENTISE MEGA CRM V2.0 - SUÍTE DE TESTES DE SEGURANÇA (10 CENÁRIOS SEÇÃO 15)
 * Validação rigorosa dos 10 cenários mandatórios solicitados na auditoria profunda.
 */

const http = require('http');
const assert = require('assert');
const crypto = require('crypto');
const server = require('../server');
const { registerTenant, generateToken, hashPassword, ROLES } = require('../services/authService');
const { leadsDB, dealsDB, usersDB, proposalsDB, tenantsDB, tasksDB, settingsDB } = require('../database/db');
const { consumeAiCredits, getTenantSubscription } = require('../services/billingService');

const TEST_PORT = 3110;

function makeRequest({ method, path, token, body, headers: customHeaders }) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
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

async function runSecuritySuite10() {
  console.log('🛡️ ================================================================');
  console.log('🛡️ [Agentise Mega CRM V2] SUÍTE DE 10 TESTES DE SEGURANÇA MANDATÓRIOS');
  console.log('🛡️ Auditoria Oficial Seção 15: Isolamento, RBAC, PIX, IA e Anti-Tampering');
  console.log('🛡️ ================================================================\n');

  await new Promise(resolve => server.listen(TEST_PORT, '127.0.0.1', resolve));

  let passedTests = 0;
  const totalTests = 10;

  try {
    const ts = Date.now();

    // SETUP: Tenant Alpha & Tenant Beta com Usuários e Recursos
    console.log('[Setup] Provisionando ambiente multi-tenant isolado...');
    const { tenant: tenantA, user: adminA, token: tokenAdminA } = registerTenant({
      companyName: `Alpha Corp ${ts}`,
      adminName: 'Admin Alpha',
      email: `admin.alpha.${ts}@test.local`,
      password: 'StrongPassword@123',
      segment: 'Tecnologia'
    });

    const sellerA = usersDB.insert({
      tenantId: tenantA.id,
      name: 'Seller Alpha',
      email: `seller.alpha.${ts}@test.local`,
      role: ROLES.VENDEDOR,
      passwordHash: hashPassword('Seller@123'),
      status: 'active'
    });
    const tokenSellerA = generateToken({
      userId: sellerA.id,
      tenantId: tenantA.id,
      role: sellerA.role,
      name: sellerA.name,
      email: sellerA.email
    });

    const { tenant: tenantB, user: adminB, token: tokenAdminB } = registerTenant({
      companyName: `Beta Corp ${ts}`,
      adminName: 'Admin Beta',
      email: `admin.beta.${ts}@test.local`,
      password: 'StrongPassword@123',
      segment: 'Automotivo'
    });

    // Recursos do Tenant B
    const leadB = leadsDB.insert({
      tenantId: tenantB.id,
      name: 'Lead Beta Confidencial',
      email: 'lead.beta@empresa.com',
      phone: '11999998888',
      status: 'novo'
    });

    const dealB = dealsDB.insert({
      tenantId: tenantB.id,
      leadId: leadB.id,
      title: 'Oportunidade Sigilosa Beta',
      value: 50000,
      stage: 'proposta'
    });

    console.log(`[Setup] Tenant A (${tenantA.id}) e Tenant B (${tenantB.id}) configurados com sucesso.\n`);

    // =========================================================================
    // TESTE 1: Tenant A tentando acessar recurso do Tenant B -> 403 ou 404
    // =========================================================================
    console.log('▶ TESTE 1: Tenant A tentando acessar recurso do Tenant B...');
    const resGetLead = await makeRequest({
      method: 'GET',
      path: `/api/leads/${leadB.id}`,
      token: tokenAdminA
    });
    assert.ok(resGetLead.status === 404 || resGetLead.status === 403, `GET lead alheio deve retornar 404 ou 403. Recebido: ${resGetLead.status}`);

    const resGetDeal = await makeRequest({
      method: 'GET',
      path: `/api/deals/${dealB.id}`,
      token: tokenAdminA
    });
    assert.ok(resGetDeal.status === 404 || resGetDeal.status === 403, `GET deal alheio deve retornar 404 ou 403. Recebido: ${resGetDeal.status}`);

    const resPutLead = await makeRequest({
      method: 'PUT',
      path: `/api/leads/${leadB.id}`,
      token: tokenAdminA,
      body: { name: 'Tentativa de Ataque IDOR' }
    });
    assert.ok(resPutLead.status === 404 || resPutLead.status === 403, `PUT lead alheio deve retornar 404 ou 403. Recebido: ${resPutLead.status}`);

    const resDeleteDeal = await makeRequest({
      method: 'DELETE',
      path: `/api/deals/${dealB.id}`,
      token: tokenAdminA
    });
    assert.ok(resDeleteDeal.status === 404 || resDeleteDeal.status === 403, `DELETE deal alheio deve retornar 404 ou 403. Recebido: ${resDeleteDeal.status}`);

    // Confirma que os dados do Tenant B continuam intactos
    const verifyLeadB = leadsDB.findById(leadB.id);
    assert.strictEqual(verifyLeadB.name, 'Lead Beta Confidencial', 'Lead do Tenant B não deve ter sido adulterado');
    console.log(`  🛡️ RESULTADO: ${resGetLead.status} ${resGetDeal.status} - Bloqueado com sucesso (recursos isolados e existência ocultada).`);
    passedTests++;

    // =========================================================================
    // TESTE 2: Usuário Seller tentando executar ação administrativa -> 403
    // =========================================================================
    console.log('▶ TESTE 2: Usuário Seller tentando executar ação administrativa...');
    const resCreateUserBySeller = await makeRequest({
      method: 'POST',
      path: '/api/users',
      token: tokenSellerA,
      body: { name: 'Novo Hacker', email: `hacker.${ts}@local.crm`, role: 'ADMINISTRADOR' }
    });
    assert.strictEqual(resCreateUserBySeller.status, 403, `Criação de usuário por Seller deve retornar 403. Recebido: ${resCreateUserBySeller.status}`);

    const resUpdateSettingsBySeller = await makeRequest({
      method: 'PUT',
      path: '/api/settings',
      token: tokenSellerA,
      body: { companyName: 'Hackeado' }
    });
    assert.strictEqual(resUpdateSettingsBySeller.status, 403, `Edição de configurações por Seller deve retornar 403. Recebido: ${resUpdateSettingsBySeller.status}`);

    const resUpgradeBySeller = await makeRequest({
      method: 'POST',
      path: '/api/billing/upgrade',
      token: tokenSellerA,
      body: { plan: 'agency' }
    });
    assert.strictEqual(resUpgradeBySeller.status, 403, `Upgrade de plano por Seller deve retornar 403. Recebido: ${resUpgradeBySeller.status}`);
    console.log('  🛡️ RESULTADO: 403 Forbidden - Todas as ações administrativas bloqueadas no backend para papel VENDEDOR.');
    passedTests++;

    // =========================================================================
    // TESTE 3: Manipulação de tenantId no request -> ignorar valor enviado e usar tenant da sessão
    // =========================================================================
    console.log('▶ TESTE 3: Manipulação de tenantId no request (Parameter Spoofing)...');
    const resSpoofedLead = await makeRequest({
      method: 'POST',
      path: '/api/leads',
      token: tokenAdminA,
      body: { name: 'Lead Injetado', email: 'spoofed@teste.com', tenantId: tenantB.id }
    });
    assert.strictEqual(resSpoofedLead.status, 201, 'Criação do lead deve responder 201');
    assert.strictEqual(resSpoofedLead.body.data.tenantId, tenantA.id, 'O tenantId retornado deve ser o da sessão (Tenant A)');

    const resSpoofedTask = await makeRequest({
      method: 'POST',
      path: '/api/tasks',
      token: tokenAdminA,
      body: { title: 'Tarefa com Tenant Injetado', tenantId: tenantB.id }
    });
    assert.strictEqual(resSpoofedTask.status, 201, 'Criação da tarefa deve responder 201');
    assert.strictEqual(resSpoofedTask.body.data.tenantId, tenantA.id, 'A tarefa deve pertencer ao Tenant A da sessão');

    const resSpoofedDeal = await makeRequest({
      method: 'POST',
      path: '/api/deals',
      token: tokenAdminA,
      body: { title: 'Deal com Tenant B Injetado', leadId: resSpoofedLead.body.data.id, value: 5000, tenantId: tenantB.id }
    });
    assert.strictEqual(resSpoofedDeal.status, 201, 'Criação da oportunidade deve responder 201');
    assert.strictEqual(resSpoofedDeal.body.data.tenantId, tenantA.id, 'A oportunidade deve pertencer ao Tenant A');
    console.log('  🛡️ RESULTADO: Ignorado valor enviado e forçado tenantId da sessão autenticada.');
    passedTests++;

    // =========================================================================
    // TESTE 4: Manipulação de userId -> acesso negado
    // =========================================================================
    console.log('▶ TESTE 4: Manipulação de userId (Escalada de Privilégio e Acesso Não Autorizado)...');
    const resModifyOtherUser = await makeRequest({
      method: 'PUT',
      path: `/api/users/${adminA.id}`,
      token: tokenSellerA,
      body: { role: 'VENDEDOR' }
    });
    assert.strictEqual(resModifyOtherUser.status, 403, 'Alteração de outro usuário por Seller deve retornar 403');

    const resSelfEscalate = await makeRequest({
      method: 'PUT',
      path: `/api/users/${sellerA.id}`,
      token: tokenSellerA,
      body: { role: 'PROPRIETARIO' }
    });
    assert.strictEqual(resSelfEscalate.status, 403, 'Auto-escalada de privilégio deve retornar 403');

    const resUnauthorizedSwitch = await makeRequest({
      method: 'POST',
      path: '/api/auth/switch-tenant',
      token: tokenSellerA,
      body: { tenantId: tenantB.id }
    });
    assert.strictEqual(resUnauthorizedSwitch.status, 403, 'Troca para tenant de terceiros deve retornar 403');
    console.log('  🛡️ RESULTADO: Acesso negado (403 Forbidden) em todas as tentativas de manipulação de userId.');
    passedTests++;

    // =========================================================================
    // TESTE 5: Manipulação de resourceId -> acesso negado / 404
    // =========================================================================
    console.log('▶ TESTE 5: Manipulação de resourceId (IDs randômicos ou inexistentes)...');
    const fakeId = 'lea_fake_9999_invalido';
    const resFakeLead = await makeRequest({
      method: 'GET',
      path: `/api/leads/${fakeId}`,
      token: tokenAdminA
    });
    assert.strictEqual(resFakeLead.status, 404, 'Consulta a resourceId inexistente deve retornar 404');

    const resFakeDeal = await makeRequest({
      method: 'GET',
      path: '/api/deals/dea_inexistente_9999',
      token: tokenAdminA
    });
    assert.strictEqual(resFakeDeal.status, 404, 'Consulta a deal inexistente deve retornar 404');

    const resFakeProposalConfirm = await makeRequest({
      method: 'PATCH',
      path: '/api/proposals/prp_fake_9999/confirm',
      token: tokenAdminA
    });
    assert.strictEqual(resFakeProposalConfirm.status, 404, 'Confirmação de proposta inexistente deve retornar 404');

    const resFakeTaskDelete = await makeRequest({
      method: 'DELETE',
      path: '/api/tasks/tsk_fake_9999',
      token: tokenAdminA
    });
    assert.strictEqual(resFakeTaskDelete.status, 404, 'Deleção de tarefa inexistente deve retornar 404');
    console.log('  🛡️ RESULTADO: Acesso negado / 404 Not Found para todos os resourceIds inexistentes ou forjados.');
    passedTests++;

    // =========================================================================
    // TESTE 6: Tentativa de alterar plano pelo frontend -> não alterar
    // =========================================================================
    console.log('▶ TESTE 6: Tentativa de alterar plano pelo frontend...');
    const originalSub = getTenantSubscription(tenantA.id);
    assert.strictEqual(originalSub.plan.id, 'starter', 'Plano inicial deve ser starter');

    const resTamperPlan = await makeRequest({
      method: 'PUT',
      path: '/api/workspace',
      token: tokenAdminA,
      body: {
        name: 'Alpha Corp Renomeada',
        plan: 'agency',
        price: 0,
        aiCredits: 999999
      }
    });
    assert.strictEqual(resTamperPlan.status, 200, 'Atualização de campos permitidos deve ter sucesso');

    const checkSubAfterTamper = getTenantSubscription(tenantA.id);
    assert.strictEqual(checkSubAfterTamper.plan.id, 'starter', 'Plano no backend DEVE continuar starter (inalterado)');
    assert.notStrictEqual(checkSubAfterTamper.plan.id, 'agency', 'Tentativa de forçar plano agency pelo body deve ser ignorada');
    console.log(`  🛡️ RESULTADO: Não alterado. Plano no backend mantido como '${checkSubAfterTamper.plan.id}'.`);
    passedTests++;

    // =========================================================================
    // TESTE 7: Tentativa de aumentar créditos IA -> bloqueado
    // =========================================================================
    console.log('▶ TESTE 7: Tentativa de aumentar créditos IA...');
    const subBeforeCredits = getTenantSubscription(tenantA.id);
    const initialCredits = subBeforeCredits.aiCredits;

    await makeRequest({
      method: 'PUT',
      path: '/api/workspace',
      token: tokenAdminA,
      body: { aiCredits: 500000, aiCreditsUsed: 0 }
    });
    const subAfterWorkspacePut = getTenantSubscription(tenantA.id);
    assert.strictEqual(subAfterWorkspacePut.aiCredits, initialCredits, 'aiCredits não pode ser alterado via workspace');

    const negativeConsumeResult = consumeAiCredits(tenantA.id, 'hacker_inflation', -5000);
    assert.strictEqual(negativeConsumeResult.creditsUsed, 0, 'Consumo negativo deve ser sanitizado para 0');

    const subAfterNegative = getTenantSubscription(tenantA.id);
    assert.ok(subAfterNegative.aiCreditsUsed >= 0, 'aiCreditsUsed não pode ser negativado');
    console.log('  🛡️ RESULTADO: Bloqueado. Tentativas de injeção ou inflação de créditos neutralizadas.');
    passedTests++;

    // =========================================================================
    // TESTE 8: Tentativa de marcar PIX como pago diretamente -> bloqueado
    // =========================================================================
    console.log('▶ TESTE 8: Tentativa de marcar PIX como pago diretamente...');
    const resProp = await makeRequest({
      method: 'POST',
      path: '/api/proposals',
      token: tokenAdminA,
      body: {
        dealId: resSpoofedDeal.body.data.id,
        leadId: resSpoofedLead.body.data.id,
        amount: 2500,
        dealTitle: 'Serviço de Consultoria'
      }
    });
    assert.strictEqual(resProp.status, 200, 'Criação de proposta deve responder 200');
    const proposalId = resProp.body.data.proposalId;

    const resSellerConfirm = await makeRequest({
      method: 'PATCH',
      path: `/api/proposals/${proposalId}/confirm`,
      token: tokenSellerA
    });
    assert.strictEqual(resSellerConfirm.status, 403, 'Vendedor não pode liquidar propostas diretamente (exige PROPOSALS_CONFIRM)');

    const resArbitraryPut = await makeRequest({
      method: 'PUT',
      path: `/api/proposals/${proposalId}`,
      token: tokenAdminA,
      body: { status: 'paga' }
    });
    assert.strictEqual(resArbitraryPut.status, 404, 'Endpoint PUT /api/proposals/:id não deve existir');

    const proposalInDb = proposalsDB.findById(proposalId);
    assert.strictEqual(proposalInDb.status, 'pendente', 'Status da proposta DEVE permanecer pendente');
    console.log('  🛡️ RESULTADO: Bloqueado. Liquidação manual desautorizada e alteração direta de status impedida.');
    passedTests++;

    // =========================================================================
    // TESTE 9: Tentativa de acessar API key de outro tenant -> bloqueado
    // =========================================================================
    console.log('▶ TESTE 9: Tentativa de acessar API key de outro tenant...');
    await makeRequest({
      method: 'PUT',
      path: '/api/settings',
      token: tokenAdminA,
      body: { apiKey: 'sk-ant-api03-SECRET-KEY-TENANT-ALPHA-9999' }
    });

    const resSettingsB = await makeRequest({
      method: 'GET',
      path: '/api/settings',
      token: tokenAdminB
    });
    assert.strictEqual(resSettingsB.status, 200, 'GET /api/settings do Tenant B deve responder 200 para seu próprio escopo');
    assert.notStrictEqual(resSettingsB.body.data.apiKey, 'sk-ant-api03-SECRET-KEY-TENANT-ALPHA-9999', 'Tenant B NUNCA deve ver a chave do Tenant A');

    const resSellerSettings = await makeRequest({
      method: 'GET',
      path: '/api/settings',
      token: tokenSellerA
    });
    assert.strictEqual(resSellerSettings.status, 403, 'Seller tentando acessar /api/settings deve ser bloqueado com 403');

    const resAdminSettings = await makeRequest({
      method: 'GET',
      path: '/api/settings',
      token: tokenAdminA
    });
    assert.ok(resAdminSettings.body.data.apiKey.includes('***'), 'A chave de API deve ser retornada mascarada com ***');
    assert.ok(!resAdminSettings.body.data.apiKey.includes('SECRET-KEY-TENANT-ALPHA'), 'O miolo confidencial da chave não deve ser exposto na API');

    const resCrossSettings = await makeRequest({
      method: 'GET',
      path: `/api/settings/${tenantA.id}`,
      token: tokenAdminB
    });
    assert.strictEqual(resCrossSettings.status, 403, 'Acesso direto a configurações alheias deve ser 403');
    console.log('  🛡️ RESULTADO: Bloqueado. Chaves 100% isoladas por tenant e mascaradas na API.');
    passedTests++;

    // =========================================================================
    // TESTE 10: Seller tentando acessar dados financeiros administrativos -> bloqueado conforme RBAC
    // =========================================================================
    console.log('▶ TESTE 10: Seller tentando acessar dados financeiros administrativos...');
    const resSellerBi = await makeRequest({
      method: 'GET',
      path: '/api/analytics/bi',
      token: tokenSellerA
    });
    assert.strictEqual(resSellerBi.status, 403, `Seller acessando /api/analytics/bi deve receber 403. Recebido: ${resSellerBi.status}`);

    const resSellerSubscription = await makeRequest({
      method: 'GET',
      path: '/api/billing/subscription',
      token: tokenSellerA
    });
    assert.strictEqual(resSellerSubscription.status, 403, `Seller acessando /api/billing/subscription deve receber 403. Recebido: ${resSellerSubscription.status}`);

    const resSellerAnalyst = await makeRequest({
      method: 'POST',
      path: '/api/copilot/analyst',
      token: tokenSellerA,
      body: { question: 'Qual o faturamento total da empresa?' }
    });
    assert.strictEqual(resSellerAnalyst.status, 403, `Seller acessando Analista IA de Gestão deve receber 403. Recebido: ${resSellerAnalyst.status}`);

    const resAdminBi = await makeRequest({
      method: 'GET',
      path: '/api/analytics/bi',
      token: tokenAdminA
    });
    assert.strictEqual(resAdminBi.status, 200, 'Administrador deve conseguir acessar /api/analytics/bi normalmente');
    console.log('  🛡️ RESULTADO: Bloqueado conforme RBAC (403 Forbidden para Seller em BI, Faturamento e Analista Executivo).');
    passedTests++;

    console.log('\n================================================================');
    console.log('🎉 SUÍTE DOS 10 TESTES DE SEGURANÇA FINALIZADA COM SUCESSO!');
    console.log(`🛡️ Total de testes executados: ${totalTests}`);
    console.log(`🛡️ Total de testes aprovados:  ${passedTests}/${totalTests} (100% de sucesso)`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ ERRO NA SUÍTE DE SEGURANÇA:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    server.close();
  }
}

if (require.main === module) {
  runSecuritySuite10();
}

module.exports = { runSecuritySuite10 };
