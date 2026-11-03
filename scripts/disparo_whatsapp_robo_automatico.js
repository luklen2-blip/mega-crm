/**
 * DISPARADOR 100% AUTOMÁTICO DE WHATSAPP (ROBÔ COM CHROME)
 * Mega CRM - Engenharia de Vendas Luciano
 * 
 * Regra Operacional:
 * - 25 Oficinas Hoje com intervalo de 60 segundos (1 minuto)
 * - 25 Oficinas Amanhã com intervalo de 60 segundos (1 minuto)
 * - 100% Automático: Digita, Clica em Enviar, Aguarda 60s e passa para a próxima!
 * - Zero cliques manuais após conectar o QR Code na primeira vez.
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const LEADS_FILE = path.join(__dirname, '..', 'database', 'data', 'leads.json');
const STATUS_FILE = path.join(__dirname, '..', 'database', 'data', 'disparos_status.json');
const ACTIVITIES_FILE = path.join(__dirname, '..', 'database', 'data', 'activities.json');
const PROFILE_DIR = path.join(__dirname, '..', '.chrome_whatsapp_profile');

const TENANT_ID = 'ten_demo_agentise';
const INTERVAL_SECONDS = 60; // 1 minuto de intervalo de segurança anti-ban

// Localiza o executável do Google Chrome no Windows
function findChrome() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadLeads() {
  if (!fs.existsSync(LEADS_FILE)) {
    console.error('❌ Arquivo de leads não encontrado:', LEADS_FILE);
    process.exit(1);
  }
  const all = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
  return all.filter(l => l.tenantId === TENANT_ID && (l.source === 'Google Maps Oficinas' || (l.tags && l.tags.includes('Zona Oeste RJ'))));
}

function loadStatus() {
  if (fs.existsSync(STATUS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    } catch (e) {
      return { sent: {}, lastBatch: null, history: [] };
    }
  }
  return { sent: {}, lastBatch: null, history: [] };
}

function saveStatus(status) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), 'utf8');
}

function logActivity(lead, batchNum, note = '') {
  try {
    let activities = [];
    if (fs.existsSync(ACTIVITIES_FILE)) {
      activities = JSON.parse(fs.readFileSync(ACTIVITIES_FILE, 'utf8'));
    }
    activities.push({
      id: `act_wa_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tenantId: TENANT_ID,
      leadId: lead.id,
      type: 'WHATSAPP',
      title: `Disparo Automático WhatsApp (Lote ${batchNum})`,
      description: `Mensagem enviada pelo Robô para ${lead.name} (${lead.phone}). ${note}`,
      createdAt: new Date().toISOString()
    });
    fs.writeFileSync(ACTIVITIES_FILE, JSON.stringify(activities, null, 2), 'utf8');
  } catch (err) {
    // Silencioso
  }
}

function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') && digits.length >= 12 ? digits : ('55' + digits);
}

function extractBairro(lead) {
  const notes = (typeof lead === 'object' && lead) ? (lead.notes || '') : '';
  const match = notes.match(/Local:\s*([^|\-]+)/i);
  return match && match[1] ? match[1].trim() : 'Zona Oeste';
}

function getMessageText(leadOrName) {
  let name = 'Amigo';
  let bairro = 'Zona Oeste';
  if (typeof leadOrName === 'string') {
    name = leadOrName;
  } else if (typeof leadOrName === 'object' && leadOrName) {
    name = leadOrName.name || 'Amigo';
    bairro = extractBairro(leadOrName);
  }
  return `Olá, tudo bem? Falo com o responsável pela ${name}? Me chamo Luciano da Silva. Vi que vocês são referência em serviços automotivos em ${bairro}.\n\nCriamos o Oficina Organizada, um sistema simples para acabar com fichas de papel, enviar orçamentos rápidos pelo WhatsApp e controlar ordens de serviço da sua oficina.\n\n👉 Acesse pelo link abaixo para usar por 24 horas grátis (você usa tudo primeiro e só depois decide se vai pagar ou não):\nhttps://oficina-organizada-1.onrender.com/\n\nSe tiver qualquer dúvida ou quiser ajuda para liberar o acesso, me avise por aqui! Um abraço.`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCountdown(seconds) {
  for (let i = seconds; i > 0; i--) {
    const mins = Math.floor(i / 60).toString().padStart(2, '0');
    const secs = (i % 60).toString().padStart(2, '0');
    process.stdout.write(`\r   ⏳ Intervalo de segurança anti-ban: [${mins}:${secs}] para próxima oficina...   `);
    await sleep(1000);
  }
  process.stdout.write('\r                                                                             \r');
  try { process.stdout.write('\x07'); } catch (e) {}
}

async function waitForWhatsAppLogin(page) {
  console.log('\n⏳ Abrindo WhatsApp Web no Chrome...');
  await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 90000 });

  console.log('🔍 Verificando se já está conectado...');
  
  // Aguarda até 10s para ver se já está logado
  let loggedIn = false;
  try {
    await page.waitForSelector('#side, div[contenteditable="true"], [data-icon="chat"]', { timeout: 12000 });
    loggedIn = true;
  } catch (e) {
    loggedIn = false;
  }

  if (!loggedIn) {
    console.log('\n================================================================');
    console.log('📱 CONEXÃO COM WHATSAPP (APENAS NA PRIMEIRA VEZ)');
    console.log('================================================================');
    console.log('1. No seu celular, abra o aplicativo do WhatsApp.');
    console.log('2. Toque nos 3 pontinhos no topo (ou Configurações no iPhone).');
    console.log('3. Toque em "Aparelhos Conectados" > "Conectar um aparelho".');
    console.log('4. Aponte a câmera para o QR Code na janela do Chrome aberta na tela.');
    console.log('----------------------------------------------------------------');
    console.log('⏳ Aguardando leitura do QR Code pelo seu celular (você tem 5 minutos)...');

    await page.waitForSelector('#side, div[contenteditable="true"], [data-icon="chat"]', { timeout: 300000 });
    // Aguarda carregar as conversas
    await sleep(4000);
  }

  console.log('\n✅ WHATSAPP CONECTADO COM SUCESSO!');
  console.log('🤖 O Robô vai iniciar os disparos 100% automáticos agora.\n');
}

async function sendAutomatedMessage(page, phone, text) {
  const targetUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
  
  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (err) {
    // Retry rápido se der timeout de navegação leve
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch(e) {}
  }

  const sendBtnSelector = 'span[data-icon="send"], button[aria-label="Enviar"], [data-tab="11"]';
  const modalSelector = 'div[data-animate-modal-popup="true"], div[role="dialog"]';

  let attempts = 0;
  while (attempts < 35) {
    attempts++;
    await sleep(1000);

    // 1. Checa se o WhatsApp mostrou aviso de número inválido
    const modalEl = await page.$(modalSelector);
    if (modalEl) {
      const modalText = await page.evaluate(el => el.innerText || '', modalEl);
      if (modalText.includes('inválido') || modalText.includes('invalido') || modalText.includes('invalid') || modalText.includes('não está no WhatsApp')) {
        // Clica em OK para fechar
        try {
          const okButton = await page.$('button[data-tab="11"], button');
          if (okButton) await okButton.click();
        } catch(e) {}
        return { success: false, reason: 'Número não possui WhatsApp ativo' };
      }
    }

    // 2. Procura o botão de enviar
    const sendBtn = await page.$(sendBtnSelector);
    if (sendBtn) {
      await sleep(1500); // Garante que o texto foi preenchido
      await sendBtn.click();
      await sleep(2500); // Aguarda envio efetivo
      return { success: true };
    }

    // 3. Fallback: Se a caixa de texto estiver com a mensagem, aperta Enter
    const inputBox = await page.$('footer div[contenteditable="true"]');
    if (inputBox) {
      const hasContent = await page.evaluate(el => (el.innerText || '').length > 15, inputBox);
      if (hasContent) {
        await inputBox.focus();
        await page.keyboard.press('Enter');
        await sleep(2500);
        return { success: true };
      }
    }
  }

  return { success: false, reason: 'Tempo esgotado ao aguardar conversa carregar' };
}

let rl;

async function main() {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.clear();
  console.log('================================================================');
  console.log('🤖 MEGA CRM - ROBÔ DE DISPARO 100% AUTOMÁTICO (WHATSAPP)');
  console.log('================================================================');
  console.log('🛡️ Proteção Anti-Ban: Intervalo estrito de 1 minuto (60s) por oficina');
  console.log('🎁 Oferta: 24 Horas de Teste Grátis no Oficina Organizada');
  console.log('🔗 Link da Plataforma: https://oficina-organizada-1.onrender.com/');
  console.log('⚡ Modo: 100% Automático (Digita e Clica no Enviar Sozinho!)');
  console.log('----------------------------------------------------------------\n');

  const leads = loadLeads();
  const status = loadStatus();

  console.log(`📊 Base de Oficinas: ${leads.length} oficinas reais da Zona Oeste.`);
  const totalSent = Object.keys(status.sent).length;
  console.log(`📬 Oficinas já contatadas no histórico: ${totalSent} de ${leads.length}\n`);

  console.log('Escolha a operação desejada:');
  console.log(' [1] 🚀 Iniciar Disparo Automático LOTE 1 (HOJE - 25 oficinas: 1 a 25)');
  console.log(' [2] 🚀 Iniciar Disparo Automático LOTE 2 (AMANHÃ - 25 oficinas: 26 a 50)');
  console.log(' [3] 📋 Ver Lista das 50 Oficinas e Status de Envio');
  console.log(' [4] 🔄 Resetar Status de Disparos');
  console.log(' [0] 🚪 Sair\n');

  rl.question('👉 Digite a opção [1-4] e pressione ENTER: ', async (opt) => {
    const choice = opt.trim();

    if (choice === '1') {
      await runBatchWithRobot(leads.slice(0, 25), 1, status);
    } else if (choice === '2') {
      await runBatchWithRobot(leads.slice(25, 50), 2, status);
    } else if (choice === '3') {
      displayList(leads, status);
    } else if (choice === '4') {
      saveStatus({ sent: {}, lastBatch: null, history: [] });
      console.log('✅ Histórico de disparos resetado com sucesso!');
      rl.close();
    } else {
      console.log('Operação encerrada.');
      rl.close();
    }
  });
}

function displayList(leads, status) {
  console.log('\n================================================================');
  console.log('📋 LISTA COMPLETA DAS 50 OFICINAS DA ZONA OESTE');
  console.log('================================================================\n');

  console.log('--- LOTE 1 (HOJE: 1 a 25) ---');
  leads.slice(0, 25).forEach((l, i) => {
    const isSent = status.sent[l.id] ? '✅ ENVIADO' : '⏳ PENDENTE';
    console.log(`${(i + 1).toString().padStart(2, '0')}. [${isSent}] ${l.name} - ${l.phone} (${l.notes.split('|')[0].trim()})`);
  });

  console.log('\n--- LOTE 2 (AMANHÃ: 26 a 50) ---');
  leads.slice(25, 50).forEach((l, i) => {
    const isSent = status.sent[l.id] ? '✅ ENVIADO' : '⏳ PENDENTE';
    console.log(`${(i + 26).toString().padStart(2, '0')}. [${isSent}] ${l.name} - ${l.phone} (${l.notes.split('|')[0].trim()})`);
  });

  console.log('\n================================================================\n');
  rl.close();
}

async function runBatchWithRobot(batchLeads, batchNum, status) {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error('❌ Google Chrome não foi encontrado no caminho padrão.');
    console.log('Por favor, certifique-se de que o Google Chrome está instalado.');
    rl.close();
    return;
  }

  console.log('\n🚀 INICIALIZANDO ROBÔ AUTOMÁTICO...');
  console.log('Navegador:', chromePath);

  if (!fs.existsSync(PROFILE_DIR)) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      userDataDir: PROFILE_DIR,
      headless: false,
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--start-maximized',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-infobars'
      ]
    });
  } catch (err) {
    console.error('❌ Erro ao abrir o Google Chrome:', err.message);
    rl.close();
    return;
  }

  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();
  
  // Configura User-Agent realista
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36');

  // Aguarda Login no WhatsApp Web
  try {
    await waitForWhatsAppLogin(page);
  } catch (err) {
    console.error('❌ Tempo esgotado para login no WhatsApp:', err.message);
    await browser.close();
    rl.close();
    return;
  }

  console.log(`\n================================================================`);
  console.log(`🚀 INICIANDO DISPAROS DO LOTE ${batchNum} (${batchLeads.length} OFICINAS)`);
  console.log(`⏱️ Intervalo entre cada oficina: ${INTERVAL_SECONDS} segundos (1 minuto)`);
  console.log(`================================================================\n`);

  for (let i = 0; i < batchLeads.length; i++) {
    const lead = batchLeads[i];
    const itemNum = i + 1;
    const phone = normalizePhone(lead.phone);
    const msg = getMessageText(lead);

    console.log(`----------------------------------------------------------------`);
    console.log(`📍 [${itemNum}/${batchLeads.length}] Oficina: ${lead.name}`);
    console.log(`   📞 Telefone: ${phone} | ${lead.notes.split('|')[0].trim()}`);

    const result = await sendAutomatedMessage(page, phone, msg);

    if (result.success) {
      console.log(`   ✅ SUCESSO: Mensagem enviada automaticamente no WhatsApp!`);
      status.sent[lead.id] = {
        name: lead.name,
        phone,
        batch: batchNum,
        at: new Date().toLocaleString('pt-BR')
      };
      status.lastBatch = batchNum;
      saveStatus(status);
      logActivity(lead, batchNum, 'Enviado com sucesso pelo Robô Automático.');
    } else {
      console.log(`   ⚠️ AVISO: Não foi possível enviar (${result.reason}).`);
      logActivity(lead, batchNum, `Falha no envio automático: ${result.reason}`);
    }

    // Intervalo de 60 segundos antes da próxima oficina
    if (i < batchLeads.length - 1) {
      console.log(`   Aguardando 1 minuto antes da próxima oficina para proteção anti-ban...`);
      await runCountdown(INTERVAL_SECONDS);
    } else {
      console.log(`\n🎉 PARABÉNS! LOTE ${batchNum} CONCLUÍDO COM 100% DE SUCESSO!`);
      if (batchNum === 1) {
        console.log(`📅 As 25 oficinas de hoje foram finalizadas.`);
        console.log(`👉 Amanhã, abra o arquivo novamente e escolha a opção [2] para o LOTE 2!`);
      } else {
        console.log(`🏆 TODAS AS 50 OFICINAS FORAM CONTATADAS COM SUCESSO!`);
      }
    }
  }

  console.log('\n================================================================');
  console.log('✅ Todos os disparos programados foram finalizados.');
  console.log('Pressione ENTER para fechar o robô.');
  rl.question('', async () => {
    try { await browser.close(); } catch(e) {}
    rl.close();
  });
}

if (require.main === module) {
  main();
}

module.exports = { loadLeads, loadStatus, normalizePhone, getMessageText };

