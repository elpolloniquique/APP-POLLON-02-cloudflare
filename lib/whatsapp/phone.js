/** Compatibilidad Evolution: dígitos WA + JID. La función canónica está en lib/bot/phone.js */

import {
  digitsOnly,
  normalizeChilePhone,
  toWhatsappDigits,
  phonesMatch,
} from '../bot/phone.js';

export { digitsOnly, normalizeChilePhone, toWhatsappDigits, phonesMatch };

/** Chile/WA sin +: 569XXXXXXXX. Usado por Evolution y wa.me. */
export function normalizeWhatsappPhone(phone) {
  return toWhatsappDigits(phone);
}

export function phoneFromJid(jid) {
  const raw = String(jid || '').trim();
  if (!raw) return null;
  const user = raw.split('@')[0] || '';
  const base = user.split(':')[0];
  return toWhatsappDigits(base);
}

export function evolutionInstanceName(branchId) {
  const id = String(branchId || '').replace(/-/g, '');
  return `ep_${id}`.slice(0, 64);
}
