/** Constantes app nativa repartidor El Pollón */
export const DRIVER_APK_PUBLIC_PATH = '/DESCARGAR-APK/El-Pollon-repartidor.apk';
export const DRIVER_APK_FILE_NAME = 'El-Pollon-repartidor.apk';
export const DRIVER_APP_VERSION_NAME = '1.4.9';
export const DRIVER_APP_VERSION_CODE = 24;

export function driverOfferDeepLink(offerId) {
  const id = String(offerId || '').trim();
  return id ? `/repartidor/oferta/${encodeURIComponent(id)}` : '/repartidor';
}
export const DRIVER_APP_ID = 'cl.elpollon.app';
export const DRIVER_SITE_ORIGIN = 'https://www.el-pollon.cl';
/** Solo localhost: ?native=1 muestra la UI de la app nativa en el PC. */
export const NATIVE_PREVIEW_STORAGE_KEY = 'pollon_native_preview';

export function isLocalDevHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export function syncNativePreviewFlag() {
  if (!isLocalDevHost()) return false;
  try {
    const q = new URLSearchParams(window.location.search).get('native');
    if (q === '1' || q === 'preview') {
      sessionStorage.setItem(NATIVE_PREVIEW_STORAGE_KEY, '1');
    }
    if (q === '0' || q === 'off') {
      sessionStorage.removeItem(NATIVE_PREVIEW_STORAGE_KEY);
    }
    return sessionStorage.getItem(NATIVE_PREVIEW_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function getDriverApkDownloadUrl() {
  if (typeof window !== 'undefined' && window.location?.origin && !/localhost|capacitor/i.test(window.location.origin)) {
    return `${window.location.origin}${DRIVER_APK_PUBLIC_PATH}`;
  }
  return `${DRIVER_SITE_ORIGIN}${DRIVER_APK_PUBLIC_PATH}`;
}

/** URL absoluta: el POST nativo NO puede ir a capacitor://localhost */
export function getDriverGpsPingUrl(token) {
  return `${DRIVER_SITE_ORIGIN}/api/driver-gps-ping?k=${encodeURIComponent(token)}`;
}

export function shouldSkipNativeAutoOpen() {
  if (typeof window === 'undefined') return true;
  try {
    return new URLSearchParams(window.location.search).get('native_miss') === '1';
  } catch {
    return false;
  }
}

function nativeMissFallbackUrl() {
  if (typeof window === 'undefined') return `${DRIVER_SITE_ORIGIN}/repartidor?native_miss=1`;
  try {
    const u = new URL(window.location.href);
    u.searchParams.set('native_miss', '1');
    return u.toString();
  } catch {
    return `${DRIVER_SITE_ORIGIN}/repartidor?native_miss=1`;
  }
}

/** Chrome Android: abre cl.elpollon.app si está instalada; si no, vuelve al gate. */
export function getNativeDriverLaunchUrl() {
  const fallback = encodeURIComponent(nativeMissFallbackUrl());
  return (
    'intent://launch/#Intent;'
    + `package=${DRIVER_APP_ID};`
    + 'action=android.intent.action.MAIN;'
    + 'category=android.intent.category.LAUNCHER;'
    + `S.browser_fallback_url=${fallback};`
    + 'end'
  );
}

export function openNativeDriverApp() {
  if (typeof window === 'undefined') return;
  const url = getNativeDriverLaunchUrl();
  try {
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    /* ignore */
  }
  try {
    window.location.href = url;
  } catch {
    /* ignore */
  }
}
