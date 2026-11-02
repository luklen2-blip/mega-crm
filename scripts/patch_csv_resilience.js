const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
const appPath = path.join(__dirname, '..', 'public', 'app.js');
const indexPath = path.join(__dirname, '..', 'public', 'index.html');

let serverContent = fs.readFileSync(serverPath, 'utf8');
let appContent = fs.readFileSync(appPath, 'utf8');
let indexContent = fs.readFileSync(indexPath, 'utf8');

// 1. ATUALIZA parseLeadsCsv NO SERVER.JS
const serverParseFunction = `function parseLeadsCsv(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];
  const lines = csvText.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\\t/g) || []).length;

  let delimiter = ',';
  if (semicolonCount > commaCount && semicolonCount > tabCount) delimiter = ';';
  else if (tabCount > commaCount && tabCount > semicolonCount) delimiter = '\\t';

  function splitCsvLine(line, delim) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delim && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  }

  const rawHeaders = splitCsvLine(lines[0], delimiter).map(h => 
    h.toLowerCase()
     .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
     .replace(/[^a-z0-9_]/g, '')
  );

  const knownHeaderKeywords = [
    'nome', 'nomes', 'name', 'names', 'cliente', 'clientes', 'contato', 'contatos',
    'empresa', 'empresas', 'lugar', 'lugares', 'local', 'cidade', 'cidades', 'telefone',
    'telefones', 'celular', 'whatsapp', 'email', 'orcamento', 'valor', 'cargo'
  ];

  const hasHeaderRow = rawHeaders.some(h => knownHeaderKeywords.some(kw => h.includes(kw)));
  const startIndex = hasHeaderRow ? 1 : 0;

  const results = [];
  for (let i = startIndex; i < lines.length; i++) {
    const rowValues = splitCsvLine(lines[i], delimiter);
    if (rowValues.every(v => !v)) continue;

    const rowObj = {};
    if (hasHeaderRow) {
      for (let h = 0; h < rawHeaders.length; h++) {
        const key = rawHeaders[h];
        const val = rowValues[h] || '';
        if (!key) continue;

        if (['nome', 'nomes', 'name', 'names', 'nomecompleto', 'contato', 'contatos', 'cliente', 'clientes', 'lead', 'leads', 'pessoa', 'pessoas', 'razaosocial', 'titular'].some(k => key === k || key.includes(k))) {
          rowObj.name = val;
        } else if (['empresa', 'empresas', 'company', 'organizacao', 'razaosocial', 'lugar', 'lugares', 'local', 'locais', 'localizacao', 'cidade', 'cidades', 'municipio', 'municipios', 'bairro', 'endereco', 'regiao', 'uf', 'estado'].some(k => key === k || key.includes(k))) {
          if (!rowObj.company) rowObj.company = val;
          else rowObj.notes = (rowObj.notes ? rowObj.notes + ' | ' : '') + \`Lugar: \${val}\`;
        } else if (['cargo', 'role', 'funcao', 'posicao'].some(k => key === k || key.includes(k))) {
          rowObj.role = val;
        } else if (['email', 'mail', 'correio', 'emails'].some(k => key === k || key.includes(k))) {
          rowObj.email = val;
        } else if (['telefone', 'telefones', 'phone', 'phones', 'whatsapp', 'whatsapps', 'celular', 'celulares', 'tel', 'fone', 'fones', 'numero', 'numeros', 'cel', 'zap'].some(k => key === k || key.includes(k))) {
          rowObj.phone = val;
        } else if (['orcamento', 'orcamentoestimado', 'budget', 'estimatedbudget', 'valor', 'valorestimado', 'preco'].some(k => key === k || key.includes(k))) {
          rowObj.estimatedBudget = val;
        } else if (['tags', 'tag', 'segmento', 'categoria', 'categorias'].some(k => key === k || key.includes(k))) {
          rowObj.tags = val;
        } else if (['notas', 'notes', 'observacoes', 'obs', 'detalhes'].some(k => key === k || key.includes(k))) {
          rowObj.notes = (rowObj.notes ? rowObj.notes + ' | ' : '') + val;
        }
      }
    }

    // Fallback posicional se a coluna Nome não foi mapeada por cabeçalho
    if (!rowObj.name && rowValues[0]) {
      rowObj.name = rowValues[0];
      if (!rowObj.company && rowValues[1]) rowObj.company = rowValues[1];
      if (!rowObj.phone && rowValues[2]) rowObj.phone = rowValues[2];
    }

    if (rowObj.name) {
      results.push(rowObj);
    }
  }
  return results;
}`;

// Replace parseLeadsCsv in server.js
const serverStart = serverContent.indexOf('function parseLeadsCsv(csvText) {');
const serverEnd = serverContent.indexOf('  // 4. LEADS & CRM 360° (COM ISOLAMENTO MULTI-TENANT)', serverStart);

