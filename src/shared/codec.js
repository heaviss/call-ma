export const CODEC_VERSION = 'v1';

function toUrlBase64(bytes) {
  const b64 = Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromUrlBase64(str) {
  if (!/^[A-Za-z0-9_-]+$/.test(str)) throw new Error('Malformed base64 (URL-safe)');
  const padLen = (4 - (str.length % 4)) % 4;
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLen);
  return Buffer.from(padded, 'base64');
}

function validatePayload(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Invalid payload: not an object');
  if (obj.v !== CODEC_VERSION) throw new Error('Unsupported or mismatched version');
  if (!obj.role) throw new Error('Invalid payload: missing role');
  if (obj.role !== 'offer' && obj.role !== 'answer') throw new Error('Invalid role value');
  if (!obj.sp || typeof obj.sp !== 'object') throw new Error('Invalid payload: missing signal blob');
}

export function encodeSignal(data) {
  validatePayload(data);
  const json = JSON.stringify(data);
  const bytes = Buffer.from(json, 'utf8');
  const payload = toUrlBase64(bytes);
  return `${CODEC_VERSION}.${payload}`;
}

export function decodeSignal(str) {
  if (typeof str !== 'string' || !str) throw new Error('Invalid signal: expected non-empty string');
  const [prefix, payload] = str.split('.', 2);
  if (!prefix || !payload) throw new Error('Invalid signal format: missing version or payload');
  if (prefix !== CODEC_VERSION) throw new Error('Version mismatch');
  try {
    const bytes = fromUrlBase64(payload);
    const json = bytes.toString('utf8');
    const obj = JSON.parse(json);
    validatePayload(obj);
    return obj;
  } catch (e) {
    if (/Malformed base64/.test(String(e))) throw new Error('Malformed signal payload');
    throw new Error('Malformed signal payload');
  }
}
