// Gera payload Pix "copia e cola" (BR Code EMV) estático
function emv(id, value) {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function gerarPixCopiaECola({ chave, nome, cidade }) {
  const merchantAccount = emv('26', emv('00', 'br.gov.bcb.pix') + emv('01', chave));
  const payload =
    emv('00', '01') +
    merchantAccount +
    emv('52', '0000') +
    emv('53', '986') +
    emv('58', 'BR') +
    emv('59', nome.substring(0, 25)) +
    emv('60', cidade.substring(0, 15)) +
    emv('62', emv('05', '***')) +
    '6304';
  return payload + crc16(payload);
}