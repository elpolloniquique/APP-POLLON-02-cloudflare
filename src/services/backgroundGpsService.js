/**
 * GPS en segundo plano para repartidores (Capacitor nativo).
 * - App nativa: foreground service + notificación → pantalla apagada / otra app.
 * - Web/PWA: watchPosition (limitado).
 */
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { BackgroundGeolocation } from '@capgo/background-geolocation';
import { GPS_PUBLISH_INTERVAL_MS, upsertMyLocation, startGpsWatch } from './trackingService';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { getDriverGpsPingUrl } from '../utils/driverNativeConstants';

const PING_TOKEN_KEY = 'pollon_gps_ping_token';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let webStop = null;
let nativeRunning = false;
let startedWithNativeUrl = false;
let lastPublishAt = 0;
let heartbeatTimer = null;
const gpsListeners = new Set();

export const DRIVER_GPS_TRACK_STATUSES = [
  'available',
  'heading_to_branch',
  'delivering',
  'carrying_orders',
  'offered',
];

export function driverShouldShareGps(summary) {
  if (!summary) return false;
  const st = summary?.driver?.operational_status;
  const actives = (summary?.activeAssignments || []).length > 0;
  return actives || DRIVER_GPS_TRACK_STATUSES.includes(st);
}

export function subscribeDriverGpsUpdates(fn) {
  if (typeof fn !== 'function') return () => {};
  gpsListeners.add(fn);
  return () => gpsListeners.delete(fn);
}

function notifyGps(pos, err) {
  gpsListeners.forEach((fn) => {
    try {
      fn(pos, err);
    } catch {
      /* ignore */
    }
  });
}

async function ensureGpsPingToken() {
  try {
    const cached = localStorage.getItem(PING_TOKEN_KEY);
    if (cached && UUID_RE.test(cached)) return cached;
  } catch {
    /* ignore */
  }
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.rpc('ep_ensure_my_gps_ping_token');
    if (error || !data) {
      console.warn('[Pollón] gps ping token:', error?.message || 'sin token');
      return null;
    }
    const tok = String(data);
    try {
      localStorage.setItem(PING_TOKEN_KEY, tok);
    } catch {
      /* ignore */
    }
    return tok;
  } catch (err) {
    console.warn('[Pollón] gps ping token:', err?.message || err);
    return null;
  }
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (!nativeRunning) return;
    getAndPublishCurrentFix({ timeoutMs: 3500, force: false }).then((fix) => {
      if (fix) notifyGps(fix, null);
    }).catch(() => {});
  }, GPS_PUBLISH_INTERVAL_MS);
}

export function isNativeDriverApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getNativePlatform() {
  try {
    return Capacitor.getPlatform();
  } catch {
    return 'web';
  }
}

function isBgLocationOk(status) {
  const bg = status?.backgroundLocation;
  return bg === 'granted' || bg === 'always';
}

function withTimeout(promise, ms, fallback) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Solo lectura del estado de permisos (sin prompts). */
export async function checkLocationPermissionSnapshot() {
  if (!isNativeDriverApp()) {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ ok: false, locationOk: false, alwaysOk: false, mode: 'web' });
        return;
      }
      if (navigator.permissions?.query) {
        navigator.permissions
          .query({ name: 'geolocation' })
          .then((st) => {
            const locationOk = st.state === 'granted';
            resolve({
              ok: locationOk,
              locationOk,
              alwaysOk: locationOk,
              mode: 'web',
              needsSettings: st.state === 'denied',
              canOpenSettings: st.state === 'denied',
            });
          })
          .catch(() => {
            resolve({ ok: false, locationOk: false, alwaysOk: false, mode: 'web' });
          });
        return;
      }
      resolve({ ok: false, locationOk: false, alwaysOk: false, mode: 'web' });
    });
  }

  try {
    const status = await withTimeout(
      BackgroundGeolocation.checkPermissions(),
      4500,
      null,
    );
    if (!status) {
      return {
        ok: false,
        locationOk: false,
        alwaysOk: false,
        mode: 'native',
        timedOut: true,
        canOpenSettings: true,
      };
    }
    const locationOk = status.location === 'granted';
    const alwaysOk = isBgLocationOk(status);
    return {
      ok: locationOk && alwaysOk,
      locationOk,
      alwaysOk,
      status,
      mode: 'native',
      needsSettings: locationOk && !alwaysOk,
      canOpenSettings: !locationOk || !alwaysOk,
    };
  } catch (err) {
    return {
      ok: false,
      locationOk: false,
      alwaysOk: false,
      error: err?.message,
      canOpenSettings: true,
    };
  }
}

