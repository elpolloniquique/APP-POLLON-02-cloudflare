/** Paletas de color para mapa En vivo (según foto) */

export const PICKUP_COLORS = ['#ef4444', '#22c55e', '#a855f7']; // rojo, verde, morado
export const DELIVERY_COLORS = ['#eab308', '#3b82f6', '#f97316']; // amarillo, azul, naranja

export function isPickupPhase(phase) {
  return phase === 'to_store' || phase === 'at_store';
}

export function isDeliveryPhase(phase) {
  return phase === 'to_customer';
}

/** Hash estable de UUID → índice 0..n-1 */
export function stableColorIndex(driverId, paletteLength = 3) {
  if (!driverId) return 0;
  let h = 0;
  const s = String(driverId);
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % paletteLength;
}

export function colorForDriver(driverId, phase) {
  const palette = isDeliveryPhase(phase) ? DELIVERY_COLORS : PICKUP_COLORS;
  return palette[stableColorIndex(driverId, palette.length)];
}

export function shortBranchLabel(name) {
  if (!name) return 'EL POLLON';
  const n = String(name).replace(/_/g, ' ').trim();
  if (/poll[oó]n/i.test(n)) return 'EL POLLON';
  return n.split(/\s+/).slice(0, 2).join(' ').toUpperCase() || 'EL POLLON';
}
