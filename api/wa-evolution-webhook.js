/**
 * Inbound Evolution API → motor WhatsApp Inteligente.
 * POST /api/wa-evolution-webhook
 * Auth: X-EP-WA-SECRET o ?secret=  (EP_WA_WEBHOOK_SECRET)
 */
export const config = { maxDuration: 20 };
import { cors, parseBody, getSupabaseAdmin, env } from '../lib/whatsapp/supabaseAdmin.js';
import { parseInboundWebhook } from '../lib/whatsapp/evolution.js';
import { handleInbound } from '../lib/whatsapp/engine.js';

function secretOk(req) {
  const expected = env('EP_WA_WEBHOOK_SECRET');
  if (!expected) return true;
  const header = req.headers['x-ep-wa-secret'] || req.headers['apikey'] || '';
  const q = typeof req.query?.secret === 'string' ? req.query.secret : '';
  return header === expected || q === expected;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!secretOk(req)) return res.status(401).json({ error: 'Secret inválido' });

  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' });

  const body = parseBody(req);
  const inbound = parseInboundWebhook(body);

  if (inbound.kind !== 'message' || inbound.fromMe || !inbound.text) {
    return res.status(200).json({ ok: true, ignored: inbound.kind || 'empty' });
  }

  try {
    const result = await handleInbound({
      admin,
      instance: inbound.instance,
      phone: inbound.phone,
      text: inbound.text,
      pushName: inbound.pushName,
    });
    return res.status(200).json({ ok: true, intent: result.intent || null, skipped: result.skipped || null });
  } catch (err) {
    console.error('[wa-webhook]', err?.message || err);
    return res.status(200).json({ ok: false, error: 'handler_error' });
  }
}
