/**
 * Serviço Nativo de Pagamento PIX EMV (Padrão Banco Central do Brasil)
 * Implementação pura em JavaScript sem necessidade de bibliotecas externas.
 */

function generatePixPayload({ pixKey, name, city = 'SAO PAULO', amount, txId = '***' }) {
  const formatField = (id, value) => {
    const str = String(value);
    const len = String(str.length).padStart(2, '0');
    return `${id}${len}${str}`;
  };

  const cleanPixKey = (pixKey || 'luklen2@gmail.com').trim();
  const cleanName = (name || 'LUCIANO SANT ANNA')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 25);
  const cleanCity = (city || 'SAO PAULO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 15);
  const cleanTxId = (txId || 'CRM' + Date.now().toString().slice(-6))
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 25);

  const merchantAccountInfo = [
    formatField('00', 'br.gov.bcb.pix'),
    formatField('01', cleanPixKey)
  ].join('');

  const additionalDataField = formatField('05', cleanTxId);

  let payload = [
    formatField('00', '01'), // Payload Format Indicator
    formatField('26', merchantAccountInfo), // Merchant Account Info
    formatField('52', '0000'), // Merchant Category Code
    formatField('53', '986'), // Transaction Currency (BRL)
    amount ? formatField('54', Number(amount).toFixed(2)) : '', // Transaction Amount
    formatField('58', 'BR'), // Country Code
    formatField('59', cleanName), // Merchant Name
    formatField('60', cleanCity), // Merchant City
    formatField('62', additionalDataField), // Additional Data Field
    '6304' // CRC16 Indicator
  ].join('');

  // Cálculo CRC-16 / CCITT-FALSE (Polinômio 0x1021, valor inicial 0xFFFF)
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  const crcHex = crc.toString(16).toUpperCase().padStart(4, '0');

  return payload + crcHex;
}

function getPixQrCodeUrl(payloadPix) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payloadPix)}`;
}

function generateWhatsAppProposalUrl({ phone, customerName, dealTitle, amount, pixPayload, checkoutUrl }) {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const destination = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  
  const formattedAmount = Number(amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const text = 
`🚀 *PROPOSTA COMERCIAL - ${dealTitle.toUpperCase()}*

Olá, *${customerName}*! Tudo bem?

Conforme conversamos, segue a sua proposta formalizada no valor de *${formattedAmount}*:
${checkoutUrl ? `🔗 *Acesse sua Proposta & Checkout:* ${checkoutUrl}\n` : ''}
📱 *Chave PIX Copia-e-Cola:*
\`\`\`${pixPayload}\`\`\`

✅ Assim que efetuar o pagamento, a baixa é automática e o projeto entra imediatamente em esteira de execução.

Qualquer dúvida estou à disposição!`;

  return `https://wa.me/${destination}?text=${encodeURIComponent(text)}`;
}

function generateWhatsAppPitchUrl({ phone, customerName, pitchText }) {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const destination = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  return `https://wa.me/${destination}?text=${encodeURIComponent(pitchText)}`;
}

const fs = require('fs');
const path = require('path');

const LOCKS_DIR = path.join(__dirname, '..', 'database', 'data', '.locks');

function ensureLocksDir() {
  if (!fs.existsSync(LOCKS_DIR)) {
    try {
      fs.mkdirSync(LOCKS_DIR, { recursive: true });
    } catch (e) {
      // Ignora se já criado concorrentemente
    }
  }
}

/**
 * Adquire trava exclusiva atômica cross-process no nível do SO (flag 'wx')
 */
function acquireFileLock(resourceId, timeoutMs = 5000) {
  ensureLocksDir();
  const safeId = String(resourceId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const lockFilePath = path.join(LOCKS_DIR, `pix_${safeId}.lock`);
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const fd = fs.openSync(lockFilePath, 'wx');
      const lockData = JSON.stringify({ pid: process.pid, createdAt: Date.now() });
      fs.writeFileSync(fd, lockData);
      fs.closeSync(fd);
      return true;
    } catch (err) {
      if (err.code === 'EEXIST') {
        try {
          const content = fs.readFileSync(lockFilePath, 'utf8');
          const parsed = JSON.parse(content);
          if (Date.now() - parsed.createdAt > 10000) {
            try { fs.unlinkSync(lockFilePath); } catch (e) {}
            continue;
          }
        } catch (readErr) {}
        
        const waitUntil = Date.now() + 10;
        while (Date.now() < waitUntil) {}
      } else {
        throw err;
      }
    }
  }
  return false;
}

/**
 * Libera a trava atômica do recurso
 */
function releaseFileLock(resourceId) {
  try {
    const safeId = String(resourceId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const lockFilePath = path.join(LOCKS_DIR, `pix_${safeId}.lock`);
    if (fs.existsSync(lockFilePath)) {
      fs.unlinkSync(lockFilePath);
    }
  } catch (err) {}
}

module.exports = {
  generatePixPayload,
  getPixQrCodeUrl,
  generateWhatsAppProposalUrl,
  generateWhatsAppPitchUrl,
  acquireFileLock,
  releaseFileLock
};

