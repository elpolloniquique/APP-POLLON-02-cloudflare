/**
 * Puente global del evento beforeinstallprompt (compartido cliente / repartidor).
 * Debe engancharse lo antes posible: Chrome dispara el evento al cargar.
 */
let deferredPrompt = null;
const listeners = new Set();

export function getDeferredInstallPrompt() {
  return deferredPrompt;
}

export function setDeferredInstallPrompt(event) {
  deferredPrompt = event || null;
  if (typeof window !== 'undefined') {
    window.__pollonDeferredInstall = deferredPrompt;
  }
  listeners.forEach((fn) => {
    try { fn(deferredPrompt); } catch { /* ignore */ }
  });
}

export function subscribeDeferredInstallPrompt(fn) {
  listeners.add(fn);
  fn(deferredPrompt);
  return () => listeners.delete(fn);
}

export async function promptPwaInstall() {
  if (!deferredPrompt) return { ok: false, reason: 'unavailable' };
  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredInstallPrompt(null);
    return { ok: choice?.outcome === 'accepted', outcome: choice?.outcome };
  } catch (err) {
    return { ok: false, reason: err?.message || 'cancelled' };
  }
}

let hooked = false;
export function ensurePwaInstallListeners() {
  if (typeof window === 'undefined' || hooked) return;
  hooked = true;

  const early = window.__pollonDeferredInstall;
  if (early) setDeferredInstallPrompt(early);

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    setDeferredInstallPrompt(event);
  });
  window.addEventListener('appinstalled', () => {
    setDeferredInstallPrompt(null);
  });
}

if (typeof window !== 'undefined') {
  ensurePwaInstallListeners();
}
