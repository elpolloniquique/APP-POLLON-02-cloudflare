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

export function getDriverOnboardingRecord(userId, extraIds = []) {
  const all = readStore();
  for (const id of [userId, ...extraIds].filter(Boolean)) {
    if (all[id]) return all[id];
  }
  return null;
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

      const previouslyDone = Boolean(base.savedCompletedAt);
      const gpsOk = !native || Boolean(
        previouslyDone
        || location.alwaysOk
        || location.locationOk
        || userConfirmedAlways
      );
      const notifReady = Boolean(
        notifState === 'granted'
        || notifOk
        || pushDeferred
        || previouslyDone
      );
      const ready = native ? Boolean(notifReady && gpsOk) : notifReady;

      return {
        ...base,
        notifOk,
        hasPushSub,
        pushDeferred,
        notifState,
        gpsOk,
        locationOk: Boolean(location.locationOk),
        alwaysOk: Boolean(location.alwaysOk || userConfirmedAlways),
        needsSettings: Boolean((location.needsSettings || (native && !location.alwaysOk)) && !userConfirmedAlways),
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

  const previouslyDone = Boolean(base.savedCompletedAt);
  let notifFlag = false;
  try {
    notifFlag = localStorage.getItem('pollon_native_notif_ok') === '1';
  } catch {
    /* ignore */
  }
  return {
    ...base,
    notifOk: previouslyDone || notifFlag,
    hasPushSub: previouslyDone,
    pushDeferred: false,
    notifState: previouslyDone || notifFlag ? 'granted' : 'prompt',
    gpsOk: previouslyDone,
    locationOk: previouslyDone,
    alwaysOk: previouslyDone,
    needsSettings: false,
    canOpenSettings: true,
    ready: previouslyDone || notifFlag,
    evaluateTimedOut: true,
  };
}

export async function completeDriverLiveTrackingSetup(userId) {
  const native = isNativeDriverApp();
  const subRes = await ensureDriverPushSubscription({ force: false, userId }).catch((err) => ({
    ok: false,
    error: err?.message,
  }));

  let notifGranted = getNotificationPermission() === 'granted';
  if (!notifGranted) {
    try {
      notifGranted = localStorage.getItem('pollon_native_notif_ok') === '1'
        || localStorage.getItem(`pollon_driver_notif_confirmed_${userId}`) === '1';
    } catch {
      /* ignore */
    }
  }
  if (!notifGranted && !subRes?.ok && !subRes?.deferred && !native) {
    return {
      ok: false,
      error: 'Activa las notificaciones para recibir pedidos (aviso tipo WhatsApp).',
      needsNotif: true,
    };
  }

  let gps = { ok: true, alwaysOk: false, locationOk: !native };
  if (native) {
    gps = await requestAlwaysLocationPermission().catch((err) => ({
      ok: false,
      error: err?.message,
    }));
    if (!gps?.ok && !gps?.locationOk) {
      return {
        ok: false,
        error: gps?.error || 'Permite la ubicación (Siempre) para el GPS en segundo plano.',
        needsGps: true,
        canOpenSettings: true,
      };
    }
    if (gps?.alwaysOk || gps?.locationOk) {
      try {
        localStorage.setItem(`pollon_driver_always_confirmed_${userId}`, gps.alwaysOk ? '1' : '0');
      } catch {
        /* ignore */
      }
    }
  }

  markDriverOnboardingComplete(userId, {
    alwaysOk: Boolean(gps?.alwaysOk),
    locationOk: Boolean(gps?.locationOk || !native),
    mode: native ? 'native_gps_notify' : 'web_notify',
    pushOk: true,
    subscribed: Boolean(subRes?.endpoint || subRes?.deferred || subRes?.ok),
  });
  return {
    ok: true,
    mode: native ? 'native_gps_notify' : 'web_notify',
    push: subRes,
    gps,
  };
}

/** La APK nativa es para GPS 100%; el panel también funciona en la PWA de clientes. */
export function driverMustUseNativeApp() {
  return false;
}
