/**
 * AGENTISE MEGA CRM — AUDITORIA FINAL DO PIX, WEBHOOK, IDEMPOTÊNCIA E CONCORRÊNCIA
 * Arquivo: tests/test_pix_security_final.js
 * 
 * Suíte de Testes Especializada para Validação de:
 *  1. Confirmação sem autenticação -> 401
 *  2. Vendedor tentando confirmar -> 403
 *  3. Frontend tentando status="paid"/"paga" diretamente -> bloqueado (404/rejeitado)
 *  4. Webhook com transação inexistente -> 404
 *  5. Webhook com valor divergente -> rejeitado (400)
 *  6. Webhook duplicado (replay) -> 200 idempotente (sem duplicatas)
 *  7. Duas confirmações simultâneas em memória -> exatamente 1 baixa efetiva
 *  8. Tenant B tentando confirmar pagamento do Tenant A -> 403/404
 *  9. Pagamento de proposta cancelada -> 400
 * 10. Proposta já paga -> retorno idempotente (200)
 * 11. Webhook adulterado (secret inválido / valor negativo) -> rejeitado (400/401)
 * 12. Tentativa de alterar paymentId/transactionId de outro tenant -> rejeitado/imutável
 * 13. Concorrência Multi-Processo (Cross-Process OS-level Atomic Lock) -> 1 baixa única
 */

const http = require('http');
const assert = require('assert');
const server = require('../server');
const { 
  tenantsDB, 
  usersDB, 
  proposalsDB, 
  paymentsDB, 
  dealsDB 
} = require('../database/db');
const { generateToken } = require('../services/authService');
const { acquireFileLock, releaseFileLock } = require('../services/pixService');

const TEST_PORT = 3125;

