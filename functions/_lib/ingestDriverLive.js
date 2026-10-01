/**
 * Escribe última posición del repartidor en Cloudflare KV.
 * Lo usan POST /api/driver-live (JWT) y POST /api/driver-gps-ping (APK).
 */
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
} from './driverLiveStore.js';
import { loadActiveJobForDriver } from './driverLiveAuth.js';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function clearDriverLive(kv, driverId) {
  const prev = await kvGetJson(kv, drvKey(driverId));
  if (prev?.follow_token) await kvDel(kv, followKey(prev.follow_token));
  await kvDel(kv, drvKey(driverId));
  const ids = (await readActiveIndex(kv)).filter((id) => id !== driverId);
  await writeActiveIndex(kv, ids);
}

export async function ingestDriverLivePoint({
  env,
  admin,
  driverRow,
  lat,
  lng,
  heading = null,
  speed = null,
  accuracy = null,
} = {}) {
  const kv = getKv(env);
  if (!kv) {
    return { ok: false, status: 503, error: 'KV no vinculado. Falta DRIVER_LIVE_KV en Cloudflare Pages.' };
  }
  const driverId = driverRow?.id;
  if (!driverId) return { ok: false, status: 403, error: 'No eres repartidor' };

  const latN = num(lat);
  const lngN = num(lng);
  if (latN == null || lngN == null || Math.abs(latN) > 90 || Math.abs(lngN) > 180) {
    return { ok: false, status: 400, error: 'Coordenadas inválidas' };
  }

  const job = await loadActiveJobForDriver(admin, driverId);
  if (!job) {
    return { ok: true, pending: true, reason: 'no_active_job' };
  }

  const prev = await kvGetJson(kv, drvKey(driverId));
  const nowIso = new Date().toISOString();
  const nextPoint = { lat: latN, lng: lngN, updated_at: nowIso };
  const gate = shouldWritePoint(prev, nextPoint);
  const site = publicSiteUrl(env);
  const followToken = prev?.follow_token || newFollowToken();

  let driverName = driverRow.profile?.full_name || null;
  if (!driverName && driverRow.profile_id) {
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', driverRow.profile_id)
      .maybeSingle();
    driverName = profile?.full_name || null;
  }

  const record = {
    driver_id: driverId,
    lat: latN,
    lng: lngN,
    heading: num(heading),
    speed: num(speed),
    accuracy: num(accuracy),
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
    return {
      ok: true,
      skipped: gate.reason,
      follow_url: `${site}/seguir/${followToken}`,
      follow_token: followToken,
      phase: job.phase,
    };
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

  return {
    ok: true,
    follow_url: `${site}/seguir/${followToken}`,
    follow_token: followToken,
    phase: job.phase,
    ticket_code: job.ticket_code,
  };
}
