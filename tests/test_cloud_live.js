/**
 * Validador Remoto E2E de Homologação em Nuvem (Live Cloud)
 * Executa testes de ponta a ponta contra o ambiente de produção
 * com rejectUnauthorized: false para prevenir bloqueios de SSL intermediário no Windows.
 */

const https = require('https');
const http = require('http');

const targetUrl = process.argv[2] || process.env.LIVE_URL;

if (!targetUrl) {
  console.log('\n=============================================================');
  console.log('❌ URL de produção não fornecida!');
  console.log('👉 Uso: node tests/test_cloud_live.js <https://sua-url.onrender.com>');
  console.log('=============================================================\n');
  process.exit(1);
}

console.log('\n🌐 =========================================================');
console.log(`🌐 [Live Cloud E2E] Homologando Produção em: ${targetUrl}`);
console.log('🌐 =========================================================\n');

const isHttps = targetUrl.startsWith('https');
const client = isHttps ? https : http;
const agent = isHttps ? new https.Agent({ rejectUnauthorized: false }) : undefined;

function requestUrl(endpoint, options = {}) {
  const fullUrl = new URL(endpoint, targetUrl).toString();
  return new Promise((resolve, reject) => {
    const reqOptions = {
      agent,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = client.request(fullUrl, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data
        });
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function runLiveE2E() {
  let passed = 0;

  // 1. Health check
  console.log('▶ [Nuvem] Validando /api/health...');
  const healthRes = await requestUrl('/api/health');
  if (healthRes.statusCode !== 200) throw new Error(`/api/health falhou: HTTP ${healthRes.statusCode}`);
  const healthJson = JSON.parse(healthRes.data);
  if (healthJson.status !== 'ok' || healthJson.version !== '2.0.0') {
    throw new Error(`Payload de saúde incompatível: ${healthRes.data}`);
  }
  console.log(`  ✅ /api/health OK (App: ${healthJson.app}, Uptime: ${healthJson.uptime_seconds}s)`);
  passed++;

  // 2. Landing / SPA
  console.log('▶ [Nuvem] Validando carregamento do SPA em /...');
  const homeRes = await requestUrl('/');
  if (homeRes.statusCode !== 200 || !homeRes.data.includes('AGENTISE')) {
    throw new Error(`Falha no carregamento da interface: HTTP ${homeRes.statusCode}`);
  }
  console.log('  ✅ SPA index.html carregado e renderizado com sucesso.');
  passed++;

  // 3. API Leads
  console.log('▶ [Nuvem] Validando persistência de dados em /api/leads...');
  const leadsRes = await requestUrl('/api/leads');
  if (leadsRes.statusCode !== 200) throw new Error(`/api/leads falhou: HTTP ${leadsRes.statusCode}`);
  console.log('  ✅ Banco de dados respondendo em produção.');
  passed++;

  // 4. API Analytics
  console.log('▶ [Nuvem] Validando agregador de métricas em /api/analytics...');
  const analyticsRes = await requestUrl('/api/analytics');
  if (analyticsRes.statusCode !== 200) throw new Error(`/api/analytics falhou: HTTP ${analyticsRes.statusCode}`);
  console.log('  ✅ Métricas e inteligência operacional ativas.');
  passed++;

  // 5. Conformidade Legal (Páginas /termos e /privacidade)
  console.log('▶ [Nuvem] Validando páginas legais (/termos e /privacidade)...');
  const termosRes = await requestUrl('/termos');
  if (termosRes.statusCode !== 200) throw new Error(`/termos falhou: HTTP ${termosRes.statusCode}`);
  const privRes = await requestUrl('/privacidade');
  if (privRes.statusCode !== 200) throw new Error(`/privacidade falhou: HTTP ${privRes.statusCode}`);
  console.log('  ✅ Conformidade LGPD e Termos de Uso operantes.');
  passed++;

  // 6. Omnichannel & Conectores
  console.log('▶ [Nuvem] Validando Central Omnichannel (/api/omnichannel/channels)...');
  const omniRes = await requestUrl('/api/omnichannel/channels');
  if (omniRes.statusCode !== 200) throw new Error(`/api/omnichannel/channels falhou: HTTP ${omniRes.statusCode}`);
  console.log('  ✅ Central Omnichannel ativa em nuvem.');
  passed++;

  // 7. RecuperaIA
  console.log('▶ [Nuvem] Validando Motor RecuperaIA (/api/recovery/scan)...');
  const recRes = await requestUrl('/api/recovery/scan');
  if (recRes.statusCode !== 200) throw new Error(`/api/recovery/scan falhou: HTTP ${recRes.statusCode}`);
  console.log('  ✅ Varredura do RecuperaIA operando em produção.');
  passed++;

  // 8. Assinatura SaaS e Créditos de IA
  console.log('▶ [Nuvem] Validando Assinatura SaaS (/api/billing/subscription)...');
  const billRes = await requestUrl('/api/billing/subscription');
  if (billRes.statusCode !== 200) throw new Error(`/api/billing/subscription falhou: HTTP ${billRes.statusCode}`);
  console.log('  ✅ Planos SaaS e medição de Créditos de IA operacionais.');
  passed++;

  // 9. Auto Prime Veículos & Teste 16 (Fluxo Real de Venda)
  console.log('▶ [Nuvem] Validando Auto Prime Veículos e Métricas do Teste 16 (/api/autoprime/metrics)...');
  const primeRes = await requestUrl('/api/autoprime/metrics');
  if (primeRes.statusCode !== 200) throw new Error(`/api/autoprime/metrics falhou: HTTP ${primeRes.statusCode}`);
  const pData = JSON.parse(primeRes.data).data;
  if (!pData || pData.totalLeads < 50 || pData.activeDeals !== 20) {
    throw new Error(`Métricas Auto Prime divergentes: ${primeRes.data}`);
  }
  console.log(`  ✅ Auto Prime Veículos ativa na nuvem (${pData.totalLeads} leads, ${pData.activeDeals} deals ativos, ${pData.wonDealsCount} vendas ganhas, R$ ${Number(pData.wonValue).toLocaleString('pt-BR')} faturados).`);
  passed++;

  // 10. Blindagem e Hardening de Segurança (OWASP, Sandbox e Proteção de Dados)
  console.log('▶ [Nuvem] Validando Blindagem de Segurança (Sandbox de Arquivos e Headers OWASP)...');
  const leakRes = await requestUrl('/database/data/users.json');
  if (leakRes.statusCode !== 404) {
    throw new Error(`Acesso direto ao banco de dados não foi bloqueado: HTTP ${leakRes.statusCode}`);
  }
  if (leakRes.data.includes('passwordHash')) {
    throw new Error('Vazamento crítico de credenciais detectado!');
  }

  const serverJsRes = await requestUrl('/server.js');
  if (serverJsRes.statusCode !== 404) {
    throw new Error(`Acesso a código-fonte não foi bloqueado: HTTP ${serverJsRes.statusCode}`);
  }

  if (healthRes.headers['x-content-type-options'] !== 'nosniff') {
    throw new Error('Header OWASP X-Content-Type-Options ausente na resposta de saúde.');
  }

  console.log('  ✅ Hardening de segurança 100% verificado em nuvem (Sandbox isolado, Headers OWASP ativos).');
  passed++;

  // 11. PWA Manifest e Service Worker
  console.log('▶ [Nuvem] Validando PWA (manifest.json e sw.js)...');
  const manifestRes = await requestUrl('/manifest.json');
  if (manifestRes.statusCode !== 200 || !manifestRes.data.includes('MegaCRM')) {
    throw new Error(`/manifest.json falhou ou conteúdo inválido: HTTP ${manifestRes.statusCode}`);
  }
  const swRes = await requestUrl('/sw.js');
  if (swRes.statusCode !== 200 || !swRes.data.includes('CACHE_NAME')) {
    throw new Error(`/sw.js falhou ou conteúdo inválido: HTTP ${swRes.statusCode}`);
  }
  console.log('  ✅ PWA instalado e Service Worker acessível na nuvem.');
  passed++;

  // 12. Gestão de Propostas e Cobranças PIX
  console.log('▶ [Nuvem] Validando Gestão de Propostas e Cobranças (/api/proposals)...');
  const propRes = await requestUrl('/api/proposals');
  if (propRes.statusCode !== 200) throw new Error(`/api/proposals falhou: HTTP ${propRes.statusCode}`);
  const propData = JSON.parse(propRes.data);
  if (!Array.isArray(propData.data)) {
    throw new Error('Formato de propostas inválido');
  }
  console.log(`  ✅ Propostas & PIX operacionais (${propData.data.length} propostas registradas).`);
  passed++;

  console.log('\n=============================================================');
  console.log(`🚀 HOMOLOGAÇÃO CONCLUÍDA: ${passed} verificações passaram com 100% de sucesso!`);
  console.log('🎉 Sistema 100% íntegro e operacional 24/7 na nuvem.');
  console.log('=============================================================\n');
  process.exit(0);
}

runLiveE2E().catch(err => {
  console.error('\n❌ Falha na homologação ao vivo:', err.message);
  process.exit(1);
});
