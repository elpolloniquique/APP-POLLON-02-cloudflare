/**
 * Push nativo FCM (Capacitor) para repartidores.
 * Nunca bloquear la UI: en varios OEM requestPermissions/register no resuelven.
 */
import { Capacitor } from '@capacitor/core';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { isNativeDriverApp } from './backgroundGpsService';
import { DRIVER_APP_VERSION_NAME } from '../utils/driverNativeConstants';

let listenersBound = false;
let lastToken = null;
let registrationKickoff = null;
const OFFER_CHANNEL_ID = 'pollon_driver_alarm_v3';

function withTimeout(promise, ms, fallback) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function markNativeNotifOk() {
  try {
    localStorage.setItem('pollon_native_notif_ok', '1');
  } catch {
    /* ignore */
  }
}

export function isNativePushAvailable() {
  return isNativeDriverApp() && Capacitor.isPluginAvailable('PushNotifications');
}

async function getPushPlugin() {
  if (!isNativePushAvailable()) return null;
  try {
    const mod = await import('@capacitor/push-notifications');
    return mod.PushNotifications;
  } catch (err) {
    console.warn('[Pollón][DriverNative] push plugin:', err?.message || err);
    return null;
  }
}

export async function upsertMyFcmToken(token) {
  if (!token || !isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('ep_upsert_my_fcm_token', {
    p_token: String(token),
    p_platform: Capacitor.getPlatform?.() || 'android',
    p_app_version: DRIVER_APP_VERSION_NAME,
    p_device_info: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    },
  });
  if (error) {
    console.warn('[Pollón][DriverNative] FCM upsert:', error.message);
    try {
      localStorage.setItem('pollon_fcm_token_pending', String(token));
    } catch {
      /* ignore */
    }
    return null;
  }
  lastToken = String(token);
  try {
    localStorage.setItem('pollon_fcm_token', String(token));
    markNativeNotifOk();
  } catch {
    /* ignore */
  }
  return data;
}

async function ensureOfferNotificationChannel(PushNotifications) {
  if (!PushNotifications?.createChannel) return;
  await withTimeout(
    PushNotifications.createChannel({
      id: OFFER_CHANNEL_ID,
      name: 'Pedidos nuevos · alarma',
      description: 'Suena aunque la pantalla esté apagada o estés en otra app',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
      lights: true,
    }),
    2000,
    undefined,
  );
}

export async function registerNativePushHandlers({ onOffer } = {}) {
  const PushNotifications = await withTimeout(getPushPlugin(), 2500, null);
  if (!PushNotifications) return { ok: false, reason: 'no_plugin' };

  await ensureOfferNotificationChannel(PushNotifications);
  import('./driverTrayNotification.js')
    .then(({ ensureDriverOfferChannel, bindDriverTrayTap }) => {
      ensureDriverOfferChannel();
      bindDriverTrayTap();
    })
    .catch(() => {});

  if (!listenersBound) {
    listenersBound = true;

    void Promise.resolve(
      PushNotifications.addListener('registration', (token) => {
        const value = token?.value || token?.token || null;
        if (value) {
          upsertMyFcmToken(value).catch((err) => {
            console.warn('[Pollón][DriverNative] upsert token:', err?.message || err);
          });
        }
      }),
    ).catch(() => {});

    void Promise.resolve(
      PushNotifications.addListener('registrationError', (err) => {
        console.warn('[Pollón][DriverNative] FCM registrationError:', err);
      }),
    ).catch(() => {});

    void Promise.resolve(
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        const data = notification?.data || {};
        if (data.type === 'driver_offer' || data.offerId) onOffer?.(data);
        try {
          window.dispatchEvent(new CustomEvent('pollon-driver-push', { detail: data }));
        } catch {
          /* ignore */
        }
        // App en primer plano: FCM no pone bandeja sola → local tipo WhatsApp
        if (data.type === 'driver_offer' || data.offerId) {
          import('./driverTrayNotification.js')
            .then(({ showDriverOfferTray }) =>
              showDriverOfferTray({
                offerId: data.offerId,
                title: notification?.title || data.title || 'El Pollón · Pedido nuevo',
                body: notification?.body || data.body,
                ticket: data.ticket,
                customerName: data.customerName,
                address: data.address,
                fee: data.fee,
                badgeCount: Number(data.badgeCount) || 1,
              }),
            )
            .catch(() => {});
        }
      }),
    ).catch(() => {});

    void Promise.resolve(
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action?.notification?.data || {};
        try {
          window.dispatchEvent(new CustomEvent('pollon-driver-push-action', { detail: data }));
        } catch {
          /* ignore */
        }
        const path = String(data.deepLink || data.url || '');
        if (path.startsWith('/')) {
          window.history.pushState({}, '', path);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }),
    ).catch(() => {});
  }

  return { ok: true };
}

/**
 * Intenta permiso + FCM en background. Resuelve rápido (≤ ~3s) para no congelar UI.
 * El registro FCM sigue en segundo plano aunque esta promesa ya haya terminado.
 */
export async function ensureNativePushRegistration(opts = {}) {
  const PushNotifications = await withTimeout(getPushPlugin(), 2500, null);
  if (!PushNotifications) {
    return { ok: false, reason: 'web_or_missing_plugin' };
  }

  registerNativePushHandlers(opts).catch(() => {});

  let perm = await withTimeout(
    PushNotifications.checkPermissions(),
    2000,
    { receive: 'prompt' },
  );

  if (perm?.receive !== 'granted') {
    // No esperar al usuario más de 2.5s aquí: el diálogo puede no aparecer
    perm = await withTimeout(
      PushNotifications.requestPermissions(),
      2500,
      perm || { receive: 'prompt' },
    );
  }

  const granted = perm?.receive === 'granted';
  if (granted) markNativeNotifOk();

  // register() en background — esta es la llamada que más se cuelga en OEM
  if (!registrationKickoff) {
    registrationKickoff = (async () => {
      try {
        await withTimeout(PushNotifications.register(), 5000, null);
      } catch (err) {
        console.warn('[Pollón][DriverNative] FCM register:', err?.message || err);
      }
      try {
        const pending = localStorage.getItem('pollon_fcm_token_pending') || localStorage.getItem('pollon_fcm_token');
        if (pending) await upsertMyFcmToken(pending);
      } catch {
        /* ignore */
      }
    })().finally(() => {
      registrationKickoff = null;
    });
  }

  await sleep(400);

  return {
    ok: granted,
    permissionGranted: granted,
    permission: perm,
    token: lastToken || getCachedFcmToken() || null,
    reason: granted ? undefined : 'denied_or_pending',
  };
}

/** Dispara FCM sin esperar resultado (para onboarding). */
export function kickoffNativePushRegistration(opts = {}) {
  ensureNativePushRegistration(opts).catch((err) => {
    console.warn('[Pollón][DriverNative] kickoff push:', err?.message || err);
  });
}

export async function getNativeNotificationPermissionState() {
  const PushNotifications = await withTimeout(getPushPlugin(), 2500, null);
  if (!PushNotifications) return 'unsupported';
  try {
    const perm = await withTimeout(PushNotifications.checkPermissions(), 2500, null);
    if (!perm) return 'prompt';
    if (perm.receive === 'granted') return 'granted';
    if (perm.receive === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'unsupported';
  }
}

export function getCachedFcmToken() {
  try {
    return localStorage.getItem('pollon_fcm_token') || lastToken;
  } catch {
    return lastToken;
  }
}
