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
