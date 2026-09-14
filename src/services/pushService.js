import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { ensureMyDriverProfile } from './driverService';
import { isNativeDriverApp } from './backgroundGpsService';

const VAPID_PUBLIC = (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();
const NATIVE_NOTIF_FLAG = 'pollon_native_notif_ok';
const PUSH_OK_FLAG = 'pollon_push_subscribed_ok';
const PUSH_DEFERRED_FLAG = 'pollon_push_deferred_ok';

export function isPushConfigured() {
  return hasWebPushSupport();
}

export function hasVapidPublicKey() {
  return Boolean(VAPID_PUBLIC);
}

export function hasWebPushSupport() {
  return Boolean(
    VAPID_PUBLIC
    && typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
  );
}

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** Chrome a veces falla si el buffer tiene byteOffset != 0 */
function toApplicationServerKey(base64String) {
  const u8 = urlBase64ToUint8Array(base64String);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

export function getNotificationPermission() {
  try {
    if (isNativeDriverApp() && typeof localStorage !== 'undefined' && localStorage.getItem(NATIVE_NOTIF_FLAG) === '1') {
      return 'granted';
    }
  } catch {
    /* ignore */
  }
  if (typeof Notification === 'undefined') {
    return isNativeDriverApp() ? 'prompt' : 'unsupported';
  }
  return Notification.permission;
}

export async function getGeolocationPermission() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unsupported';
  try {
    if (navigator.permissions?.query) {
      const st = await navigator.permissions.query({ name: 'geolocation' });
      return st.state;
    }
  } catch {
    /* ignore */
  }
  return 'prompt';
}

export function requestGpsFix(timeoutMs = 12000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ok: false, error: 'Este celular no soporta GPS' });
      return;
    }
    const tid = setTimeout(() => {
      resolve({ ok: false, error: 'GPS sin señal. Activa la ubicación e inténtalo de nuevo.' });
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(tid);
        resolve({
          ok: true,
          position: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
        });
      },
      (err) => {
        clearTimeout(tid);
        const msg =
          err?.code === 1
            ? 'Debes permitir el acceso a la ubicación (GPS).'
            : err?.message || 'No se pudo obtener el GPS';
        resolve({ ok: false, error: msg });
      },
      { enableHighAccuracy: true, timeout: timeoutMs - 500, maximumAge: 5000 }
    );
  });
}

function withTimeout(promise, ms, fallback = null) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

/**
 * Usa el SW ya registrado por vite-plugin-pwa (main.jsx).
 * NO volver a register(): el doble registro + skipWaiting blanquea la PWA al recargar.
 */
async function ensureServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null;

  let reg = await withTimeout(navigator.serviceWorker.getRegistration(), 2500, null);
  if (!reg) {
    // Solo registrar si PWA aún no lo hizo (dev / race de arranque)
    try {
      reg = await withTimeout(
        navigator.serviceWorker.register('/sw.js', { scope: '/' }),
        4000,
        null
      );
    } catch {
      return null;
    }
  }

  const ready = await withTimeout(navigator.serviceWorker.ready, 5000, null);
  if (ready?.active) return ready;
  if (reg?.active) return reg;
  return reg || null;
}

/**
 * Recuperación SUAVE del push.
 * NUNCA borrar caches ni unregister del SW: eso deja la PWA en pantalla blanca.
 */
async function softResetPushSubscription() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      try {
        const sub = await reg.pushManager?.getSubscription?.();
        if (sub) await sub.unsubscribe().catch(() => {});
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

export async function getExistingPushSubscription() {
  if (!hasWebPushSupport()) return null;
  try {
    const reg = await withTimeout(navigator.serviceWorker.ready, 4000, null);
    if (!reg?.pushManager) return null;
    return (await withTimeout(reg.pushManager.getSubscription(), 3000, null)) || null;
  } catch {
    return null;
  }
}

/** Estado real de avisos PWA (no fingir OK solo con permission). */
export async function getDriverWebPushStatus() {
  const permission = getNotificationPermission();
  const vapidOk = hasVapidPublicKey();
  const swOk = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const pushApiOk = typeof window !== 'undefined' && 'PushManager' in window;
  let subscription = null;
  let swActive = false;
  if (vapidOk && swOk) {
    try {
      const reg = await ensureServiceWorkerRegistration();
      swActive = Boolean(reg?.active);
      if (reg?.pushManager && permission === 'granted') {
        subscription = await reg.pushManager.getSubscription();
      }
    } catch {
      /* ignore */
    }
  }
  const subscribed = Boolean(subscription?.endpoint);
  let pushSavedOk = false;
  try {
    pushSavedOk = localStorage.getItem(PUSH_OK_FLAG) === '1';
  } catch {
    /* ignore */
  }
  return {
    vapidOk,
    swOk,
    swActive,
    pushApiOk,
    permission,
    subscribed,
    pushSavedOk,
    ready: vapidOk && permission === 'granted' && subscribed,
    missingVapid: !vapidOk,
  };
}

/** Prueba inmediata en bandeja (sin servidor) para validar permiso + SW. */
export async function showLocalTrayTestNotification({
  title = 'El Pollón · Prueba de aviso',
  body = 'Si ves esto en la bandeja, las notificaciones del sistema están. Los pedidos reales llegarán igual.',
  badgeCount = 1,
} = {}) {
  if (typeof Notification === 'undefined') {
    throw new Error('Este celular no soporta notificaciones del sistema.');
  }
  if (Notification.permission !== 'granted') {
    throw new Error('Primero permite las notificaciones.');
  }
  const reg = await ensureServiceWorkerRegistration();
  if (reg?.showNotification) {
    await reg.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'pollon-push-test',
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: { url: '/repartidor', badgeCount },
    });
  } else {
    // eslint-disable-next-line no-new
    new Notification(title, { body, icon: '/icons/icon-192.png' });
  }
  await setDriverAppBadge(badgeCount);
  return { ok: true };
}

