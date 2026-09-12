/**
 * Gerenciador de Túnel Seguro Cloudflare Quick Tunnel 24/7 para o Mega CRM
 * Com flag mandatória --no-prechecks e pool de certificados CA.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const tls = require('tls');
const http = require('http');

const projectDir = __dirname;
const cloudflaredExe = path.join(projectDir, 'cloudflared.exe');
const caBundlePath = path.join(projectDir, 'ca-bundle.crt');

// 1. Garantir existência de certificados CA confiáveis
if (!fs.existsSync(caBundlePath) || fs.statSync(caBundlePath).size < 100) {
  fs.writeFileSync(caBundlePath, tls.rootCertificates.join('\n'), 'utf-8');
}

// 2. Detecta qual porta está respondendo (3001 ou 3000)
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/health`, { timeout: 1500 }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j.app === 'Agentise Mega CRM') return resolve(true);
        } catch (e) {}
        resolve(false);
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function main() {
  console.log('🛡️  Iniciando Gerenciador de Túnel Seguro Cloudflare 24/7...');

  let activePort = 3001;
  const is3001 = await checkPort(3001);
  if (!is3001) {
    const is3000 = await checkPort(3000);
    if (is3000) activePort = 3000;
  }

  console.log(`📡 Apontando túnel para http://127.0.0.1:${activePort}...`);

  if (!fs.existsSync(cloudflaredExe)) {
    console.error('❌ cloudflared.exe não encontrado em:', cloudflaredExe);
    process.exit(1);
  }

  const args = [
    'tunnel',
    '--url', `http://127.0.0.1:${activePort}`,
    '--no-prechecks',
    '--edge-ip-version', '4',
    '--protocol', 'http2',
    '--origin-ca-pool', caBundlePath
  ];

  const tunnel = spawn(cloudflaredExe, args);
  let publicUrl = null;

  const handleOutput = (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !publicUrl) {
      publicUrl = match[0];
      fs.writeFileSync(path.join(projectDir, 'tunnel_url.txt'), publicUrl, 'utf-8');
      console.log(`\n===============================================================`);
      console.log(`🚀 AGENTISE MEGA CRM DISPONÍVEL 24/7 NA NUVEM GLOBAL!`);
      console.log(`🌐 URL Pública HTTPS:   ${publicUrl}`);
      console.log(`🩺 Health Check Nuvem:  ${publicUrl}/api/health`);
      console.log(`📱 Acesso Mobile / Web: Disponível para qualquer dispositivo no mundo!`);
      console.log(`===============================================================\n`);
    }
  };

  tunnel.stdout.on('data', handleOutput);
  tunnel.stderr.on('data', handleOutput);

  tunnel.on('close', (code) => {
    console.log(`Túnel encerrado com código: ${code}`);
  });

  process.on('SIGTERM', () => tunnel.kill());
  process.on('SIGINT', () => tunnel.kill());
}

main();
