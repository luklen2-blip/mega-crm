/**
 * DISPARADOR 100% AUTOMÁTICO DE WHATSAPP - CONCILIAZAP
 * Base: 38 Condomínios e Vilas Residenciais da Zona Oeste (Campo Grande, Cosmos, Santíssimo, etc.)
 * Oferta: 30 dias grátis para conhecer a ferramenta (https://conciliazap.onrender.com/)
 * 
 * Regra Anti-Ban:
 * - Intervalo estrito de 60 segundos entre cada envio
 * - Mensagens personalizadas com o nome de cada condomínio
 * - 100% Automático via Puppeteer com Chrome/Edge
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const LEADS_FILE = path.join(__dirname, '..', 'database', 'data', 'leads.json');
const STATUS_FILE = path.join(__dirname, '..', 'database', 'data', 'disparos_status_condominios.json');
const ACTIVITIES_FILE = path.join(__dirname, '..', 'database', 'data', 'activities.json');
const PROFILE_DIR = path.join(__dirname, '..', '.chrome_whatsapp_profile');

const TENANT_ID = 'ten_demo_agentise';
const INTERVAL_SECONDS = 60; // 1 minuto de intervalo anti-ban

// Localiza Google Chrome ou Microsoft Edge
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
  return all.filter(l => l.tenantId === TENANT_ID && (l.source === 'Prospecção ConciliaZap' || (l.tags && l.tags.includes('ConciliaZap'))));
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
      title: `Disparo ConciliaZap 30 Dias (Lote ${batchNum})`,
      description: `Mensagem enviada pelo Robô para o síndico de ${lead.name} (${lead.phone}). ${note}`,
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

function getMessageText(lead) {
  if (lead && lead.customMessage) {
    return lead.customMessage;
  }
  const name = lead && lead.name ? lead.name : 'seu condomínio';
  return `Olá! Tudo bem? Mensagem para o síndico ou administração do ${name}. Meu nome é Luciano, sou da região da Zona Oeste e criei o ConciliaZap (https://conciliazap.onrender.com/). É um assistente no WhatsApp que resolve a sobrecarga da comunicação com condôminos: organiza reservas de áreas comuns sem conflito, avisa entregas/encomendas e registra ocorrências 24h sem bagunçar seu WhatsApp particular. Liberamos para o ${name} 30 dias de uso 100% gratuito, sem fidelidade e sem cartão. Se quiser ver na prática aí essa semana, só me responder 'QUERO TESTAR' que ativo agora para vocês!`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCountdown(seconds) {
  for (let i = seconds; i > 0; i--) {
    const mins = Math.floor(i / 60).toString().padStart(2, '0');
    const secs = (i % 60).toString().padStart(2, '0');
    process.stdout.write(`\r   ⏳ Intervalo anti-ban: [${mins}:${secs}] para o próximo condomínio...   `);
    await sleep(1000);
  }
  process.stdout.write('\r                                                                                   \r');
  try { process.stdout.write('\x07'); } catch (e) {}
}

async function waitForWhatsAppLogin(page) {
  console.log('\n⏳ Abrindo WhatsApp Web no Chrome/Edge...');
  await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 90000 });

  console.log('🔍 Verificando se já está conectado...');
  
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
    console.log('2. Toque nos 3 pontinhos no topo (ou Ajustes/Configurações no iPhone).');
    console.log('3. Toque em "Aparelhos Conectados" > "Conectar um aparelho".');
    console.log('4. Aponte a câmera para o QR Code na janela do navegador aberta na tela.');
    console.log('----------------------------------------------------------------');
    console.log('⏳ Aguardando leitura do QR Code pelo seu celular (você tem até 5 minutos)...');

    await page.waitForSelector('#side, div[contenteditable="true"], [data-icon="chat"]', { timeout: 300000 });
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
        try {
          const okButton = await page.$('button[data-tab="11"], button');
          if (okButton) await okButton.click();
        } catch(e) {}
        return { success: false, reason: 'Número não possui WhatsApp ativo' };
      }
    }

    // 2. Procura botão de enviar
    const sendBtn = await page.$(sendBtnSelector);
    if (sendBtn) {
      await sleep(1500);
      await sendBtn.click();
      await sleep(2500);
      return { success: true };
    }

    // 3. Fallback: Se o texto foi carregado no rodapé, pressiona Enter
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

  return { success: false, reason: 'Tempo esgotado ao aguardar chat carregar' };
}

let rl;

async function main() {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.clear();
  console.log('================================================================');
  console.log('🤖 CONCILIAZAP - ROBÔ DE DISPARO 100% AUTOMÁTICO (WHATSAPP)');
  console.log('================================================================');
  console.log('🛡️ Proteção Anti-Ban: Intervalo estrito de 1 minuto (60s) por condomínio');
  console.log('🎁 Oferta: 30 DIAS GRÁTIS SEM PAGAR (CONHECER A FERRAMENTA)');
  console.log('🔗 Link da Plataforma: https://conciliazap.onrender.com/');
  console.log('⚡ Modo: 100% Automático (Digita e Clica no Enviar Sozinho!)');
  console.log('----------------------------------------------------------------\n');

  const leads = loadLeads();
  const status = loadStatus();

  console.log(`📊 Base de Condomínios: ${leads.length} vilas e condomínios da Zona Oeste.`);
  const totalSent = Object.keys(status.sent).length;
  console.log(`📬 Condomínios já contatados no histórico: ${totalSent} de ${leads.length}\n`);

  console.log('Escolha a operação desejada:');
  console.log(' [1] 🚀 Iniciar Disparo Automático LOTE 1 (HOJE - 19 condomínios: 1 a 19)');
  console.log(' [2] 🚀 Iniciar Disparo Automático LOTE 2 (AMANHÃ - 19 condomínios: 20 a 38)');
  console.log(' [3] 🚀 Disparo Completo (Todos os 38 Condomínios)');
  console.log(' [4] 📋 Ver Lista dos 38 Condomínios e Status de Envio');
  console.log(' [5] 🔄 Resetar Status de Disparos');
  console.log(' [0] 🚪 Sair\n');

  rl.question('👉 Digite a opção [1-5] e pressione ENTER: ', async (opt) => {
    const choice = opt.trim();

    if (choice === '1') {
      await runBatchWithRobot(leads.slice(0, 19), 1, status);
    } else if (choice === '2') {
      await runBatchWithRobot(leads.slice(19, 38), 2, status);
    } else if (choice === '3') {
      await runBatchWithRobot(leads, 'TOTAL', status);
    } else if (choice === '4') {
      displayList(leads, status);
    } else if (choice === '5') {
      saveStatus({ sent: {}, lastBatch: null, history: [] });
      console.log('✅ Histórico de disparos de condomínios resetado com sucesso!');
      rl.close();
    } else {
      console.log('Operação encerrada.');
      rl.close();
    }
  });
}

function displayList(leads, status) {
  console.log('\n================================================================');
  console.log('📋 LISTA COMPLETA DOS 38 CONDOMÍNIOS DA ZONA OESTE');
  console.log('================================================================\n');

  console.log('--- LOTE 1 (HOJE: 1 a 19) ---');
  leads.slice(0, 19).forEach((l, i) => {
    const isSent = status.sent[l.id] ? '✅ ENVIADO' : '⏳ PENDENTE';
    console.log(`${(i + 1).toString().padStart(2, '0')}. [${isSent}] ${l.name} - ${l.phoneDisplay || l.phone} (${l.tags[4] || 'Zona Oeste'})`);
  });

  console.log('\n--- LOTE 2 (AMANHÃ: 20 a 38) ---');
  leads.slice(19, 38).forEach((l, i) => {
    const isSent = status.sent[l.id] ? '✅ ENVIADO' : '⏳ PENDENTE';
    console.log(`${(i + 20).toString().padStart(2, '0')}. [${isSent}] ${l.name} - ${l.phoneDisplay || l.phone} (${l.tags[4] || 'Zona Oeste'})`);
  });

  console.log('\n================================================================\n');
  rl.close();
}

async function runBatchWithRobot(batchLeads, batchNum, status) {
  const chromePath = findChrome();
  if (!chromePath) {
    console.error('❌ Google Chrome ou Microsoft Edge não foi encontrado.');
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
    console.error('❌ Erro ao abrir o navegador:', err.message);
    rl.close();
    return;
  }

  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36');

  try {
    await waitForWhatsAppLogin(page);
  } catch (err) {
    console.error('❌ Tempo esgotado para login no WhatsApp:', err.message);
    await browser.close();
    rl.close();
    return;
  }

  console.log(`\n================================================================`);
  console.log(`🚀 INICIANDO DISPAROS DO LOTE ${batchNum} (${batchLeads.length} CONDOMÍNIOS)`);
  console.log(`⏱️ Intervalo entre cada condomínio: ${INTERVAL_SECONDS} segundos (1 minuto)`);
  console.log(`================================================================\n`);

  for (let i = 0; i < batchLeads.length; i++) {
    const lead = batchLeads[i];
    const itemNum = i + 1;
    const phone = normalizePhone(lead.phone);
    const msgText = getMessageText(lead);

    console.log(`\n----------------------------------------------------------------`);
    console.log(`📍 [${itemNum}/${batchLeads.length}] Condomínio: ${lead.name}`);
    console.log(`📱 Telefone: ${lead.phoneDisplay || phone}`);
    console.log(`📝 Mensagem Personalizada:`);
    console.log(`   "${msgText.substring(0, 110)}..."`);

    // Pula se já enviado
    if (status.sent[lead.id]) {
      console.log(`⏩ Já foi enviado anteriormente em ${status.sent[lead.id].sentAt}. Pulando para o próximo.`);
      continue;
    }

    console.log(`🤖 Robô abrindo conversa e enviando...`);
    const result = await sendAutomatedMessage(page, phone, msgText);

    if (result.success) {
      console.log(`✅ [SUCESSO] Mensagem enviada automaticamente para ${lead.name}!`);
      status.sent[lead.id] = {
        name: lead.name,
        phone: phone,
        sentAt: new Date().toISOString(),
        batch: batchNum
      };
      status.history.push({
        leadId: lead.id,
        name: lead.name,
        phone: phone,
        sentAt: new Date().toISOString(),
        batch: batchNum
      });
      status.lastBatch = batchNum;
      saveStatus(status);
      logActivity(lead, batchNum, 'Envio com sucesso');
    } else {
      console.log(`⚠️ [ALERTA] Não foi possível enviar para ${lead.name}: ${result.reason}`);
      logActivity(lead, batchNum, `Falha: ${result.reason}`);
    }

    // Intervalo de segurança anti-ban
    if (i < batchLeads.length - 1) {
      console.log(`🛡️ Aguardando ${INTERVAL_SECONDS} segundos de segurança anti-ban...`);
      await runCountdown(INTERVAL_SECONDS);
    }
  }

  console.log(`\n================================================================`);
  console.log(`🎉 LOTE ${batchNum} CONCLUÍDO COM SUCESSO!`);
  console.log(`================================================================\n`);
  console.log('Pressione qualquer tecla para fechar o robô...');
  rl.question('', () => {
    browser.close();
    rl.close();
  });
}

main();

