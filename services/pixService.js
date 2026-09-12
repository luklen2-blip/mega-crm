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

  const cleanPixKey = (pixKey || 'luciano.contato@crm.ia.br').trim();
  const cleanName = (name || 'MEGA CRM EMPREENDIMENTOS')
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

function generateWhatsAppProposalUrl({ phone, customerName, dealTitle, amount, pixPayload }) {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const destination = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  
  const formattedAmount = Number(amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const text = 
`🚀 *PROPOSTA COMERCIAL - ${dealTitle.toUpperCase()}*

Olá, *${customerName}*! Tudo bem?

Conforme conversamos, segue o link e os dados para formalizarmos nossa parceria no valor de *${formattedAmount}*:

📱 *Chave PIX Copia-e-Cola:*
\`\`\`${pixPayload}\`\`\`

✅ Assim que efetuar o pagamento, seu projeto entra imediatamente em esteira de execução prioritária.

Qualquer dúvida estou à disposição!`;

  return `https://wa.me/${destination}?text=${encodeURIComponent(text)}`;
}

function generateWhatsAppPitchUrl({ phone, customerName, pitchText }) {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const destination = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  return `https://wa.me/${destination}?text=${encodeURIComponent(pitchText)}`;
}

module.exports = {
  generatePixPayload,
  getPixQrCodeUrl,
  generateWhatsAppProposalUrl,
  generateWhatsAppPitchUrl
};
