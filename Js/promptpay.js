// PromptPay (Thai QR) payload generator, EMV-co format with CRC16-CCITT.

export function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const tlv = (id, value) => id + String(value.length).padStart(2, '0') + value;

// id: 10-digit mobile number, 13-digit national/tax id, or 15-digit e-wallet id.
export function promptPayPayload(id, amount) {
  const digits = String(id).replace(/\D/g, '');
  let type;
  let target;
  if (digits.length === 10) {
    type = '01';
    target = '0066' + digits.slice(1);
  } else if (digits.length === 13) {
    type = '02';
    target = digits;
  } else if (digits.length === 15) {
    type = '03';
    target = digits;
  } else {
    throw new Error('เลข PromptPay ไม่ถูกต้อง');
  }
  const hasAmount = typeof amount === 'number' && amount > 0;
  const merchant = tlv('29', tlv('00', 'A000000677010111') + tlv(type, target));
  let payload =
    tlv('00', '01') +
    tlv('01', hasAmount ? '12' : '11') +
    merchant +
    tlv('53', '764') +
    (hasAmount ? tlv('54', amount.toFixed(2)) : '') +
    tlv('58', 'TH') +
    '6304';
  return payload + crc16(payload);
}
