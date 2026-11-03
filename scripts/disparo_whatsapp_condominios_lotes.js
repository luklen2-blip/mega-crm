/**
 * DISPARADOR EM LOTES DE WHATSAPP (MODO NAVEGADOR PADRÃO) - CONCILIAZAP
 * Base: 38 Condomínios e Vilas Residenciais da Zona Oeste
 * Oferta: 30 dias grátis para conhecer a ferramenta (https://conciliazap.onrender.com/)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');

const LEADS_FILE = path.join(__dirname, '..', 'database', 'data', 'leads.json');
const STATUS_FILE = path.join(__dirname, '..', 'database', 'data', 'disparos_status_condominios.json');
const ACTIVITIES_FILE = path.join(__dirname, '..', 'database', 'data', 'activities.json');

const TENANT_ID = 'ten_demo_agentise';
const INTERVAL_SECONDS = 60;

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

function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') && digits.length >= 12 ? digits : ('55' + digits);
}

function getMessageText(lead) {
  if (lead && lead.customMessage) return lead.customMessage;
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
}

function openWhatsApp(phone, text) {
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  const cmd = `start "" "${waUrl.replace(/&/g, '^&')}"`;
  exec(cmd, (err) => {
    if (err) console.error('  ⚠️ Erro ao abrir navegador:', err.message);
  });
}

let rl;

async function main() {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.clear();
  console.log('================================================================');
  console.log('🚀 CONCILIAZAP - DISPARADOR EM LOTES (NAVEGADOR PADRÃO)');
  console.log('================================================================');
  console.log('🛡️ Intervalo de segurança: 60 segundos por condomínio');
  console.log('🎁 Oferta: 30 DIAS GRÁTIS SEM PAGAR (https://conciliazap.onrender.com/)');
  console.log('----------------------------------------------------------------\n');

  const leads = loadLeads();
  const status = loadStatus();

  console.log(`📊 Base de Condomínios: ${leads.length} condomínios carregados.`);
  const totalSent = Object.keys(status.sent).length;
  console.log(`📬 Condomínios contatados: ${totalSent} de ${leads.length}\n`);

  console.log('Escolha a opção:');
  console.log(' [1] Iniciar Lote 1 (19 condomínios - 1 a 19)');
  console.log(' [2] Iniciar Lote 2 (19 condomínios - 20 a 38)');
  console.log(' [3] Disparar Todos os 38 Condomínios');
  console.log(' [4] Ver Lista e Status');
  console.log(' [5] Resetar Status');
  console.log(' [0] Sair\n');

  rl.question('👉 Digite a opção [1-5]: ', async (opt) => {
    const choice = opt.trim();
    if (choice === '1') {
      await runBatch(leads.slice(0, 19), 1, status);
    } else if (choice === '2') {
      await runBatch(leads.slice(19, 38), 2, status);
    } else if (choice === '3') {
      await runBatch(leads, 'TOTAL', status);
    } else if (choice === '4') {
      leads.forEach((l, i) => {
        const isSent = status.sent[l.id] ? '✅ ENVIADO' : '⏳ PENDENTE';
        console.log(`${(i + 1).toString().padStart(2, '0')}. [${isSent}] ${l.name} - ${l.phoneDisplay || l.phone}`);
      });
      rl.close();
    } else if (choice === '5') {
      saveStatus({ sent: {}, lastBatch: null, history: [] });
      console.log('Histórico resetado.');
      rl.close();
    } else {
      rl.close();
    }
  });
}

async function runBatch(batchLeads, batchNum, status) {
  console.log(`\nIniciando Lote ${batchNum} (${batchLeads.length} condomínios)...`);
  for (let i = 0; i < batchLeads.length; i++) {
    const lead = batchLeads[i];
    const phone = normalizePhone(lead.phone);
    const msg = getMessageText(lead);

    console.log(`\n[${i + 1}/${batchLeads.length}] Abrindo WhatsApp para ${lead.name} (${phone})...`);
    openWhatsApp(phone, msg);

    status.sent[lead.id] = { name: lead.name, phone: phone, sentAt: new Date().toISOString(), batch: batchNum };
    saveStatus(status);

    if (i < batchLeads.length - 1) {
      await runCountdown(INTERVAL_SECONDS);
    }
  }
  console.log(`\n🎉 Lote concluído!`);
  rl.close();
}

main();

