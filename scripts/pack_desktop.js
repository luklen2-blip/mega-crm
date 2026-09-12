const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('📦 ========================================================');
console.log('📦 [Mega CRM] Gerador de Pacote de Deploy para Nuvem (.zip)');
console.log('📦 ========================================================\n');

const projectRoot = path.resolve(__dirname, '..');

// Identifica o caminho exato do Desktop (mesmo com OneDrive)
let desktopDir = path.join(process.env.USERPROFILE || 'C:\\Users\\luciano', 'Desktop');
try {
  const resolved = execSync('powershell -Command "[Environment]::GetFolderPath(\'Desktop\')"', { encoding: 'utf-8' }).trim();
  if (resolved && fs.existsSync(resolved)) {
    desktopDir = resolved;
  }
} catch (e) {
  // fallback
}

const zipPath = path.join(desktopDir, 'mega-crm-deploy.zip');

console.log(`📁 Destino na Área de Trabalho: ${desktopDir}`);

// Cria lista de arquivos/pastas a incluir (limpos de caches e temporários)
const tempPackDir = path.join(projectRoot, '.pack_temp');
if (fs.existsSync(tempPackDir)) {
  fs.rmSync(tempPackDir, { recursive: true, force: true });
}
fs.mkdirSync(tempPackDir, { recursive: true });

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    const baseName = path.basename(src);
    if (['node_modules', '.git', '.system_generated', 'scratch', '.pack_temp'].includes(baseName)) return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    const ext = path.extname(src);
    if (['.tmp', '.log'].includes(ext)) return;
    fs.copyFileSync(src, dest);
  }
}

console.log('▶ Copiando fontes limpos para preparação do pacote...');
copyRecursive(projectRoot, tempPackDir);

// Remove zip anterior se existir
if (fs.existsSync(zipPath)) {
  try { fs.unlinkSync(zipPath); } catch (e) {}
}

console.log('▶ Compactando pacote ZIP via PowerShell...');
try {
  execSync(`powershell -Command "Compress-Archive -Path '${tempPackDir}\\*' -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit' });
  console.log(`\n✅ Pacote gerado com sucesso em:\n   ${zipPath}`);
  const stats = fs.statSync(zipPath);
  console.log(`📊 Tamanho do arquivo: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log('🚀 Pronto para upload imediato no Render, Railway ou GitHub!');
} catch (err) {
  console.error('❌ Falha na compactação do arquivo ZIP:', err.message);
} finally {
  try { fs.rmSync(tempPackDir, { recursive: true, force: true }); } catch (e) {}
}
