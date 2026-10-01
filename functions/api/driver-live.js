/**
 * GPS en vivo (opción 1): Cloudflare KV, sin Realtime de Supabase.
 *
 * POST /api/driver-live          { lat, lng, heading?, speed?, accuracy?, done? }
 * GET  /api/driver-live?view=staff
 * GET  /api/driver-live?t=TOKEN
 * GET  /api/driver-live?orderId=
 */
import { applyCloudflareEnv } from '../_lib/vercelAdapter.js';
import {
  getKv,
  drvKey,
  followKey,
  kvGetJson,
  kvPutJson,
  kvDel,
  readActiveIndex,
  writeActiveIndex,
  shouldWritePoint,
  appendTrail,
  publicSiteUrl,
  newFollowToken,
  toStaffLocation,
  toPublicFollow,
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
  loadActiveJobForDriver,
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

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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
    const prev = await kvGetJson(kv, drvKey(driverId));
    if (prev?.follow_token) await kvDel(kv, followKey(prev.follow_token));
    await kvDel(kv, drvKey(driverId));
    const ids = (await readActiveIndex(kv)).filter((id) => id !== driverId);
    await writeActiveIndex(kv, ids);
    return json({ ok: true, stopped: true });
  }

  const lat = num(body?.lat);
  const lng = num(body?.lng);
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json({ error: 'Coordenadas inválidas' }, 400);
  }

  const job = await loadActiveJobForDriver(admin, driverId);
  if (!job) {
    return json({ ok: true, pending: true, reason: 'no_active_job' });
  }

  const prev = await kvGetJson(kv, drvKey(driverId));
  const nowIso = new Date().toISOString();
  const nextPoint = { lat, lng, updated_at: nowIso };
  const gate = shouldWritePoint(prev, nextPoint);
  const site = publicSiteUrl(env);
  const followToken = prev?.follow_token || newFollowToken();

  const { data: profile } = driverRow.profile_id
    ? await admin.from('profiles').select('full_name').eq('id', driverRow.profile_id).maybeSingle()
    : { data: driverRow.profile || null };
  const driverName = profile?.full_name || driverRow.profile?.full_name || null;

  const record = {
    driver_id: driverId,
    lat,
    lng,
    heading: num(body?.heading),
    speed: num(body?.speed),
    accuracy: num(body?.accuracy),
    updated_at: nowIso,
    phase: job.phase,
    ticket_code: job.ticket_code,
    job_id: job.job_id,
    order_id: job.order_id,
    branch_id: job.branch_id || driverRow.preferred_branch_id || null,
    assignment_id: job.assignment_id,
    follow_token: followToken,
    driver_name: driverName,
    customer: job.customer,
    store: job.store,
    jobs: job.jobs,
    trail: appendTrail(prev?.trail, nextPoint),
  };

  if (!gate.write && prev) {
    return json({
      ok: true,
      skipped: gate.reason,
      follow_url: `${site}/seguir/${followToken}`,
      follow_token: followToken,
      phase: job.phase,
    });
  }

  await kvPutJson(kv, drvKey(driverId), record);
  await kvPutJson(kv, followKey(followToken), { driver_id: driverId, job_id: job.job_id });

  if (!prev) {
    const ids = await readActiveIndex(kv);
    if (!ids.includes(driverId)) {
      ids.push(driverId);
      await writeActiveIndex(kv, ids);
    }
  }

  return json({
    ok: true,
    follow_url: `${site}/seguir/${followToken}`,
    follow_token: followToken,
    phase: job.phase,
    ticket_code: job.ticket_code,
  });
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
