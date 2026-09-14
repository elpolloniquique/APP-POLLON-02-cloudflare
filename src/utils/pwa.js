/** Utilidades PWA — detección de plataforma e instalación */

export const PWA_INSTALL_DISMISS_KEY = 'pollon_pwa_install_dismissed_v2';
export const PWA_DISMISS_MS = 12 * 60 * 60 * 1000; // 12 h (no bloquear una semana)

export function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.matchMedia('(display-mode: minimal-ui)').matches
    || window.navigator.standalone === true
  );
}

export function isIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isApple = /iPad|iPhone|iPod/.test(ua);
  const isMacTouch = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return (isApple || isMacTouch) && !window.MSStream;
}

export function isAndroidChrome() {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent) && /Chrome/i.test(navigator.userAgent) && !/Edg/i.test(navigator.userAgent);
}

export function isMobileBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function isDesktopInstallableBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isDesktop = !/Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  return isDesktop && (/Chrome|Edg|Chromium/i.test(ua));
}

/** PWA ya instalada (ícono pollito), aunque ahora estés en Chrome. */
export async function isPwaAlreadyInstalled() {
  if (isStandaloneDisplayMode()) return true;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.getInstalledRelatedApps === 'function') {
      const apps = await navigator.getInstalledRelatedApps();
      if (Array.isArray(apps) && apps.length) {
        return apps.some((app) => {
          const platform = String(app?.platform || '').toLowerCase();
          const url = String(app?.url || '');
          return platform === 'webapp' || /el-pollon/i.test(url);
        });
      }
    }
  } catch {
    /* API no disponible o denegada */
  }
  return false;
}

export function wasInstallPromptDismissed() {
  try {
    const raw = localStorage.getItem(PWA_INSTALL_DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < PWA_DISMISS_MS;
  } catch {
    return false;
  }
}

export function dismissInstallPrompt() {
  try {
    localStorage.setItem(PWA_INSTALL_DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function clearInstallPromptDismiss() {
  try {
    localStorage.removeItem(PWA_INSTALL_DISMISS_KEY);
  } catch {
    /* ignore */
  }
}