if (serverStart !== -1 && serverEnd !== -1) {
  serverContent = serverContent.substring(0, serverStart) + serverParseFunction + '\n\n' + serverContent.substring(serverEnd);
  fs.writeFileSync(serverPath, serverContent, 'utf8');
  console.log('✅ server.js atualizado com parseLeadsCsv ultra resiliente!');
} else {
  console.error('❌ Não foi possível localizar parseLeadsCsv em server.js');
}

// 2. ATUALIZA parseClientCsvLeads, switchView e renderLeadsTable EM PUBLIC/APP.JS
const clientParseFunction = `function parseClientCsvLeads(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];
  const lines = csvText.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\\t/g) || []).length;

  let delimiter = ',';
  if (semicolonCount > commaCount && semicolonCount > tabCount) delimiter = ';';
  else if (tabCount > commaCount && tabCount > semicolonCount) delimiter = '\\t';

  function splitLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  }

  const rawHeaders = splitLine(lines[0]).map(h => 
    h.toLowerCase()
     .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
     .replace(/[^a-z0-9_]/g, '')
  );

  const knownHeaderKeywords = [
    'nome', 'nomes', 'name', 'names', 'cliente', 'clientes', 'contato', 'contatos',
    'empresa', 'empresas', 'lugar', 'lugares', 'local', 'cidade', 'cidades', 'telefone',
    'telefones', 'celular', 'whatsapp', 'email', 'orcamento', 'valor', 'cargo'
  ];

  const hasHeaderRow = rawHeaders.some(h => knownHeaderKeywords.some(kw => h.includes(kw)));
  const startIndex = hasHeaderRow ? 1 : 0;

  const leads = [];
  for (let i = startIndex; i < lines.length; i++) {
    const rowValues = splitLine(lines[i]);
    if (rowValues.every(v => !v)) continue;

    const rowObj = {};
    if (hasHeaderRow) {
      for (let h = 0; h < rawHeaders.length; h++) {
        const key = rawHeaders[h];
        const val = rowValues[h] || '';
        if (!key) continue;

        if (['nome', 'nomes', 'name', 'names', 'nomecompleto', 'contato', 'contatos', 'cliente', 'clientes', 'lead', 'leads', 'pessoa', 'pessoas', 'razaosocial', 'titular'].some(k => key === k || key.includes(k))) {
          rowObj.name = val;
        } else if (['empresa', 'empresas', 'company', 'organizacao', 'razaosocial', 'lugar', 'lugares', 'local', 'locais', 'localizacao', 'cidade', 'cidades', 'municipio', 'bairro', 'endereco', 'regiao', 'uf', 'estado'].some(k => key === k || key.includes(k))) {
          if (!rowObj.company) rowObj.company = val;
          else rowObj.notes = (rowObj.notes ? rowObj.notes + ' | ' : '') + \`Lugar: \${val}\`;
        } else if (['cargo', 'role', 'funcao', 'posicao'].some(k => key === k || key.includes(k))) {
          rowObj.role = val;
        } else if (['email', 'mail', 'correio', 'emails'].some(k => key === k || key.includes(k))) {
          rowObj.email = val;
        } else if (['telefone', 'telefones', 'phone', 'phones', 'whatsapp', 'whatsapps', 'celular', 'celulares', 'tel', 'fone', 'fones', 'numero', 'numeros', 'cel', 'zap'].some(k => key === k || key.includes(k))) {
          rowObj.phone = val;
        } else if (['orcamento', 'orcamentoestimado', 'budget', 'estimatedbudget', 'valor', 'valorestimado', 'preco'].some(k => key === k || key.includes(k))) {
          rowObj.estimatedBudget = val;
        } else if (['tags', 'tag', 'segmento', 'categoria', 'categorias'].some(k => key === k || key.includes(k))) {
          rowObj.tags = val;
        } else if (['notas', 'notes', 'observacoes', 'obs', 'detalhes'].some(k => key === k || key.includes(k))) {
          rowObj.notes = (rowObj.notes ? rowObj.notes + ' | ' : '') + val;
        }
      }
    }

    // Fallback posicional se a coluna Nome não foi mapeada por cabeçalho
    if (!rowObj.name && rowValues[0]) {
      rowObj.name = rowValues[0];
      if (!rowObj.company && rowValues[1]) rowObj.company = rowValues[1];
      if (!rowObj.phone && rowValues[2]) rowObj.phone = rowValues[2];
    }

    if (rowObj.name) {
      leads.push(rowObj);
    }
  }
  return leads;
}`;

// Replace parseClientCsvLeads in public/app.js
const appParseStart = appContent.indexOf('function parseClientCsvLeads(csvText) {');
const appParseEnd = appContent.indexOf('function renderCsvPreview(fileName, leads) {', appParseStart);

