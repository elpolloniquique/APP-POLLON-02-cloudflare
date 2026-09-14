/**
 * FASE 15+19: inbound Evolution → BotEngine → WhatsAppProvider.sendText
 * Auth: EP_WA_WEBHOOK_SECRET o apikey = EVOLUTION_API_KEY (obligatorio en prod)
 */
export const config = { maxDuration: 20 };
import { cors, parseBody, getSupabaseAdmin } from '../lib/whatsapp/supabaseAdmin.js';
import { processInbound } from '../lib/bot/engine.js';
import { getWhatsAppProvider, parseInboundWebhook, inboundPhone } from '../lib/bot/provider.js';
import { inboundSecretOk } from '../lib/bot/auth.js';
import { clientIp, rateLimitHit } from '../lib/bot/rateLimit.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });
  if (!inboundSecretOk(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (rateLimitHit(`in:${clientIp(req)}`, { max: 60, windowMs: 60_000 })) {
    return res.status(429).json({ ok: false, error: 'rate_limit' });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ ok: false, error: 'supabase_admin' });

  const inbound = parseInboundWebhook(parseBody(req));
  if (inbound.kind !== 'message' || inbound.fromMe || !inbound.text) {
    return res.status(200).json({ ok: true, ignored: inbound.kind || 'empty' });
  }

  const phone = inboundPhone(inbound.phone);
  if (!phone) return res.status(200).json({ ok: true, ignored: 'no_phone' });
  if (rateLimitHit(`in-phone:${phone}`, { max: 20, windowMs: 60_000 })) {
    return res.status(200).json({ ok: true, skipped: 'rate_limit' });
  }

  try {
    const result = await processInbound({
      admin,
      phone,
      message: inbound.text,
      profileName: inbound.pushName || '',
      messageId: inbound.messageId || null,
      simulate: false,
    });

    if (result?.reply) {
      const provider = await getWhatsAppProvider({
        admin,
        branchId: result.branchId || null,
        instance: inbound.instance || undefined,
      });
      if (provider.configured) {
        await provider.sendText(phone, result.reply);
      }
    }

    return res.status(200).json({
      ok: true,
      intent: result.intent || null,
      skipped: result.skipped || null,
      replied: Boolean(result?.reply),
    });
  } catch (err) {
    console.error('[bot-wa-inbound]', err?.message || err);
    return res.status(200).json({ ok: false, error: 'handler_error' });
  }
}