/**
 * Solicita ubicación (When In Use) y, en nativo, “Siempre” / background.
 */
export async function requestAlwaysLocationPermission() {
  if (!isNativeDriverApp()) {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ ok: false, error: 'Sin GPS en este dispositivo' });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        () => resolve({ ok: true, mode: 'web', locationOk: true, alwaysOk: true }),
        (err) => resolve({ ok: false, error: err.message || 'GPS denegado' }),
        { enableHighAccuracy: true, timeout: 12000 }
      );
    });
  }

  try {
    try {
      await Geolocation.requestPermissions();
    } catch {
      /* ignore */
    }

    let status = await BackgroundGeolocation.checkPermissions();
    if (status.location !== 'granted') {
      status = await BackgroundGeolocation.requestPermissions({
        permissions: ['location', 'notification'],
      });
    }

    if (status.location !== 'granted') {
      return {
        ok: false,
        error: 'Debes permitir la ubicación para entregas.',
        status,
        locationOk: false,
        alwaysOk: false,
        canOpenSettings: true,
      };
    }

    if (!isBgLocationOk(status)) {
      status = await BackgroundGeolocation.requestPermissions({
        permissions: ['backgroundLocation', 'notification'],
      });
    }

    try {
      status = await BackgroundGeolocation.checkPermissions();
    } catch {
      /* keep */
    }

    const alwaysOk = isBgLocationOk(status);
    return {
      ok: true,
      mode: 'native',
      status,
      locationOk: true,
      alwaysOk,
      needsSettings: !alwaysOk,
      canOpenSettings: !alwaysOk,
    };
  } catch (err) {
    return { ok: false, error: err?.message || 'No se pudo pedir permiso GPS' };
  }
}

export async function openNativeLocationSettings() {
  if (!isNativeDriverApp()) return;
  try {
    await BackgroundGeolocation.openSettings();
  } catch {
    /* ignore */
  }
}

/** Ajustes de la app (notificaciones / permisos) en Android. */
export async function openNativeAppSettings() {
  return openNativeLocationSettings();
}

async function publishNativeFix(location, { force = false } = {}) {
  if (!location) return null;
  const lat = Number(location.latitude ?? location.lat);
  const lng = Number(location.longitude ?? location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const now = Date.now();
  if (!force && lastPublishAt && now - lastPublishAt < GPS_PUBLISH_INTERVAL_MS) return null;
  lastPublishAt = now;
  try {
    await upsertMyLocation({
      lat,
      lng,
      heading: location.bearing ?? location.heading ?? null,
      speed: location.speed ?? null,
      accuracy: location.accuracy ?? null,
    });
    return { lat, lng, accuracy: location.accuracy ?? null };
  } catch (err) {
    console.warn('[Pollón] GPS background publish:', err?.message || err);
    return null;
  }
}

/** Primer punto GPS inmediato (sin esperar a moverse 18 m). Obligatorio para ofertas. */
export async function getAndPublishCurrentFix({ timeoutMs = 12000, force = true } = {}) {
  try {
    const pos = await withTimeout(
      Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 20000,
      }),
      timeoutMs + 500,
      null,
    );
    if (!pos?.coords) return null;
    const payload = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      accuracy: pos.coords.accuracy,
    };
    const published = await publishNativeFix(payload, { force });
    return published ? { lat: payload.lat, lng: payload.lng, accuracy: payload.accuracy } : null;
  } catch (err) {
    console.warn('[Pollón] getCurrentPosition:', err?.message || err);
    return null;
  }
}

/**
 * Inicia seguimiento continuo en vivo (publica a Supabase).
 * Nativo: FGS + notificación persistente → pantalla apagada / otra app.
 * No reinicia el servicio si ya corre (evita caídas cada 2–5 min).
 */
