import { NavLink, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  isNativeDriverPreview,
  stopDriverBackgroundGps,
  startDriverBackgroundGps,
  driverShouldShareGps,
} from '../../services/backgroundGpsService';
import { stopDriverLiveShare } from '../../services/driverLiveShareService';
import { getDriverOnboardingRecord } from '../../services/driverOnboardingService';
import { bootNativeSafeArea } from '../../utils/nativeSafeArea';
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
  const location = useLocation();
  const native = isNativeDriverApp();
  const previewPc = isNativeDriverPreview();
  const tabs = native
    ? TABS
    : TABS
      .filter((t) => t.to === '/repartidor' || t.to === '/repartidor/perfil')
      .map((t) => (t.to === '/repartidor' ? { ...t, label: 'Avisos' } : t));
  const [trackingReady, setTrackingReady] = useState(() => {
    const rec = getDriverOnboardingRecord(profile?.authUserId || profile?.id, [profile?.id, profile?.authUserId]);
    return Boolean(rec?.completedAt);
  });
  const [pendingOffers, setPendingOffers] = useState(0);
  const [chrome, setChrome] = useState({
    online: false,
    gpsOn: false,
    live: false,
    busy: false,
  });
  const toggleOnlineRef = useRef(null);

  const onReadyChange = useCallback((ready) => {
    if (ready) {
      setTrackingReady(true);
      return;
    }
    const rec = getDriverOnboardingRecord(profile?.authUserId || profile?.id, [profile?.id, profile?.authUserId]);
    if (!rec?.completedAt) setTrackingReady(false);
  }, [profile?.id, profile?.authUserId]);

  const refreshBadge = useCallback(async () => {
    try {
      await ensureMyDriverProfile().catch(() => {});
      const s = await getMyDriverSummary();
      const n = (s?.pendingOffers || []).length;
      setPendingOffers((prev) => (prev === n ? prev : n));
      const st = String(s?.driver?.operational_status || '');
      const online = ['available', 'heading_to_branch', 'delivering', 'carrying_orders', 'offered'].includes(st);
      const live = (s?.activeAssignments || []).length > 0;
      setChrome((prev) => ({ ...prev, online, live }));
      if (n > 0) await setDriverAppBadge(n);
      else await clearDriverAppBadge();
    } catch {
      /* ignore */
    }
  }, []);

  const registerChrome = useCallback((api) => {
    if (api?.toggleOnline) toggleOnlineRef.current = api.toggleOnline;
    if (api?.state) setChrome((prev) => ({ ...prev, ...api.state }));
  }, []);

  const handleToggleOnline = async () => {
    if (toggleOnlineRef.current) {
      await toggleOnlineRef.current();
      return;
    }
    const next = chrome.online ? 'offline' : 'available';
    await setMyOperationalStatus(next).catch(() => {});
    if (next === 'available') {
      startDriverBackgroundGps({ idle: !chrome.live, quiet: true }).catch(() => {});
    } else if (!chrome.live) {
      stopDriverBackgroundGps().catch(() => {});
    }
    setChrome((prev) => ({ ...prev, online: next === 'available' }));
    void refreshBadge();
  };

  const outletContext = useMemo(
    () => ({ trackingReady, pendingOffers, refreshBadge, registerChrome }),
    [trackingReady, pendingOffers, refreshBadge, registerChrome]
  );

  useEffect(() => {
    const unlock = () => { unlockDriverAudio(); };
    unlock();
    const opts = { capture: true, passive: true };
    window.addEventListener('pointerdown', unlock, opts);
    window.addEventListener('touchstart', unlock, opts);
    window.addEventListener('click', unlock, opts);
    const onVis = () => {
      if (document.visibilityState === 'visible') unlockDriverAudio();
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
    if (native) {
      bootNativeSafeArea().catch(() => {});
      import('@capacitor/splash-screen')
        .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 150 }).catch(() => {}))
        .catch(() => {});
      const later = window.setTimeout(() => {
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
        retryDriverPushInBackground().catch(() => {});
        ensureDriverPushSubscription().catch(() => {});
      }, 2000);
      return () => clearTimeout(later);
    }
    retryDriverPushInBackground().catch(() => {});
    ensureDriverPushSubscription().catch(() => {});
    return undefined;
  }, [refreshBadge, native]);

  useEffect(() => {
    if (!trackingReady) return undefined;
    const first = window.setTimeout(() => { void refreshBadge(); }, 400);
    const gpsKick = window.setTimeout(() => {
      if (!isNativeDriverApp()) return;
      getMyDriverSummary()
        .then((s) => {
          if (!driverShouldShareGps(s)) return;
          const idle = (s?.activeAssignments || []).length === 0;
          return startDriverBackgroundGps({ idle, quiet: idle });
        })
        .catch(() => {});
    }, 1600);
    const unsub = subscribeDispatch(() => refreshBadge());
    const t = setInterval(refreshBadge, 15000);
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
      clearTimeout(first);
      clearTimeout(gpsKick);
      unsub();
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onMsg);
      }
    };
  }, [trackingReady, refreshBadge, native]);

  const handleLogout = async () => {
    await stopDriverLiveShare().catch(() => {});
    await stopDriverBackgroundGps();
    await clearDriverAppBadge();
    await signOut();
    navigate('/repartidor', { replace: true });
  };

  if (!native && /^\/repartidor\/(mapa|historial|ingresos)/.test(location.pathname)) {
    return <Navigate to="/repartidor" replace />;
  }

  if (!trackingReady) {
    return (
      <div className={`driver-shell min-h-[100dvh] bg-black ${native ? 'is-native' : ''}`} data-build={APP_BUILD_ID}>
        <DriverLiveTrackingOnboarding onReadyChange={onReadyChange} />
      </div>
    );
  }

  return (
    <div className={`driver-shell flex min-h-[100dvh] flex-col bg-white text-gray-900 ${native ? 'is-native' : ''}`} data-build={APP_BUILD_ID}>
      <header className={`driver-topbar drv-top sticky top-0 z-40 text-white ${native ? '' : 'bg-black'}`}>
        <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/img/logo%20pollon.png" alt="" className="h-9 w-9 rounded-full border border-white/30 bg-white object-contain" />
            <div className="min-w-0">
              <p className="font-display text-[17px] leading-none tracking-wide">EL POLLÓN</p>
              <p className="mt-0.5 text-[11px] font-semibold text-white/80">{native ? 'Repartidor' : 'Avisos de pedidos'}</p>
            </div>
          </div>
          {native && (
            <button
              type="button"
              disabled={chrome.busy}
              onClick={() => { void handleToggleOnline(); }}
              className={`drv-online-pill ${chrome.online ? '' : 'is-off'}`}
            >
              {chrome.online ? 'En línea' : 'Conectarme'}
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-white"
            aria-label="Salir"
            title={profile?.fullName || profile?.email || 'Salir'}
          >
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </div>
        {native && (
          <div className="drv-gpsbar">
            <p>
              <span className={`drv-gpsbar__dot ${chrome.gpsOn || chrome.live ? '' : 'is-off'}`} />
              {chrome.live
                ? (chrome.gpsOn ? 'GPS Activo en ruta' : 'GPS pendiente')
                : (chrome.online ? 'GPS Activo en línea' : 'GPS inactivo')}
            </p>
            <p className={chrome.gpsOn ? 'drv-gpsbar__ok' : 'drv-gpsbar__warn'}>
              {chrome.gpsOn ? (chrome.live ? 'En vivo' : 'Conectado') : (chrome.live ? 'Sin ubicación' : 'Desconectado')}
            </p>
          </div>
        )}
        {previewPc && (
          <p className="drv-preview-note">
            Prueba en este PC · avisos FCM y GPS con pantalla apagada solo en el celular
          </p>
        )}
      </header>

      <main className="relative flex-1 overflow-y-auto pb-24">
        <Outlet context={outletContext} />
      </main>

      <nav className="driver-tabbar fixed bottom-0 left-0 right-0 z-50">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 py-1.5">
          {tabs.map(({ to, end, icon: Icon, label, badgeKey }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => {
                const offerTab = to === '/repartidor' && location.pathname.startsWith('/repartidor/oferta');
                const on = isActive || offerTab;
                return `relative flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-bold ${
                  on ? 'is-active text-white' : 'text-white/45'
                }`;
              }}
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
