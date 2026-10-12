/** Paletas En vivo: recojo y entrega no se mezclan. Si hay más motos, se crea un color nuevo. */

export const PICKUP_COLORS = ['#ef4444', '#22c55e', '#a855f7']; // rojo, verde, morado
export const DELIVERY_COLORS = ['#eab308', '#3b82f6', '#f97316']; // amarillo, azul, naranja

const PICKUP_EXTRAS = [
  '#0d9488', // teal
  '#db2777', // pink
  '#0369a1', // cyan
  '#4d7c0f', // olive
  '#9a3412', // rust
  '#6d28d9', // violet
  '#be123c', // rose
  '#155e75', // slate-teal
];

const DELIVERY_EXTRAS = [
  '#14b8a6', // aqua
  '#e11d48', // crimson
  '#6366f1', // indigo
  '#84cc16', // lime
  '#c026d3', // fuchsia
  '#0f766e', // dark teal
  '#fb7185', // salmon
  '#1d4ed8', // royal
];

export function isPickupPhase(phase) {
  return phase === 'to_store' || phase === 'at_store';
}

export function isDeliveryPhase(phase) {
  return phase === 'to_customer';
}

function hueDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function hexToHue(hex) {
  const n = String(hex || '').replace('#', '');
  if (n.length < 6) return 0;
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.0001) return 0;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

function hslToHex(h, s, l) {
  const sat = s / 100;
  const lig = l / 100;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = lig - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function isFarFrom(hex, used) {
  const h = hexToHue(hex);
  return used.every((u) => hueDiff(h, hexToHue(u)) >= 18);
}

function mintedColor(index, used) {
  for (let k = 0; k < 48; k += 1) {
    const hue = (index * 137.508 + k * 13 + 8) % 360;
    const candidate = hslToHex(hue, 76, 46);
    if (isFarFrom(candidate, used)) return candidate;
  }
  return hslToHex((index * 53) % 360, 70, 42);
}

function paletteFor(kind) {
  const base = kind === 'delivery' ? DELIVERY_COLORS : PICKUP_COLORS;
  const extras = kind === 'delivery' ? DELIVERY_EXTRAS : PICKUP_EXTRAS;
  const reserved = [...PICKUP_COLORS, ...DELIVERY_COLORS];
  return { base, extras, reserved };
}

/** Color n-ésimo de un grupo (0 = primer color fijo de esa leyenda). */
export function colorAt(kind, index) {
  const i = Math.max(0, Number(index) || 0);
  const { base, extras, reserved } = paletteFor(kind);
  if (i < base.length) return base[i];
  const extraIdx = i - base.length;
  if (extraIdx < extras.length && isFarFrom(extras[extraIdx], reserved)) {
    return extras[extraIdx];
  }
  const used = [...reserved, ...extras.slice(0, extraIdx)];
  return mintedColor(extraIdx + (kind === 'delivery' ? 21 : 5), used);
}

function sortKey(item) {
  const at = item?.acceptedAt || item?.accepted_at || '';
  const id = String(item?.driverId || item?.driver_id || '');
  return `${at}\t${id}`;
}

/**
 * Un color distinto por moto, según fase:
 * recojo = rojo / verde / morado / extra
 * cliente = amarillo / azul / naranja / extra
 */
export function assignColorsByPhase(groups = []) {
  const pickup = groups.filter((g) => isPickupPhase(g.phase)).slice().sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const delivery = groups.filter((g) => isDeliveryPhase(g.phase)).slice().sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const colors = {};
  pickup.forEach((g, i) => {
    if (g.driverId) colors[g.driverId] = colorAt('pickup', i);
  });
  delivery.forEach((g, i) => {
    if (g.driverId) colors[g.driverId] = colorAt('delivery', i);
  });
  return colors;
}

/** Fallback (1 moto, seguimiento cliente). Preferir assignColorsByPhase en En vivo. */
export function colorForDriver(driverId, phase, index = 0) {
  return colorAt(isDeliveryPhase(phase) ? 'delivery' : 'pickup', index);
}

export function shortBranchLabel(name) {
  if (!name) return 'EL POLLON';
  const n = String(name).replace(/_/g, ' ').trim();
  if (/poll[oó]n/i.test(n)) return 'EL POLLON';
  return n.split(/\s+/).slice(0, 2).join(' ').toUpperCase() || 'EL POLLON';
}