export async function setDriverAppBadge(count) {
  try {
    const n = Math.max(0, Number(count) || 0);
    if (navigator.setAppBadge) {
      if (n > 0) await navigator.setAppBadge(n);
      else if (navigator.clearAppBadge) await navigator.clearAppBadge();
    }
    if (isNativeDriverApp()) {
      const { setNativeLauncherBadge, clearDriverOfferTrays } = await import('./driverTrayNotification.js');
      if (n > 0) await setNativeLauncherBadge(n);
      else await clearDriverOfferTrays();
    }
    if (n <= 0 && 'serviceWorker' in navigator) {
      const reg = await withTimeout(navigator.serviceWorker.ready, 3000, null);
      reg?.active?.postMessage({ type: 'DRIVER_CLEAR_BADGE' });
    }
  } catch {
    /* ignore */
  }
}

export async function clearDriverAppBadge() {
  await setDriverAppBadge(0);
}

async function saveSubscriptionToSupabase(sub) {
  const json = sub.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    throw new Error('No se pudo crear la suscripción push.');
  }
  if (!isSupabaseConfigured()) return { endpoint };
  const driver = await ensureMyDriverProfile();
  const sb = getSupabase();
  const { error } = await sb.from('ep_driver_push_subscriptions').upsert(
    {
      driver_id: driver.id,
      endpoint,
      p256dh,
      auth,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 400) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );
  if (error) throw new Error(error.message || 'No se pudo guardar la suscripción push');
  return { endpoint };
}

function keysMatch(existingKey, wantedKey) {
  try {
    const existing = new Uint8Array(existingKey);
    const wanted = new Uint8Array(wantedKey);
    return existing.byteLength === wanted.byteLength
      && existing.every((b, i) => b === wanted[i]);
  } catch {
    return false;
  }
}

async function subscribeWithKey(reg, appServerKey) {
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const opts = sub.options?.applicationServerKey;
    if (opts && !keysMatch(opts, appServerKey)) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
  }
  if (!sub) {
    // 1) ArrayBuffer (recomendado Chrome reciente)
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });
    } catch (err) {
      // 2) Uint8Array fallback (algunos WebViews)
      const msg = String(err?.message || err || '').toLowerCase();
      if (msg.includes('push service') || msg.includes('registration failed') || msg.includes('applicationServerKey')) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: new Uint8Array(appServerKey),
        });
      } else {
        throw err;
      }
    }
  }
  return sub;
}

function markDeferred() {
  try { localStorage.setItem(PUSH_DEFERRED_FLAG, '1'); } catch { /* ignore */ }
}

function markPushOk() {
  try {
    localStorage.setItem(PUSH_OK_FLAG, '1');
    localStorage.removeItem(PUSH_DEFERRED_FLAG);
  } catch {
    /* ignore */
  }
}

function isPushInfraError(err) {
  const m = String(err?.message || err || '').toLowerCase();
  return m.includes('push service')
    || m.includes('registration failed')
    || m.includes('abort')
    || m.includes('pushmanager')
    || m.includes('service worker no activo');
}

/**
 * Pide permiso + intenta Web Push (bandeja tipo WhatsApp).
 * Si Google/FCM falla: reintento suave (sin borrar caché) y deferred.
 * Nunca recarga ni borra SW/caches: eso dejaba la pantalla en blanco.
 */
