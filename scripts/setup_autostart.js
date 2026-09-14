const fs = require('fs');
const path = require('path');

console.log('🔄 ========================================================');
console.log('🔄 [Mega CRM] Configuração de AutoStart no Windows (shell:startup)');
console.log('🔄 ========================================================\n');

const appData = process.env.APPDATA || 'C:\\Users\\luciano\\AppData\\Roaming';
const startupDir = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const projectRoot = path.resolve(__dirname, '..');

const vbsContent = `' Script AutoStart em segundo plano para Agentise Mega CRM
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "${projectRoot}"
WshShell.Run "node server.js", 0, False
`;

const vbsPath = path.join(startupDir, 'AgentiseMegaCRM_AutoStart.vbs');

try {
  if (fs.existsSync(startupDir)) {
    fs.writeFileSync(vbsPath, vbsContent, 'utf-8');
    console.log(`✅ Script de AutoStart VBScript instalado com sucesso em:\n   ${vbsPath}`);
    console.log('ℹ️ O Mega CRM será iniciado silenciosamente a cada inicialização do Windows.');
  } else {
    console.log(`Diretório de Startup não encontrado em ${startupDir}`);
  }
} catch (err) {
  console.error('❌ Falha ao configurar inicialização automática:', err.message);
}
