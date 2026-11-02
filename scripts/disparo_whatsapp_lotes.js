/**
 * DISPARADOR INTELIGENTE DE WHATSAPP EM LOTES (ANTI-BAN)
 * Mega CRM - Engenharia de Vendas Luciano
 * 
 * Regra Operacional:
 * - 25 Oficinas Hoje com intervalo de 60 segundos (1 minuto)
 * - 25 Oficinas Amanhã com intervalo de 60 segundos (1 minuto)
 * - Abre no navegador padrão do Windows sem bloqueio de pop-ups
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');

const LEADS_FILE = path.join(__dirname, '..', 'database', 'data', 'leads.json');
const STATUS_FILE = path.join(__dirname, '..', 'database', 'data', 'disparos_status.json');
const ACTIVITIES_FILE = path.join(__dirname, '..', 'database', 'data', 'activities.json');

const TENANT_ID = 'ten_demo_agentise';
const INTERVAL_SECONDS = 60; // 1 minuto entre cada mensagem

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

function logActivity(lead, batchNum) {
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
      title: `Disparo WhatsApp Comercial (Lote ${batchNum})`,
      description: `Mensagem comercial enviada para ${lead.name} (${lead.phone}) com intervalo de 60s.`,
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
  return `Olá, tudo bem? Falo com o responsável pela ${name}? Me chamo Luciano da Silva. Vi que vocês são referência em serviços automotivos em ${bairro} e gostaria de apresentar nossa solução para acelerar o atendimento e orçamentos via WhatsApp.`;
}

function openWhatsApp(phone, text) {
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  // No Windows, usa start para abrir no navegador padrão com URL escapada
  const cmd = `start "" "${waUrl.replace(/&/g, '^&')}"`;
  exec(cmd, (err) => {
    if (err) console.error('  ⚠️ Erro ao abrir navegador:', err.message);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCountdown(seconds) {
  for (let i = seconds; i > 0; i--) {
    const mins = Math.floor(i / 60).toString().padStart(2, '0');
    const secs = (i % 60).toString().padStart(2, '0');
    process.stdout.write(`\r   ⏳ Intervalo anti-spam: [${mins}:${secs}] para próxima oficina...   `);
    await sleep(1000);
  }
  process.stdout.write('\r                                                                    \r');
  try { process.stdout.write('\x07'); } catch (e) {} // beep sonoro
}

// rl initialized in main
let rl;({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.clear();
  console.log('================================================================');
  console.log('🚗 AGENTISE MEGA CRM - DISPARADOR WHATSAPP EM LOTES (50 OFICINAS)');
  console.log('================================================================');
  console.log('🛡️ Proteção Anti-Ban: Intervalo estrito de 1 minuto (60 segundos)');
  console.log('📱 Remetente: Seu próprio WhatsApp (respostas vão direto para você)');
  console.log('----------------------------------------------------------------\n');

  const leads = loadLeads();
  const status = loadStatus();

  console.log(`📊 Base de Oficinas Carregada: ${leads.length} oficinas da Zona Oeste.`);
  const totalSent = Object.keys(status.sent).length;
  console.log(`📬 Oficinas já contatadas anteriormente: ${totalSent} de ${leads.length}\n`);

  console.log('Escolha a operação desejada:');
  console.log(' [1] ▶️ Disparar LOTE 1 (HOJE - 25 primeiras oficinas: 1 a 25)');
  console.log(' [2] ▶️ Disparar LOTE 2 (AMANHÃ - 25 oficinas restantes: 26 a 50)');
  console.log(' [3] 📋 Ver Lista das 50 Oficinas e Status de Envio');
  console.log(' [4] 🔄 Resetar Status de Disparos');
  console.log(' [0] 🚪 Sair\n');

  rl.question('👉 Digite a opção [1-4] e pressione ENTER: ', async (opt) => {
    const choice = opt.trim();

    if (choice === '1') {
      await executeBatch(leads.slice(0, 25), 1, status);
    } else if (choice === '2') {
      await executeBatch(leads.slice(25, 50), 2, status);
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

async function executeBatch(batchLeads, batchNum, status) {
  console.log(`\n🚀 INICIANDO DISPARO DO LOTE ${batchNum} (${batchLeads.length} OFICINAS)`);
  console.log(`⏱️ Intervalo entre cada oficina: ${INTERVAL_SECONDS} segundos (1 minuto)\n`);

  for (let i = 0; i < batchLeads.length; i++) {
    const lead = batchLeads[i];
    const itemNum = i + 1;
    const phone = normalizePhone(lead.phone);
    const msg = getMessageText(lead);

    console.log(`----------------------------------------------------------------`);
    console.log(`📍 [${itemNum}/${batchLeads.length}] Oficina: ${lead.name}`);
    console.log(`   📞 Telefone: ${phone} | ${lead.notes.split('|')[0].trim()}`);

    if (status.sent[lead.id]) {
      console.log(`   ℹ️ Esta oficina já foi contatada em ${status.sent[lead.id].at}.`);
      console.log(`   👉 Abrindo WhatsApp novamente conforme solicitado...`);
    }

    // Abre a conversa no WhatsApp
    openWhatsApp(phone, msg);
    console.log(`   💬 WhatsApp aberto com mensagem pré-formatada! Clique em Enviar.`);

    // Registra envio
    status.sent[lead.id] = {
      name: lead.name,
      phone,
      batch: batchNum,
      at: new Date().toLocaleString('pt-BR')
    };
    status.lastBatch = batchNum;
    saveStatus(status);
    logActivity(lead, batchNum);

    // Se não for a última oficina do lote, aguarda 60 segundos
    if (i < batchLeads.length - 1) {
      console.log(`   Aguardando 1 minuto antes de chamar a próxima oficina...`);
      await runCountdown(INTERVAL_SECONDS);
    } else {
      console.log(`\n🎉 PARABÉNS! LOTE ${batchNum} CONCLUÍDO COM SUCESSO!`);
      if (batchNum === 1) {
        console.log(`📅 As 25 oficinas de hoje foram concluídas.`);
        console.log(`👉 Amanhã, execute novamente e escolha a opção [2] para o LOTE 2 (oficinas 26 a 50)!`);
      } else {
        console.log(`🏆 TODAS AS 50 OFICINAS DA ZONA OESTE FORAM CONTATADAS COM SUCESSO!`);
      }
    }
  }

  console.log('\n================================================================');
  console.log('✅ Execução finalizada. Pressione qualquer tecla para sair.');
  rl.close();
}

if (require.main === module) {
  main();
}

module.exports = { loadLeads, loadStatus, normalizePhone, getMessageText };
