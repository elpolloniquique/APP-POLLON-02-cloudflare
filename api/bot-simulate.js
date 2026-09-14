/**
 * Simulador El Pollón Bot — no envía WhatsApp.
 * Auth: secret o JWT staff. Rate limit FASE 19.
 */
import { cors, parseBody, getSupabaseAdmin } from '../lib/whatsapp/supabaseAdmin.js';
import { processInbound } from '../lib/bot/engine.js';
import { requireStaff, webhookSecretOk } from '../lib/bot/auth.js';
import { clientIp, rateLimitHit } from '../lib/bot/rateLimit.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });

  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ ok: false, error: 'supabase_admin' });

  const staff = await requireStaff(req, admin);
  if (!webhookSecretOk(req) && !staff) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (rateLimitHit(`sim:${staff?.id || clientIp(req)}`, { max: 30, windowMs: 60_000 })) {
    return res.status(429).json({ ok: false, error: 'rate_limit' });
  }

  const body = parseBody(req);
  try {
    const result = await processInbound({
      admin,
      phone: body.phone,
      message: body.message || body.text,
      profileName: body.profileName || body.name || '',
      branchId: body.branchId || body.branch_id || null,
      messageId: body.messageId || null,
      simulate: true,
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
