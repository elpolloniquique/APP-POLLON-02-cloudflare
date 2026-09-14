/** Texto: acentos, dinero, interpolación de plantillas */

export function foldAccents(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s#]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

export function interpolate(template, vars = {}) {
  let out = String(template || '');
  out = out.replace(/\{,\s*\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v ? `, ${v}` : '';
  });
  out = out.replace(/\{(\w+)\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractOrderCode(text) {
  const raw = String(text || '');
  const m = raw.match(/#?\s*(\d{4,8})\b/);
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

export function paymentLabel(method) {
  const m = String(method || '').toLowerCase();
  if (m === 'efectivo') return 'Efectivo (al recibir)';
  if (m === 'transferencia') return 'Transferencia (al recibir)';
  if (m === 'tarjeta') return 'Tarjeta (al recibir)';
  if (m === 'whatsapp') return 'Contraentrega';
  return method || 'Contraentrega';
}

export function orderTypeLabel(type) {
  const t = String(type || 'delivery').toLowerCase();
  if (t === 'retiro') return 'Retiro en local';
  if (t === 'reserva') return 'Reserva';
  return 'Delivery';
}

export const ORDER_STATUS_HUMAN = {
  pendiente: 'Pedido recibido',
  aceptado: 'Aceptado',
  confirmado: 'Confirmado',
  preparando: 'En cocina',
  listo: 'En reparto',
  en_delivery: 'En reparto',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};
