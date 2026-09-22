/**
 * AGENTISE MEGA CRM V4 — SUÍTE DE TESTES COMERCIAIS
 * Arquivo: tests/test_v4_commercial.js
 * 
 * Validação automatizada de 14 vetores de transformação comercial:
 *  1. Ingestão de evento LANDING_VIEW público (/api/analytics/events)
 *  2. Registro de novo tenant com Trial de 7 dias e emissão de SIGNUP + TRIAL_STARTED
 *  3. Conclusão do Onboarding de 3 passos (/api/onboarding/complete)
 *  4. Verificação de Score inicial de Ativação (/api/tenant/activation-status)
 *  5. Criação do primeiro lead e ativação de FIRST_LEAD
 *  6. Criação da primeira oportunidade e ativação de FIRST_DEAL
 *  7. Execução do RecuperaIA / IA Copilot e ativação de FIRST_AI_ACTION
 *  8. Criação da primeira regra de automação e ativação de FIRST_AUTOMATION
 *  9. Progressão do checklist até 100% de Ativação do Tenant
 * 10. Início de Checkout do Plano Business R$ 397 (/api/billing/checkout)
 * 11. Validação estrita do Payload PIX EMV Bacen e Checksum CRC-16
 * 12. Confirmação legítima de pagamento PIX (/api/proposals/:id/confirm)
 * 13. Ativação automática do plano no Tenant (upgrade para Business e novas cotas)
 * 14. Métricas Administrativas SaaS, Funil Comercial e Barreira RBAC (/api/admin/saas-metrics)
 */

const http = require('http');
const assert = require('assert');
const server = require('../server');
const { 
  tenantsDB, 
  usersDB, 
  proposalsDB, 
  paymentsDB, 
  dealsDB,
  leadsDB,
  automationsDB,
  conversionEventsDB
} = require('../database/db');
const { generateToken } = require('../services/authService');

const TEST_PORT = 3135;

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

