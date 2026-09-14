/**
 * Onboarding obligatorio repartidores.
 * Nativa (APK): GPS + notifs + aceptar. PWA clientes: solo avisos tipo WhatsApp.
 */
import {
  isNativeDriverApp,
  getNativePlatform,
  requestAlwaysLocationPermission,
  checkLocationPermissionSnapshot,
} from './backgroundGpsService';
import {
  getNotificationPermission,
  ensureDriverPushSubscription,
  hasWebPushSupport,
  getExistingPushSubscription,
} from './pushService';
import { getNativeNotificationPermissionState } from './fcmService';
import { isIosSafari, isAndroidChrome } from '../utils/pwa';
import {
  DRIVER_APP_VERSION_CODE,
  DRIVER_APP_VERSION_NAME,
  getDriverApkDownloadUrl,
} from '../utils/driverNativeConstants';

const STORAGE_KEY = 'pollon_driver_live_tracking_v2';

function withTimeout(promise, ms, fallback) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeStore(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/** Nativa Capacitor o PWA de clientes (mismo correo). */
export function isDriverAppInstalled() {
  return true;
}

/** Ya no se obliga a descargar APK para usar el panel en la app de clientes. */
export function driverNeedsInstall() {
  return false;
}

export function getDriverOnboardingRecord(userId) {
  if (!userId) return null;
  return readStore()[userId] || null;
}

export function markDriverOnboardingComplete(userId, extra = {}) {
  if (!userId) return;
  const all = readStore();
  all[userId] = {
    completedAt: new Date().toISOString(),
    platform: getNativePlatform(),
    native: isNativeDriverApp(),
    versionName: DRIVER_APP_VERSION_NAME,
    versionCode: DRIVER_APP_VERSION_CODE,
    ...extra,
  };
  writeStore(all);
}

export function clearDriverOnboarding(userId) {
  if (!userId) return;
  const all = readStore();
  delete all[userId];
  writeStore(all);
}

export async function evaluateDriverLiveTrackingReady(userId) {
  const native = isNativeDriverApp();
  const apkUrl = getDriverApkDownloadUrl();

  const base = {
    native,
    platform: getNativePlatform(),
    needsInstall: false,
    mustNative: false,
    installed: true,
    apkUrl,
    versionName: DRIVER_APP_VERSION_NAME,
    versionCode: DRIVER_APP_VERSION_CODE,
    isIos: isIosSafari(),
    isAndroid: isAndroidChrome(),
    savedCompletedAt: getDriverOnboardingRecord(userId)?.completedAt || null,
  };

  // Cap duro: nunca dejar la UI en “Verificando…” infinito (plugins nativos a veces no responden)
  const evaluated = await withTimeout(
    (async () => {
      let notifState = getNotificationPermission();
      try {
        const nativeNotif = await getNativeNotificationPermissionState();
        if (nativeNotif === 'granted' || nativeNotif === 'denied' || nativeNotif === 'prompt') {
          notifState = nativeNotif;
        }
      } catch {
        /* ignore */
      }

      let notifOk = notifState === 'granted';
      if (!notifOk) {
        try {
          notifOk = localStorage.getItem('pollon_native_notif_ok') === '1'
            || localStorage.getItem(`pollon_driver_notif_confirmed_${userId}`) === '1';
        } catch {
          /* ignore */
        }
      }

      // En nativo el push real es FCM; no esperar Service Worker / Web Push
      let hasPushSub = false;
      try {
        if (localStorage.getItem('pollon_fcm_token')) hasPushSub = true;
      } catch {
        /* ignore */
      }
      let pushDeferred = false;
      try {
        pushDeferred = localStorage.getItem('pollon_push_deferred_ok') === '1';
      } catch {
        /* ignore */
      }
      if (!hasPushSub && !native && notifState === 'granted' && hasWebPushSupport()) {
        try {
          hasPushSub = Boolean(await getExistingPushSubscription());
        } catch {
          hasPushSub = false;
        }
      }
      if (!hasPushSub && !native) {
        try {
          hasPushSub = localStorage.getItem('pollon_push_subscribed_ok') === '1';
        } catch {
          /* ignore */
        }
      }

      let location = { ok: false, alwaysOk: false, locationOk: false };
      try {
        location = await checkLocationPermissionSnapshot();
      } catch {
        location = { ok: false, alwaysOk: false, locationOk: false };
      }

      let userConfirmedAlways = false;
      try {
        userConfirmedAlways = localStorage.getItem(`pollon_driver_always_confirmed_${userId}`) === '1';
      } catch {
        /* ignore */
      }

      const gpsOk = native
        ? Boolean(location.locationOk && (location.alwaysOk || userConfirmedAlways))
        : true;
      // PWA: listo SOLO con permiso granted + suscripción Web Push real (sin bypass deferred)
      const ready = native
        ? Boolean(notifOk && gpsOk)
        : Boolean(notifState === 'granted' && hasPushSub);

      return {
        ...base,
        notifOk,
        hasPushSub,
        pushDeferred,
        notifState,
        gpsOk,
        locationOk: Boolean(location.locationOk),
        alwaysOk: Boolean(location.alwaysOk || userConfirmedAlways),
        needsSettings: Boolean(location.needsSettings && !userConfirmedAlways),
        canOpenSettings: Boolean(location.canOpenSettings) || native,
        ready,
        vapidConfigured: hasWebPushSupport() || Boolean(
          typeof import.meta !== 'undefined' && import.meta.env?.VITE_VAPID_PUBLIC_KEY
        ),
      };
    })(),
    7000,
    null,
  );

  if (evaluated) return evaluated;

  return {
    ...base,
    notifOk: false,
    hasPushSub: false,
    pushDeferred: false,
    notifState: 'prompt',
    gpsOk: false,
    locationOk: false,
    alwaysOk: false,
    needsSettings: false,
    canOpenSettings: true,
    ready: false,
    evaluateTimedOut: true,
  };
}

export async function completeDriverLiveTrackingSetup(userId) {
  const native = isNativeDriverApp();

  await ensureDriverPushSubscription().catch(() => {});

  let notifGranted = getNotificationPermission() === 'granted';
  if (!notifGranted) {
    try {
      const nativeNotif = await getNativeNotificationPermissionState();
      notifGranted = nativeNotif === 'granted' || localStorage.getItem('pollon_native_notif_ok') === '1';
    } catch {
      try {
        notifGranted = localStorage.getItem('pollon_native_notif_ok') === '1';
      } catch {
        notifGranted = false;
      }
    }
  }
  if (!notifGranted) {
    try {
      notifGranted = localStorage.getItem(`pollon_driver_notif_confirmed_${userId}`) === '1';
    } catch {
      /* ignore */
    }
  }
  if (!notifGranted) {
    return {
      ok: false,
      error: 'Activa las notificaciones para recibir pedidos (aviso tipo WhatsApp).',
      needsNotif: true,
    };
  }

  // PWA de clientes: listo solo con notificaciones + suscripción
  if (!native) {
    const subRes = await ensureDriverPushSubscription().catch((err) => ({ ok: false, error: err?.message }));
    if (!subRes?.ok && !subRes?.deferred && !subRes?.endpoint) {
      return {
        ok: false,
        error: subRes?.error || 'No se pudo activar el aviso en bandeja. Revisa el permiso de notificaciones.',
        needsNotif: true,
      };
    }
    markDriverOnboardingComplete(userId, {
      alwaysOk: false,
      mode: 'web_notify',
      pushOk: true,
      subscribed: Boolean(subRes?.endpoint || subRes?.deferred),
    });
    return { ok: true, mode: 'web_notify', push: subRes };
  }

  const gps = await requestAlwaysLocationPermission();
  if (!gps.ok) {
    return { ok: false, error: gps.error || 'GPS denegado', canOpenSettings: true };
  }

  let userConfirmedAlways = false;
  try {
    userConfirmedAlways = localStorage.getItem(`pollon_driver_always_confirmed_${userId}`) === '1';
  } catch {
    /* ignore */
  }

  if (!gps.alwaysOk && !userConfirmedAlways) {
    return {
      ok: false,
      error: 'En Ajustes elige ubicación “Permitir todo el tiempo” / “Siempre”.',
      needsSettings: true,
      canOpenSettings: true,
    };
  }

  markDriverOnboardingComplete(userId, {
    alwaysOk: gps.alwaysOk !== false || userConfirmedAlways,
    mode: gps.mode,
  });

  return { ok: true, gps };
}

/** La APK nativa es para GPS 100%; el panel también funciona en la PWA de clientes. */
export function driverMustUseNativeApp() {
  return false;
}
