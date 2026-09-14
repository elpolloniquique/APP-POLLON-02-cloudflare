/**
 * WhatsAppProvider (FASE 15)
 * Única vía de envío. Motor y cola no llaman Evolution/Meta directo.
 *
 * Permitido: Evolution OSS (adapter).
 * Prohibido: Meta Cloud API, Twilio, WATI, 360dialog, trycloudflare como prod.
 */

import { env } from '../whatsapp/supabaseAdmin.js';
import {
  sendText as evoSendText,
  sendImage as evoSendImage,
  pingEvolution,
  evolutionConfigured,
  parseInboundWebhook,
} from '../whatsapp/evolution.js';
import { toWhatsappDigits, normalizeChilePhone } from './phone.js';
import { loadBotSettings } from './settings.js';

export { parseInboundWebhook, evolutionConfigured };

export async function resolveInstanceName(admin, branchId = null) {
  const fromEnv = env('EVOLUTION_INSTANCE_NAME', 'BOT_EVOLUTION_INSTANCE');
  if (fromEnv) return fromEnv;
  if (admin) {
    const settings = await loadBotSettings(admin, branchId);
    if (settings.evolution_instance) return String(settings.evolution_instance);
  }
  return 'pollon-bot';
}

function noopProvider(reason = 'not_configured') {
  return {
    name: 'noop',
    configured: false,
    instance: null,
    async sendText() {
      return { ok: false, skipped: reason, provider: 'noop' };
    },
    async sendImage() {
      return { ok: false, skipped: reason, provider: 'noop' };
    },
    async health() {
      return { ok: false, configured: false, provider: 'noop', error: reason };
    },
  };
}

function evolutionProvider(instance) {
  return {
    name: 'evolution',
    configured: true,
    instance,
    async sendText(phone, text) {
      const digits = toWhatsappDigits(phone) || String(phone || '').replace(/\D/g, '');
      if (!digits || !text) return { ok: false, error: 'invalid_phone_or_text', provider: 'evolution' };
      await evoSendText(instance, digits, text);
      return { ok: true, provider: 'evolution', instance, phone: digits };
    },
    async sendImage(phone, imageUrl, caption = '') {
      const digits = toWhatsappDigits(phone) || String(phone || '').replace(/\D/g, '');
      if (!digits || !imageUrl) return { ok: false, error: 'invalid_media', provider: 'evolution' };
      await evoSendImage(instance, digits, imageUrl, caption);
      return { ok: true, provider: 'evolution', instance, phone: digits };
    },
    async health() {
      const ping = await pingEvolution();
      return { ...ping, provider: 'evolution', instance };
    },
  };
}

/**
 * @param {object} [opts]
 * @param {import('@supabase/supabase-js').SupabaseClient} [opts.admin]
 * @param {string} [opts.branchId]
 * @param {string} [opts.instance] instancia Evolution del webhook inbound
 */
export async function getWhatsAppProvider(opts = {}) {
  const instance = opts.instance || await resolveInstanceName(opts.admin || null, opts.branchId || null);
  if (!evolutionConfigured()) return noopProvider('evolution_not_configured');
  if (!instance) return noopProvider('missing_instance');
  return evolutionProvider(instance);
}

export function inboundPhone(raw) {
  return normalizeChilePhone(raw) || toWhatsappDigits(raw);
}
