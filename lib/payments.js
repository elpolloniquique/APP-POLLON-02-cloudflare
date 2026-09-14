const METHOD_IDS = ['efectivo', 'transferencia', 'tarjeta'];
const METHOD_LABELS = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
};

export function normalizePaymentMethods(raw) {
  let list = raw;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      list = String(list).split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(list)) return ['efectivo', 'transferencia'];
  const picked = new Set(
    list.map((id) => String(id || '').toLowerCase().trim()).filter((id) => METHOD_IDS.includes(id)),
  );
  const ordered = METHOD_IDS.filter((id) => picked.has(id));
  return ordered.length ? ordered : ['efectivo', 'transferencia'];
}

export function formatBranchPaymentSummary(branch) {
  const labels = normalizePaymentMethods(branch?.paymentMethods || branch?.payment_methods)
    .map((id) => METHOD_LABELS[id]);
  if (labels.length <= 1) return labels[0] || 'efectivo';
  if (labels.length === 2) return `${labels[0].toLowerCase()} o ${labels[1].toLowerCase()}`;
  return `${labels.slice(0, -1).map((l) => l.toLowerCase()).join(', ')} o ${labels[labels.length - 1].toLowerCase()}`;
}

export function paymentMethodDisplay(method) {
  const m = String(method || '').toLowerCase().trim();
  if (m === 'efectivo') return 'Efectivo (al recibir)';
  if (m === 'transferencia') return 'Transferencia (al recibir)';
  if (m === 'tarjeta') return 'Tarjeta (al recibir)';
  if (m === 'whatsapp') return 'Contraentrega';
  return method || 'Contraentrega';
}
