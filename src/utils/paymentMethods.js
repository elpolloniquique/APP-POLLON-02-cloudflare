/** Métodos de pago del checkout — configurables por sucursal. El cobro es siempre al recibir. */

export const PAYMENT_METHOD_IDS = ['efectivo', 'transferencia', 'tarjeta'];

/** Si la sucursal aún no tiene columna/config, mantiene el comportamiento actual. */
export const DEFAULT_BRANCH_PAYMENT_METHODS = ['efectivo', 'transferencia'];

export const PAYMENT_METHODS = [
  {
    id: 'efectivo',
    label: 'Efectivo',
    icon: '💵',
    tone: 'cash',
    desc: 'Paga en efectivo al recibir tu pedido (delivery o retiro).',
  },
  {
    id: 'transferencia',
    label: 'Transferencia',
    icon: '🏦',
    tone: 'transfer',
    desc: 'Transfiere al recibir, con los datos que te entrega el local o el repartidor.',
  },
  {
    id: 'tarjeta',
    label: 'Tarjeta',
    icon: '💳',
    tone: 'card',
    desc: 'Paga con tarjeta al recibir (POS o máquina del local / repartidor).',
  },
];

export function normalizePaymentMethods(raw) {
  let list = raw;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      list = String(list)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  if (!Array.isArray(list)) return [...DEFAULT_BRANCH_PAYMENT_METHODS];

  const allowed = new Set(PAYMENT_METHOD_IDS);
  const picked = new Set(
    list
      .map((id) => String(id || '').toLowerCase().trim())
      .filter((id) => allowed.has(id)),
  );

  const ordered = PAYMENT_METHOD_IDS.filter((id) => picked.has(id));
  return ordered.length ? ordered : [...DEFAULT_BRANCH_PAYMENT_METHODS];
}

export function getAvailablePaymentMethods(branch) {
  const ids = normalizePaymentMethods(branch?.paymentMethods);
  return PAYMENT_METHODS.filter((m) => ids.includes(m.id));
}

export function getDefaultPaymentMethod(branch) {
  return getAvailablePaymentMethods(branch)[0]?.id || 'efectivo';
}

export function isPaymentMethodAllowed(branch, id) {
  return getAvailablePaymentMethods(branch).some((m) => m.id === id);
}

export function paymentMethodLabel(id) {
  const key = String(id || '').toLowerCase().trim();
  return PAYMENT_METHODS.find((m) => m.id === key)?.label
    || (key === 'whatsapp' ? 'WhatsApp' : (id || '—'));
}

export function formatPaymentMethodsSummary(branchOrIds) {
  const ids = Array.isArray(branchOrIds)
    ? normalizePaymentMethods(branchOrIds)
    : normalizePaymentMethods(branchOrIds?.paymentMethods);
  const labels = ids.map(paymentMethodLabel);
  if (!labels.length) return 'Efectivo';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} o ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} o ${labels[labels.length - 1]}`;
}
