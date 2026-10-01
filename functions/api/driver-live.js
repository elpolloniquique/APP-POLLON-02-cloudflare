/**
 * GPS en vivo (opción 1): Cloudflare KV, sin Realtime de Supabase.
 *
 * POST /api/driver-live          { lat, lng, heading?, speed?, accuracy?, done? }
 * GET  /api/driver-live?view=staff
 * GET  /api/driver-live?t=TOKEN
 * GET  /api/driver-live?orderId=
 */
import { applyCloudflareEnv } from '../_lib/vercelAdapter.js';
import { ingestDriverLivePoint, clearDriverLive } from '../_lib/ingestDriverLive.js';
import {
  getKv,
  drvKey,
  followKey,
  kvGetJson,
  toStaffLocation,
  toPublicFollow,
  readActiveIndex,
} from '../_lib/driverLiveStore.js';
import {
  supabaseClients,
  bearerToken,
  getAuthUser,
  adminClient,
  findDriverIdForAuthUser,
  loadCallerProfile,
  canViewLiveMap,
  staffBranchFilter,
  findLiveDriverForOrder,
  customerOwnsOrder,
} from '../_lib/driverLiveAuth.js';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Cache-Control': 'no-store',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function handlePing(request, env) {
  const kv = getKv(env);
  if (!kv) {
    return json({ error: 'KV no vinculado. Falta DRIVER_LIVE_KV en Cloudflare Pages.' }, 503);
  }

  const creds = supabaseClients();
  if (creds.error) return json({ error: creds.error }, 500);

  const token = bearerToken(request);
  const user = await getAuthUser(token, creds.url, creds.anon);
  if (!user) return json({ error: 'Sin autorización' }, 401);

  const admin = adminClient(creds.url, creds.service);
  const driverRow = await findDriverIdForAuthUser(admin, user.id);
  const driverId = driverRow?.id;
  if (!driverId) return json({ error: 'No eres repartidor' }, 403);

  const body = await parseJson(request);
  const done = body?.done === true || body?.stop === true;

  if (done) {
    const kv = getKv(env);
    if (kv) await clearDriverLive(kv, driverId);
    return json({ ok: true, stopped: true });
  }

  const result = await ingestDriverLivePoint({
    env,
    admin,
    driverRow,
    lat: body?.lat ?? body?.latitude,
    lng: body?.lng ?? body?.longitude,
    heading: body?.heading ?? body?.bearing,
    speed: body?.speed,
    accuracy: body?.accuracy,
  });
  if (result.status) return json(result, result.status);
  return json(result);
}

async function handleStaffList(request, env) {
  const kv = getKv(env);
  if (!kv) return json({ locations: [], warning: 'kv_unbound' });

  const creds = supabaseClients();
  if (creds.error) return json({ error: creds.error }, 500);

  const token = bearerToken(request);
  const user = await getAuthUser(token, creds.url, creds.anon);
  if (!user) return json({ error: 'Sin autorización' }, 401);

  const admin = adminClient(creds.url, creds.service);
  const profile = await loadCallerProfile(admin, user.id);
  const site = publicSiteUrl(env);

  if (!canViewLiveMap(profile)) {
    const driverRow = await findDriverIdForAuthUser(admin, user.id);
    if (!driverRow?.id) return json({ error: 'Sin permiso de mapa en vivo' }, 403);
    const row = await kvGetJson(kv, drvKey(driverRow.id));
    const loc = toStaffLocation(row, site);
    return json({ locations: loc ? [loc] : [] });
  }

  const branchId = staffBranchFilter(profile);
  const ids = await readActiveIndex(kv);
  const rows = await Promise.all(ids.map((id) => kvGetJson(kv, drvKey(id))));
  const locations = [];
  for (const row of rows) {
    const loc = toStaffLocation(row, site);
    if (!loc) continue;
    if (branchId && loc.branch_id && loc.branch_id !== branchId) continue;
    locations.push(loc);
  }
  return json({ locations });
}

async function handleFollow(env, followToken) {
  const kv = getKv(env);
  if (!kv) return json({ ok: false, active: false, error: 'kv_unbound' }, 503);
  const token = String(followToken || '').trim();
  if (!token || token.length < 8) return json({ ok: false, active: false, error: 'token' }, 400);
  const map = await kvGetJson(kv, followKey(token));
  if (!map?.driver_id) return json({ ok: false, active: false });
  const row = await kvGetJson(kv, drvKey(map.driver_id));
  if (!row || row.follow_token !== token) return json({ ok: false, active: false });
  const pub = toPublicFollow(row);
  if (!pub) return json({ ok: false, active: false });
  return json(pub);
}

async function handleOrder(request, env, orderId) {
  const kv = getKv(env);
  if (!kv) return json({ ok: false, active: false });

  const creds = supabaseClients();
  if (creds.error) return json({ error: creds.error }, 500);

  const token = bearerToken(request);
  const user = await getAuthUser(token, creds.url, creds.anon);
  if (!user) return json({ error: 'Sin autorización' }, 401);

  const admin = adminClient(creds.url, creds.service);
  const profile = await loadCallerProfile(admin, user.id);
  const staff = canViewLiveMap(profile);
  const owns = await customerOwnsOrder(admin, orderId, user.id);
  if (!staff && !owns) return json({ error: 'No autorizado' }, 403);

  const driverId = await findLiveDriverForOrder(admin, orderId);
  if (!driverId) return json({ ok: false, active: false });
  const row = await kvGetJson(kv, drvKey(driverId));
  const matchesOrder = Boolean(
    row
    && (
      String(row.order_id) === String(orderId)
      || (Array.isArray(row.jobs) && row.jobs.some((j) => String(j.order_id) === String(orderId)))
    ),
  );
  if (!matchesOrder) return json({ ok: false, active: false });
  const pub = toPublicFollow(row);
  if (!pub) return json({ ok: false, active: false });
  return json(pub);
}

export async function onRequest(context) {
  applyCloudflareEnv(context.env);
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    if (request.method === 'POST') {
      return await handlePing(request, env);
    }
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const url = new URL(request.url);
    const follow = url.searchParams.get('t') || url.searchParams.get('token') || '';
    const orderId = url.searchParams.get('orderId') || url.searchParams.get('order') || '';
    const view = url.searchParams.get('view') || '';

    if (follow) return await handleFollow(env, follow);
    if (orderId) return await handleOrder(request, env, orderId);
    if (view === 'staff' || view === 'list' || !view) return await handleStaffList(request, env);
    return json({ error: 'Parámetros inválidos' }, 400);
  } catch (err) {
    return json({ error: err?.message || 'Error interno' }, 500);
  }
}
