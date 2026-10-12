const fs = require('fs');
const path = require('path');

console.log('🔍 ========================================================');
console.log('🔍 [AUDITORIA COMPLETA MEGA CRM] Inspeção 360 Graus');
console.log('🔍 ========================================================');

const appPath = path.join(__dirname, '../public/app.js');
const htmlPath = path.join(__dirname, '../public/index.html');
const serverPath = path.join(__dirname, '../server.js');
const swPath = path.join(__dirname, '../public/sw.js');
const guiaPath = path.join(__dirname, '../public/guia.html');
const landingPath = path.join(__dirname, '../public/landing.html');

const appContent = fs.readFileSync(appPath, 'utf8');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const serverContent = fs.readFileSync(serverPath, 'utf8');
const swContent = fs.readFileSync(swPath, 'utf8');
const guiaContent = fs.readFileSync(guiaPath, 'utf8');
const landingContent = fs.readFileSync(landingPath, 'utf8');

// 1. Verificar Lucide Icons
console.log('\n▶ [1] Auditando Ícones Lucide...');
const iconRegex = /data-lucide=["']([^"']+)["']/g;
const icons = [];
let m;
while ((m = iconRegex.exec(htmlContent)) !== null) {
  icons.push(m[1]);
}
const uniqueIcons = [...new Set(icons)].sort();
console.log(`  Total de referências a ícones: ${icons.length}`);
console.log(`  Total de ícones únicos: ${uniqueIcons.length}`);

// 2. Verificar IDs duplicados no HTML
console.log('\n▶ [2] Auditando IDs no index.html...');
const idRegex = /id=["']([^"']+)["']/g;
const idCount = {};
while ((m = idRegex.exec(htmlContent)) !== null) {
  const id = m[1];
  idCount[id] = (idCount[id] || 0) + 1;
}
const duplicateIds = Object.entries(idCount).filter(([id, count]) => count > 1);
if (duplicateIds.length === 0) {
  console.log('  ✅ Nenhum ID duplicado encontrado no index.html!');
} else {
  console.log('  ⚠️ IDs duplicados encontrados:', duplicateIds);
}

// 3. Verificar Service Worker Cache Assets
console.log('\n▶ [3] Auditando Service Worker Assets...');
const staticAssetsMatch = swContent.match(/const STATIC_ASSETS = \[([\s\S]*?)\];/);
if (staticAssetsMatch) {
  const rawAssets = staticAssetsMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
  console.log('  Ativos declarados no cache PWA:', rawAssets);
}

// 4. Verificar todas as views registradas
console.log('\n▶ [4] Auditando Sistema de Views (switchView)...');
const allViewsMatch = appContent.match(/const allViews = \[([\s\S]*?)\];/);
if (allViewsMatch) {
  const views = allViewsMatch[1].split(',').map(v => v.trim().replace(/['"]/g, '')).filter(Boolean);
  console.log('  Views registradas no switchView:', views);
  views.forEach(v => {
    const hasViewEl = htmlContent.includes(`id="view-${v}"`);
    const hasNavEl = htmlContent.includes(`id="nav-${v}"`);
    console.log(`  - view-${v}: ${hasViewEl ? '✅' : '❌ Falta container'} | nav-${v}: ${hasNavEl ? '✅' : 'ℹ️ Sem nav dedicado'}`);
  });
}

// 5. Verificar consistência dos endpoints em server.js vs frontend
console.log('\n▶ [5] Auditando Endpoints do Servidor vs Frontend...');
const serverRouteMatches = [...serverContent.matchAll(/(?:req\.url\.startsWith|req\.url ===)\(['"](\/api\/[^'"]+)['"]/g)].map(m => m[1]);
console.log(`  Endpoints mapeados no server.js: ${[...new Set(serverRouteMatches)].length}`);

console.log('\n✅ Auditoria concluída.');
