import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bike, Map, History, Wallet, User, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { unlockDriverAudio } from '../../utils/orderAlertSound';
import { APP_BUILD_ID } from '../../utils/buildStamp';
import { DriverLiveTrackingOnboarding } from './DriverLiveTrackingOnboarding';
import { getMyDriverSummary, ensureMyDriverProfile, setMyOperationalStatus } from '../../services/driverService';
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
  stopDriverBackgroundGps,
} from '../../services/backgroundGpsService';
import { syncDriverLiveShareFromSummary, stopDriverLiveShare } from '../../services/driverLiveShareService';
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
      await syncDriverLiveShareFromSummary(s).catch(() => {});
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
    void stopDriverBackgroundGps();
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
    setMyOperationalStatus('available').catch(() => {});
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

  // GPS nativo desactivado: no publicar ubicación ni consultar cada segundo.
  useEffect(() => {
    void stopDriverBackgroundGps();
  }, []);

  const handleLogout = async () => {
    await stopDriverLiveShare().catch(() => {});
    await stopDriverBackgroundGps();
    await clearDriverAppBadge();
    await signOut();
    navigate('/', { replace: true });
  };

  if (!trackingReady) {
    return (
      <div className="driver-shell min-h-[100dvh] bg-black" data-build={APP_BUILD_ID}>
        {native && (
          <div className="relative z-[91] bg-amber-100 px-3 py-2 text-center text-[12px] font-semibold text-amber-950">
            Usa Chrome en elpollon.cl/repartidor. Esta APK ya no se usa.
          </div>
        )}
        <DriverLiveTrackingOnboarding onReadyChange={onReadyChange} />
      </div>
    );
  }

  return (
    <div className="driver-shell flex min-h-[100dvh] flex-col bg-[#f3f3f3] text-gray-900" data-build={APP_BUILD_ID}>
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

      <main className="relative flex-1 overflow-y-auto pb-24">
        <Outlet context={outletContext} />
      </main>

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
    </div>
  );
}
