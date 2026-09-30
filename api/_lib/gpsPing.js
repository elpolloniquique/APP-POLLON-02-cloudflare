/**
 * POST nativo Capgo. La APK de repartidor quedó desactivada:
 * no escribe GPS ni dispara reavisos (eso inflaba el uso de Supabase).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isGpsPingRequest(req) {
  const token = String(req.query?.k || req.query?.token || '').trim();
  if (UUID_RE.test(token)) return true;
  const url = String(req.url || '');
  return url.includes('driver-gps-ping');
}

export async function handleGpsPing(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  return res.status(200).json({ ok: true, disabled: true, skipped: true });
}
