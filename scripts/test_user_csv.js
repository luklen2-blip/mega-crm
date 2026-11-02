const fs = require('fs');
const path = require('path');

const csvText = `Nome,Empresa,Cargo,E-mail,Telefone,Orçamento,Tags,Observações
Carlos Eduardo Silveira,Silveira Logística,Diretor,carlos@silveiralog.com.br,11987654321,28000,"Logística, B2B",Interessado em automação
Dra. Marina Albuquerque,Albuquerque Clínicas,Proprietária,marina@clinica.com.br,21976543210,15500,"Saúde, High-Ticket",Contato via WhatsApp`;

// Test browser function
const appCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

// Extrai a função parseClientCsvLeads
const fnStart = appCode.indexOf('function parseClientCsvLeads(csvText) {');
const fnEnd = appCode.indexOf('function renderCsvPreview', fnStart);
const fnBody = appCode.substring(fnStart, fnEnd);

eval(fnBody); // define parseClientCsvLeads

const clientResult = parseClientCsvLeads(csvText);
console.log('Client parsed count:', clientResult.length);
console.log('Client parsed leads:', JSON.stringify(clientResult, null, 2));

// Test server function
const serverCode = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const sStart = serverCode.indexOf('function parseLeadsCsv(csvText) {');
const sEnd = serverCode.indexOf('  // 4. LEADS & CRM 360° (COM ISOLAMENTO MULTI-TENANT)', sStart);
const sBody = serverCode.substring(sStart, sEnd);

eval(sBody); // define parseLeadsCsv

const serverResult = parseLeadsCsv(csvText);
console.log('Server parsed count:', serverResult.length);
console.log('Server parsed leads:', JSON.stringify(serverResult, null, 2));

