import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Precisión objetivo: ≤ 20 m = fix de satélite real (no wifi/celular).
 * En iOS/Safari el GPS es más lento y estricto; si no alcanza, usamos el mejor fix.
 */
const TARGET_ACCURACY_M = 20;
const WATCH_TIMEOUT_MS = 18000;
const WATCH_POLL_MS = 200;
const FIRST_FIX_TIMEOUT_MS = 16000;

export const ADDRESS_MAP_HINT =
  'Abre el mapa y mueve la aguja hasta tu puerta o entrada.';

/** @deprecated alias — el checkout ya no usa lista de direcciones */
export const ADDRESS_LIST_HINT = ADDRESS_MAP_HINT;

export function isAppleMobileBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  // iPadOS reporta MacIntel + touch
  return navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1;
}

export function gpsErrorMessage(err) {
  const code = err?.code;
  const apple = isAppleMobileBrowser();
  const appleHint = apple
    ? ' En iPhone: Ajustes → Privacidad y seguridad → Localización → Safari → Preguntar o Permitir. Luego vuelve a tocar Dirección de entrega.'
    : '';

  if (err?.coarseOnly) {
    return `Ubicación aproximada. ${ADDRESS_MAP_HINT}`;
  }
  if (code === 1 || err?.denied) {
    return `Ubicación bloqueada.${appleHint} ${ADDRESS_MAP_HINT}`;
  }
  if (code === 2) {
    return `Sin señal GPS. ${ADDRESS_MAP_HINT}`;
  }
  if (code === 3) {
    return `El GPS tardó demasiado. ${ADDRESS_MAP_HINT}`;
  }
  return `${err?.message || 'No se pudo usar el GPS.'} ${ADDRESS_MAP_HINT}`;
}

function toWebPosition(pos) {
  const coords = pos?.coords || pos;
  return {
    coords: {
      latitude: Number(coords.latitude),
      longitude: Number(coords.longitude),
      accuracy: Number(coords.accuracy || 0),
    },
    timestamp: pos?.timestamp || Date.now(),
  };
}

function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function denyError(message, extra = {}) {
  const err = new Error(message);
  err.code = 1;
  err.denied = true;
  Object.assign(err, extra);
  return err;
}

function assertUsable(pos) {
  const lat = pos?.coords?.latitude;
  const lng = pos?.coords?.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const err = new Error('No se pudo leer el GPS.');
    err.code = 2;
    throw err;
  }
  return toWebPosition(pos);
}

function webGetCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Este dispositivo no tiene GPS / geolocalización.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/**
 * Safari/iOS responde mejor a getCurrentPosition (gesto del usuario)
 * que a watchPosition solo. Luego afinamos con watch si hace falta.
 */
function webWatchImprove(seedPos, onImprove, budgetMs) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(assertUsable(seedPos));
  }
  const seed = assertUsable(seedPos);
  if ((seed.coords.accuracy || Infinity) <= TARGET_ACCURACY_M) {
    return Promise.resolve(seed);
  }

  return new Promise((resolve) => {
    let watchId = null;
    let best = seed;
    let settled = false;

    const finish = (pos) => {
      if (settled) return;
      settled = true;
      if (watchId !== null) {
        try { navigator.geolocation.clearWatch(watchId); } catch { /* ignore */ }
      }
      resolve(assertUsable(pos));
    };

    const timer = setTimeout(() => finish(best), Math.max(1200, budgetMs));

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = pos?.coords?.accuracy ?? Infinity;
        const prevAcc = best?.coords?.accuracy ?? Infinity;
        if (acc < prevAcc) {
          best = toWebPosition(pos);
          try { onImprove?.(best); } catch { /* ignore */ }
        }
        if (acc <= TARGET_ACCURACY_M) {
          clearTimeout(timer);
          finish(pos);
        }
      },
      () => {
        // En iOS un error de watch no invalida el fix ya obtenido
        clearTimeout(timer);
        finish(best);
      },
      {
        enableHighAccuracy: true,
        // Safari: un timeout muy bajo en watchPosition suele disparar error falso
        maximumAge: 5000,
        timeout: Math.max(8000, budgetMs),
      },
    );
  });
}

async function webPreciseFix(onImprove) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Este dispositivo no tiene GPS / geolocalización.');
  }

  // 1) Primer fix con getCurrentPosition (mejor para el diálogo de permiso en iOS)
  let first = null;
  try {
    first = await webGetCurrentPosition({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: FIRST_FIX_TIMEOUT_MS,
    });
  } catch (err) {
    // Reintento suave: a veces iOS falla el primer intento con highAccuracy
    if (err?.code === 1) {
      throw denyError('Debes permitir la ubicación del teléfono.');
    }
    try {
      first = await webGetCurrentPosition({
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: FIRST_FIX_TIMEOUT_MS,
      });
    } catch (err2) {
      if (err2?.code === 1) {
        throw denyError('Debes permitir la ubicación del teléfono.');
      }
      // Último intento: precisión estándar (aún sirve para centrar el mapa)
      try {
        first = await webGetCurrentPosition({
          enableHighAccuracy: false,
          maximumAge: 60000,
          timeout: 12000,
        });
      } catch (err3) {
        if (err3?.code === 1) {
          throw denyError('Debes permitir la ubicación del teléfono.');
        }
        throw err3;
      }
    }
  }

  const usable = assertUsable(first);
  try { onImprove?.(usable); } catch { /* ignore */ }

  // 2) Afinar un poco más si aún no es ≤ 20 m
  return webWatchImprove(usable, onImprove, 10000);
}

async function nativePreciseFix(onImprove) {
  const perm = await Geolocation.requestPermissions();
  if (perm?.location !== 'granted') {
    if (perm?.coarseLocation === 'granted') {
      throw denyError(
        'Activa ubicación precisa (no aproximada) en Ajustes del celular y toca de nuevo.',
        { coarseOnly: true },
      );
    }
    throw denyError('Debes permitir la ubicación precisa del teléfono.');
  }
  let best = null;
  const deadline = Date.now() + WATCH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 6000,
      maximumAge: 0,
    }).catch(() => null);
    if (!pos) break;
    const acc = pos?.coords?.accuracy ?? Infinity;
    const prevAcc = best?.coords?.accuracy ?? Infinity;
    if (acc < prevAcc) {
      best = pos;
      try { onImprove?.(toWebPosition(pos)); } catch { /* ignore */ }
    }
    if (acc <= TARGET_ACCURACY_M) break;
    await new Promise((r) => setTimeout(r, WATCH_POLL_MS));
  }
  if (!best) {
    const err = new Error('GPS tardó demasiado. Inténtalo de nuevo al aire libre.');
    err.code = 3;
    throw err;
  }
  return assertUsable(best);
}

/**
 * Pide permiso de ubicación y espera el mejor fix posible.
 * onImprove / onProgress actualizan la UI mientras afina.
 */
export async function locateWithPrecisePermission(opts = {}) {
  const pos = isNativeApp()
    ? await nativePreciseFix(opts.onImprove)
    : await webPreciseFix(opts.onImprove);
  opts.onProgress?.(pos);
  return pos;
}