export async function startDriverBackgroundGps({ forceRestart = false } = {}) {

  if (!isNativeDriverApp()) {
    if (webStop && !forceRestart) {
      return { ok: true, mode: 'web', alreadyRunning: true };
    }
    await stopDriverBackgroundGps();
    const publishRef = { current: true };
    webStop = startGpsWatch(
      (pos, err) => {
        notifyGps(pos, err);
      },
      { intervalMs: GPS_PUBLISH_INTERVAL_MS, publishRef }
    );
    return { ok: true, mode: 'web' };
  }

  const perm = await requestAlwaysLocationPermission();
  if (!perm.ok) {
    return perm;
  }

  const pingToken = await ensureGpsPingToken();
  const pingUrl = pingToken ? getDriverGpsPingUrl(pingToken) : null;
  if (!pingUrl) {
    return {
      ok: false,
      error: 'No se pudo activar el GPS en segundo plano (token). Cierra y vuelve a abrir la app nativa.',
      needsPingToken: true,
    };
  }
  const needUrlRestart = nativeRunning && !startedWithNativeUrl && Boolean(pingUrl);

  if (nativeRunning && !forceRestart && !needUrlRestart) {
    const first = await getAndPublishCurrentFix({ timeoutMs: 8000 });
    if (first) notifyGps(first, null);
    startHeartbeat();
    return {
      ok: true,
      mode: 'native',
      alreadyRunning: true,
      nativePost: startedWithNativeUrl,
      alwaysOk: perm.alwaysOk !== false,
      firstFix: Boolean(first),
      position: first || null,
    };
  }

  await stopDriverBackgroundGps();

  try {
    const first = await getAndPublishCurrentFix({ timeoutMs: 10000 });
    if (first) notifyGps(first, null);

    const startOpts = {
      backgroundMessage: 'GPS siempre activo. No detengas esta notificación aunque apagues la pantalla.',
      backgroundTitle: 'El Pollón · GPS en vivo',
      requestPermissions: false,
      stale: true,
      // 0 = actualizar aunque el moto esté parado (si no, el mapa “pierde” el pin)
      distanceFilter: 0,
    };
    // POST nativo: no usa el WebView. Sigue con pantalla apagada / otra app / swipe.
    if (pingUrl) startOpts.url = pingUrl;

    await BackgroundGeolocation.start(startOpts, (location, error) => {
      if (error) {
        if (error.code === 'NOT_AUTHORIZED') {
          notifyGps(null, new Error('Permiso de ubicación denegado'));
        } else {
          notifyGps(null, new Error(error.message || 'Error GPS nativo'));
        }
        return;
      }
      if (!location) return;
      const payload = {
        lat: location.latitude,
        lng: location.longitude,
        heading: location.bearing,
        speed: location.speed,
        accuracy: location.accuracy,
      };
      notifyGps(payload, null);
      void publishNativeFix(location);
    });
    nativeRunning = true;
    startedWithNativeUrl = Boolean(pingUrl);
    startHeartbeat();
    return {
      ok: true,
      mode: 'native',
      nativePost: startedWithNativeUrl,
      alwaysOk: perm.alwaysOk !== false,
      needsSettings: Boolean(perm.needsSettings),
      canOpenSettings: Boolean(perm.canOpenSettings),
      firstFix: Boolean(first),
      position: first || null,
    };
  } catch (err) {
    startedWithNativeUrl = false;
    return { ok: false, error: err?.message || 'No se pudo iniciar GPS en segundo plano' };
  }
}

export async function stopDriverBackgroundGps() {
  stopHeartbeat();
  if (webStop) {
    try { webStop(); } catch { /* ignore */ }
    webStop = null;
  }
  if (nativeRunning || isNativeDriverApp()) {
    try {
      await BackgroundGeolocation.stop();
    } catch {
      /* ignore */
    }
    nativeRunning = false;
    startedWithNativeUrl = false;
  }
}

export function isDriverBackgroundGpsRunning() {
  return nativeRunning || Boolean(webStop);
}