export async function ensureDriverPushSubscription() {
  if (!isSupabaseConfigured() && !isNativeDriverApp()) {
    return { ok: true, demo: true };
  }

  if (!VAPID_PUBLIC) {
    throw new Error(
      'Falta configurar notificaciones push (VITE_VAPID_PUBLIC_KEY). Avisa al administrador.'
    );
  }

  if (typeof Notification === 'undefined') {
    if (isNativeDriverApp()) {
      try { localStorage.setItem(NATIVE_NOTIF_FLAG, '1'); } catch { /* ignore */ }
      return { ok: true, nativeLocal: true };
    }
    throw new Error('Este navegador no soporta notificaciones del sistema.');
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    throw new Error('Debes permitir las notificaciones para recibir pedidos con la pantalla apagada.');
  }

  try {
    localStorage.setItem(NATIVE_NOTIF_FLAG, '1');
  } catch {
    /* ignore */
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    markDeferred();
    return {
      ok: true,
      deferred: true,
      warn: 'Este navegador no soporta push en bandeja. Usa Chrome e instala la app El Pollón.',
    };
  }

  const appServerKey = toApplicationServerKey(VAPID_PUBLIC);
  if (new Uint8Array(appServerKey).byteLength !== 65) {
    throw new Error('Clave de notificaciones inválida. Avisa al administrador.');
  }

  const tryOnce = async () => {
    const reg = await ensureServiceWorkerRegistration();
    if (!reg?.active) throw new Error('Service Worker no activo');
    const sub = await subscribeWithKey(reg, appServerKey);
    const saved = await saveSubscriptionToSupabase(sub);
    markPushOk();
    return { ok: true, endpoint: saved.endpoint };
  };

  try {
    return await tryOnce();
  } catch (err1) {
    console.warn('[Pollón] push subscribe attempt 1:', err1);
    if (!isPushInfraError(err1)) {
      try {
        return await tryOnce();
      } catch (errSave) {
        console.warn('[Pollón] push save retry failed:', errSave);
        // Permiso ya OK: no tumbar la UI por un fallo de guardado
        markDeferred();
        return {
          ok: true,
          deferred: true,
          warn: errSave?.message || 'No se pudo guardar la suscripción. Se reintentará al conectarte.',
        };
      }
    }
  }

  // Reintento suave: solo desuscribe push, NO toca caches ni SW
  try {
    await softResetPushSubscription();
    await new Promise((r) => setTimeout(r, 400));
    return await tryOnce();
  } catch (err2) {
    console.warn('[Pollón] push soft-retry failed:', err2);
  }

  markDeferred();
  return {
    ok: true,
    deferred: true,
    warn:
      'Permiso de notificaciones OK. El registro push se reintentará solo. '
      + 'Puedes seguir con la ubicación.',
  };
}

/** Reintento silencioso al abrir panel / volverse visible (si quedó deferred). */
export async function retryDriverPushInBackground() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null;
  let needs = false;
  try {
    needs = localStorage.getItem(PUSH_DEFERRED_FLAG) === '1'
      || localStorage.getItem(PUSH_OK_FLAG) !== '1';
  } catch {
    needs = true;
  }
  if (!needs) {
    const existing = await getExistingPushSubscription();
    if (existing) return { ok: true, existing: true };
  }
  try {
    return await ensureDriverPushSubscription();
  } catch {
    return null;
  }
}

export async function checkDriverReadyPermissions() {
  const notif = getNotificationPermission();
  const geo = await getGeolocationPermission();
  const webPush = hasWebPushSupport();
  let hasSub = false;
  if (webPush && notif === 'granted') {
    hasSub = Boolean(await getExistingPushSubscription());
  }
  let deferred = false;
  try {
    deferred = localStorage.getItem(PUSH_DEFERRED_FLAG) === '1';
  } catch {
    /* ignore */
  }

  const nativeOk = isNativeDriverApp() && (
    notif === 'granted'
    || (typeof localStorage !== 'undefined' && localStorage.getItem(NATIVE_NOTIF_FLAG) === '1')
  );

  return {
    notificationsGranted: notif === 'granted' || nativeOk || deferred,
    notificationsState: notif,
    geoState: geo,
    geoGranted: geo === 'granted',
    pushConfigured: webPush,
    hasPushSubscription: hasSub,
    pushDeferred: deferred && !hasSub,
    readyForOnline: (notif === 'granted' || nativeOk || deferred) && (geo === 'granted' || geo === 'prompt' || isNativeDriverApp()),
  };
}

export async function notifyDriversForJob(jobId) {
  if (!jobId || !isSupabaseConfigured()) return { skipped: true };
  try {
    const sb = getSupabase();
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return { skipped: true, reason: 'no-session' };

    const res = await fetch('/api/notify-driver-offers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jobId }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[Pollón] notify-driver-offers:', res.status, text);
      return { ok: false, status: res.status, body: text };
    }
    return await res.json().catch(() => ({ ok: true }));
  } catch (err) {
    console.warn('[Pollón] notify-driver-offers:', err?.message || err);
    return { ok: false, error: err?.message };
  }
}

/** Prueba real Web Push (servidor → bandeja), igual que un pedido ofertado. */
export async function sendDriverSelfTestPush() {
  if (!isSupabaseConfigured()) return { skipped: true };
  const sb = getSupabase();
  const { data: sessionData } = await sb.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sin sesión. Vuelve a iniciar sesión.');

  const res = await fetch('/api/notify-driver-offers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ selfTest: true }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Error ${res.status}`);
  }
  return json;
}
