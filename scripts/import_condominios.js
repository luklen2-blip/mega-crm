const fs = require('fs');
const path = require('path');

const CSV_FILE = path.join(__dirname, '..', 'database', 'data', 'leads_condominios_conciliazap.csv');
const LEADS_FILE = path.join(__dirname, '..', 'database', 'data', 'leads.json');
const TENANT_ID = 'ten_demo_agentise';

function parseCSV(content) {
  const lines = content.replace(/\r/g, '').split('\n').filter(l => l.trim().length > 0);
  const header = lines[0].split(';').map(h => h.trim().replace(/^\uFEFF/, ''));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    if (cols.length >= header.length) {
      const obj = {};
      header.forEach((h, idx) => {
        obj[h] = (cols[idx] || '').trim();
      });
      rows.push(obj);
    }
  }
  return rows;
}

function importLeads() {
  if (!fs.existsSync(CSV_FILE)) {
    console.error('[ERRO] CSV nao encontrado:', CSV_FILE);
    process.exit(1);
  }

  const rawCsv = fs.readFileSync(CSV_FILE, 'utf8');
  const condoRows = parseCSV(rawCsv);
  console.log(`[INFO] Linhas lidas do CSV: ${condoRows.length}`);

  let leads = [];
  if (fs.existsSync(LEADS_FILE)) {
    leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
  }

  let added = 0;
  let updated = 0;

  condoRows.forEach((row, idx) => {
    const existingIndex = leads.findIndex(l => 
      l.tenantId === TENANT_ID && 
      l.name.toLowerCase() === row.Nome.toLowerCase()
    );

    const leadObj = {
      id: existingIndex >= 0 ? leads[existingIndex].id : `lea_condo_${Date.now()}_${idx + 1}`,
      tenantId: TENANT_ID,
      name: row.Nome,
      company: row.Nome,
      role: 'Síndico / Administração',
      phone: row.Telefone_DDI,
      phoneDisplay: row.Telefone_Contato,
      email: '',
      estimatedBudget: 199,
      tags: ['Condomínios', 'ConciliaZap', 'Zona Oeste RJ', 'WhatsApp Lead', row.Bairro],
      notes: `Bairro: ${row.Bairro} | Logradouro: ${row.Logradouro} | Tipo: ${row.Tipo} | Oferta: ${row.Oferta} | Link: ${row.Link_Proposta}`,
      customMessage: row.Mensagem_Disparo,
      source: 'Prospecção ConciliaZap',
      status: 'A Contatar',
      createdAt: existingIndex >= 0 ? leads[existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      leads[existingIndex] = { ...leads[existingIndex], ...leadObj };
      updated++;
    } else {
      leads.push(leadObj);
      added++;
    }
  });

  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
  console.log(`[SUCESSO] Importacao concluida: ${added} novos leads adicionados, ${updated} atualizados.`);
  console.log(`[TOTAL] Total de leads na base agora: ${leads.length}`);
}

importLeads();

