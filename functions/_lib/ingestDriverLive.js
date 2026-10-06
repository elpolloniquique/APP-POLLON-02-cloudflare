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
  IDLE_MIN_WRITE_MS,
  IDLE_FORCE_WRITE_MS,
  IDLE_MIN_MOVE_M,
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
    return { ok: false, status: 503, error: 'No hay almacén GPS (KV ni fallback).' };
  }
  const driverId = driverRow?.id;
  if (!driverId) return { ok: false, status: 403, error: 'No eres repartidor' };

  const latN = num(lat);
  const lngN = num(lng);
  if (latN == null || lngN == null || Math.abs(latN) > 90 || Math.abs(lngN) > 180) {
    return { ok: false, status: 400, error: 'Coordenadas inválidas' };
  }

  const job = await loadActiveJobForDriver(admin, driverId);
  const prev = await kvGetJson(kv, drvKey(driverId));
  const nowIso = new Date().toISOString();
  const nextPoint = { lat: latN, lng: lngN, updated_at: nowIso };
  const idle = !job;
  const gate = shouldWritePoint(prev, nextPoint, Date.now(), idle
    ? { minWriteMs: IDLE_MIN_WRITE_MS, forceWriteMs: IDLE_FORCE_WRITE_MS, minMoveM: IDLE_MIN_MOVE_M }
    : {});
  const site = publicSiteUrl(env);
  const followToken = idle ? null : (prev?.follow_token || newFollowToken());

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
    phase: idle ? 'available' : job.phase,
    ticket_code: idle ? null : job.ticket_code,
    job_id: idle ? null : job.job_id,
    order_id: idle ? null : job.order_id,
    branch_id: idle ? (driverRow.preferred_branch_id || prev?.branch_id || null) : (job.branch_id || driverRow.preferred_branch_id || null),
    assignment_id: idle ? null : job.assignment_id,
    follow_token: followToken,
    driver_name: driverName,
    customer: idle ? null : job.customer,
    store: idle ? null : job.store,
    jobs: idle ? [] : job.jobs,
    trail: idle ? [] : appendTrail(prev?.trail, nextPoint),
    idle,
  };

  if (!gate.write && prev) {
    return {
      ok: true,
      skipped: gate.reason,
      pending: idle,
      follow_url: followToken ? `${site}/seguir/${followToken}` : null,
      follow_token: followToken,
      phase: idle ? 'available' : job.phase,
    };
  }

  await kvPutJson(kv, drvKey(driverId), record);
  if (idle && prev?.follow_token) {
    await kvDel(kv, followKey(prev.follow_token));
  }
  if (followToken && !idle) {
    await kvPutJson(kv, followKey(followToken), { driver_id: driverId, job_id: job.job_id });
  }

  if (!prev) {
    const ids = await readActiveIndex(kv);
    if (!ids.includes(driverId)) {
      ids.push(driverId);
      await writeActiveIndex(kv, ids);
    }
  }

  return {
    ok: true,
    pending: idle,
    follow_url: followToken ? `${site}/seguir/${followToken}` : null,
    follow_token: followToken,
    phase: idle ? 'available' : job.phase,
    ticket_code: idle ? null : job.ticket_code,
  };
}
