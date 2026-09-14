/**
 * Reloj de 1 min: Supabase pg_cron (plan pago) pega aquí.
 * Backup: cron diario de Vercel + GPS ping nativo + panel admin.
 */
import { createClient } from '@supabase/supabase-js';
import { env, isFcmConfigured, fcmModeLabel } from './_lib/fcmSend.js';
import { retryAndNotifyOffers } from './_lib/retryAndNotify.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = env('CRON_SECRET');
  const auth = req.headers.authorization || '';
  const headerSecret = req.headers['x-cron-secret'] || '';
  const q = req.query?.secret;
  const fromVercel = Boolean(req.headers['x-vercel-cron']);
  const ok = Boolean(cronSecret) && (
    auth === `Bearer ${cronSecret}`
    || q === cronSecret
    || headerSecret === cronSecret
  );
  if (!ok && !fromVercel) {
    return res.status(401).json({
      error: 'Unauthorized',
      hint: cronSecret ? 'Falta CRON_SECRET' : 'Configura CRON_SECRET en Vercel Production',
    });
  }

  const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Faltan SUPABASE_URL / SERVICE_ROLE' });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const parsedBody = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body || '{}'); } catch { return {}; } })() : (req.body || {});
  const bodySource = parsedBody.source || req.query?.source || null;

  const result = await retryAndNotifyOffers(admin, { force: true });
  if (!result.ok && result.error) {
    return res.status(500).json(result);
  }

  return res.status(200).json({
    ...result,
    fcmConfigured: isFcmConfigured(),
    fcmMode: fcmModeLabel(),
    source: bodySource,
  });
}