function verifyPixCrc16(payload) {
  if (!payload || typeof payload !== 'string' || payload.length < 8) return false;
  const crcIndex = payload.lastIndexOf('6304');
  if (crcIndex === -1) return false;
  
  const toValidate = payload.substring(0, crcIndex + 4);
  const expectedCrc = payload.substring(crcIndex + 4).toUpperCase();
  
  let crc = 0xFFFF;
  for (let i = 0; i < toValidate.length; i++) {
    crc ^= (toValidate.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  const calculatedHex = crc.toString(16).toUpperCase().padStart(4, '0');
  return calculatedHex === expectedCrc;
}

async function runCommercialSuite() {
  console.log('🚀 ================================================================');
  console.log('🚀 [Agentise Mega CRM V4] SUÍTE DE TESTES DE TRANSFORMAÇÃO COMERCIAL');
  console.log('🚀 Trial, Onboarding, Ativação, Checkout PIX Bacen, Upgrades e Funil');
  console.log('🚀 ================================================================\n');

  await new Promise(resolve => server.listen(TEST_PORT, '127.0.0.1', resolve));

  const stamp = Date.now();
  let passedCount = 0;

  try {
    // -------------------------------------------------------------------------
    // VETOR 1: Ingestão de evento público de Landing Page (LANDING_VIEW)
    // -------------------------------------------------------------------------
    console.log('▶ Vetor 1: Ingestão de evento público LANDING_VIEW (/api/analytics/events)...');
    const resV1 = await makeRequest({
      method: 'POST',
      path: '/api/analytics/events',
      body: {
        event: 'LANDING_VIEW',
        metadata: {
          source: 'google_organic',
          campaign: 'crm_ia_brasil',
          page: '/landing'
        }
      }
    });

    assert.strictEqual(resV1.status, 201, `Status esperado 201, obtido ${resV1.status}`);
    assert.strictEqual(resV1.body.success, true);
    assert.strictEqual(resV1.body.data.event, 'LANDING_VIEW');
    assert.strictEqual(resV1.body.data.tenantId, 'public_visitor');
    console.log('  ✅ [PASS] Evento público registrado sem exigência indevida de token.');
    passedCount++;

    // -------------------------------------------------------------------------
    // VETOR 2: Registro de novo Tenant com Trial de 7 dias e emissão de eventos
    // -------------------------------------------------------------------------
    console.log('▶ Vetor 2: Registro de novo Tenant com Trial (/api/auth/register)...');
    const registerEmail = `fundador_${stamp}@empresaalfa.com.br`;
    const resV2 = await makeRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        adminName: 'Carlos Fundador',
        name: 'Carlos Fundador',
        email: registerEmail,
        password: 'SenhaUltraForte123!',
        companyName: `Empresa Alfa ${stamp}`
      }
    });

    assert.strictEqual(resV2.status, 201, `Status esperado 201, obtido ${resV2.status}`);
    assert.strictEqual(resV2.body.success, true);
    assert(resV2.body.data && resV2.body.data.token, 'Token JWT deve ser retornado no registro em body.data.token.');
    const tenantToken = resV2.body.data.token;
    const tenantId = resV2.body.data.user.tenantId;
    const userId = resV2.body.data.user.id;

    const tenantInDb = tenantsDB.findById(tenantId);
    assert(tenantInDb, 'Tenant deve estar persistido no JsonDB.');
    assert(tenantInDb.trialEndsAt, 'Tenant deve ter data de término do trial definida.');
    
    // Verifica eventos no conversionEventsDB
    const signupEvents = conversionEventsDB.findByTenant(tenantId, e => e.event === 'SIGNUP');
    const trialEvents = conversionEventsDB.findByTenant(tenantId, e => e.event === 'TRIAL_STARTED');
    assert(signupEvents.length >= 1, 'Evento SIGNUP deve estar gravado.');
    assert(trialEvents.length >= 1, 'Evento TRIAL_STARTED deve estar gravado.');
    console.log(`  ✅ [PASS] Tenant criado com sucesso: ${tenantId}, Trial ativo até ${tenantInDb.trialEndsAt}.`);
    passedCount++;

    // -------------------------------------------------------------------------
    // VETOR 3: Conclusão do Onboarding de 3 Passos (/api/onboarding/complete)
    // -------------------------------------------------------------------------
    console.log('▶ Vetor 3: Conclusão do Onboarding de 3 Passos (/api/onboarding/complete)...');
    const resV3 = await makeRequest({
      method: 'POST',
      path: '/api/onboarding/complete',
      token: tenantToken,
      body: {
        segment: 'servicos_b2b',
        teamSize: '6_15',
        primaryGoal: 'aumentar_conversao'
      }
    });

    assert.strictEqual(resV3.status, 200, `Status esperado 200, obtido ${resV3.status}`);
    assert.strictEqual(resV3.body.success, true);
    
    const onboardingEvents = conversionEventsDB.findByTenant(tenantId, e => e.event === 'ONBOARDING_COMPLETED');
    assert(onboardingEvents.length >= 1, 'Evento ONBOARDING_COMPLETED deve estar gravado.');
    assert.strictEqual(onboardingEvents[0].segment, 'servicos_b2b');
    console.log('  ✅ [PASS] Onboarding concluído e perfil gravado com evento emitido.');
    passedCount++;

    // -------------------------------------------------------------------------
    // VETOR 4: Verificação de Score inicial de Ativação (/api/tenant/activation-status)
    // -------------------------------------------------------------------------
    console.log('▶ Vetor 4: Verificação do Score Inicial de Ativação (/api/tenant/activation-status)...');
    const resV4 = await makeRequest({
      method: 'GET',
      path: '/api/tenant/activation-status',
      token: tenantToken
    });

    assert.strictEqual(resV4.status, 200, `Status esperado 200, obtido ${resV4.status}`);
    assert.strictEqual(resV4.body.success, true);
    assert.strictEqual(typeof resV4.body.data.score, 'number');
    assert.strictEqual(resV4.body.data.totalSteps, 7);
    assert.strictEqual(resV4.body.data.isFullyActivated, false);
    console.log(`  ✅ [PASS] Checklist retornado com 7 passos, Score inicial: ${resV4.body.data.score}%.`);
    passedCount++;

    // -------------------------------------------------------------------------
    // VETOR 5: Criação do Primeiro Lead e Ativação de FIRST_LEAD
    // -------------------------------------------------------------------------
    console.log('▶ Vetor 5: Criação do Primeiro Lead e Ativação de FIRST_LEAD (/api/leads)...');
    const resV5 = await makeRequest({
      method: 'POST',
      path: '/api/leads',
      token: tenantToken,
      body: {
        name: 'Doutor Roberto Consultoria',
        email: `roberto_${stamp}@consultoria.com.br`,
        phone: '11988887777',
        origin: 'Campanha Google'
      }
    });

    assert.strictEqual(resV5.status, 201, `Status esperado 201, obtido ${resV5.status}`);
    const leadId = resV5.body.data.id;

    const firstLeadEvents = conversionEventsDB.findByTenant(tenantId, e => e.event === 'FIRST_LEAD');
    assert(firstLeadEvents.length >= 1, 'Evento FIRST_LEAD deve ter sido gerado.');

    const resV5Check = await makeRequest({
      method: 'GET',
      path: '/api/tenant/activation-status',
      token: tenantToken
    });
    const stepLead = resV5Check.body.data.checklist.find(c => c.id === 'first_lead');
    assert.strictEqual(stepLead.completed, true, 'Item first_lead deve estar completed=true');
    console.log('  ✅ [PASS] Primeiro lead criado com sucesso e checklist atualizado.');
    passedCount++;

    // -------------------------------------------------------------------------
    // VETOR 6: Criação da Primeira Oportunidade e Ativação de FIRST_DEAL
    // -------------------------------------------------------------------------
    console.log('▶ Vetor 6: Criação da Primeira Oportunidade e Ativação de FIRST_DEAL (/api/deals)...');
    const resV6 = await makeRequest({
      method: 'POST',
      path: '/api/deals',
      token: tenantToken,
      body: {
        title: 'Consultoria Estratégica Q4',
        value: 12500,
        stage: 'qualificacao',
        leadId: leadId
      }
    });

    assert.strictEqual(resV6.status, 201, `Status esperado 201, obtido ${resV6.status}`);
    const dealId = resV6.body.data.id;

    const firstDealEvents = conversionEventsDB.findByTenant(tenantId, e => e.event === 'FIRST_DEAL');
    assert(firstDealEvents.length >= 1, 'Evento FIRST_DEAL deve ter sido gerado.');

    const resV6Check = await makeRequest({
      method: 'GET',
      path: '/api/tenant/activation-status',
      token: tenantToken
    });
    const stepDeal = resV6Check.body.data.checklist.find(c => c.id === 'first_deal');
    assert.strictEqual(stepDeal.completed, true, 'Item first_deal deve estar completed=true');
    console.log('  ✅ [PASS] Primeira oportunidade criada e checklist atualizado.');
    passedCount++;

    // -------------------------------------------------------------------------
    // VETOR 7: Execução do RecuperaIA / Copiloto IA e Ativação de FIRST_AI_ACTION
    // -------------------------------------------------------------------------
    console.log('▶ Vetor 7: Execução do RecuperaIA e Ativação de FIRST_AI_ACTION (/api/recovery/scan)...');
    const resV7 = await makeRequest({
      method: 'GET',
      path: '/api/recovery/scan',
      token: tenantToken
    });

    assert.strictEqual(resV7.status, 200, `Status esperado 200, obtido ${resV7.status}`);
    const aiEvents = conversionEventsDB.findByTenant(tenantId, e => e.event === 'FIRST_AI_ACTION');
    assert(aiEvents.length >= 1, 'Evento FIRST_AI_ACTION deve ter sido gravado.');
    console.log('  ✅ [PASS] Varredura RecuperaIA concluída e FIRST_AI_ACTION registrado.');
    passedCount++;

    // -------------------------------------------------------------------------
    // VETOR 8: Criação da Primeira Regra de Automação e Ativação de FIRST_AUTOMATION
    // -------------------------------------------------------------------------
    console.log('▶ Vetor 8: Criação de Automação e FIRST_AUTOMATION (/api/automations)...');
    const resV8 = await makeRequest({
      method: 'POST',
      path: '/api/automations',
      token: tenantToken,
      body: {
        name: 'Auto Boas Vindas Comercial',
        trigger: 'novo_lead',
        action: 'enviar_whatsapp'
      }
    });

    assert.strictEqual(resV8.status, 201, `Status esperado 201, obtido ${resV8.status}`);
    const firstAutoEvents = conversionEventsDB.findByTenant(tenantId, e => e.event === 'FIRST_AUTOMATION');
    assert(firstAutoEvents.length >= 1, 'Evento FIRST_AUTOMATION deve ter sido gravado.');
    console.log('  ✅ [PASS] Automação criada com sucesso e checklist atualizado.');
    passedCount++;

    // -------------------------------------------------------------------------
    // VETOR 9: Conclusão dos Passos Restantes e 100% de Ativação do Tenant
    // -------------------------------------------------------------------------
    console.log('▶ Vetor 9: Conclusão dos Passos Restantes até 100% de Ativação...');
    // Adiciona vendedor
    const resAddSeller = await makeRequest({
      method: 'POST',
      path: '/api/users',
      token: tenantToken,
      body: {
        name: 'Juliana Vendedora',
        email: `juliana_${stamp}@empresaalfa.com.br`,
        password: 'PasswordVendedora123!',
        role: 'VENDEDOR'
      }
    });
    assert.strictEqual(resAddSeller.status, 201, 'Vendedor deve ser adicionado com sucesso.');

    // Configura pipeline
    const resPipe = await makeRequest({
      method: 'POST',
      path: '/api/pipelines',
      token: tenantToken,
      body: {
        name: 'Funil Expansão Enterprise',
        description: 'Vendas consultivas high ticket'
      }
    });
    assert.strictEqual(resPipe.status, 201, 'Pipeline customizado deve ser criado.');

    // Consulta Status Final
    const resActivationFinal = await makeRequest({
      method: 'GET',
      path: '/api/tenant/activation-status',
      token: tenantToken
    });
    assert.strictEqual(resActivationFinal.status, 200);
    assert.strictEqual(resActivationFinal.body.data.completedCount, 7, 'Todos os 7 passos devem estar completos.');
    assert.strictEqual(resActivationFinal.body.data.score, 100, 'Score deve atingir 100%.');
    assert.strictEqual(resActivationFinal.body.data.isFullyActivated, true, 'isFullyActivated deve ser true.');
    console.log('  ✅ [PASS] Tenant atingiu 100% no checklist de primeiro valor.');
    passedCount++;

    // -------------------------------------------------------------------------
    // VETOR 10: Início de Checkout do Plano Business R$ 397 (/api/billing/checkout)
    // -------------------------------------------------------------------------
    console.log('▶ Vetor 10: Início de Checkout do Plano Business R$ 397 (/api/billing/checkout)...');
    const resCheckout = await makeRequest({
      method: 'POST',
      path: '/api/billing/checkout',
      token: tenantToken,
      body: {
        plan: 'business'
      }
    });

    assert.strictEqual(resCheckout.status, 201, `Status esperado 201, obtido ${resCheckout.status}`);
    assert.strictEqual(resCheckout.body.success, true);
    assert.strictEqual(resCheckout.body.data.plan, 'business');
    assert.strictEqual(resCheckout.body.data.price, 397);
    assert(resCheckout.body.data.proposalId, 'proposalId deve ser retornado.');
    assert(resCheckout.body.data.pix.payload, 'payload PIX deve ser gerado.');

    const proposalId = resCheckout.body.data.proposalId;
    const pixPayload = resCheckout.body.data.pix.payload;

    const checkoutStartedEvents = conversionEventsDB.findByTenant(tenantId, e => e.event === 'CHECKOUT_STARTED');
    const paymentPendingEvents = conversionEventsDB.findByTenant(tenantId, e => e.event === 'PAYMENT_PENDING');
    assert(checkoutStartedEvents.length >= 1, 'Evento CHECKOUT_STARTED deve estar gravado.');
    assert(paymentPendingEvents.length >= 1, 'Evento PAYMENT_PENDING deve estar gravado.');
    console.log(`  ✅ [PASS] Checkout iniciado com proposta ${proposalId}, valor R$ 397.`);
    passedCount++;

    // -------------------------------------------------------------------------
    // VETOR 11: Validação estrita do Payload PIX EMV Bacen e Checksum CRC-16
    // -------------------------------------------------------------------------
    console.log('▶ Vetor 11: Validação estrita do Payload PIX EMV e Checksum CRC-16...');
    assert(pixPayload.startsWith('000201'), 'PIX EMV deve iniciar com 000201.');
    assert(pixPayload.includes('5303986'), 'PIX deve conter Moeda Real BRL (986).');
    assert(pixPayload.includes('5406397.00'), 'PIX deve conter valor exato R$ 397.00.');
    assert(pixPayload.includes('5802BR'), 'PIX deve conter País BR.');
    assert(pixPayload.includes('6304'), 'PIX deve conter indicador de CRC16 6304.');

    const isCrcValid = verifyPixCrc16(pixPayload);
    assert(isCrcValid, 'Checksum CRC-16 CCITT do payload PIX gerado deve ser matematicamente válido.');
    console.log('  ✅ [PASS] Payload EMV Bacen certificado e CRC-16 conferido.');
    passedCount++;

    // -------------------------------------------------------------------------
    // VETOR 12: Confirmação Legítima de Pagamento PIX (/api/proposals/:id/confirm)
    // -------------------------------------------------------------------------
    console.log('▶ Vetor 12: Confirmação Legítima de Pagamento PIX (/api/proposals/:id/confirm)...');
    const resConfirm = await makeRequest({
      method: 'PATCH',
      path: `/api/proposals/${proposalId}/confirm`,
      token: tenantToken,
      body: {
        amount: 397,
        txId: resCheckout.body.data.pix.txid,
        endToEndId: `E${Date.now()}BACENOFICIAL`
      }
    });

    assert.strictEqual(resConfirm.status, 200, `Status esperado 200, obtido ${resConfirm.status}`);
    assert.strictEqual(resConfirm.body.success, true);
    
    const paidProposal = proposalsDB.findById(proposalId);
    assert.strictEqual(paidProposal.status, 'paga', 'Proposta deve estar com status paga.');

    const paymentRecords = paymentsDB.findAll(p => p.proposalId === proposalId);
    assert(paymentRecords.length >= 1, 'Registro formal de pagamento deve existir.');
    assert.strictEqual(paymentRecords[0].status, 'pago');

    const paymentConfirmedEvents = conversionEventsDB.findByTenant(tenantId, e => e.event === 'PAYMENT_CONFIRMED');
    assert(paymentConfirmedEvents.length >= 1, 'Evento PAYMENT_CONFIRMED deve estar gravado.');
    console.log('  ✅ [PASS] Pagamento liquidado legitimamente com baixa atômica.');
    passedCount++;

    // -------------------------------------------------------------------------
    // VETOR 13: Ativação Automática do Plano no Tenant (Upgrade para Business)
    // -------------------------------------------------------------------------
    console.log('▶ Vetor 13: Validação da Ativação Automática do Plano Business no Tenant...');
    const upgradedTenant = tenantsDB.findById(tenantId);
    assert.strictEqual(upgradedTenant.plan, 'business', 'Tenant deve ter sofrido upgrade para o plano business.');
    assert.strictEqual(upgradedTenant.aiCredits, 20000, 'Tenant deve receber 20.000 créditos de IA do plano business.');

    const planActivatedEvents = conversionEventsDB.findByTenant(tenantId, e => e.event === 'PLAN_ACTIVATED');
    assert(planActivatedEvents.length >= 1, 'Evento PLAN_ACTIVATED deve estar registrado.');
    assert.strictEqual(planActivatedEvents[0].plan, 'business');
    console.log(`  ✅ [PASS] Plano Business ativo: ${upgradedTenant.plan}, Cotas de IA: ${upgradedTenant.aiCredits}.`);
    passedCount++;

    // -------------------------------------------------------------------------
    // VETOR 14: Métricas Administrativas SaaS, Funil Comercial e Barreira RBAC
    // -------------------------------------------------------------------------
    console.log('▶ Vetor 14: Métricas Administrativas SaaS (/api/admin/saas-metrics) e Barreira RBAC...');
    // Teste de barreira RBAC com Vendedor
    const sellerUser = usersDB.findAll(u => u.tenantId === tenantId && u.role === 'VENDEDOR')[0];
    const sellerToken = generateToken(sellerUser);

    const resSellerForbidden = await makeRequest({
      method: 'GET',
      path: '/api/admin/saas-metrics',
      token: sellerToken
    });
    assert.strictEqual(resSellerForbidden.status, 403, 'Vendedor deve ser barrado com HTTP 403.');

    // Teste com Administrador / Proprietário
    const resAdminMetrics = await makeRequest({
      method: 'GET',
      path: '/api/admin/saas-metrics',
      token: tenantToken
    });
    assert.strictEqual(resAdminMetrics.status, 200, `Status esperado 200, obtido ${resAdminMetrics.status}`);
    assert.strictEqual(resAdminMetrics.body.success, true);
    
    const mData = resAdminMetrics.body.data;
    assert(mData.activeTenants >= 1, 'activeTenants deve ser >= 1');
    assert(mData.plansDistribution.business >= 1, 'plansDistribution.business deve ser >= 1');
    assert(mData.mrr >= 397, 'MRR deve ser >= 397');
    assert(mData.totalPixRevenue >= 397, 'totalPixRevenue deve contabilizar os R$ 397 liquidados');
    assert(mData.funnelMetrics.landingViews >= 1, 'Funil deve computar landingViews');
    assert(mData.funnelMetrics.checkouts >= 1, 'Funil deve computar checkouts');
    assert(mData.funnelMetrics.payments >= 1, 'Funil deve computar pagamentos confirmados');
    assert(mData.funnelMetrics.plansActivated >= 1, 'Funil deve computar planos ativados');

    const resConversionFunnel = await makeRequest({
      method: 'GET',
      path: '/api/admin/conversion-funnel',
      token: tenantToken
    });
    assert.strictEqual(resConversionFunnel.status, 200);
    assert(resConversionFunnel.body.data.counts.SIGNUP >= 1);
    assert(resConversionFunnel.body.data.recentEvents.length >= 5);
    console.log('  ✅ [PASS] Barreira RBAC validada (403 para vendedor) e métricas de SaaS consistentes.');
    passedCount++;

    console.log('\n================================================================');
    console.log(`🎯 RESULTADO FINAL V4 COMERCIAL: ${passedCount}/14 TESTES APROVADOS (100%)`);
    console.log('================================================================\n');

  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

if (require.main === module) {
  runCommercialSuite()
    .then(() => {
      console.log('✅ Suíte V4 Comercial finalizada com sucesso absoluto.');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Falha na suíte de testes comerciais V4:', err);
      process.exit(1);
    });
}

module.exports = { runCommercialSuite };
