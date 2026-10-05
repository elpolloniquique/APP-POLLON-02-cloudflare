/**
 * Última posición del repartidor en Cloudflare KV (no Supabase Realtime).
 * Una clave por conductor; se sobrescribe. TTL 8 h por seguridad.
 */

export const DRIVER_LIVE_KV_BINDING = 'DRIVER_LIVE_KV';
export const LIVE_TTL_SEC = 8 * 3600;
export const MIN_WRITE_MS = 8_000;
export const FORCE_WRITE_MS = 22_000;
export const MIN_MOVE_M = 15;
export const IDLE_MIN_WRITE_MS = 75_000;
export const IDLE_FORCE_WRITE_MS = 90_000;
export const IDLE_MIN_MOVE_M = 80;
export const TRAIL_MAX = 14;
export const IDX_KEY = 'idx:active';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function haversineMeters(a, b) {
  if (!a || !b) return null;
  const lat1 = num(a.lat);
  const lng1 = num(a.lng);
  const lat2 = num(b.lat);
  const lng2 = num(b.lng);
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const x =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function getKv(env) {
  return env?.[DRIVER_LIVE_KV_BINDING] || null;
}

export function drvKey(driverId) {
  return `drv:${driverId}`;
}

export function followKey(token) {
  return `follow:${token}`;
}

export async function kvGetJson(kv, key) {
  if (!kv || !key) return null;
  try {
    const raw = await kv.get(key);
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

export async function kvPutJson(kv, key, value, { ttl = LIVE_TTL_SEC } = {}) {
  await kv.put(key, JSON.stringify(value), { expirationTtl: ttl });
}

export async function kvDel(kv, key) {
  try {
    await kv.delete(key);
  } catch {
    /* ignore */
  }
}

export async function readActiveIndex(kv) {
  const idx = await kvGetJson(kv, IDX_KEY);
  const ids = Array.isArray(idx?.ids) ? idx.ids.map(String).filter(Boolean) : [];
  return [...new Set(ids)];
}

export async function writeActiveIndex(kv, ids) {
  const unique = [...new Set((ids || []).map(String).filter(Boolean))].slice(0, 80);
  await kvPutJson(kv, IDX_KEY, { ids: unique, updated_at: new Date().toISOString() });
}

export function shouldWritePoint(prev, next, now = Date.now(), opts = {}) {
  if (!prev?.lat || !prev?.lng) return { write: true, reason: 'first' };
  const lastAt = Date.parse(prev.updated_at || '') || 0;
  const elapsed = now - lastAt;
  const minWrite = opts.minWriteMs ?? MIN_WRITE_MS;
  const forceWrite = opts.forceWriteMs ?? FORCE_WRITE_MS;
  const minMove = opts.minMoveM ?? MIN_MOVE_M;
  if (elapsed < minWrite) return { write: false, reason: 'throttle' };
  const moved = haversineMeters(prev, next);
  if (moved != null && moved >= minMove) return { write: true, reason: 'moved' };
  if (elapsed >= forceWrite) return { write: true, reason: 'heartbeat' };
  return { write: false, reason: 'still' };
}

export function appendTrail(prevTrail, point) {
  const trail = Array.isArray(prevTrail) ? [...prevTrail] : [];
  const lat = num(point.lat);
  const lng = num(point.lng);
  if (lat == null || lng == null) return trail.slice(-TRAIL_MAX);
  const last = trail[trail.length - 1];
  if (last && Math.abs(last.lat - lat) < 0.00005 && Math.abs(last.lng - lng) < 0.00005) {
    return trail.slice(-TRAIL_MAX);
  }
  trail.push({ lat, lng, t: point.updated_at || new Date().toISOString() });
  return trail.slice(-TRAIL_MAX);
}

export function publicSiteUrl(env) {
  const raw = String(env?.EP_PUBLIC_SITE_URL || env?.VITE_PUBLIC_SITE_URL || 'https://www.el-pollon.cl').trim();
  return raw.replace(/\/+$/, '');
}

export function newFollowToken() {
  try {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 22);
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function toStaffLocation(row, siteUrl) {
  if (!row?.driver_id || row.lat == null || row.lng == null) return null;
  const token = row.follow_token || '';
  return {
    driver_id: row.driver_id,
    lat: Number(row.lat),
    lng: Number(row.lng),
    heading: row.heading ?? null,
    speed: row.speed ?? null,
    accuracy: row.accuracy ?? null,
    updated_at: row.updated_at,
    phase: row.phase || 'to_store',
    ticket_code: row.ticket_code || null,
    job_id: row.job_id || null,
    order_id: row.order_id || null,
    branch_id: row.branch_id || null,
    follow_token: token || null,
    follow_url: token && siteUrl ? `${siteUrl}/seguir/${token}` : null,
    trail: Array.isArray(row.trail) ? row.trail : [],
    driver_name: row.driver_name || null,
  };
}

export function toPublicFollow(row) {
  if (!row || row.lat == null || row.lng == null) return null;
  const first = String(row.driver_name || 'Repartidor').trim().split(/\s+/)[0] || 'Repartidor';
  return {
    ok: true,
    active: true,
    lat: Number(row.lat),
    lng: Number(row.lng),
    heading: row.heading ?? null,
    updated_at: row.updated_at,
    phase: row.phase || 'to_store',
    ticket_code: row.ticket_code || null,
    driver_name: first,
    store: row.store || null,
    customer: row.customer
      ? {
        lat: row.customer.lat ?? null,
        lng: row.customer.lng ?? null,
        address: row.customer.address || null,
      }
      : null,
    trail: Array.isArray(row.trail) ? row.trail : [],
  };
}
