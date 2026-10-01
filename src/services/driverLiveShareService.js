/**
 * GPS del repartidor solo con pedido activo.
 * Publica a /api/driver-live (Cloudflare KV). No usa Realtime de Supabase.
 */
import { getSupabase } from './supabaseClient';
import { haversineKm } from '../utils/geo';

export const LIVE_SHARE_INTERVAL_MS = 25_000;
const MIN_MOVE_M = 40;
const FORCE_MS = 45_000;

let watchId = null;
let tickTimer = null;
let wakeLock = null;
let running = false;
let lastSent = null;
let lastSentAt = 0;
let lastFollowUrl = '';
const listeners = new Set();

function notify(pos, err, meta) {
  listeners.forEach((fn) => {
    try {
      fn(pos, err, meta);
    } catch {
      /* ignore */
    }
  });
}

export function subscribeDriverLiveShare(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isDriverLiveShareRunning() {
  return running;
}

export function getDriverLiveFollowUrl() {
  return lastFollowUrl || '';
}

export async function getAccessToken() {
  const sb = getSupabase();
  if (!sb) return '';
  const { data } = await sb.auth.getSession();
  return data?.session?.access_token || '';
}

async function requestWake() {
  try {
    if (navigator.wakeLock?.request) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch {
    /* algunos celulares no permiten */
  }
}

function releaseWake() {
  try {
    wakeLock?.release?.();
  } catch {
    /* ignore */
  }
  wakeLock = null;
}

function shouldPublish(lat, lng) {
  const now = Date.now();
  if (!lastSent) return true;
  const elapsed = now - lastSentAt;
  if (elapsed < LIVE_SHARE_INTERVAL_MS - 2000) {
    const km = haversineKm(lastSent.lat, lastSent.lng, lat, lng);
    if (km != null && km * 1000 >= MIN_MOVE_M && elapsed >= 8_000) return true;
    return false;
  }
  if (elapsed >= FORCE_MS) return true;
  const km = haversineKm(lastSent.lat, lastSent.lng, lat, lng);
  if (km != null && km * 1000 >= MIN_MOVE_M) return true;
  if (elapsed >= LIVE_SHARE_INTERVAL_MS) return true;
  return false;
}

async function postLive(payload) {
  const token = await getAccessToken();
  if (!token) throw new Error('Sin sesión');
  const res = await fetch('/api/driver-live', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `GPS ${res.status}`);
  }
  return data;
}

async function publishFix(coords, { force = false } = {}) {
  const lat = Number(coords?.latitude ?? coords?.lat);
  const lng = Number(coords?.longitude ?? coords?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!force && !shouldPublish(lat, lng)) {
    const pos = { lat, lng, accuracy: coords?.accuracy ?? null };
    notify(pos, null, { skipped: true, followUrl: lastFollowUrl });
    return pos;
  }
  const pos = {
    lat,
    lng,
    heading: coords?.heading ?? null,
    speed: coords?.speed ?? null,
    accuracy: coords?.accuracy ?? null,
  };
  try {
    const data = await postLive(pos);
    if (data?.stopped) {
      await stopDriverLiveShare({ silent: true });
      notify(pos, null, { stopped: true });
      return pos;
    }
    if (data?.pending) {
      notify(pos, null, { pending: true });
      return pos;
    }
    lastSent = { lat, lng };
    lastSentAt = Date.now();
    if (data?.follow_url) lastFollowUrl = data.follow_url;
    notify(pos, null, { followUrl: lastFollowUrl, phase: data?.phase });
    return pos;
  } catch (err) {
    notify(pos, err, {});
    return pos;
  }
}

function geoOptions() {
  return { enableHighAccuracy: true, maximumAge: 8_000, timeout: 20_000 };
}

async function snapshotAndPublish({ force = false } = {}) {
  if (!navigator.geolocation) {
    notify(null, new Error('Este celular no tiene GPS'));
    return null;
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void publishFix(pos.coords, { force }).then(resolve);
      },
      (err) => {
        const msg = err?.code === 1
          ? 'Activa la ubicación para que admin y cajeras vean tu ruta.'
          : (err?.message || 'Sin señal GPS');
        notify(null, new Error(msg));
        resolve(null);
      },
      geoOptions(),
    );
  });
}

export async function startDriverLiveShare() {
  if (!navigator.geolocation) {
    return { ok: false, error: 'Este celular no tiene GPS' };
  }
  if (running) {
    const pos = await snapshotAndPublish({ force: true });
    return { ok: true, alreadyRunning: true, position: pos, followUrl: lastFollowUrl };
  }

  running = true;
  lastSent = null;
  lastSentAt = 0;
  await requestWake();

  const first = await snapshotAndPublish({ force: true });

  watchId = navigator.geolocation.watchPosition(
    (pos) => { void publishFix(pos.coords); },
    (err) => {
      if (err?.code === 1) {
        notify(null, new Error('Activa la ubicación para compartir tu ruta.'));
      }
    },
    geoOptions(),
  );

  tickTimer = setInterval(() => {
    if (document.visibilityState === 'hidden') return;
    void snapshotAndPublish({ force: false });
  }, LIVE_SHARE_INTERVAL_MS);

  const onVis = () => {
    if (document.visibilityState === 'visible') {
      void requestWake();
      void snapshotAndPublish({ force: true });
    }
  };
  document.addEventListener('visibilitychange', onVis);
  startDriverLiveShare._onVis = onVis;

  return { ok: true, position: first, followUrl: lastFollowUrl };
}

export async function stopDriverLiveShare({ silent = false } = {}) {
  running = false;
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  if (watchId != null && navigator.geolocation) {
    try { navigator.geolocation.clearWatch(watchId); } catch { /* ignore */ }
    watchId = null;
  }
  if (startDriverLiveShare._onVis) {
    document.removeEventListener('visibilitychange', startDriverLiveShare._onVis);
    startDriverLiveShare._onVis = null;
  }
  releaseWake();
  lastSent = null;
  lastSentAt = 0;
  lastFollowUrl = '';
  if (!silent) {
    try {
      await postLive({ done: true, lat: 0, lng: 0 });
    } catch {
      /* ignore */
    }
  }
}

export async function syncDriverLiveShareFromSummary(summary) {
  const actives = summary?.activeAssignments || [];
  if (actives.length > 0) {
    return startDriverLiveShare();
  }
  if (running) {
    await stopDriverLiveShare();
  }
  return { ok: true, stopped: true };
}
