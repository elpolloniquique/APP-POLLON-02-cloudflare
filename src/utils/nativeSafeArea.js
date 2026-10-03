import { Capacitor } from '@capacitor/core';

export function isNativeApp() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function bootNativeSafeArea() {
  if (typeof document === 'undefined' || !isNativeApp()) return;
  document.documentElement.classList.add('is-native-app');
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.show().catch(() => {});
    await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    await StatusBar.setBackgroundColor({ color: '#000000' }).catch(() => {});
  } catch {
    /* plugin ausente en web */
  }
}
