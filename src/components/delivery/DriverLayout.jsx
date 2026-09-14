import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bike, Map, History, Wallet, User, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { unlockDriverAudio } from '../../utils/orderAlertSound';
import { APP_BUILD_ID } from '../../utils/buildStamp';
import { DriverLiveTrackingOnboarding } from './DriverLiveTrackingOnboarding';
import { DriverNotifyHome } from '../../pages/driver/DriverNotifyHome';
import { getMyDriverSummary, ensureMyDriverProfile } from '../../services/driverService';
import { subscribeDispatch } from '../../services/dispatchService';
import {
  setDriverAppBadge,
  clearDriverAppBadge,
  ensureDriverPushSubscription,
  retryDriverPushInBackground,
} from '../../services/pushService';
import { ensureNativePushRegistration, registerNativePushHandlers } from '../../services/fcmService';
import {
  isNativeDriverApp,
  startDriverBackgroundGps,
  stopDriverBackgroundGps,
  driverShouldShareGps,
} from '../../services/backgroundGpsService';
import '../../styles/driver-native.css';

const TABS = [
  { to: '/repartidor', end: true, icon: Bike, label: 'Pedidos', badgeKey: 'offers' },
  { to: '/repartidor/mapa', icon: Map, label: 'Mapa' },
  { to: '/repartidor/historial', icon: History, label: 'Historial' },
  { to: '/repartidor/ingresos', icon: Wallet, label: 'Ingresos' },
  { to: '/repartidor/perfil', icon: User, label: 'Perfil' },
];