if (appParseStart !== -1 && appParseEnd !== -1) {
  appContent = appContent.substring(0, appParseStart) + clientParseFunction + '\n\n' + appContent.substring(appParseEnd);
  console.log('✅ public/app.js atualizado com parseClientCsvLeads ultra resiliente!');
} else {
  console.error('❌ Não foi possível localizar parseClientCsvLeads em public/app.js');
}

// Ensure switchView calls loadLeads()
if (!appContent.includes("if (viewName === 'leads') loadLeads();")) {
  appContent = appContent.replace(
    "if (viewName === 'copilot') loadCopilotView();",
    "if (viewName === 'copilot') loadCopilotView();\n  if (viewName === 'leads') loadLeads();\n  if (viewName === 'pipeline') { loadPipelines(); loadDeals(); }"
  );
  console.log('✅ switchView atualizado para carregar leads automaticamente!');
}

// Add empty state to renderLeadsTable
if (!appContent.includes('Nenhum lead encontrado')) {
  appContent = appContent.replace(
    'tbody.innerHTML = \'\';',
    `tbody.innerHTML = '';
  if (globalLeads.length === 0) {
    tbody.innerHTML = \`
      <tr>
        <td colspan="5" class="p-8 text-center text-slate-400">
          <div class="flex flex-col items-center justify-center space-y-2">
            <i data-lucide="users" class="h-8 w-8 text-slate-600"></i>
            <p class="text-xs font-semibold text-slate-300">Nenhum lead encontrado nesta base.</p>
            <p class="text-[11px] text-slate-500">Clique em "Importar CSV" ou "Cadastrar Lead" para adicionar contatos.</p>
          </div>
        </td>
      </tr>
    \`;
    if (window.lucide) lucide.createIcons();
    return;
  }`
  );
  console.log('✅ Empty state adicionado a renderLeadsTable!');
}

// Add handleLeadsCsvPaste function
if (!appContent.includes('function handleLeadsCsvPaste(')) {
  const pasteFunction = `
function handleLeadsCsvPaste(event) {
  const text = event.target.value.trim();
  if (!text) {
    const previewContainer = document.getElementById('csv-preview-container');
    if (previewContainer) previewContainer.classList.add('hidden');
    const btnConfirm = document.getElementById('btn-confirm-import-csv');
    if (btnConfirm) btnConfirm.disabled = true;
    parsedCsvLeads = [];
    return;
  }
  parsedCsvLeads = parseClientCsvLeads(text);
  renderCsvPreview('Texto Colado', parsedCsvLeads);
}
`;
  appContent += '\n' + pasteFunction;
  console.log('✅ handleLeadsCsvPaste adicionado!');
}

fs.writeFileSync(appPath, appContent, 'utf8');

// 3. ATUALIZA PUBLIC/INDEX.HTML COM ABAS NO MODAL E BOTÃO ATUALIZAR
// Botão Atualizar na barra de Leads
if (!indexContent.includes('onclick="loadLeads()"')) {
  indexContent = indexContent.replace(
    '<button onclick="openImportLeadsModal()"',
    `<button onclick="loadLeads()" class="px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1" title="Atualizar Lista de Leads">
              <i data-lucide="refresh-cw" class="h-3.5 w-3.5"></i>
              <span class="hidden sm:inline">Atualizar</span>
            </button>
            <button onclick="openImportLeadsModal()"`
  );
  console.log('✅ Botão Atualizar adicionado na barra de Leads!');
}

// Inserir Área de Colar Texto no Modal de Importação
if (!indexContent.includes('csv-paste-input')) {
  const pasteAreaHtml = `
        <!-- Alternativa: Colar Texto Diretamente -->
        <div class="space-y-1.5 pt-1">
          <div class="flex items-center justify-between">
            <label class="block text-slate-300 font-semibold text-xs">Ou Cole o Texto da sua Planilha / Bloco de Notas:</label>
            <span class="text-[10px] text-slate-500">Ex: Nome, Lugar, Telefone</span>
          </div>
          <textarea id="csv-paste-input" oninput="handleLeadsCsvPaste(event)" rows="3" placeholder="Carlos Silveira, São Paulo, 11987654321&#10;Marina Albuquerque, Rio de Janeiro, 21976543210" class="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-emerald-500 placeholder-slate-600"></textarea>
        </div>
`;
  indexContent = indexContent.replace(
    '<!-- Preview da Tabela -->',
    pasteAreaHtml + '\n        <!-- Preview da Tabela -->'
  );
  console.log('✅ Textarea de colar texto CSV adicionado ao modal!');
}

fs.writeFileSync(indexPath, indexContent, 'utf8');
console.log('🎉 Todas as atualizações de resiliência foram aplicadas com sucesso!');

