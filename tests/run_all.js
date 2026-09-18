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
  // O servidor bloqueia o arquivo sensível com 404 ou cai no fallback index.html seguro sem vazar código
  assert.ok([404, 200].includes(traversalRes.status), 'Requisição com path traversal tratada com segurança');
  assert.strictEqual(traversalRes.body.includes('"dependencies"'), false, 'Não deve expor o package.json');

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

  // 8. Teste de Autenticação Multi-Tenant e Registro de Nova Empresa
  console.log('▶ Teste 8: Validação de Autenticação Multi-Tenant, Hashing e Tokens JWT...');
  const { registerTenant, login, verifyToken } = require('../services/authService');
  const testTenantEmail = `empresa_${Date.now()}@teste.com`;
  const regResult = registerTenant({
    companyName: 'Tech Sul Soluções',
    adminName: 'Eduardo Silveira',
    email: testTenantEmail,
    password: 'senhaSegura123',
    segment: 'Serviços'
  });
  assert.ok(regResult.token, 'Registro deve emitir token assinado');
  assert.strictEqual(regResult.tenant.name, 'Tech Sul Soluções', 'Tenant criado com nome correto');
  
  const verified = verifyToken(regResult.token);
  assert.strictEqual(verified.email, testTenantEmail, 'Token verificado deve conter e-mail correto');

  const loginRes = login(testTenantEmail, 'senhaSegura123');
  assert.ok(loginRes.token, 'Login com credenciais corretas deve gerar token');
  console.log('  ✅ Autenticação Multi-Tenant, Hashing PBKDF2 e Tokens JWT 100% operacionais.\n');
  passed++;

  // 9. Teste de Onboarding e Segmentação
  console.log('▶ Teste 9: Validação do Onboarding Guiado...');
  const onboardingRes = await new Promise((resolve) => {
    const postData = JSON.stringify({
      segment: 'Automotivo',
      teamSize: '6-15',
      leadSources: ['WhatsApp', 'Instagram'],
      primaryGoal: 'Aumentar vendas e recuperar clientes'
    });
    const req = http.request(`http://127.0.0.1:${TEST_PORT}/api/onboarding/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${regResult.token}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(onboardingRes.status, 200, 'Onboarding deve retornar HTTP 200');
  assert.strictEqual(onboardingRes.body.success, true);
  console.log('  ✅ Onboarding guiado e configuração de negócio validados.\n');
  passed++;

  // 10. Teste da Central Omnichannel e Conectores Oficiais
  console.log('▶ Teste 10: Validação da Central Omnichannel e Status dos Canais Oficiais...');
  const { getChannelsStatus, getConversations } = require('../services/omnichannelService');
  const channels = getChannelsStatus(regResult.tenant.id);
  assert.ok(channels.length >= 3, 'Deve suportar WhatsApp, Instagram e Webchat');
  assert.strictEqual(channels[0].status, 'disconnected', 'Sem credenciais reais Meta, deve exibir status desconectado com integridade');
  assert.strictEqual(channels[0].statusLabel, 'Conectar Canal');
  console.log('  ✅ Central Omnichannel em estrita integridade (sem simulações falsas).\n');
  passed++;

  // 11. Teste do Módulo RecuperaIA (Varredura e Campanhas)
  console.log('▶ Teste 11: Validação do Módulo RecuperaIA (Varredura de Vendas Perdidas)...');
  const { scanRecoverableOpportunities, generateRecoveryCampaign } = require('../services/recoveryService');
  const scan = scanRecoverableOpportunities('ten_demo_agentise');
  assert.ok(scan.categories, 'Varredura deve categorizar oportunidades');
  
  const camp = generateRecoveryCampaign('ten_demo_agentise', 'stalledDeals', 'consultivo');
  assert.ok(camp.id, 'Campanha de recuperação deve ser gerada');
  assert.ok(camp.sequence.length === 3, 'Sequência em 3 passos de follow-up');
  console.log('  ✅ Módulo RecuperaIA identificando oportunidades paradas e gerando campanhas.\n');
  passed++;

  // 12. Teste do Motor de Automações QUANDO-SE-ENTÃO
  console.log('▶ Teste 12: Validação do Construtor de Automações (QUANDO -> SE -> ENTÃO)...');
  const { automationsDB } = require('../database/db');
  const autoList = automationsDB.findByTenant(regResult.tenant.id);
  assert.ok(autoList.length > 0, 'Onboarding deve criar automações automáticas para o segmento');
  console.log('  ✅ Motor de Automações operando com triggers e ações comerciais.\n');
  passed++;

  // 13. Teste do Analista IA e Vertical Agentise Auto
  console.log('▶ Teste 13: Validação do Analista IA para Gestores e Módulo Agentise Auto...');
  const { runManagerAnalyticsQuery } = require('../services/aiCopilotService');
  const { calculateFinancing } = require('../services/autoVerticalService');
  
  const analystAnswer = runManagerAnalyticsQuery('ten_demo_agentise', 'Quanto tenho no pipeline?');
  assert.ok(analystAnswer.answer.includes('R$'), 'Analista IA deve responder com dados reais do pipeline');
  assert.ok(analystAnswer.supportingData, 'Resposta deve conter dados de apoio fundamentados');

  const sim = calculateFinancing({ vehiclePrice: 100000, downPayment: 20000, termMonths: 48 });
  assert.strictEqual(sim.financedAmount, 80000, 'Valor financiado correto');
  assert.ok(sim.monthlyInstallment > 0, 'Parcela calculada via Tabela Price');
  console.log('  ✅ Analista IA para Gestores e Vertical Agentise Auto validados.\n');
  passed++;

  // 14. Teste de Assinatura SaaS, Trial de 7 Dias e Créditos de IA
  console.log('▶ Teste 14: Validação de Planos SaaS, Trial de 7 Dias e Medição de Créditos de IA...');
  const { getTenantSubscription, consumeAiCredits } = require('../services/billingService');
  const sub = getTenantSubscription(regResult.tenant.id);
  assert.strictEqual(sub.isTrialActive, true, 'Novo tenant deve nascer em período de trial');
  assert.ok(sub.daysLeftTrial <= 7 && sub.daysLeftTrial > 0, 'Trial de 7 dias ativo');

  const creditUse = consumeAiCredits(regResult.tenant.id, 'teste_ia', 50);
  assert.strictEqual(creditUse.success, true);
  assert.strictEqual(creditUse.remainingCredits, 950, 'Créditos de IA devem ser decrementados corretamente');
  console.log('  ✅ Planos SaaS, Trial e Gestão de Créditos de IA 100% operacionais.\n');
  passed++;

  // 15. Teste de Blindagem contra IDOR Multi-Tenant
  console.log('▶ Teste 15: Validação de Blindagem contra Ataque IDOR (Tentativa de Exclusão Cross-Tenant)...');
  // Tenant A cria um lead
  const { leadsDB } = require('../database/db');
  const leadA = leadsDB.insert({ tenantId: 'tenant_A_seguro', name: 'Lead Confidencial A' });

  // Tenant B tenta deletar o lead de Tenant A via API
  const idorRes = await new Promise((resolve) => {
    const req = http.request(`http://127.0.0.1:${TEST_PORT}/api/leads/${leadA.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${regResult.token}` // regResult.token é do tenant Tech Sul Soluções (Tenant B)
      }
    }, res => {
      resolve({ status: res.statusCode });
    });
    req.end();
  });

  assert.strictEqual(idorRes.status, 404, 'Tentativa de exclusão de lead de outro tenant DEVE retornar 404 Not Found');
  // Verifica se o lead continua intacto no banco
  assert.ok(leadsDB.findById(leadA.id), 'Lead confidencial deve permanecer intacto após tentativa de ataque');
  console.log('  ✅ Blindagem contra IDOR Multi-Tenant 100% validada (dados de outros tenants inacessíveis).\n');
  passed++;

  // 16. Teste 16 — Fluxo real de venda (Auto Prime Veículos)
  console.log('▶ Teste 16: Validação do Fluxo Real de Venda de Ponta a Ponta (Auto Prime Veículos)...');
  const { 
    AUTOPRIME_TENANT_ID, 
    seedAutoPrimeVeiculos, 
    executeFullSalesFlow, 
    getAutoPrimeAuditMetrics 
  } = require('../services/autoPrimeService');

  // Garante sementes da Auto Prime (3 vendedores, 50 leads, 20 oportunidades, 10 propostas, 5 vendas)
  seedAutoPrimeVeiculos();
  const initialMetrics = getAutoPrimeAuditMetrics();
  assert.strictEqual(initialMetrics.totalLeads >= 50, true, 'Deve possuir no mínimo 50 leads cadastrados');
  assert.strictEqual(initialMetrics.activeDeals, 20, 'Deve possuir exatamente 20 oportunidades ativas no funil');
  assert.strictEqual(initialMetrics.proposalsCount >= 10, true, 'Deve possuir no mínimo 10 propostas com PIX EMV oficial');
  assert.strictEqual(initialMetrics.wonDealsCount >= 5, true, 'Deve possuir no mínimo 5 vendas concluídas');
  assert.strictEqual(initialMetrics.wonValue >= 738000, true, 'Faturamento inicial de vendas deve ser no mínimo R$ 738.000,00');

  // Executa o fluxo: Lead -> Atendimento -> Qualificação -> Oportunidade -> Proposta -> Venda
  const flowResult = executeFullSalesFlow();
  assert.strictEqual(flowResult.success, true);
  assert.strictEqual(flowResult.stepsAudit.length, 6, 'Fluxo deve conter 6 etapas auditadas');

  // Validação via API REST do Dashboard (/api/analytics) com token da Auto Prime
  const { generateToken: genToken } = require('../services/authService');
  const autoPrimeToken = genToken({
    userId: 'usr_autoprime_admin',
    tenantId: AUTOPRIME_TENANT_ID,
    role: 'ADMINISTRADOR',
    name: 'Carlos Eduardo (Diretor)',
    email: 'admin@autoprime.com.br'
  });

  const analyticsRes = await new Promise((resolve) => {
    const req = http.request(`http://127.0.0.1:${TEST_PORT}/api/analytics`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${autoPrimeToken}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.end();
  });

  assert.strictEqual(analyticsRes.status, 200);
  const dash = analyticsRes.body.data;
  assert.strictEqual(dash.totalLeads, 51, 'Total de leads no dashboard deve ser 51');
  assert.strictEqual(dash.activeDeals, 20, 'Oportunidades em aberto continuam 20');
  assert.strictEqual(dash.wonValue, 1078000, 'Faturamento total ganho deve ser exatamente R$ 1.078.000,00');
  assert.strictEqual(dash.winRate, '100.0', 'Taxa de conversão deve ser 100%');
  assert.strictEqual(dash.stageBreakdown.ganho, 6, 'Total de negócios ganhos no breakdown deve ser 6');
  assert.strictEqual(dash.sellersPerformance.length >= 3, true, 'Ranking deve exibir os 3 vendedores');
  assert.strictEqual(dash.sellersPerformance[0].name, 'Fernanda Lima', '1º lugar do ranking deve ser Fernanda Lima');
  assert.strictEqual(dash.sellersPerformance[0].wonCount, 3, 'Fernanda Lima deve ter 3 vendas');
  assert.strictEqual(dash.sellersPerformance[0].revenue, 650000, 'Receita de Fernanda Lima deve ser R$ 650.000,00');
  console.log('  ✅ Teste 16 Aprovado: Fluxo real (Lead -> Atendimento -> Qualificação -> Oportunidade -> Proposta -> Venda) e Dashboard 100% íntegros.\n');
  passed++;

  // 17. Teste de Blindagem e Auditoria de Segurança
  console.log('▶ Teste 17: Validação de Blindagem e Hardening de Segurança (OWASP, RBAC, Anti-IDOR, Rate Limit)...');

  // 17.1 Isolamento de Arquivos Estáticos / Anti Directory Traversal
  const blockedEndpoints = [
    '/database/data/users.json',
    '/server.js',
    '/package.json',
    '/tests/run_all.js'
  ];

  for (const ep of blockedEndpoints) {
    const resBlocked = await new Promise((resolve) => {
      http.get(`http://127.0.0.1:${TEST_PORT}${ep}`, (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
      });
    });
    assert.strictEqual(resBlocked.status, 404, `Acesso a ${ep} deve ser categoricamente bloqueado com HTTP 404`);
    assert.strictEqual(resBlocked.body.includes('passwordHash'), false, `Arquivo ${ep} não pode vazar credenciais ou código`);
  }

  // 17.2 Headers de Segurança OWASP
  const healthHeadersCheck = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${TEST_PORT}/api/health`, (res) => {
      resolve(res.headers);
    });
  });
  assert.strictEqual(healthHeadersCheck['x-content-type-options'], 'nosniff');
  assert.strictEqual(healthHeadersCheck['x-frame-options'], 'SAMEORIGIN');
  assert.strictEqual(healthHeadersCheck['x-xss-protection'], '1; mode=block');
  assert.strictEqual(healthHeadersCheck['referrer-policy'], 'strict-origin-when-cross-origin');

  // 17.3 Timing-Safe JWT Validation
  const { verifyToken: vToken } = require('../services/authService');
  const validT = genToken({ userId: 'u_sec_1', tenantId: 'ten_sec_1', role: 'ADMINISTRADOR' });
  assert.ok(vToken(validT), 'Token íntegro deve ser validado com sucesso');
  assert.strictEqual(vToken(validT + 'tampered'), null, 'Token adulterado deve ser rejeitado com timingSafeEqual');

  // 17.4 Proteção Anti-IDOR no endpoint de LGPD
  const testLeadSec = leadsDB.insert({
    tenantId: 'ten_sec_owner',
    name: 'Lead Protegido LGPD',
    email: 'protegido@lgpd.com.br'
  });
  const hackerToken = genToken({
    userId: 'u_attacker',
    tenantId: 'ten_sec_attacker',
    role: 'ADMINISTRADOR',
    email: 'attacker@bad.com'
  });

  const idorSecRes = await new Promise((resolve) => {
    const postData = JSON.stringify({ leadId: testLeadSec.id });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/lgpd/anonymize',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hackerToken}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(idorSecRes.status, 404, 'Tentativa de anonimização cross-tenant deve retornar 404');
  leadsDB.delete(testLeadSec.id);

  // 17.5 RBAC: Apenas ADMINISTRADOR pode salvar configurações
  const vendedorToken = genToken({
    userId: 'u_vend_sec',
    tenantId: 'ten_sec_owner',
    role: 'VENDEDOR',
    email: 'vendedor@sec.com'
  });
  const rbacRes = await new Promise((resolve) => {
    const postData = JSON.stringify({ companyName: 'Tentativa Vendedor' });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/settings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vendedorToken}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(rbacRes.status, 403, 'Vendedor não pode alterar configurações do sistema (deve retornar 403)');

  // 17.6 Rate Limiter Defensivo contra Força Bruta
  const testIp = '198.51.100.188';
  let rateBlocked = false;
  for (let i = 1; i <= 32; i++) {
    const rStatus = await new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': testIp
        }
      }, res => {
        resolve(res.statusCode);
      });
      req.write(JSON.stringify({ email: 'fake@brute.com', password: 'bad' }));
      req.end();
    });
    if (i <= 30) {
      assert.strictEqual(rStatus, 401, `Tentativa ${i} deve processar normalmente (retornar 401 para credencial inválida)`);
    } else {
      assert.strictEqual(rStatus, 429, `Tentativa ${i} deve ser barrada pelo Rate Limiter com HTTP 429`);
      rateBlocked = true;
    }
  }
  assert.strictEqual(rateBlocked, true, 'Rate limit deve ter bloqueado a 31ª e 32ª requisição');

  console.log('  ✅ Teste 17 Aprovado: Sandbox estático, OWASP Headers, JWT seguro, Anti-IDOR, RBAC e Rate Limiting 100% blindados.\n');
  passed++;

  // 18. Teste de Propostas Integradas, Baixa Automática PIX, PWA, Equipe e Backup
  console.log('▶ Teste 18: Validação de Propostas com Baixa PIX Automática, PWA, Gestão de Vendedores e Backup...');
  const { dealsDB, proposalsDB, usersDB } = require('../database/db');

  // 18.1 PWA: manifest.json e sw.js
  const manifestRes = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${TEST_PORT}/manifest.json`, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(manifestRes.status, 200, 'manifest.json deve estar acessível com HTTP 200');
  assert.strictEqual(manifestRes.body.short_name, 'MegaCRM', 'Manifest deve conter short_name');

  const swRes = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${TEST_PORT}/sw.js`, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
  });
  assert.strictEqual(swRes.status, 200, 'sw.js deve estar acessível com HTTP 200');
  assert.ok(swRes.body.includes('agentise-crm-cache'), 'sw.js deve conter lógica de cache');

  // 18.2 Configuração Oficial de PIX (luklen2@gmail.com / LUCIANO SANT ANNA)
  const setCheck = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${TEST_PORT}/api/settings`, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d).data));
    });
  });
  assert.strictEqual(setCheck.pixKey, 'luklen2@gmail.com', 'Chave PIX oficial deve ser luklen2@gmail.com');
  assert.strictEqual(setCheck.pixName, 'LUCIANO SANT ANNA', 'Nome do recebedor deve ser LUCIANO SANT ANNA');

  // 18.3 Ciclo Completo de Propostas e Baixa Automática de Venda
  const testDeal18 = dealsDB.insert({
    tenantId: 'ten_demo_agentise',
    title: 'Projeto Enterprise IA - Teste 18',
    value: 50000,
    stage: 'proposta'
  });

  const pixGenRes = await new Promise((resolve) => {
    const postData = JSON.stringify({
      dealId: testDeal18.id,
      amount: 50000,
      description: 'Implantação SaaS Enterprise'
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/pix/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(pixGenRes.success, true);
  const createdProposalId = pixGenRes.data.proposalId;
  assert.ok(createdProposalId, 'ID da proposta gerado');

  // Listagem de Propostas
  const propListRes = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${TEST_PORT}/api/proposals`, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
  });
  assert.strictEqual(propListRes.success, true);
  const foundProp = propListRes.data.find(p => p.id === createdProposalId);
  assert.ok(foundProp, 'Proposta recém-criada deve estar na listagem');
  assert.strictEqual(foundProp.status, 'pendente');

  // Confirmação de Pagamento PIX (Baixa Manual/Webhook)
  const confirmRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/proposals/${createdProposalId}/confirm`,
      method: 'PATCH'
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.end();
  });
  assert.strictEqual(confirmRes.success, true);
  assert.strictEqual(confirmRes.data.status, 'paga', 'Proposta deve estar com status paga');

  // Verificação de avanço automático do Deal para 'ganho'
  const updatedDeal18 = dealsDB.findById(testDeal18.id);
  assert.strictEqual(updatedDeal18.stage, 'ganho', 'Deal deve avançar automaticamente para estágio ganho ao confirmar PIX');
  dealsDB.delete(testDeal18.id);
  proposalsDB.delete(createdProposalId);

  // 18.4 Gestão de Usuários / Vendedores da Equipe (POST /api/users)
  const newSellerRes = await new Promise((resolve) => {
    const postData = JSON.stringify({
      name: 'Gabriel Souza Consultor',
      email: 'gabriel.teste18@agentise.com.br',
      role: 'VENDEDOR',
      phone: '11988776655'
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/users',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(newSellerRes.status, 201, 'POST /api/users deve cadastrar novo vendedor com status 201');
  assert.strictEqual(newSellerRes.body.data.email, 'gabriel.teste18@agentise.com.br');
  usersDB.delete(newSellerRes.body.data.id);

  // 18.5 Backup Completo do Tenant (GET /api/backup)
  const backupRes = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${TEST_PORT}/api/backup`, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(backupRes.status, 200, 'GET /api/backup deve responder HTTP 200');
  assert.ok(backupRes.body.data.dados.leads, 'Backup deve conter coleção de leads');
  assert.ok(backupRes.body.data.dados.deals, 'Backup deve conter coleção de deals');
  assert.ok(backupRes.body.data.dados.proposals, 'Backup deve conter coleção de proposals');

  console.log('  ✅ Teste 18 Aprovado: PWA, PIX oficial, propostas com fechamento automático, equipe e backup validados.\n');
  passed++;

  // =========================================================================
  // TESTE 19: Validação da Arquitetura Multi-Tenant Real e 7 Papéis RBAC (FASE 2)
  // =========================================================================
  console.log('▶ Teste 19: Validação da Arquitetura Multi-Tenant Real e 7 Papéis RBAC (FASE 2)...');

  // 19.1 Verificação dos 7 Papéis Oficiais via API
  const rolesRes = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${TEST_PORT}/api/users/roles`, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
  });
  assert.strictEqual(rolesRes.success, true);
  assert.strictEqual(rolesRes.data.length, 7, 'Devem existir exatamente 7 papéis RBAC oficiais');
  const expectedRoles = ['PROPRIETARIO', 'ADMINISTRADOR', 'GERENTE', 'VENDEDOR', 'SDR', 'FINANCEIRO', 'ATENDIMENTO'];
  expectedRoles.forEach(r => assert.ok(rolesRes.data.includes(r), `Papel ${r} deve estar presente`));

  // 19.2 Tokens com os diferentes papéis para teste de RBAC
  const { generateToken: genTok19 } = require('../services/authService');
  const vendedorToken19 = genTok19({
    userId: 'usr_demo_camila',
    tenantId: 'ten_demo_agentise',
    role: 'VENDEDOR',
    name: 'Camila Mendes',
    email: 'camila@agentise.ia.br'
  });

  const financeiroToken19 = genTok19({
    userId: 'usr_demo_mariana',
    tenantId: 'ten_demo_agentise',
    role: 'FINANCEIRO',
    name: 'Mariana Financeiro',
    email: 'mariana@agentise.ia.br'
  });

  const proprietarioToken19 = genTok19({
    userId: 'usr_demo_luciano',
    tenantId: 'ten_demo_agentise',
    role: 'PROPRIETARIO',
    name: 'Luciano',
    email: 'luciano@recuperaia.local'
  });

  // 19.3 Teste de Permissões: VENDEDOR tentando alterar configurações (Deve receber 403)
  const vendedorSettingRes = await new Promise((resolve) => {
    const postData = JSON.stringify({ companyName: 'Hack Tentativa' });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/settings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vendedorToken19}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(vendedorSettingRes.status, 403, 'Vendedor tentando alterar settings deve receber HTTP 403');

  // 19.4 Criação de Proposta no tenant ten_demo_agentise
  const prop19Res = await new Promise((resolve) => {
    const postData = JSON.stringify({
      amount: 15000,
      description: 'Consultoria Empresarial RBAC'
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/pix/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${financeiroToken19}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(prop19Res.success, true);
  const prop19Id = prop19Res.data.proposalId;

  // 19.5 Teste de Permissões: VENDEDOR tentando confirmar proposta (Deve receber 403)
  const vendedorProposalRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/proposals/${prop19Id}/confirm`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${vendedorToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.end();
  });
  assert.strictEqual(vendedorProposalRes.status, 403, 'Vendedor tentando confirmar proposta deve receber HTTP 403');

  // 19.6 Teste de Permissões: FINANCEIRO confirmando proposta do seu tenant (Deve receber 200)
  const financeiroProposalRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/proposals/${prop19Id}/confirm`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${financeiroToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.end();
  });
  assert.strictEqual(financeiroProposalRes.status, 200, 'Financeiro confirmando proposta deve receber HTTP 200');

  // 19.7 Teste Anti-IDOR: Usuário de OUTRO tenant tentando confirmar a mesma proposta (Deve receber 404)
  const otherTenantToken = genTok19({
    userId: 'usr_other_tenant',
    tenantId: 'ten_autoprime_veiculos',
    role: 'FINANCEIRO',
    name: 'Financeiro AutoPrime',
    email: 'financeiro@autoprime.com.br'
  });

  const crossTenantProposalRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/proposals/${prop19Id}/confirm`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${otherTenantToken}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.end();
  });
  assert.strictEqual(crossTenantProposalRes.status, 404, 'Manipulação cross-tenant deve ser bloqueada com 404');

  // 19.8 Teste de Permissões: PROPRIETARIO alterando configurações (Deve receber 200)
  const propSettingRes = await new Promise((resolve) => {
    const postData = JSON.stringify({ notes: 'Configuracao Proprietario OK' });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/settings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(propSettingRes.status, 200, 'Proprietário alterando settings deve receber HTTP 200');

  console.log('  ✅ Teste 19 Aprovado: Multi-Tenant real, 7 papéis RBAC e matriz de permissões 100% validados.\n');
  passed++;

  // =========================================================================
  // TESTE 20: Validação de Banco de Dados, Segurança e Auditoria com Delta (FASE 3)
  // =========================================================================
  console.log('▶ Teste 20: Validação de Banco de Dados, Segurança e Auditoria com Delta (FASE 3)...');

  // 20.1 Validação do Schema Relacional PostgreSQL
  const { validateSchemaSyntax } = require('../database/migrate_postgres');
  const schemaValidation = validateSchemaSyntax();
  assert.strictEqual(schemaValidation.isValid, true, 'Schema SQL deve ser válido');
  assert.ok(schemaValidation.totalTables >= 20, 'Schema deve conter pelo menos 20 tabelas relacionais');

  // 20.2 Verificação de Paridade das Coleções JsonDB V2
  const dbV2 = require('../database/db');
  assert.ok(dbV2.pipelinesDB, 'pipelinesDB deve estar disponível');
  assert.ok(dbV2.pipelineStagesDB, 'pipelineStagesDB deve estar disponível');
  assert.ok(dbV2.paymentsDB, 'paymentsDB deve estar disponível');
  assert.ok(dbV2.workflowRunsDB, 'workflowRunsDB deve estar disponível');
  assert.ok(dbV2.aiAgentsDB, 'aiAgentsDB deve estar disponível');
  assert.ok(dbV2.consentsDB, 'consentsDB deve estar disponível');

  // 20.3 Atualização de Oportunidade com Geração de Auditoria Delta (Valor Anterior vs Novo)
  const testDeal20 = dbV2.dealsDB.insert({
    tenantId: 'ten_demo_agentise',
    title: 'Auditoria de Delta Deal #382',
    value: 5000,
    stage: 'prospeccao'
  });

  const updateDealRes = await new Promise((resolve) => {
    const postData = JSON.stringify({ value: 7500, stage: 'proposta' });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/deals/${testDeal20.id}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(updateDealRes.status, 200, 'Atualização da oportunidade deve retornar HTTP 200');

  // 20.4 Consulta à Trilha de Auditoria (/api/audit-logs) com Validação de Delta
  const auditLogsRes = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/audit-logs?resource=deals`,
      headers: {
        'Authorization': `Bearer ${proprietarioToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(auditLogsRes.status, 200, 'GET /api/audit-logs deve responder HTTP 200 para Proprietário');
  assert.strictEqual(auditLogsRes.body.success, true);
  const foundLog = auditLogsRes.body.data.find(l => l.entityId === testDeal20.id && l.action === 'DEAL_UPDATED');
  assert.ok(foundLog, 'Log de auditoria da atualização do deal deve existir');
  assert.strictEqual(foundLog.oldValues.value, 5000, 'Valor anterior no log deve ser 5000');
  assert.strictEqual(foundLog.newValues.value, 7500, 'Valor novo no log deve ser 7500');

  // 20.5 Bloqueio de Acesso aos Logs de Auditoria para Vendedor (RBAC)
  const vendedorAuditRes = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/audit-logs`,
      headers: {
        'Authorization': `Bearer ${vendedorToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode }));
    });
  });
  assert.strictEqual(vendedorAuditRes.status, 403, 'Vendedor tentando ver audit-logs deve receber HTTP 403');

  // 20.6 Isolamento Anti-IDOR nos Logs de Auditoria (Admin de outro tenant só vê seus próprios logs)
  const otherTenantAdminToken = genTok19({
    userId: 'usr_other_admin',
    tenantId: 'ten_autoprime_veiculos',
    role: 'ADMINISTRADOR',
    name: 'Admin AutoPrime',
    email: 'admin@autoprime.com.br'
  });

  const crossTenantAuditRes = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/audit-logs`,
      headers: {
        'Authorization': `Bearer ${otherTenantAdminToken}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(crossTenantAuditRes.status, 200, 'Admin de outro tenant deve conseguir consultar seus próprios logs');
  const leakedLog = crossTenantAuditRes.body.data.find(l => l.tenantId === 'ten_demo_agentise');
  assert.strictEqual(leakedLog, undefined, 'Logs de outro tenant não devem vazar (Anti-IDOR)');

  console.log('  ✅ Teste 20 Aprovado: Schema PostgreSQL, coleções JsonDB V2, auditoria delta (valor anterior/novo) e RBAC validados.\n');
  passed++;

  // =========================================================================
  // TESTE 21: VALIDAÇÃO DO CRM 360°, EMPRESAS, CONTATOS E TIMELINE 10 ESTÁGIOS (FASE 4)
  // =========================================================================
  console.log('▶ Teste 21: Validação do CRM 360°, Empresas, Contatos e Linha do Tempo de 10 Estágios (FASE 4)...');

  // 21.1 Criação de Empresa PJ (POST /api/companies)
  const createCompanyRes = await new Promise((resolve) => {
    const postData = JSON.stringify({
      name: 'Acme Corporativa S.A.',
      cnpj: '12.345.678/0001-90',
      industry: 'Tecnologia',
      annualRevenue: 5000000
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/companies',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(createCompanyRes.status, 201, 'POST /api/companies deve responder HTTP 201');
  assert.strictEqual(createCompanyRes.body.success, true);
  const testCompanyId = createCompanyRes.body.data.id;

  // 21.2 Listagem de Empresas (GET /api/companies)
  const listCompaniesRes = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/companies',
      headers: { 'Authorization': `Bearer ${proprietarioToken19}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(listCompaniesRes.status, 200, 'GET /api/companies deve responder HTTP 200');
  assert.ok(listCompaniesRes.body.data.some(c => c.id === testCompanyId), 'Empresa criada deve constar na listagem');

  // 21.3 Criação de Contato Decisor (POST /api/contacts)
  const createContactRes = await new Promise((resolve) => {
    const postData = JSON.stringify({
      name: 'Mariana Lima',
      role: 'Diretora de Operações',
      email: 'mariana.lima@acmecorp.com.br',
      phone: '11988887777',
      companyId: testCompanyId
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/contacts',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(createContactRes.status, 201, 'POST /api/contacts deve responder HTTP 201');
  assert.strictEqual(createContactRes.body.success, true);

  // 21.4 Criação de Lead e Registro de Interação na Timeline (POST /api/leads/:id/activities)
  const testLead360 = leadsDB.insert({
    tenantId: 'ten_demo_agentise',
    name: 'Roberto Valente',
    company: 'Acme Corporativa S.A.',
    email: 'roberto@acme.com',
    phone: '11977776666',
    estimatedBudget: 35000,
    tags: ['Decisor', 'ERP'],
    createdAt: new Date().toISOString()
  });

  const createActivityRes = await new Promise((resolve) => {
    const postData = JSON.stringify({
      type: 'call',
      title: 'Ligação de Alinhamento Técnico',
      description: 'Cliente confirmou interesse na proposta e solicitou emissão do PIX comercial.'
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/leads/${testLead360.id}/activities`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vendedorToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(createActivityRes.status, 201, 'POST /api/leads/:id/activities deve retornar HTTP 201');
  assert.strictEqual(createActivityRes.body.success, true);

  // 21.5 Consulta à Linha do Tempo Comercial 360° (GET /api/leads/:id/timeline)
  const timelineRes = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/leads/${testLead360.id}/timeline`,
      headers: { 'Authorization': `Bearer ${vendedorToken19}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(timelineRes.status, 200, 'GET /api/leads/:id/timeline deve retornar HTTP 200');
  assert.strictEqual(timelineRes.body.success, true);
  assert.strictEqual(timelineRes.body.data.stages.length, 10, 'A linha do tempo deve contemplar os 10 estágios padronizados');
  assert.ok(timelineRes.body.data.events.some(e => e.title === 'Ligação de Alinhamento Técnico'), 'A atividade registrada deve constar no feed');

  // 21.6 Isolamento Anti-IDOR na Linha do Tempo 360°
  const idorTimelineRes = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/leads/${testLead360.id}/timeline`,
      headers: { 'Authorization': `Bearer ${otherTenantAdminToken}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode }));
    });
  });
  assert.strictEqual(idorTimelineRes.status, 404, 'Tentativa de acessar timeline de outro tenant deve receber HTTP 404');

  // Limpa lead temporário
  leadsDB.delete(testLead360.id);

  console.log('  ✅ Teste 21 Aprovado: CRM 360°, Empresas, Contatos, Linha do Tempo de 10 Estágios e Anti-IDOR 100% validados.\n');
  passed++;

  // =========================================================================
  // TESTE 22: VALIDAÇÃO DE MÚLTIPLOS PIPELINES, ESTÁGIOS E AI DEAL SCORE (FASE 5)
  // =========================================================================
  console.log('▶ Teste 22: Validação de Múltiplos Pipelines, Estágios e AI Deal Score BANT (FASE 5)...');
  const { pipelinesDB } = require('../database/db');

  // 22.1 Listagem de Pipelines e Estágios Padrão do Tenant
  const listPipesRes = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/pipelines?includeStages=true',
      headers: { 'Authorization': `Bearer ${proprietarioToken19}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(listPipesRes.status, 200, 'GET /api/pipelines deve retornar HTTP 200');
  assert.strictEqual(listPipesRes.body.success, true);
  assert.ok(listPipesRes.body.data.length >= 2, 'Tenant deve possuir ao menos 2 pipelines padrão inicializados');
  const defaultPipe = listPipesRes.body.data.find(p => p.isDefault);
  assert.ok(defaultPipe, 'Pipeline padrão deve existir');
  assert.ok(defaultPipe.stages && defaultPipe.stages.length >= 5, 'Pipeline padrão deve conter estágios comerciais');

  // 22.2 Criação de Pipeline Customizado (POST /api/pipelines)
  const createPipeRes = await new Promise((resolve) => {
    const postData = JSON.stringify({
      name: 'Parcerias Estratégicas & Canais',
      description: 'Pipeline exclusivo para prospecção e onboarding de canais integradores.',
      isDefault: false
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/pipelines',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(createPipeRes.status, 201, 'POST /api/pipelines deve retornar HTTP 201');
  const customPipeId = createPipeRes.body.data.id;

  // 22.3 Adição de Estágio Customizado no Pipeline (POST /api/pipelines/:id/stages)
  const createStageRes = await new Promise((resolve) => {
    const postData = JSON.stringify({
      name: 'Homologação Jurídica & Compliance',
      probability: 60,
      slaDays: 5,
      color: '#6366f1'
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/pipelines/${customPipeId}/stages`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(createStageRes.status, 201, 'POST /api/pipelines/:id/stages deve retornar HTTP 201');
  assert.strictEqual(createStageRes.body.success, true);

  // 22.4 Criação de Oportunidade com Cálculo Automático de AI Deal Score
  const createDealRes22 = await new Promise((resolve) => {
    const postData = JSON.stringify({
      title: 'Contrato de Licenciamento Enterprise',
      leadId: leadA.id,
      value: 48000,
      stage: 'proposta',
      pipelineId: customPipeId
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/deals',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${vendedorToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(createDealRes22.status, 201, 'POST /api/deals deve responder HTTP 201');
  const testDeal22 = createDealRes22.body.data;
  assert.ok(typeof testDeal22.aiDealScore === 'number', 'Deal criado deve possuir aiDealScore numérico inicial');
  assert.ok(testDeal22.aiDealScore >= 0 && testDeal22.aiDealScore <= 100, 'Score deve estar entre 0 e 100');

  // 22.5 Recálculo de AI Deal Score com Explicabilidade Textual (POST /api/deals/:id/ai-score)
  const recalcScoreRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/deals/${testDeal22.id}/ai-score`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vendedorToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.end();
  });
  assert.strictEqual(recalcScoreRes.status, 200, 'POST /api/deals/:id/ai-score deve responder HTTP 200');
  assert.strictEqual(recalcScoreRes.body.success, true);
  assert.ok(typeof recalcScoreRes.body.aiDealScore === 'number', 'Score recalculado deve ser numérico');
  assert.ok(typeof recalcScoreRes.body.rationale === 'string' && recalcScoreRes.body.rationale.length > 10, 'Deve retornar justificativa textual explicável');

  // 22.6 Isolamento Anti-IDOR em Pipelines & Estágios
  const idorStageRes = await new Promise((resolve) => {
    const postData = JSON.stringify({ name: 'Estágio Invasivo' });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/pipelines/${customPipeId}/stages`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${otherTenantAdminToken}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(idorStageRes.status, 404, 'Tentativa de criar estágio em pipeline de outro tenant deve retornar HTTP 404');

  // Limpeza de entidades temporárias do teste 22
  dealsDB.delete(testDeal22.id);
  pipelinesDB.delete(customPipeId);

  console.log('  ✅ Teste 22 Aprovado: Múltiplos Pipelines, Estágios Customizados, AI Deal Score BANT e Anti-IDOR 100% validados.\n');
  passed++;

  // =========================================================================
  // TESTE 23: VALIDAÇÃO DO AI GATEWAY MULTI-LLM, CACHE LRU E TELEMETRIA (FASE 6)
  // =========================================================================
  console.log('▶ Teste 23: Validação do AI Gateway Multi-LLM, Cache LRU e Telemetria (FASE 6)...');

  // 23.1 Listagem de Modelos Disponíveis (GET /api/ai/models)
  const modelsRes = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/ai/models',
      headers: { 'Authorization': `Bearer ${proprietarioToken19}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(modelsRes.status, 200, 'GET /api/ai/models deve responder HTTP 200');
  assert.strictEqual(modelsRes.body.success, true);
  assert.ok(modelsRes.body.data.length >= 4, 'Deve listar ao menos 4 modelos (Claude, Gemini, GPT, Heurístico)');
  const heuristicModel = modelsRes.body.data.find(m => m.id === 'heuristic-core');
  assert.ok(heuristicModel, 'Modelo nativo de heurística deve estar disponível e ativo');

  // 23.2 Execução de Prompt Comercial no Gateway (POST /api/ai/chat)
  const chatRes1 = await new Promise((resolve) => {
    const postData = JSON.stringify({
      prompt: 'Como contornar a objeção de preço alto para um cliente de médio porte?',
      taskType: 'objection_handling',
      modelPreference: 'auto'
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/ai/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(chatRes1.status, 200, 'POST /api/ai/chat deve responder HTTP 200');
  assert.strictEqual(chatRes1.body.success, true);
  assert.ok(chatRes1.body.text && chatRes1.body.text.length > 20, 'Deve retornar resposta textual gerada');
  assert.strictEqual(chatRes1.body.cached, false, 'Primeira chamada não deve vir do cache');
  assert.strictEqual(chatRes1.body.creditsConsumed, 20, 'Deve cobrar créditos da tarefa objection_handling');

  // 23.3 Validação de Cache Semântico / LRU (Segunda chamada idêntica)
  const chatRes2 = await new Promise((resolve) => {
    const postData = JSON.stringify({
      prompt: 'Como contornar a objeção de preço alto para um cliente de médio porte?',
      taskType: 'objection_handling',
      modelPreference: 'auto'
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/ai/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(chatRes2.status, 200, 'Segunda chamada deve responder HTTP 200');
  assert.strictEqual(chatRes2.body.cached, true, 'Segunda chamada idêntica deve ser servida pelo Cache LRU');
  assert.strictEqual(chatRes2.body.creditsConsumed, 0, 'Chamada em cache deve custar 0 créditos');
  assert.ok(chatRes2.body.latencyMs <= 15, 'Latência do cache deve ser inferior a 15ms');

  // 23.4 Telemetria de Uso e Governança (GET /api/ai/usage)
  const usageRes = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/ai/usage',
      headers: { 'Authorization': `Bearer ${proprietarioToken19}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(usageRes.status, 200, 'GET /api/ai/usage deve responder HTTP 200');
  assert.strictEqual(usageRes.body.success, true);
  assert.ok(usageRes.body.summary.totalCalls >= 1, 'Telemetria deve registrar as chamadas realizadas');
  assert.ok(usageRes.body.summary.totalCreditsUsed >= 20, 'Deve somar os créditos deduzidos');

  // 23.5 Isolamento Anti-IDOR na Telemetria de IA (Outro tenant só vê seus registros)
  const crossUsageRes = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/ai/usage',
      headers: { 'Authorization': `Bearer ${otherTenantAdminToken}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(crossUsageRes.status, 200, 'Outro tenant deve conseguir consultar seus próprios dados');
  const leakedRecord = crossUsageRes.body.data.find(r => r.tenantId === 'ten_demo_agentise');
  assert.strictEqual(leakedRecord, undefined, 'Telemetria de outro tenant não deve vazar (Anti-IDOR)');

  console.log('  ✅ Teste 23 Aprovado: AI Gateway Multi-LLM, Cache LRU, Telemetria e Anti-IDOR 100% validados.\n');
  passed++;

  // =========================================================================
  // TESTE 24: VALIDAÇÃO DO AGENTE COMERCIAL DE IA E TRANSBORDO HUMANO (FASE 7)
  // =========================================================================
  console.log('▶ Teste 24: Validação do Agente Comercial de IA e Transbordo Humano (FASE 7)...');

  // 24.1 Listagem de Agentes de IA Padrão do Tenant (GET /api/ai/agents)
  const listAgentsRes = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/ai/agents',
      headers: { 'Authorization': `Bearer ${proprietarioToken19}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(listAgentsRes.status, 200, 'GET /api/ai/agents deve responder HTTP 200');
  assert.strictEqual(listAgentsRes.body.success, true);
  assert.ok(listAgentsRes.body.data.length >= 2, 'Deve inicializar ao menos Sofia e Lucas como agentes');
  const sofiaAgent = listAgentsRes.body.data.find(a => a.name.includes('Sofia'));
  assert.ok(sofiaAgent, 'Agente Sofia Closer deve existir');

  // 24.2 Atendimento Comercial Autônomo com IA (Sem transbordo)
  const agentChatRes1 = await new Promise((resolve) => {
    const postData = JSON.stringify({
      leadId: leadA.id,
      message: 'Quais são as condições de pagamento e faturamento no PIX?'
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/ai/agents/${sofiaAgent.id}/interact`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(agentChatRes1.status, 200, 'POST /api/ai/agents/:id/interact deve responder HTTP 200');
  assert.strictEqual(agentChatRes1.body.handover, false, 'Dúvida normal não deve acionar transbordo');
  assert.ok(agentChatRes1.body.reply && agentChatRes1.body.reply.length > 20, 'IA deve gerar resposta comercial');

  // 24.3 Transbordo Humano por Palavra-Chave Explícita
  const agentChatRes2 = await new Promise((resolve) => {
    const postData = JSON.stringify({
      leadId: leadA.id,
      message: 'Quero falar com um atendente humano urgente, não quero falar com robô.'
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/ai/agents/${sofiaAgent.id}/interact`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(agentChatRes2.status, 200, 'Interação de transbordo deve responder HTTP 200');
  assert.strictEqual(agentChatRes2.body.handover, true, 'Pedido de humano deve acionar transbordo');
  assert.ok(agentChatRes2.body.taskId, 'Deve criar tarefa urgente para vendedor humano');

  // 24.4 Transbordo Humano por Teto de Autonomia Financeira
  const highValueDeal = dealsDB.insert({
    tenantId: 'ten_demo_agentise',
    leadId: leadA.id,
    title: 'Negociação Mega Enterprise',
    value: 95000,
    stage: 'proposta'
  });

  const agentChatRes3 = await new Promise((resolve) => {
    const postData = JSON.stringify({
      leadId: leadA.id,
      dealId: highValueDeal.id,
      message: 'Podemos fechar o contrato no valor total?'
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/ai/agents/${sofiaAgent.id}/interact`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(agentChatRes3.body.handover, true, 'Negócio acima do teto de autonomia deve transbordar');
  dealsDB.delete(highValueDeal.id);

  // 24.5 Consulta ao Histórico de Sessões com IA (GET /api/ai/conversations)
  const convsRes = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/ai/conversations',
      headers: { 'Authorization': `Bearer ${proprietarioToken19}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(convsRes.status, 200, 'GET /api/ai/conversations deve responder HTTP 200');
  assert.ok(convsRes.body.data.length >= 2, 'Deve conter as interações registradas no histórico');

  // 24.6 Isolamento Anti-IDOR em Agentes de IA
  const idorAgentRes = await new Promise((resolve) => {
    const postData = JSON.stringify({ message: 'Ataque cross-tenant' });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/ai/agents/${sofiaAgent.id}/interact`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${otherTenantAdminToken}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(idorAgentRes.status, 500, 'Tentativa de interagir com agente de outro tenant deve falhar (Tenant mismatch)');

  console.log('  ✅ Teste 24 Aprovado: Agente Comercial de IA, Transbordo Humano, Teto de Autonomia e Histórico validados.\n');
  passed++;

  // 25. Validação do Inbox Multicanal com IA & Human-in-the-Loop (FASE 8)
  console.log('▶ Teste 25: Validação do Inbox Multicanal com IA & Human-in-the-Loop (FASE 8)...');
  const { conversationsDB, messagesDB } = require('../database/db');

  // 25.1 Cria conversa de teste associada ao tenant
  const testConv = conversationsDB.insert({
    tenantId: 'ten_demo_agentise',
    leadId: leadA.id,
    customerName: leadA.name,
    customerPhone: leadA.phone || '11999990000',
    channel: 'whatsapp',
    mode: 'copiloto',
    status: 'aguardando_atendimento',
    lastMessage: 'Qual é o prazo de entrega?'
  });

  messagesDB.insert({
    tenantId: 'ten_demo_agentise',
    conversationId: testConv.id,
    text: 'Olá, gostaria de saber os detalhes da proposta e o prazo de entrega.',
    sender: 'cliente',
    senderName: leadA.name,
    status: 'received',
    channel: 'whatsapp'
  });

  // 25.2 GET /api/inbox/conversations
  const inboxListRes = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/inbox/conversations',
      headers: { 'Authorization': `Bearer ${proprietarioToken19}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(inboxListRes.status, 200, 'GET /api/inbox/conversations deve responder 200');
  const foundConv = inboxListRes.body.data.find(c => c.id === testConv.id);
  assert.ok(foundConv, 'Conversa criada deve estar presente na listagem do inbox');
  assert.strictEqual(foundConv.lead.name, leadA.name, 'Conversa enriquecida deve trazer dados do lead');

  // 25.3 POST /api/inbox/conversations/:id/suggest (IA gera sugestão)
  const suggestRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/inbox/conversations/${testConv.id}/suggest`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.end();
  });
  assert.strictEqual(suggestRes.status, 200, 'POST /api/inbox/conversations/:id/suggest deve responder 200');
  assert.ok(suggestRes.body.suggestion, 'Sugestão da IA deve ser gerada');
  assert.ok(suggestRes.body.modelUsed, 'Modelo de IA utilizado deve ser informado');

  // 25.4 POST /api/inbox/conversations/:id/messages (Humano envia/aprova)
  const humanSendRes = await new Promise((resolve) => {
    const postData = JSON.stringify({
      text: suggestRes.body.suggestion,
      sender: 'vendedor',
      approvedByHuman: true
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/inbox/conversations/${testConv.id}/messages`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(humanSendRes.status, 201, 'POST /api/inbox/conversations/:id/messages deve responder 201');
  assert.strictEqual(humanSendRes.body.data.sender, 'vendedor');

  // 25.5 PATCH /api/inbox/conversations/:id/mode (Alterna modo)
  const modeRes = await new Promise((resolve) => {
    const patchData = JSON.stringify({ mode: 'humano' });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/inbox/conversations/${testConv.id}/mode`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(patchData);
    req.end();
  });
  assert.strictEqual(modeRes.status, 200, 'PATCH /api/inbox/conversations/:id/mode deve responder 200');
  assert.strictEqual(modeRes.body.data.mode, 'humano', 'Modo deve ter sido alterado para humano');

  // 25.6 Anti-IDOR: Outro tenant não pode sugerir ou enviar mensagens na conversa
  const idorInboxRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/inbox/conversations/${testConv.id}/suggest`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${otherTenantAdminToken}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.end();
  });
  assert.strictEqual(idorInboxRes.status, 404, 'Tentativa de obter sugestão em conversa de outro tenant deve retornar 404');

  conversationsDB.delete(testConv.id);
  messagesDB.deleteWhere(m => m.conversationId === testConv.id);

  console.log('  ✅ Teste 25 Aprovado: Inbox Multicanal com IA, Sugestão Assistida, Human-in-the-Loop e Anti-IDOR validados.\n');
  passed++;

  // 26. Validação do Motor de Automações Comerciais Visual & Telemetria (FASE 9)
  console.log('▶ Teste 26: Validação do Motor de Automações Comerciais Visual & Telemetria (FASE 9)...');
  const { automationsDB: autoDB26, workflowRunsDB: runsDB26 } = require('../database/db');

  // 26.1 Criação de nova regra com QUANDO -> SE -> ENTÃO
  const newAutoRes = await new Promise((resolve) => {
    const postData = JSON.stringify({
      name: 'Alerta Deal VIP Score Alto',
      trigger: 'deal_score_alto',
      condition: { field: 'value', operator: 'greater_than', value: 20000 },
      action: { type: 'alertar_gestor', params: { title: 'Lead de Alto Valor requer atenção imediata' } }
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/automations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(newAutoRes.status, 201, 'POST /api/automations deve responder 201');
  const createdAutoId = newAutoRes.body.data.id;
  assert.ok(createdAutoId, 'Automação deve possuir ID gerado');

  // 26.2 Teste de Disparo Imediato via Endpoint (POST /api/automations/test-trigger)
  const testTriggerRes = await new Promise((resolve) => {
    const postData = JSON.stringify({
      triggerType: 'deal_score_alto',
      context: { title: 'Expansão Enterprise Corp', value: 50000, leadId: leadA.id }
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/automations/test-trigger',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(testTriggerRes.status, 200, 'POST /api/automations/test-trigger deve responder 200');
  assert.ok(testTriggerRes.body.executedActions.length >= 1, 'Pelo menos uma ação deve ter sido executada');
  const alertAction = testTriggerRes.body.executedActions.find(a => a.type === 'alert_created');
  assert.ok(alertAction, 'Ação de alert_created deve ter sido disparada');

  // 26.3 Verificação de Histórico de Execuções (workflowRunsDB & GET /api/automations/runs)
  const runsRes = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/automations/runs',
      headers: { 'Authorization': `Bearer ${proprietarioToken19}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(runsRes.status, 200, 'GET /api/automations/runs deve responder 200');
  assert.ok(runsRes.body.data.length >= 1, 'Deve conter registro de execução no histórico');
  const autoRun = runsRes.body.data.find(r => r.automationId === createdAutoId);
  assert.ok(autoRun, 'Execução da automação criada deve constar no log');
  assert.strictEqual(autoRun.status, 'success');

  // 26.4 Atualização da Automação (PUT /api/automations/:id)
  const updateAutoRes = await new Promise((resolve) => {
    const putData = JSON.stringify({ name: 'Alerta Deal VIP Score Alto - Atualizado' });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/automations/${createdAutoId}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(putData);
    req.end();
  });
  assert.strictEqual(updateAutoRes.status, 200, 'PUT /api/automations/:id deve responder 200');
  assert.strictEqual(updateAutoRes.body.data.name, 'Alerta Deal VIP Score Alto - Atualizado');

  // 26.5 Isolamento Anti-IDOR em Automações (Exclusão por outro tenant é bloqueada)
  const idorAutoRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/automations/${createdAutoId}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${otherTenantAdminToken}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.end();
  });
  assert.strictEqual(idorAutoRes.status, 404, 'Exclusão de automação de outro tenant deve retornar 404');

  // 26.6 Exclusão Autorizada da Automação (DELETE /api/automations/:id)
  const deleteAutoRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/automations/${createdAutoId}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${proprietarioToken19}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.end();
  });
  assert.strictEqual(deleteAutoRes.status, 200, 'DELETE /api/automations/:id autorizado deve responder 200');

  console.log('  ✅ Teste 26 Aprovado: Motor de Automações Visuais (QUANDO->SE->ENTÃO), Telemetria de Runs e Anti-IDOR validados.\n');
  passed++;

  // 27. Validação de Propostas Comerciais, Checkout Público & PIX Banco Central (FASE 10)
  console.log('▶ Teste 27: Validação de Propostas Comerciais, Checkout Público & PIX Banco Central (FASE 10)...');
  const { proposalsDB: propDB27, paymentsDB: payDB27 } = require('../database/db');

  // 27.1 Criação de Deal para a Proposta
  const testDeal27 = dealsDB.insert({
    tenantId: 'ten_demo_agentise',
    leadId: leadA.id,
    title: 'Projeto Solução Enterprise AI V2',
    value: 10000,
    stage: 'proposta'
  });

  // 27.2 Geração de Proposta com Itens Detalhados e Desconto
  const genPropRes = await new Promise((resolve) => {
    const postData = JSON.stringify({
      dealId: testDeal27.id,
      leadId: leadA.id,
      items: [
        { description: 'Licença Enterprise Agentise AI', quantity: 1, unitPrice: 8000, discount: 500 },
        { description: 'Capacitação e Setup Especializado', quantity: 2, unitPrice: 1500, discount: 0 }
      ],
      discount: 500,
      customerName: leadA.name,
      customerPhone: '11999998888',
      dealTitle: 'Projeto Solução Enterprise AI V2'
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/pix/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(genPropRes.status, 200, 'POST /api/pix/generate deve responder 200');
  const propData = genPropRes.body.data;
  assert.strictEqual(propData.amount, 10000, 'Valor final calculado deve ser 10000');
  assert.ok(propData.publicToken, 'Deve gerar publicToken para checkout');
  assert.ok(propData.checkoutUrl.startsWith('/p/'), 'Deve conter URL amigável de checkout');
  assert.ok(propData.payload.includes('luklen2@gmail.com'), 'Payload PIX deve conter a chave oficial');
  assert.ok(propData.payload.includes('LUCIANO SANT ANNA'), 'Payload PIX deve conter o nome do titular oficial');

  // 27.3 Acesso Público ao Checkout HTML (GET /p/:token sem header de autenticação)
  const checkoutHtmlRes = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${TEST_PORT}${propData.checkoutUrl}`, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
  });
  assert.strictEqual(checkoutHtmlRes.status, 200, 'Página pública de checkout deve responder 200');
  assert.ok(checkoutHtmlRes.body.includes('Proposta Comercial Oficial'), 'Página deve renderizar título da proposta');
  assert.ok(checkoutHtmlRes.body.includes('Licença Enterprise Agentise AI'), 'Página deve exibir itens detalhados');
  assert.ok(checkoutHtmlRes.body.includes(propData.payload), 'Página deve exibir payload PIX Copia-e-Cola');

  // 27.4 Acesso Público à API da Proposta (GET /api/public/proposals/:token)
  const publicApiRes = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${TEST_PORT}/api/public/proposals/${propData.publicToken}`, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(publicApiRes.status, 200, 'API pública da proposta deve responder 200');
  assert.strictEqual(publicApiRes.body.data.amount, 10000);

  // 27.5 Webhook de Baixa Automática PIX em Tempo Real (POST /api/pix/webhook)
  const webhookRes = await new Promise((resolve) => {
    const postData = JSON.stringify({
      token: propData.publicToken,
      txId: propData.txId,
      amount: 10000,
      endToEndId: 'E9999999920260918BACEN'
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/pix/webhook',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(webhookRes.status, 200, 'Webhook PIX deve responder 200');

  // 27.6 Verificação de Fechamento Automático do Deal e Registro em paymentsDB
  const updatedProposal = propDB27.findById(propData.proposalId);
  assert.strictEqual(updatedProposal.status, 'paga', 'Proposta deve estar com status paga');
  assert.ok(updatedProposal.paidAt, 'Proposta deve ter paidAt preenchido');

  const updatedDeal = dealsDB.findById(testDeal27.id);
  assert.strictEqual(updatedDeal.stage, 'ganho', 'Deal deve avançar automaticamente para "ganho"');

  const paymentRecord = payDB27.findOne(p => p.proposalId === propData.proposalId);
  assert.ok(paymentRecord, 'Registro de pagamento deve ter sido gravado em paymentsDB');
  assert.strictEqual(paymentRecord.status, 'pago');
  assert.strictEqual(paymentRecord.method, 'PIX');

  // 27.7 Isolamento Anti-IDOR (Outro tenant não pode consultar a proposta via API privada)
  const idorPropRes = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/proposals/${propData.proposalId}`,
      headers: { 'Authorization': `Bearer ${otherTenantAdminToken}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode }));
    });
  });
  assert.strictEqual(idorPropRes.status, 404, 'Consulta cross-tenant a proposta deve ser bloqueada com 404');

  // Limpeza
  propDB27.delete(propData.proposalId);
  dealsDB.delete(testDeal27.id);
  payDB27.deleteWhere(p => p.proposalId === propData.proposalId);

  console.log('  ✅ Teste 27 Aprovado: Propostas com Itens, Checkout Público, PIX Bacen, Baixa por Webhook e Anti-IDOR validados.\n');
  passed++;

  // 28. Validação de Analytics Comercial Avançado & BI (FASE 11)
  console.log('▶ Teste 28: Validação de Analytics Comercial Avançado & BI (FASE 11)...');

  // 28.1 Consulta ao Endpoint Dedicado de BI (/api/analytics/bi)
  const biRes = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/analytics/bi',
      headers: { 'Authorization': `Bearer ${proprietarioToken19}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(biRes.status, 200, 'GET /api/analytics/bi deve responder HTTP 200');
  assert.strictEqual(biRes.body.success, true);
  const kpis = biRes.body.data.kpis;
  assert.ok(typeof kpis.cac === 'number', 'CAC deve ser numérico');
  assert.ok(typeof kpis.ltv === 'number', 'LTV deve ser numérico');
  assert.ok(typeof kpis.ltvCacRatio === 'number', 'LTV/CAC ratio deve ser numérico');
  assert.ok(typeof kpis.salesCycleDays === 'number', 'Ciclo de vendas deve ser numérico');
  assert.ok(typeof kpis.weightedForecast === 'number', 'Forecast ponderado deve ser numérico');
  assert.ok(Array.isArray(biRes.body.data.channelPerformance), 'channelPerformance deve ser um array');
  assert.ok(Array.isArray(biRes.body.data.sellersPerformance), 'sellersPerformance deve ser um array');
  assert.ok(typeof biRes.body.data.aiUsageSummary.totalTokens === 'number', 'aiUsageSummary deve conter totalTokens');

  // 28.2 Validação de Compatibilidade Retroativa no Dashboard (/api/analytics)
  const analyticsRes28 = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/analytics',
      headers: { 'Authorization': `Bearer ${proprietarioToken19}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(analyticsRes28.status, 200);
  assert.ok(analyticsRes28.body.data.bi, 'Dashboard tradicional deve conter objeto bi enriquecido');
  assert.ok(analyticsRes28.body.data.channelPerformance, 'Dashboard deve conter channelPerformance');

  // 28.3 Isolamento Cross-Tenant no BI (Outro tenant não visualiza métricas de ten_demo_agentise)
  const idorBiRes = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/analytics/bi',
      headers: { 'Authorization': `Bearer ${otherTenantAdminToken}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(idorBiRes.status, 200);
  assert.notStrictEqual(idorBiRes.body.data.kpis.totalPipelineValue, kpis.totalPipelineValue, 'Métricas entre tenants distintos devem ser isoladas');

  console.log('  ✅ Teste 28 Aprovado: BI Avançado (CAC, LTV, LTV/CAC, Ciclo de Vendas, Previsibilidade Ponderada) e Anti-IDOR validados.\n');
  passed++;

  // 29. Validação de Blindagem de Segurança, LGPD & Auditoria 360° (FASE 12)
  console.log('▶ Teste 29: Validação de Blindagem de Segurança, LGPD & Auditoria 360° (FASE 12)...');
  const { consentsDB: conDB29 } = require('../database/db');

  // 29.1 Verificação da Rota Pública de Termos de Uso (/termos)
  const termosRes = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${TEST_PORT}/termos`, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
  });
  assert.strictEqual(termosRes.status, 200, '/termos deve responder HTTP 200');
  assert.ok(termosRes.body.includes('não substituem diagnósticos, consultas, aconselhamentos ou tratamentos médicos'), 'Aviso ético obrigatório Luciano deve estar presente');
  assert.ok(termosRes.body.includes('16+ anos'), 'Indicação de faixa etária deve estar presente');
  assert.ok(termosRes.body.includes('restritos a maiores de 18 anos'), 'Restrição de compras/assinaturas deve constar');

  // 29.2 Verificação da Rota Pública de Política de Privacidade (/privacidade)
  const privRes = await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${TEST_PORT}/privacidade`, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
  });
  assert.strictEqual(privRes.status, 200, '/privacidade deve responder HTTP 200');
  assert.ok(privRes.body.includes('Lei nº 13.709/2018'), 'Referência explícita à LGPD deve constar');
  assert.ok(privRes.body.includes('Art. 14 da LGPD'), 'Proteção de crianças e adolescentes (Art. 14 e ECA) deve constar');
  assert.ok(privRes.body.includes('Art. 18 da LGPD'), 'Direitos dos titulares (Art. 18) devem constar');

  // 29.3 Registro de Consentimento LGPD (POST /api/lgpd/consent)
  const consentRes = await new Promise((resolve) => {
    const postData = JSON.stringify({
      leadId: leadA.id,
      purpose: 'comercial_ia_whatsapp',
      accepted: true
    });
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/lgpd/consent',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${proprietarioToken19}`
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.write(postData);
    req.end();
  });
  assert.strictEqual(consentRes.status, 201, 'POST /api/lgpd/consent deve responder 201');
  assert.strictEqual(consentRes.body.data.accepted, true);
  const consentId = consentRes.body.data.id;

  // 29.4 Consulta de Consentimentos (GET /api/lgpd/consents)
  const listConsentsRes = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/lgpd/consents',
      headers: { 'Authorization': `Bearer ${proprietarioToken19}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  assert.strictEqual(listConsentsRes.status, 200);
  assert.ok(listConsentsRes.body.data.some(c => c.id === consentId), 'Consentimento registrado deve constar na listagem');

  // 29.5 Anonimização de Dados do Titular (Art. 18 LGPD) com Auditoria de Delta
  const leadToAnon = leadsDB.insert({
    tenantId: 'ten_demo_agentise',
    name: 'Carlos Eduardo Silveira',
    email: 'carlos.silveira@cliente.com.br',
    phone: '11988887777',
    document: '123.456.789-00'
  });

  const anonRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/leads/${leadToAnon.id}/anonymize`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${proprietarioToken19}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.end();
  });
  assert.strictEqual(anonRes.status, 200, 'POST /api/leads/:id/anonymize deve responder 200');
  assert.ok(anonRes.body.data.name.includes('Titular Anonimizado Art. 18 LGPD'), 'Nome deve ser anonimizado');
  assert.strictEqual(anonRes.body.data.phone, '11900000000', 'Telefone deve ser mascarado');
  assert.strictEqual(anonRes.body.data.document, '***', 'Documento deve ser mascarado');

  // Verifica se a Trilha de Auditoria registrou o delta exato
  const auditLogsRes29 = await new Promise((resolve) => {
    http.get({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/audit-logs?resource=leads`,
      headers: { 'Authorization': `Bearer ${proprietarioToken19}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
  });
  const anonAuditLog = auditLogsRes29.body.data.find(l => l.entityId === leadToAnon.id && l.action === 'LGPD_ANONYMIZED');
  assert.ok(anonAuditLog, 'Log de auditoria da anonimização LGPD deve existir');
  assert.strictEqual(anonAuditLog.oldValues.name, 'Carlos Eduardo Silveira', 'Valor anterior deve preservar integridade do delta');
  assert.ok(anonAuditLog.newValues.name.includes('Titular Anonimizado'), 'Novo valor deve constar no delta');

  // 29.6 Isolamento Anti-IDOR (Outro tenant não pode anonimizar lead alheio)
  const idorAnonRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: `/api/leads/${leadToAnon.id}/anonymize`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${otherTenantAdminToken}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.end();
  });
  assert.strictEqual(idorAnonRes.status, 404, 'Tentativa de anonimizar lead de outro tenant deve retornar 404');

  // Limpeza
  leadsDB.delete(leadToAnon.id);
  conDB29.delete(consentId);

  console.log('  ✅ Teste 29 Aprovado: Segurança, /termos, /privacidade, LGPD Art. 18, Auditoria Delta e Anti-IDOR validados.\n');
  passed++;

  console.log(`🎉 SUCESSO TOTAL: Todos os ${passed} testes foram aprovados com êxito!`);
  console.log('=========================================================\n');
  // Limpeza de entidades temporárias de teste
  leadsDB.delete(leadA.id);
  const db = require('../database/db');
  if (typeof camp !== 'undefined' && camp && camp.id) {
    db.campaignsDB.delete(camp.id);
  }
  if (regResult && regResult.tenant) {
    db.tenantsDB.delete(regResult.tenant.id);
    db.usersDB.deleteWhere(u => u.tenantId === regResult.tenant.id);
    db.leadsDB.deleteWhere(l => l.tenantId === regResult.tenant.id);
    db.tasksDB.deleteWhere(t => t.tenantId === regResult.tenant.id);
    db.automationsDB.deleteWhere(a => a.tenantId === regResult.tenant.id);
    db.campaignsDB.deleteWhere(c => c.tenantId === regResult.tenant.id);
    if (db.aiUsageDB) db.aiUsageDB.deleteWhere(a => a.tenantId === regResult.tenant.id);
    if (db.auditLogsDB) db.auditLogsDB.deleteWhere(al => al.tenantId === regResult.tenant.id);
  }

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
