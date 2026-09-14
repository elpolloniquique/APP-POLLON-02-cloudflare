/**
 * FASE 13–15 + 19: drena bot_notification_queue.
 * Auth: secret / CRON_SECRET (x-vercel-cron solo si el Bearer coincide).
 */
import { cors, parseBody, getSupabaseAdmin } from '../lib/whatsapp/supabaseAdmin.js';
import { dispatchQueue } from '../lib/bot/queue.js';
import { dispatchAuthorized } from '../lib/bot/auth.js';
import { clientIp, rateLimitHit } from '../lib/bot/rateLimit.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'method' });
  if (!dispatchAuthorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (rateLimitHit(`dispatch:${clientIp(req)}`, { max: 30, windowMs: 60_000 })) {
    return res.status(429).json({ ok: false, error: 'rate_limit' });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ ok: false, error: 'supabase_admin' });

  const body = req.method === 'POST' ? parseBody(req) : {};
  const orderId = body.orderId || req.query?.orderId || null;
  const limit = Math.min(30, Number(body.limit || req.query?.limit || 15) || 15);

  try {
    const result = await dispatchQueue(admin, { orderId, limit });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
