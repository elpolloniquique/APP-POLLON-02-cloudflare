import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isDriverRole, normalizeRole } from '../../services/authService';
import { isNativeDriverApp } from '../../services/backgroundGpsService';
import {
  ensureDriverPushSubscription,
  retryDriverPushInBackground,
} from '../../services/pushService';

async function registerPeriodicSync() {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    if (!reg?.periodicSync) return;
    const status = await navigator.permissions?.query?.({ name: 'periodic-background-sync' }).catch(() => null);
    if (status && status.state !== 'granted') return;
    await reg.periodicSync.register('pollon-driver-alerts', { minInterval: 15 * 60 * 1000 });
  } catch {
    /* OEM / Chrome sin periodicSync */
  }
}

/**
 * En el-pollon.cl (PWA del pollito): mantiene Web Push vivo en cualquier página,
 * no solo en /repartidor. Xiaomi/Huawei rotan o matan la suscripción si no se refresca.
 */
export function DriverWebPushGuardian() {
  const { profile, session } = useAuth();
  const role = normalizeRole(profile?.rol || profile?.role);

  useEffect(() => {
    if (isNativeDriverApp()) return undefined;
    if (!session?.user?.id) return undefined;
    if (!isDriverRole(role)) return undefined;

    const uid = session.user.id;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      ensureDriverPushSubscription({ force: false, userId: uid }).catch(() => {});
      retryDriverPushInBackground().catch(() => {});
      registerPeriodicSync();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => {
            try {
              reg.active?.postMessage({ type: 'DRIVER_POLL_ALERTS' });
            } catch {
              /* ignore */
            }
          })
          .catch(() => {});
      }
    };

    const first = window.setTimeout(tick, 400);
    const interval = window.setInterval(tick, 90_000);

    const onVis = () => {
      if (document.visibilityState === 'visible') tick();
    };
    const onSw = (event) => {
      const type = event?.data?.type;
      if (type === 'PUSH_SUBSCRIPTION_CHANGE' || type === 'DRIVER_NEW_OFFER') tick();
    };
    const onOnline = () => tick();

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSw);
    }

    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOnline);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onSw);
      }
    };
  }, [profile, session?.user?.id, role]);

  return null;
}
