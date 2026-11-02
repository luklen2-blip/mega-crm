const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const target = 'onclick="openImportLeadsModal()"';
const idx = html.lastIndexOf('<button', html.indexOf(target));

if (html.includes('openWhatsAppDispatcherModal()')) {
  console.log('Button already exists in index.html');
} else if (idx !== -1) {
  const btnHtml = `            <button onclick="openWhatsAppDispatcherModal()" class="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-600/20" title="Disparador Inteligente em Lotes (25 oficinas com 60s de intervalo)">
              <i data-lucide="send" class="h-4 w-4"></i>
              <span>Disparador em Lote (25/dia)</span>
            </button>\r\n`;
  html = html.slice(0, idx) + btnHtml + html.slice(idx);
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('✅ Button inserted successfully into public/index.html!');
} else {
  console.log('Target not found');
}

