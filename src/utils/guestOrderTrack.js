/** Ruta pública de seguimiento (invitado). No choca con /seguir/:token del GPS. */

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function guestTrackPath(order = {}) {
  const code = String(order.ticketNumber || order.codigo_pedido || order.codigo || '')
    .replace(/^#/, '')
    .trim();
  const phone = digits(order.customer?.phone || order.phone || order.cliente_telefono || '');
  const q = new URLSearchParams();
  if (code) q.set('codigo', code);
  if (phone) q.set('tel', phone);
  const qs = q.toString();
  return qs ? `/pedido/seguir?${qs}` : '/pedido/seguir';
}

export function followOrderPath(order, { loggedInCustomer = false } = {}) {
  if (loggedInCustomer && order?.id) return `/cuenta/seguimiento/${order.id}`;
  return guestTrackPath(order);
}

export function normalizeTrackPhone(value) {
  return digits(value);
}
