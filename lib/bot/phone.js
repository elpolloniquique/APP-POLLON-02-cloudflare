/** FASE 6 — función única de teléfono (Chile + internacional) */

export function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function stripLeadingTrunkZero(digits) {
  let d = digits;
  if (d.startsWith('0') && d.length >= 9) d = d.slice(1);
  return d;
}

/** Móvil Chile: 9 + 8 dígitos, con o sin 56. */
export function isChileMobileDigits(digits) {
  const d = stripLeadingTrunkZero(digitsOnly(digits));
  return /^9\d{8}$/.test(d) || /^569\d{8}$/.test(d);
}

/**
 * Normaliza a E.164.
 * Chile (móvil): +569XXXXXXXX
 * Ejemplos → +56925586256
 *   925586256 | 09 2558 6256 | 56925586256 | +56925586256
 *   +56 9 2558 6256 | 56 9 2558 6256
 * Internacional (+51…): no se convierte a Chile.
 */
export function normalizeChilePhone(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  let digits = stripLeadingTrunkZero(digitsOnly(trimmed));
  if (!digits || digits.length < 8) return null;

  if (/^9\d{8}$/.test(digits)) return `+56${digits}`;
  if (/^569\d{8}$/.test(digits)) return `+${digits}`;

  if (digits.startsWith('56') && digits.length >= 10 && digits.length <= 12) {
    return `+${digits}`;
  }

  if (trimmed.startsWith('+') && !digits.startsWith('56') && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

/** Dígitos para wa.me / Evolution: 569XXXXXXXX (sin +). */
export function toWhatsappDigits(raw) {
  const e164 = normalizeChilePhone(raw);
  return e164 ? digitsOnly(e164) : null;
}

export function phoneDigits(phone) {
  const n = normalizeChilePhone(phone);
  return n ? digitsOnly(n) : digitsOnly(phone);
}

export function phonesMatch(a, b) {
  const da = phoneDigits(a);
  const db = phoneDigits(b);
  if (!da || !db || da.length < 8 || db.length < 8) return false;
  return da === db || da.endsWith(db) || db.endsWith(da);
}
