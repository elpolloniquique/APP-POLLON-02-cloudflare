/**
 * Almacén GPS cuando DRIVER_LIVE_KV no está vinculado al deploy de Pages.
 * Usa ep_internal_secrets (solo service_role, sin Realtime).
 * Así admin/caja en el-pollon.cl ven al repartidor aunque Cloudflare KV falle.
 */
import { createClient } from '@supabase/supabase-js';

const PREFIX = 'dlive:';

function credsFrom(env) {
  const url = String(
    env?.SUPABASE_URL
    || env?.VITE_SUPABASE_URL
    || process.env.SUPABASE_URL
    || process.env.VITE_SUPABASE_URL
    || '',
  ).trim();
  const service = String(env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !service) return null;
  return { url, service };
}

function asText(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function canUseSecretsLiveStore(env) {
  return Boolean(credsFrom(env));
}

export function makeSecretsLiveKv(env) {
  const creds = credsFrom(env);
  if (!creds) return null;
  const admin = createClient(creds.url, creds.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    async get(key) {
      const { data, error } = await admin
        .from('ep_internal_secrets')
        .select('value')
        .eq('key', PREFIX + key)
        .maybeSingle();
      if (error || data?.value == null) return null;
      return asText(data.value);
    },
    async put(key, value) {
      const { error } = await admin.from('ep_internal_secrets').upsert(
        {
          key: PREFIX + key,
          value: asText(value) ?? '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' },
      );
      if (error) throw new Error(error.message || 'No se pudo guardar GPS');
    },
    async delete(key) {
      await admin.from('ep_internal_secrets').delete().eq('key', PREFIX + key);
    },
  };
}