export function DriverLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const native = isNativeDriverApp();
  const [trackingReady, setTrackingReady] = useState(false);
  const [pendingOffers, setPendingOffers] = useState(0);

  const onReadyChange = useCallback((ready) => {
    setTrackingReady(Boolean(ready));
  }, []);

  const refreshBadge = useCallback(async () => {
    try {
      await ensureMyDriverProfile().catch(() => {});
      const s = await getMyDriverSummary();
      const n = (s?.pendingOffers || []).length;
      setPendingOffers((prev) => (prev === n ? prev : n));
      if (n > 0) await setDriverAppBadge(n);
      else await clearDriverAppBadge();
    } catch {
      /* ignore */
    }
  }, []);

  const outletContext = useMemo(
    () => ({ trackingReady, pendingOffers, refreshBadge }),
    [trackingReady, pendingOffers, refreshBadge]
  );

  useEffect(() => {
    const unlock = () => { unlockDriverAudio(); };
    unlock();
    const opts = { capture: true, passive: true };
    window.addEventListener('pointerdown', unlock, opts);
    window.addEventListener('touchstart', unlock, opts);
    window.addEventListener('click', unlock, opts);
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        unlockDriverAudio();
        if (trackingReady) refreshBadge();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pointerdown', unlock, opts);
      window.removeEventListener('touchstart', unlock, opts);
      window.removeEventListener('click', unlock, opts);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refreshBadge, trackingReady]);

  useEffect(() => {
    retryDriverPushInBackground().catch(() => {});
    ensureDriverPushSubscription().catch(() => {});
    if (native) {
      registerNativePushHandlers({
        onOffer: () => {
          refreshBadge();
          try {
            window.dispatchEvent(new CustomEvent('pollon-driver-push', {
              detail: { type: 'driver_offer' },
            }));
          } catch {
            /* ignore */
          }
        },
      }).catch(() => {});
      ensureNativePushRegistration().catch(() => {});
      import('@capacitor/status-bar')
        .then(({ StatusBar, Style }) => {
          StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
          StatusBar.setBackgroundColor({ color: '#000000' }).catch(() => {});
        })
        .catch(() => {});
      import('@capacitor/splash-screen')
        .then(({ SplashScreen }) => SplashScreen.hide().catch(() => {}))
        .catch(() => {});
    }
  }, [refreshBadge, native]);

  useEffect(() => {
    if (!trackingReady) return undefined;
    refreshBadge();
    ensureDriverPushSubscription().catch(() => {});
    const unsub = subscribeDispatch(() => refreshBadge());
    const t = setInterval(refreshBadge, 8000);
    const onMsg = (event) => {
      if (event.data?.type === 'DRIVER_NEW_OFFER') refreshBadge();
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        retryDriverPushInBackground().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVis);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onMsg);
    }
    return () => {
      unsub();
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onMsg);
      }
    };
  }, [trackingReady, refreshBadge]);

  // GPS solo en app nativa (nunca en PWA de clientes)
  useEffect(() => {
    if (!native || !trackingReady) return undefined;
    let cancelled = false;
    let stopMisses = 0;

    const syncGps = async () => {
      if (cancelled) return;
      try {
        const s = await getMyDriverSummary();
        if (cancelled) return;
        if (driverShouldShareGps(s)) {
          stopMisses = 0;
          await startDriverBackgroundGps();
        } else {
          stopMisses += 1;
          if (stopMisses >= 30) {
            await stopDriverBackgroundGps();
            stopMisses = 0;
          }
        }
      } catch {
        /* ignore */
      }
    };

    void syncGps();
    const t = setInterval(syncGps, 1000);
    let resumeHandle = null;
    import('@capacitor/app')
      .then(async ({ App }) => {
        resumeHandle = await App.addListener('appStateChange', (state) => {
          if (state?.isActive) void syncGps();
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      clearInterval(t);
      try { resumeHandle?.remove(); } catch { /* ignore */ }
    };
  }, [trackingReady, native]);

  const handleLogout = async () => {
    if (native) await stopDriverBackgroundGps();
    await clearDriverAppBadge();
    await signOut();
    navigate(native ? '/repartidor' : '/', { replace: true });
  };

  // PWA clientes: shell mínimo + pantalla solo avisos
  if (!native) {
    return (
      <div className="driver-shell flex min-h-[100dvh] flex-col bg-[#f3f3f3] text-gray-900" data-build={APP_BUILD_ID}>
        <DriverLiveTrackingOnboarding onReadyChange={onReadyChange} />
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-black/10 bg-black px-4 py-3 text-white shadow-sm">
          <div className="flex items-center gap-2.5">
            <img src="/img/logo pollon.png" alt="" className="h-10 w-10 rounded-full border border-white/20 bg-white object-contain" />
            <div>
              <p className="font-display text-lg leading-none tracking-wide text-white">EL POLLÓN</p>
              <p className="mt-0.5 text-[11px] font-semibold text-white/55">Avisos repartidor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Salir"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="relative flex-1 overflow-y-auto">
          {trackingReady ? (
            <DriverNotifyHome />
          ) : (
            <div className="flex min-h-[40dvh] items-center justify-center px-6">
              <p className="text-sm text-gray-500">Activa las notificaciones para continuar…</p>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="driver-shell flex min-h-[100dvh] flex-col bg-[#f3f3f3] text-gray-900" data-build={APP_BUILD_ID}>
      <DriverLiveTrackingOnboarding onReadyChange={onReadyChange} />

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-black/10 bg-black px-4 py-3 text-white shadow-sm">
        <div className="flex items-center gap-2.5">
          <img src="/img/logo pollon.png" alt="" className="h-10 w-10 rounded-full border border-white/20 bg-white object-contain" />
          <div>
            <p className="font-display text-lg leading-none tracking-wide text-white">EL POLLÓN</p>
            <p className="mt-0.5 text-[11px] font-semibold text-white/55">Repartidor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingOffers > 0 && (
            <span className="rounded-full bg-[#c00000] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
              {pendingOffers} nuevo{pendingOffers === 1 ? '' : 's'}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Salir"
            title={profile?.fullName || profile?.email || 'Salir'}
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className={`relative flex-1 overflow-y-auto ${trackingReady ? 'pb-24' : ''}`}>
        {trackingReady ? (
          <Outlet context={outletContext} />
        ) : (
          <div className="flex min-h-[50dvh] items-center justify-center px-6">
            <p className="text-sm text-gray-500">Completa la configuración para continuar…</p>
          </div>
        )}
      </main>

      {trackingReady && (
        <nav className="driver-tabbar fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,.08)]">
          <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 py-1.5">
            {TABS.map(({ to, end, icon: Icon, label, badgeKey }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `relative flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-bold ${
                    isActive ? 'is-active text-[#c00000]' : 'text-gray-500'
                  }`
                }
              >
                <span className="relative inline-flex">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                  {badgeKey === 'offers' && pendingOffers > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#c00000] px-1 text-[10px] font-bold leading-none text-white shadow ring-2 ring-white">
                      {pendingOffers > 9 ? '9+' : pendingOffers}
                    </span>
                  )}
                </span>
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
