/** FASE 19 — auth compartida para APIs del bot (sin secretos en el front) */

import { env, getSupabaseUserClient } from '../whatsapp/supabaseAdmin.js';

export function isProdRuntime() {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');
}

export function readSecretParts(req) {
  const header = String(req.headers['x-ep-wa-secret'] || req.headers['apikey'] || '');
  const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const query = typeof req.query?.secret === 'string' ? req.query.secret : '';
  return { header, auth, query };
}

export function configuredWebhookSecrets(extra = []) {
  return [
    env('EP_WA_WEBHOOK_SECRET'),
    env('BOT_DISPATCH_SECRET'),
    env('BOT_SIMULATE_SECRET'),
    env('BOT_WA_INBOUND_SECRET'),
    ...extra,
  ].filter(Boolean);
}

/** Secret de webhook. En producción, si no hay secret configurado → deny. */
export function webhookSecretOk(req, extraEnvValues = []) {
  const keys = configuredWebhookSecrets(extraEnvValues);
  if (!keys.length) return !isProdRuntime();
  const { header, auth, query } = readSecretParts(req);
  return keys.some((s) => s && (header === s || auth === s || query === s));
}

export function inboundSecretOk(req) {
  const evo = env('EVOLUTION_API_KEY');
  if (webhookSecretOk(req, evo ? [evo] : [])) return true;
  return false;
}

/** Cron Vercel: no confiar solo en x-vercel-cron (se puede spoofear). */
export function cronAuthorized(req) {
  if (String(req.headers['x-vercel-cron'] || '') !== '1') return false;
  const cron = env('CRON_SECRET');
  if (cron) {
    const auth = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    return auth === cron;
  }
  return webhookSecretOk(req);
}

export function dispatchAuthorized(req) {
  return cronAuthorized(req) || webhookSecretOk(req, [env('CRON_SECRET')].filter(Boolean));
}

export async function requireStaff(req, admin, {
  roles = ['super_admin', 'admin_sucursal'],
} = {}) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token || !admin) return null;
  const userClient = getSupabaseUserClient(token);
  if (!userClient) return null;
  const { data: authData } = await userClient.auth.getUser();
  if (!authData?.user) return null;
  const { data: caller } = await admin
    .from('profiles')
    .select('id, role, is_active, branch_id')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();
  if (!caller || caller.is_active === false) return null;
  const role = caller.role === 'administrador' ? 'admin_sucursal' : caller.role;
  if (!roles.includes(role)) return null;
  return { ...caller, role };
}

const SECRET_RE = /(service_role|Bearer\s+\S+|apikey["']?\s*[:=]\s*["']?[\w.-]+|EVOLUTION_API_KEY|SUPABASE_SERVICE|EP_WA_WEBHOOK|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9._-]+)/gi;

export function sanitizeLogText(text) {
  return String(text || '').replace(SECRET_RE, '[redacted]').slice(0, 2000);
}

export function sanitizeLogMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    if (/secret|password|token|authorization|apikey|service_role/i.test(k)) {
      out[k] = '[redacted]';
    } else if (typeof v === 'string') {
      out[k] = sanitizeLogText(v);
    } else if (v && typeof v === 'object') {
      out[k] = '[object]';
    } else {
      out[k] = v;
    }
  }
  return out;
}
