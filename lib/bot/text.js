/** Normalización de mensajes, dinero CLP, códigos de pedido */

const BASIC_TYPOS = {
  presio: 'precio',
  presios: 'precio',
  cuato: 'cuarto',
  cuánto: 'cuanto',
  delibery: 'delivery',
  deliberry: 'delivery',
  deonde: 'donde',
  onde: 'donde',
  aser: 'hacer',
  kiero: 'quiero',
  qiero: 'quiero',
  xfa: 'por favor',
};

export function foldAccents(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s#]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function applyBasicTypos(folded) {
  let out = ` ${folded} `;
  for (const [wrong, right] of Object.entries(BASIC_TYPOS)) {
    out = out.replace(new RegExp(`\\b${wrong}\\b`, 'g'), right);
  }
  return out.trim();
}

export function normalizeMessage(text) {
  const original = String(text || '').trim();
  const folded = applyBasicTypos(foldAccents(original));
  const tokens = folded.split(/\s+/).filter(Boolean);
  return { original, folded, tokens };
}

export function moneyCLP(value) {
  const n = Number(value) || 0;
  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n)}`;
  }
}

export function extractOrderCode(text) {
  const m = String(text || '').match(/#?\s*(\d{4,8})\b/);
  if (!m) return null;
  return String(m[1]).padStart(6, '0');
}

export function includesAny(foldedHaystack, keywords) {
  if (!foldedHaystack) return false;
  return (keywords || []).some((kw) => {
    const f = foldAccents(kw);
    return f && foldedHaystack.includes(f);
  });
}

export function displayName(name) {
  const n = String(name || '').trim();
  if (!n || /^undefined$/i.test(n) || /^null$/i.test(n)) return '';
  return n.split(/\s+/)[0];
}

export const ORDER_STATUS_HUMAN = {
  pendiente: 'recibido',
  aceptado: 'aceptado',
  confirmado: 'confirmado',
  preparando: 'en preparación',
  listo: 'listo',
  en_delivery: 'en camino',
  entregado: 'entregado',
  cancelado: 'cancelado',
};