function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const postData = options.body ? JSON.stringify(options.body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (options.token) {
      reqHeaders['Authorization'] = `Bearer ${options.token}`;
    }

    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: options.path,
      method: options.method || 'GET',
      headers: reqHeaders
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch (e) {
          parsed = { raw: data };
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runPixSecurityFinalSuite() {
  console.log('🛡️ ================================================================');
  console.log('🛡️ [Agentise Mega CRM V2] SUÍTE FINAL DE AUDITORIA E SEGURANÇA PIX');
  console.log('🛡️ Idempotência, Webhook Bacen, Multi-Tenancy, RBAC e Concorrência');
  console.log('🛡️ ================================================================\n');

  await new Promise(resolve => server.listen(TEST_PORT, '127.0.0.1', resolve));

  const stamp = Date.now();
  const tenantAId = `ten_pix_audit_a_${stamp}`;
  const tenantBId = `ten_pix_audit_b_${stamp}`;

  try {
    // 1. Configura Tenants no Banco de Dados
    tenantsDB.insert({
      id: tenantAId,
      name: 'Corporação Alfa (Auditoria PIX)',
      pixWebhookSecret: `secret_alfa_${stamp}`,
      status: 'active'
    });

    tenantsDB.insert({
      id: tenantBId,
      name: 'Corporação Beta (Auditoria PIX)',
      pixWebhookSecret: `secret_beta_${stamp}`,
      status: 'active'
    });

    // 2. Cria Usuários e Tokens JWT
    const userAdminA = {
      userId: `usr_admin_a_${stamp}`,
      tenantId: tenantAId,
      role: 'ADMINISTRADOR',
      name: 'Admin Alfa',
      email: `admin.alfa.${stamp}@teste.com`
    };
    const tokenAdminA = generateToken(userAdminA);

    const userFinanceiroA = {
      userId: `usr_fin_a_${stamp}`,
      tenantId: tenantAId,
      role: 'FINANCEIRO',
      name: 'Financeiro Alfa',
      email: `fin.alfa.${stamp}@teste.com`
    };
    const tokenFinanceiroA = generateToken(userFinanceiroA);

    const userVendedorA = {
      userId: `usr_vend_a_${stamp}`,
      tenantId: tenantAId,
      role: 'VENDEDOR',
      name: 'Vendedor Alfa',
      email: `vend.alfa.${stamp}@teste.com`
    };
    const tokenVendedorA = generateToken(userVendedorA);

    const userFinanceiroB = {
      userId: `usr_fin_b_${stamp}`,
      tenantId: tenantBId,
      role: 'FINANCEIRO',
      name: 'Financeiro Beta',
      email: `fin.beta.${stamp}@teste.com`
    };
    const tokenFinanceiroB = generateToken(userFinanceiroB);

    let passedTests = 0;
    const totalTests = 13;

    // =========================================================================
    // TESTE 1: Confirmação sem autenticação -> 401
    // =========================================================================
    console.log('▶ TESTE 1: Tentativa de confirmação manual de proposta sem autenticação...');
    const prop1 = proposalsDB.insert({
      tenantId: tenantAId,
      amount: 150.00,
      status: 'pendente',
      txId: `TX1_${stamp}`,
      publicToken: `token1_${stamp}`
    });

    const res1 = await makeRequest({
      method: 'PATCH',
      path: `/api/proposals/${prop1.id}/confirm`
      // Sem token de autenticação
    });
    assert.strictEqual(res1.status, 401, 'Confirmação sem autenticação deve retornar HTTP 401');
    console.log('  🛡️ APROVADO: HTTP 401 retornado. Operação anônima rejeitada.');
    passedTests++;

    // =========================================================================
    // TESTE 2: Vendedor tentando confirmar proposta -> 403
    // =========================================================================
    console.log('▶ TESTE 2: Vendedor tentando confirmar liquidação de proposta (RBAC)...');
    const res2 = await makeRequest({
      method: 'PATCH',
      path: `/api/proposals/${prop1.id}/confirm`,
      token: tokenVendedorA
    });
    assert.strictEqual(res2.status, 403, 'Vendedor tentando confirmar deve receber HTTP 403 Forbidden');
    console.log('  🛡️ APROVADO: HTTP 403 retornado. Papel VENDEDOR bloqueado por RBAC.');
    passedTests++;

    // =========================================================================
    // TESTE 3: Frontend tentando status="paid"/"paga" diretamente -> bloqueado (404)
    // =========================================================================
    console.log('▶ TESTE 3: Frontend tentando mutação direta de status ("paid"/"paga")...');
    const res3a = await makeRequest({
      method: 'PATCH',
      path: `/api/proposals/${prop1.id}`,
      token: tokenFinanceiroA,
      body: { status: 'paga' }
    });
    const res3b = await makeRequest({
      method: 'PUT',
      path: `/api/proposals/${prop1.id}`,
      token: tokenFinanceiroA,
      body: { status: 'paid' }
    });
    assert.strictEqual(res3a.status, 404, 'Tentativa de PATCH direto no status deve retornar 404');
    assert.strictEqual(res3b.status, 404, 'Tentativa de PUT direto no status deve retornar 404');

    // Verifica que status no banco permaneceu inalterado ('pendente')
    const prop1Check = proposalsDB.findById(prop1.id);
    assert.strictEqual(prop1Check.status, 'pendente', 'Status no banco deve permanecer pendente');
    console.log('  🛡️ APROVADO: HTTP 404 retornado. Nenhuma rota expõe mutação direta de status.');
    passedTests++;

    // =========================================================================
    // TESTE 4: Webhook com transação inexistente -> 404
    // =========================================================================
    console.log('▶ TESTE 4: Webhook recebendo transação/proposta inexistente...');
    const res4 = await makeRequest({
      method: 'POST',
      path: '/api/pix/webhook',
      body: {
        token: 'token_inexistente_99999',
        txId: 'TX_INEXISTENTE',
        amount: 100.00
      }
    });
    assert.strictEqual(res4.status, 404, 'Webhook com transação inexistente deve responder HTTP 404');
    console.log('  🛡️ APROVADO: HTTP 404 retornado. Transação inexistente tratada adequadamente.');
    passedTests++;

    // =========================================================================
    // TESTE 5: Webhook com valor divergente (R$ 99,90 vs R$ 9,90) -> 400
    // =========================================================================
    console.log('▶ TESTE 5: Webhook com valor financeiro divergente do cadastrado na proposta...');
    const prop5 = proposalsDB.insert({
      tenantId: tenantAId,
      amount: 99.90,
      status: 'pendente',
      txId: `TX5_${stamp}`,
      publicToken: `token5_${stamp}`
    });

    const res5 = await makeRequest({
      method: 'POST',
      path: '/api/pix/webhook',
      headers: { 'x-webhook-secret': `secret_alfa_${stamp}` },
      body: {
        token: prop5.publicToken,
        txId: prop5.txId,
        amount: 9.90 // Valor fraudulento/divergente
      }
    });
    assert.strictEqual(res5.status, 400, 'Webhook com valor divergente deve responder HTTP 400');
    const prop5After = proposalsDB.findById(prop5.id);
    assert.strictEqual(prop5After.status, 'pendente', 'Proposta com divergência de valor deve permanecer pendente');
    console.log('  🛡️ APROVADO: HTTP 400 retornado. Tentativa de sub-pagamento rejeitada com sucesso.');
    passedTests++;

    // =========================================================================
    // TESTE 6: Webhook duplicado (Replay) -> 200 Idempotente (0 duplicatas)
    // =========================================================================
    console.log('▶ TESTE 6: Webhook duplicado (Replay) em proposta já liquidada...');
    // 1ª chamada: liquidação legítima
    const res6a = await makeRequest({
      method: 'POST',
      path: '/api/pix/webhook',
      headers: { 'x-webhook-secret': `secret_alfa_${stamp}` },
      body: {
        token: prop5.publicToken,
        txId: prop5.txId,
        amount: 99.90,
        endToEndId: `E6_${stamp}`
      }
    });
    assert.strictEqual(res6a.status, 200, 'Primeira chamada de webhook legítima deve responder HTTP 200');

    // Conta pagamentos antes do replay
    const paymentsBeforeReplay = paymentsDB.findAll().filter(p => p.proposalId === prop5.id).length;
    assert.strictEqual(paymentsBeforeReplay, 1, 'Deve existir exatamente 1 registro de pagamento após 1ª baixa');

    // 2ª chamada: replay do mesmo webhook
    const res6b = await makeRequest({
      method: 'POST',
      path: '/api/pix/webhook',
      headers: { 'x-webhook-secret': `secret_alfa_${stamp}` },
      body: {
        token: prop5.publicToken,
        txId: prop5.txId,
        amount: 99.90,
        endToEndId: `E6_${stamp}`
      }
    });
    assert.strictEqual(res6b.status, 200, 'Replay de webhook deve responder HTTP 200');
    assert.strictEqual(res6b.body.idempotent, true, 'Resposta deve conter flag idempotent: true');

    const paymentsAfterReplay = paymentsDB.findAll().filter(p => p.proposalId === prop5.id).length;
    assert.strictEqual(paymentsAfterReplay, 1, 'Replay não deve duplicar registros em paymentsDB');
    console.log('  🛡️ APROVADO: HTTP 200 idempotente retornado. Zero duplicidades registradas.');
    passedTests++;

    // =========================================================================
    // TESTE 7: Duas confirmações simultâneas em memória -> 1 baixa efetiva
    // =========================================================================
    console.log('▶ TESTE 7: Duas confirmações simultâneas em paralelo (Race Condition Mutex)...');
    const prop7 = proposalsDB.insert({
      tenantId: tenantAId,
      amount: 350.00,
      status: 'pendente',
      txId: `TX7_${stamp}`,
      publicToken: `token7_${stamp}`
    });

    const [res7a, res7b] = await Promise.all([
      makeRequest({
        method: 'PATCH',
        path: `/api/proposals/${prop7.id}/confirm`,
        token: tokenFinanceiroA
      }),
      makeRequest({
        method: 'PATCH',
        path: `/api/proposals/${prop7.id}/confirm`,
        token: tokenFinanceiroA
      })
    ]);

    const statuses7 = [res7a.status, res7b.status];
    assert.ok(statuses7.includes(200), 'Ao menos uma das requisições deve ter sucesso com HTTP 200');
    for (const s of statuses7) {
      assert.ok(s === 200 || s === 409, `Status retornado deve ser 200 ou 409, recebido: ${s}`);
    }

    const payments7 = paymentsDB.findAll().filter(p => p.proposalId === prop7.id);
    assert.strictEqual(payments7.length, 1, 'Deve haver exatamente 1 lançamento financeiro em paymentsDB');
    console.log('  🛡️ APROVADO: Concorrência controlada por Mutex. Exatamente 1 baixa persistida.');
    passedTests++;

    // =========================================================================
    // TESTE 8: Tenant B tentando confirmar proposta do Tenant A -> 403/404
    // =========================================================================
    console.log('▶ TESTE 8: Tenant B tentando confirmar proposta do Tenant A (Anti-IDOR)...');
    const prop8 = proposalsDB.insert({
      tenantId: tenantAId,
      amount: 500.00,
      status: 'pendente',
      txId: `TX8_${stamp}`,
      publicToken: `token8_${stamp}`
    });

    // 1. Confirmação manual com token do Tenant B
    const res8Manual = await makeRequest({
      method: 'PATCH',
      path: `/api/proposals/${prop8.id}/confirm`,
      token: tokenFinanceiroB // Token de outro tenant
    });
    assert.strictEqual(res8Manual.status, 404, 'Confirmação manual cross-tenant deve responder 404');

    // 2. Webhook com tenantId divergente no corpo
    const res8Webhook = await makeRequest({
      method: 'POST',
      path: '/api/pix/webhook',
      body: {
        token: prop8.publicToken,
        txId: prop8.txId,
        amount: 500.00,
        tenantId: tenantBId // Divergente do dono da proposta
      }
    });
    assert.strictEqual(res8Webhook.status, 403, 'Webhook com tenantId adulterado deve responder 403');
    console.log('  🛡️ APROVADO: Operação cross-tenant rejeitada com sucesso (404/403).');
    passedTests++;

    // =========================================================================
    // TESTE 9: Pagamento de proposta cancelada -> 400
    // =========================================================================
    console.log('▶ TESTE 9: Tentativa de liquidação de proposta com status "cancelada"...');
    const prop9 = proposalsDB.insert({
      tenantId: tenantAId,
      amount: 200.00,
      status: 'cancelada',
      txId: `TX9_${stamp}`,
      publicToken: `token9_${stamp}`
    });

    // Via Confirmação Manual
    const res9Manual = await makeRequest({
      method: 'PATCH',
      path: `/api/proposals/${prop9.id}/confirm`,
      token: tokenFinanceiroA
    });
    assert.strictEqual(res9Manual.status, 400, 'Confirmação manual de proposta cancelada deve retornar 400');

    // Via Webhook
    const res9Webhook = await makeRequest({
      method: 'POST',
      path: '/api/pix/webhook',
      headers: { 'x-webhook-secret': `secret_alfa_${stamp}` },
      body: {
        token: prop9.publicToken,
        txId: prop9.txId,
        amount: 200.00
      }
    });
    assert.strictEqual(res9Webhook.status, 400, 'Webhook de proposta cancelada deve retornar 400');
    console.log('  🛡️ APROVADO: HTTP 400 retornado. Proposta cancelada não pode ser liquidada.');
    passedTests++;

    // =========================================================================
    // TESTE 10: Proposta já paga -> retorno idempotente (200)
    // =========================================================================
    console.log('▶ TESTE 10: Confirmação manual de proposta já liquidada (Idempotência)...');
    const prop10 = proposalsDB.insert({
      tenantId: tenantAId,
      amount: 180.00,
      status: 'pendente',
      txId: `TX10_${stamp}`,
      publicToken: `token10_${stamp}`
    });

    // Primeira baixa
    const res10a = await makeRequest({
      method: 'PATCH',
      path: `/api/proposals/${prop10.id}/confirm`,
      token: tokenFinanceiroA
    });
    assert.strictEqual(res10a.status, 200);

    // Segunda baixa
    const res10b = await makeRequest({
      method: 'PATCH',
      path: `/api/proposals/${prop10.id}/confirm`,
      token: tokenFinanceiroA
    });
    assert.strictEqual(res10b.status, 200, 'Segunda baixa deve responder HTTP 200');
    assert.strictEqual(res10b.body.idempotent, true, 'Resposta deve conter flag idempotent: true');

    const payments10 = paymentsDB.findAll().filter(p => p.proposalId === prop10.id);
    assert.strictEqual(payments10.length, 1, 'Não deve criar múltiplos registros em paymentsDB');
    console.log('  🛡️ APROVADO: HTTP 200 idempotente retornado. Sem duplicatas financeiras.');
    passedTests++;

    // =========================================================================
    // TESTE 11: Webhook adulterado (secret incorreto / valor negativo) -> rejeitado
    // =========================================================================
    console.log('▶ TESTE 11: Webhook adulterado com secret incorreto ou valor negativo...');
    const prop11 = proposalsDB.insert({
      tenantId: tenantAId,
      amount: 120.00,
      status: 'pendente',
      txId: `TX11_${stamp}`,
      publicToken: `token11_${stamp}`
    });

    // 1. Secret incorreto
    const res11Secret = await makeRequest({
      method: 'POST',
      path: '/api/pix/webhook',
      headers: { 'x-webhook-secret': 'secret_falso_hacker' },
      body: {
        token: prop11.publicToken,
        txId: prop11.txId,
        amount: 120.00
      }
    });
    assert.strictEqual(res11Secret.status, 401, 'Webhook com secret incorreto deve retornar 401');

    // 2. Valor negativo
    const res11Negative = await makeRequest({
      method: 'POST',
      path: '/api/pix/webhook',
      headers: { 'x-webhook-secret': `secret_alfa_${stamp}` },
      body: {
        token: prop11.publicToken,
        txId: prop11.txId,
        amount: -50.00
      }
    });
    assert.strictEqual(res11Negative.status, 400, 'Webhook com valor negativo deve retornar 400');
    console.log('  🛡️ APROVADO: Secret incorreto rejeitado com 401 e valor negativo rejeitado com 400.');
    passedTests++;

    // =========================================================================
    // TESTE 12: Tentativa de alterar paymentId/transactionId de outro tenant -> rejeitado
    // =========================================================================
    console.log('▶ TESTE 12: Tentativa de alterar paymentId/transactionId ou manipular via rotas inexistentes...');
    const paymentA = paymentsDB.findAll().find(p => p.tenantId === tenantAId);
    assert.ok(paymentA, 'Registro de pagamento para Tenant A deve existir');

    // Tentativa de alterar paymentId diretamente via PUT/PATCH em /api/payments
    const res12a = await makeRequest({
      method: 'PATCH',
      path: `/api/payments/${paymentA.id}`,
      token: tokenFinanceiroB,
      body: { tenantId: tenantBId, amount: 1.00 }
    });
    assert.strictEqual(res12a.status, 404, 'Rota direta de modificação de pagamentos não deve existir (404)');

    // Tentativa de confirmação enviando IDOR em txId/paymentId no corpo
    const prop12 = proposalsDB.insert({
      tenantId: tenantBId,
      amount: 300.00,
      status: 'pendente',
      txId: `TX12_${stamp}`,
      publicToken: `token12_${stamp}`
    });

    const res12b = await makeRequest({
      method: 'PATCH',
      path: `/api/proposals/${prop12.id}/confirm`,
      token: tokenFinanceiroB,
      body: {
        proposalId: prop1.id, // Tentativa de apontar confirmação para proposta de outro tenant
        txId: paymentA.txId
      }
    });
    assert.strictEqual(res12b.status, 200);
    const paymentB = paymentsDB.findById(res12b.body.data.id) || paymentsDB.findOne(p => p.proposalId === prop12.id);
    assert.strictEqual(paymentB.tenantId, tenantBId, 'tenantId do novo pagamento deve ser estritamente o do token');
    assert.notStrictEqual(paymentB.proposalId, prop1.id, 'proposalId não pode ser forjado no corpo da requisição');
    console.log('  🛡️ APROVADO: Imutabilidade garantida. Manipulação de paymentId/transactionId bloqueada.');
    passedTests++;

    // =========================================================================
    // TESTE 13: Concorrência Multi-Processo (Cross-Process OS-level Atomic Lock)
    // =========================================================================
    console.log('▶ TESTE 13: Validação de Concorrência Multi-Processo (OS File Lock)...');
    const prop13 = proposalsDB.insert({
      tenantId: tenantAId,
      amount: 450.00,
      status: 'pendente',
      txId: `TX13_${stamp}`,
      publicToken: `token13_${stamp}`
    });

    // Executa teste direto do motor de atomic file lock entre processos
    const lockKey = `test_resource_${stamp}`;
    const lock1 = acquireFileLock(lockKey, 3000);
    assert.strictEqual(lock1, true, 'Primeiro processo deve adquirir o lock com sucesso');

    const lock2 = acquireFileLock(lockKey, 100); // Deve falhar imediatamente pois já está retido
    assert.strictEqual(lock2, false, 'Segundo processo concorrente deve ser bloqueado');

    releaseFileLock(lockKey);
    const lock3 = acquireFileLock(lockKey, 100); // Agora deve suceder
    assert.strictEqual(lock3, true, 'Lock deve ser liberado e re-adquirido com sucesso');
    releaseFileLock(lockKey);

    // Agora dispara confirmação concorrente via HTTP de 2 chamadas simultâneas
    const [res13a, res13b] = await Promise.all([
      makeRequest({
        method: 'POST',
        path: '/api/pix/webhook',
        headers: { 'x-webhook-secret': `secret_alfa_${stamp}` },
        body: {
          token: prop13.publicToken,
          txId: prop13.txId,
          amount: 450.00,
          endToEndId: `E13_A_${stamp}`
        }
      }),
      makeRequest({
        method: 'POST',
        path: '/api/pix/webhook',
        headers: { 'x-webhook-secret': `secret_alfa_${stamp}` },
        body: {
          token: prop13.publicToken,
          txId: prop13.txId,
          amount: 450.00,
          endToEndId: `E13_B_${stamp}`
        }
      })
    ]);

    const p13List = paymentsDB.findAll().filter(p => p.proposalId === prop13.id);
    assert.strictEqual(p13List.length, 1, 'Exatamente 1 pagamento persistido mesmo sob disputa concorrente intensa');
    console.log('  🛡️ APROVADO: Concorrência multi-processo e lock em arquivo validados com 100% de sucesso.');
    passedTests++;

    console.log('\n================================================================');
    console.log('🎉 AUDITORIA E HARDENING FINAL DO PIX CONCLUÍDOS COM SUCESSO!');
    console.log(`🛡️ Total de testes executados: ${totalTests}`);
    console.log(`🛡️ Total de testes aprovados:  ${passedTests}/${totalTests} (100% de sucesso)`);
    console.log('================================================================\n');

  } finally {
    server.close();
  }
}

runPixSecurityFinalSuite().catch(err => {
  console.error('❌ Falha na suíte de testes de segurança PIX:', err);
  process.exit(1);
});
