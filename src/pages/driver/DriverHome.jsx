import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bell, MapPin, Radio } from 'lucide-react';
import { DriverOfferCard } from '../../components/delivery/DriverOfferCard';
import { DriverActiveOrderCard } from '../../components/delivery/DriverActiveOrderCard';
import { DriverOemPushGuide } from '../../components/delivery/DriverOemPushGuide';
import {
  ensureMyDriverProfile,
  getMyDriverSummary,
  setMyOperationalStatus,
} from '../../services/driverService';
import {
  acceptOffer,
  rejectOffer,
  confirmPickup,
  confirmDelivery,
  subscribeDispatch,
} from '../../services/dispatchService';
import {
  syncAfterDriverAccept,
  maybeAdvanceNearStore,
} from '../../services/orderStatusSyncService';
import {
  ensureDriverPushSubscription,
} from '../../services/pushService';
import {
  isNativeDriverApp,
  openNativeLocationSettings,
  startDriverBackgroundGps,
  stopDriverBackgroundGps,
  isDriverBackgroundGpsRunning,
  subscribeDriverGpsUpdates,
  driverShouldShareGps,
  getAndPublishCurrentFix,
} from '../../services/backgroundGpsService';
import {
  stopDriverLiveShare,
  subscribeDriverLiveShare,
  isDriverLiveShareRunning,
} from '../../services/driverLiveShareService';
import { evaluateDriverLiveTrackingReady } from '../../services/driverOnboardingService';
import { unlockDriverAudio } from '../../utils/orderAlertSound';
import { kickoffNativePushRegistration } from '../../services/fcmService';
import { getSupabase, isSupabaseConfigured } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { setDriverAppBadge, clearDriverAppBadge } from '../../services/pushService';
import { getDriverApkDownloadUrl, openNativeDriverApp } from '../../utils/driverNativeConstants';

function offerAlarmKey(o) {
  return `${o.id}|${o.expires_at || ''}`;
}

export function DriverHome() {
  const { offerId: focusOfferId } = useParams();
  const { user, profile } = useAuth();
  const userId = user?.id || profile?.id;
  const webAlerts = !isNativeDriverApp();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [offerBusyId, setOfferBusyId] = useState(null);
  const offerBusyRef = useRef(null);
  const dismissedOffersRef = useRef(new Set());
  const optimisticAssignRef = useRef(null);
  const [gpsOn, setGpsOn] = useState(false);
  const [gpsPos, setGpsPos] = useState(null);
  const [gpsError, setGpsError] = useState('');
  const [error, setError] = useState('');
  const [branch, setBranch] = useState(null);
  const [permsReady, setPermsReady] = useState(true);

  const publishRef = useRef(false);
  const alarmedKeysRef = useRef(new Set());
  const alertReadyRef = useRef(false);
  const seenOffersRef = useRef(new Map());
  const stopAlarmRef = useRef(null);
  const loadTimerRef = useRef(null);
  const loadingRef = useRef(false);
  /** null | 'idle' | 'active' — evita reiniciar GPS en cada poll */
  const gpsModeRef = useRef(null);
  const stopGpsFnRef = useRef(null);

  const playOfferAlarmOnce = useCallback((keys) => {
    const fresh = keys.filter((k) => k && !alarmedKeysRef.current.has(k));
    if (!fresh.length) return;
    fresh.forEach((k) => alarmedKeysRef.current.add(k));
    if (alarmedKeysRef.current.size > 80) {
      alarmedKeysRef.current = new Set([...alarmedKeysRef.current].slice(-40));
    }
  }, []);

  const applyServerSummary = useCallback((s) => {
    if (!s) {
      setSummary(s);
      return;
    }
    const dismissed = dismissedOffersRef.current;
    const pending = (s.pendingOffers || []).filter((o) => !dismissed.has(o.id));
    let actives = s.activeAssignments || [];
    const opt = optimisticAssignRef.current;
    if (opt) {
      const jobId = opt.job_id || opt.ep_delivery_jobs?.id;
      const orderId = opt.ep_delivery_jobs?.source_order_id;
      const hasReal = actives.some((a) => {
        const j = a.ep_delivery_jobs || {};
        return (jobId && (a.job_id === jobId || j.id === jobId))
          || (orderId && j.source_order_id === orderId);
      });
      if (hasReal) optimisticAssignRef.current = null;
      else actives = [opt, ...actives.filter((a) => a.id !== opt.id)];
    }
    for (const id of [...dismissed]) {
      if (!(s.pendingOffers || []).some((o) => o.id === id)) dismissed.delete(id);
    }
    setSummary({ ...s, pendingOffers: pending, activeAssignments: actives });
  }, []);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      await ensureMyDriverProfile();
      const s = await getMyDriverSummary();
      applyServerSummary(s);
      setError('');

      const hasActive = (s?.activeAssignments || []).length > 0;
      const onlineNow = ['available', 'heading_to_branch', 'delivering', 'carrying_orders', 'offered']
        .includes(s?.driver?.operational_status);
      publishRef.current = hasActive || onlineNow;

      if (isSupabaseConfigured()) {
        const sb = getSupabase();
        const branchId =
          s?.driver?.preferred_branch_id
          || s?.activeAssignments?.[0]?.ep_delivery_jobs?.branch_id;
        if (branchId) {
          const { data } = await sb
            .from('branches')
            .select('lat,lng,name,address,city')
            .eq('id', branchId)
            .maybeSingle();
          if (data) {
            setBranch({
              lat: data.lat != null ? Number(data.lat) : null,
              lng: data.lng != null ? Number(data.lng) : null,
              name: data.name,
              address: data.address,
              city: data.city || 'Iquique',
            });
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Error al cargar. ¿Ejecutaste la migración SQL?');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [applyServerSummary]);

  const scheduleLoad = useCallback(() => {
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    loadTimerRef.current = setTimeout(() => { load(); }, 450);
  }, [load]);

  useEffect(() => {
    load();
    const unsub = subscribeDispatch(() => scheduleLoad());
    const pollMs = () => (document.visibilityState === 'visible' ? 2500 : 8000);
    let t = setInterval(scheduleLoad, pollMs());
    const onVis = () => {
      clearInterval(t);
      if (document.visibilityState === 'visible') {
        unlockDriverAudio();
        scheduleLoad();
      }
      t = setInterval(scheduleLoad, pollMs());
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      unsub();
      clearInterval(t);
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load, scheduleLoad]);

  // Push nativo + SW: refrescar lista; la alarma la dispara el efecto de ofertas
  useEffect(() => {
    const onNativePush = (event) => {
      const data = event?.detail || {};
      if (data.type === 'driver_offer' || data.offerId || data.type === 'DRIVER_NEW_OFFER') {
        void load();
      }
    };
    window.addEventListener('pollon-driver-push', onNativePush);
    let onSw = null;
    if ('serviceWorker' in navigator) {
      onSw = (event) => {
        const data = event.data;
        if (!data || data.type !== 'DRIVER_NEW_OFFER') return;
        void load();
      };
      navigator.serviceWorker.addEventListener('message', onSw);
    }
    return () => {
      window.removeEventListener('pollon-driver-push', onNativePush);
      if (onSw) navigator.serviceWorker.removeEventListener('message', onSw);
    };
  }, [load]);

  useEffect(() => {
    if (webAlerts) return undefined;
    const unsubLive = subscribeDriverLiveShare((pos, err) => {
      if (pos) {
        setGpsPos(pos);
        setGpsOn(true);
      }
      if (err) setGpsError(err.message || 'Error GPS');
      else setGpsError('');
    });
    const unsubNative = subscribeDriverGpsUpdates((pos, err) => {
      if (pos) {
        setGpsPos(pos);
        setGpsOn(true);
      }
      if (err) setGpsError(err.message || 'Error GPS');
      else setGpsError('');
    });
    return () => {
      unsubLive();
      unsubNative();
    };
  }, [webAlerts]);

  useEffect(() => () => {
    // No apagar el FGS nativo al salir de Pedidos (Mapa/Perfil). Lo mantiene DriverLayout.
    stopGpsFnRef.current?.();
    stopAlarmRef.current?.();
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    evaluateDriverLiveTrackingReady(userId)
      .then((s) => {
        if (!cancelled) setPermsReady(Boolean(s?.ready));
      })
      .catch(() => {
        if (!cancelled) setPermsReady(false);
      });
    return () => { cancelled = true; };
  }, [userId]);


  useEffect(() => {
    const offers = summary?.pendingOffers || [];
    if (!alertReadyRef.current) {
      offers.forEach((o) => alarmedKeysRef.current.add(offerAlarmKey(o)));
      alertReadyRef.current = true;
      return undefined;
    }

    const newKeys = [];
    for (const o of offers) {
      const key = offerAlarmKey(o);
      if (!alarmedKeysRef.current.has(key)) newKeys.push(key);
    }

    const nextSeen = new Map();
    for (const o of offers) {
      nextSeen.set(o.id, o.job_id || o.ep_delivery_jobs?.id || '');
    }
    for (const [id, jobId] of seenOffersRef.current) {
      if (!nextSeen.has(id)) {
        import('../../services/driverTrayNotification.js')
          .then(({ cancelDriverOfferTray }) => cancelDriverOfferTray(id, jobId))
          .catch(() => {});
      }
    }
    seenOffersRef.current = nextSeen;

    if (newKeys.length) {
      playOfferAlarmOnce(newKeys);
      if (isNativeDriverApp()) {
        for (const o of offers) {
          if (!newKeys.includes(offerAlarmKey(o))) continue;
          const job = o.ep_delivery_jobs || {};
          import('../../services/driverTrayNotification.js')
            .then(({ showDriverOfferTray }) => showDriverOfferTray({
              offerId: o.id,
              jobId: o.job_id || job.id,
              ticket: job.ticket_code,
              customerName: job.customer_name,
              address: job.customer_address,
              fee: o.offered_fee || job.delivery_fee,
              badgeCount: offers.length,
            }))
            .catch(() => {});
        }
      }
    }

    if (!offers.length) {
      stopAlarmRef.current?.();
      stopAlarmRef.current = null;
    }

    const n = offers.length;
    if (n > 0) void setDriverAppBadge(n);
    else void clearDriverAppBadge();

    return undefined;
  }, [summary?.pendingOffers, playOfferAlarmOnce]);

  const clearGps = useCallback(async () => {
    stopGpsFnRef.current?.();
    stopGpsFnRef.current = null;
    await stopDriverLiveShare().catch(() => {});
    await stopDriverBackgroundGps().catch(() => {});
    setGpsOn(false);
    setGpsPos(null);
    publishRef.current = false;
    gpsModeRef.current = null;
  }, []);

  const goOffline = useCallback(async (reason) => {
    try {
      await setMyOperationalStatus('offline');
    } catch {
      /* ignore */
    }
    // Si aún hay pedidos activos, el FGS GPS no se apaga
    const stillActive = (summary?.activeAssignments || []).length > 0;
    if (!stillActive) await clearGps();
    if (reason) setError(reason);
    await load();
  }, [load, clearGps, summary?.activeAssignments]);

  const startGps = useCallback(async (publish, { idle = false } = {}) => {
    if (!isNativeDriverApp()) return { ok: true };
    publishRef.current = !!publish;
    if (!publish) {
      setGpsOn(false);
      return { ok: true };
    }

    const switchFromIdle = gpsModeRef.current === 'idle' && !idle;
    const res = await startDriverBackgroundGps({
      idle,
      quiet: true,
      forceRestart: switchFromIdle,
    });
    if (!res.ok) {
      setGpsError(res.error || 'No se pudo compartir la ubicación.');
      setGpsOn(false);
      gpsModeRef.current = null;
      return res;
    }
    if (res.position) setGpsPos(res.position);
    setGpsOn(true);
    setGpsError('');
    gpsModeRef.current = idle ? 'idle' : 'active';
    return res;
  }, []);

  // GPS en KV: solo app nativa. La PWA de clientes no comparte ubicación ni acepta.
  useEffect(() => {
    if (webAlerts) return undefined;
    if (!summary) return undefined;
    const shouldShare = driverShouldShareGps(summary);
    const idle = shouldShare && (summary.activeAssignments || []).length === 0;
    const wantMode = idle ? 'idle' : 'active';
    const sharing = isNativeDriverApp()
      ? isDriverBackgroundGpsRunning()
      : isDriverLiveShareRunning();
    const needStart = shouldShare && (!sharing || gpsModeRef.current !== wantMode);
    if (needStart) {
      const delay = sharing ? 200 : (isNativeDriverApp() ? 800 : 0);
      const t = window.setTimeout(() => {
        void (isNativeDriverApp()
          ? startDriverBackgroundGps({
            idle,
            quiet: true,
            forceRestart: Boolean(gpsModeRef.current && gpsModeRef.current !== wantMode),
          }).then((res) => {
            if (res?.ok) {
              setGpsOn(true);
              gpsModeRef.current = wantMode;
              if (res.position) setGpsPos(res.position);
              const hasRealJob = (summary.activeAssignments || []).some(
                (a) => a?.id && !String(a.id).startsWith('opt-'),
              );
              if (hasRealJob) {
                void getAndPublishCurrentFix({ timeoutMs: 3500, force: true }).then((pos) => {
                  if (pos) setGpsPos(pos);
                });
              }
            }
          })
          : startGps(true, { idle }));
      }, delay);
      return () => clearTimeout(t);
    }
    if (!shouldShare && gpsModeRef.current) {
      void clearGps();
    }
    return undefined;
  }, [summary, clearGps, startGps, webAlerts]);

  // ~5 min de la sucursal → estado "En cocina" (preparando)
  useEffect(() => {
    if (!gpsPos || !branch?.lat || !branch?.lng) return undefined;
    const activesNow = summary?.activeAssignments || [];
    const heading = activesNow.filter((a) => (a.phase || 'to_store') === 'to_store');
    if (!heading.length) return undefined;

    let cancelled = false;
    const tick = async () => {
      for (const a of heading) {
        if (cancelled) return;
        const orderId = a?.ep_delivery_jobs?.source_order_id || a?.source_order_id;
        if (!orderId) continue;
        await maybeAdvanceNearStore({
          orderId,
          driverLat: gpsPos.lat,
          driverLng: gpsPos.lng,
          storeLat: Number(branch.lat),
          storeLng: Number(branch.lng),
          currentEstado: 'aceptado',
        });
      }
    };
    const t = setTimeout(() => { void tick(); }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [gpsPos, branch?.lat, branch?.lng, summary?.activeAssignments]);

  const toggleOnline = async () => {
    if (webAlerts) return;
    const currentlyOnline = ['available', 'heading_to_branch', 'delivering', 'carrying_orders', 'offered'].includes(
      summary?.driver?.operational_status
    );
    const next = currentlyOnline ? 'offline' : 'available';
    setBusy(true);
    setError('');
    try {
      await unlockDriverAudio();
      if (next === 'available') {
        if (!permsReady) {
          throw new Error('Activa avisos y ubicación (Siempre) para ponerte Disponible.');
        }
        const ready = await evaluateDriverLiveTrackingReady(userId);
        if (!ready.ready) {
          throw new Error('Activa avisos y ubicación (Siempre) para ponerte Disponible.');
        }
        await ensureDriverPushSubscription().catch(() => {});
        kickoffNativePushRegistration();
      }

      await setMyOperationalStatus(next);
      if (next !== 'available' && !(summary?.activeAssignments || []).length) {
        await clearGps();
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const hushOfferUi = (offer) => {
    const offerId = offer?.id || offer;
    const jobId = offer?.job_id || offer?.ep_delivery_jobs?.id || offer?.job?.id || '';
    stopAlarmRef.current?.();
    stopAlarmRef.current = null;
    import('../../services/driverTrayNotification.js')
      .then(({ stopNativeOfferAlarm, cancelDriverOfferTray }) => {
        stopNativeOfferAlarm();
        cancelDriverOfferTray(offerId, jobId);
      })
      .catch(() => {});
  };

  const onAccept = (offer) => {
    if (webAlerts) return;
    if (!offer?.id || dismissedOffersRef.current.has(offer.id) || offerBusyRef.current) return;
    const cap = summary?.driver?.max_orders || 2;
    const current = (summary?.activeAssignments || []).length;
    if (current >= cap) {
      setError(`Tu cuenta puede llevar máximo ${cap} pedidos a la vez. Entrega uno para aceptar otro.`);
      return;
    }
    dismissedOffersRef.current.add(offer.id);
    offerBusyRef.current = offer.id;
    hushOfferUi(offer);

    const job = offer.ep_delivery_jobs || offer.job || {};
    const optimistic = {
      id: `opt-${offer.id}`,
      phase: 'to_store',
      status: 'accepted',
      job_id: job.id,
      ep_delivery_jobs: job,
    };
    optimisticAssignRef.current = optimistic;
    publishRef.current = true;
    void startGps(true, { idle: false });
    setSummary((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pendingOffers: (prev.pendingOffers || []).filter((o) => o.id !== offer.id),
        activeAssignments: [
          optimistic,
          ...(prev.activeAssignments || []).filter((a) => a.id !== optimistic.id),
        ],
      };
    });
    setOfferBusyId(offer.id);

    const orderId = job.source_order_id || offer.source_order_id || null;
    void acceptOffer(offer.id)
      .then(() => {
        if (orderId) void syncAfterDriverAccept(orderId);
        offerBusyRef.current = null;
        setOfferBusyId(null);
        void getAndPublishCurrentFix({ timeoutMs: 3500, force: true }).then((pos) => {
          if (pos) setGpsPos(pos);
        });
        void load();
      })
      .catch((err) => {
        dismissedOffersRef.current.delete(offer.id);
        if (optimisticAssignRef.current?.id === optimistic.id) optimisticAssignRef.current = null;
        offerBusyRef.current = null;
        setOfferBusyId(null);
        const msg = err.message || '';
        if (/tomado por otro|ya no disponible|expirad|otro repartidor/i.test(msg)) {
          setError('Este pedido ya fue aceptado por otro repartidor.');
        } else {
          setError(msg);
        }
        void load();
      });
  };

  const onReject = (offer) => {
    if (webAlerts) return;
    if (!offer?.id || dismissedOffersRef.current.has(offer.id) || offerBusyRef.current) return;
    dismissedOffersRef.current.add(offer.id);
    offerBusyRef.current = offer.id;
    hushOfferUi(offer);
    setSummary((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pendingOffers: (prev.pendingOffers || []).filter((o) => o.id !== offer.id),
      };
    });
    setOfferBusyId(offer.id);
    void rejectOffer(offer.id)
      .then(() => {
        offerBusyRef.current = null;
        setOfferBusyId(null);
        void load();
      })
      .catch((err) => {
        dismissedOffersRef.current.delete(offer.id);
        offerBusyRef.current = null;
        setOfferBusyId(null);
        setError(err.message);
        void load();
      });
  };

  const onPickup = async (assignment) => {
    if (webAlerts) return;
    if (String(assignment?.id || '').startsWith('opt-')) return;
    setBusy(true);
    try {
      // confirmPickup ya sincroniza pedido → en_delivery
      await confirmPickup(assignment.id);
      void startGps(true, { idle: false });
      void getAndPublishCurrentFix({ timeoutMs: 3500, force: true }).then((pos) => {
        if (pos) setGpsPos(pos);
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onDelivered = async (assignment) => {
    if (webAlerts) return;
    setBusy(true);
    try {
      await confirmDelivery(assignment.id);
      const leftover = (summary?.activeAssignments || []).filter((a) => a.id !== assignment.id);
      if (!leftover.length) {
        await setMyOperationalStatus('available').catch(() => {});
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const actives = summary?.activeAssignments || [];
  const offers = useMemo(() => {
    const list = [...(summary?.pendingOffers || [])];
    if (!focusOfferId) return list;
    return list.sort((a, b) => {
      if (String(a.id) === String(focusOfferId)) return -1;
      if (String(b.id) === String(focusOfferId)) return 1;
      return 0;
    });
  }, [summary?.pendingOffers, focusOfferId]);
  const isOnline = summary?.driver?.operational_status === 'available'
    || ['heading_to_branch', 'delivering', 'carrying_orders', 'offered'].includes(summary?.driver?.operational_status);
  const maxOrders = summary?.driver?.max_orders || 2;
  const driverName =
    summary?.driver?.profiles?.full_name
    || summary?.driver?.profiles?.nombre
    || 'repartidor';
  const branchCity = branch?.city || 'Iquique';
  const canGoOnline = permsReady && !busy && !loading;

  return (
    <div className="mx-auto max-w-lg space-y-3 p-3 sm:p-4">
      {webAlerts && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">
          <Bell className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-bold">App de clientes · solo avisos</p>
            <p className="text-xs opacity-90">
              Cuando hay un pedido nuevo te llega a la bandeja como WhatsApp. Para aceptar usa la app nativa de repartidor.
            </p>
          </div>
        </div>
      )}

      {webAlerts && (
        <div className="rounded-2xl border border-pollon-red/30 bg-white px-3.5 py-3 text-sm text-gray-800 shadow-sm">
          <p className="font-bold text-pollon-red">Aceptar es en la app nativa</p>
          <p className="mt-1 text-xs text-gray-600">
            El ícono del pollito (el-pollon.cl) avisa. El Pollón repartidor es donde tomas el pedido, el GPS y la entrega.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openNativeDriverApp()}
              className="rounded-xl bg-pollon-red px-3 py-2 text-xs font-bold text-white"
            >
              Abrir app nativa
            </button>
            <a
              href={getDriverApkDownloadUrl()}
              className="rounded-xl border border-pollon-red px-3 py-2 text-xs font-bold text-pollon-red"
            >
              Descargar instalador
            </a>
          </div>
        </div>
      )}

      {webAlerts && <DriverOemPushGuide />}

      {!webAlerts && (
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Estado</p>
            <p className="text-lg font-bold text-gray-900">{isOnline ? 'En línea' : 'Desconectado'}</p>
            <p className="mt-0.5 text-sm font-semibold text-pollon-orange">
              Pedidos {actives.length}/{maxOrders}
            </p>
          </div>
          <button
            type="button"
            disabled={busy || loading || (!isOnline && !canGoOnline)}
            onClick={toggleOnline}
            title={!isOnline && !permsReady ? 'Completa permisos arriba primero' : undefined}
            className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-bold shadow-sm transition active:scale-95 disabled:opacity-50 ${
              isOnline ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {isOnline ? 'Disponible' : 'Conectarme'}
          </button>
        </div>
        {(actives.length > 0 || isOnline) && (
          <div className={`flex items-start gap-2 border-t px-4 py-2.5 text-xs ${
            gpsOn ? 'border-sky-100 bg-sky-50 text-sky-950' : 'border-amber-100 bg-amber-50 text-amber-950'
          }`}
          >
            {actives.length ? <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
            <div>
              <p className="font-bold">
                {gpsOn
                  ? (actives.length ? 'En vivo · admin y caja te ven' : 'GPS en línea')
                  : 'Falta ubicación Siempre'}
              </p>
              <p className="opacity-90">
                {gpsOn
                  ? (actives.length
                    ? 'Pantalla apagada u otra app: no detengas la notificación “En ruta”.'
                    : 'Al aceptar, tu avance se ve en el mapa.')
                  : (gpsError || 'Permite ubicación Siempre para seguir con la pantalla apagada.')}
              </p>
              {!gpsOn && (
                <button
                  type="button"
                  onClick={() => { void startGps(true, { idle: actives.length === 0 }); }}
                  className="mt-1 font-bold underline"
                >
                  Permitir ubicación ahora
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{error}</p>
          {isNativeDriverApp() && /ajustes|siempre|todo el tiempo/i.test(error) && (
            <button
              type="button"
              onClick={() => openNativeLocationSettings()}
              className="mt-2 text-xs font-bold underline"
            >
              Abrir ajustes de ubicación
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {offers.map((offer) => (
          <DriverOfferCard
            key={`${offer.id}-${offer.expires_at || ''}`}
            offer={offer}
            focused={Boolean(focusOfferId && String(offer.id) === String(focusOfferId))}
            onAccept={onAccept}
            onReject={onReject}
            loading={offerBusyId === offer.id}
            driverName={driverName}
            branchCity={branchCity}
            canAccept={!webAlerts && actives.length < maxOrders}
            alertsOnly={webAlerts}
          />
        ))}
      </div>

      <div className="space-y-3">
        {actives.map((active) => (
          <DriverActiveOrderCard
            key={active.id}
            assignment={active}
            branch={branch}
            driverName={driverName}
            branchCity={branchCity}
            loading={busy || String(active.id || '').startsWith('opt-')}
            alertsOnly={webAlerts}
            onPickup={onPickup}
            onDelivered={onDelivered}
          />
        ))}
      </div>

      {!loading && offers.length === 0 && actives.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500">
          {webAlerts
            ? 'Cuando haya un pedido nuevo te llega el aviso a la bandeja. Ábrelo y acéptalo en la app nativa.'
            : (isOnline
              ? `Esperando pedidos… Puedes llevar hasta ${maxOrders} a la vez antes del recojo. Al marcar pedido recogido no llegan más ofertas hasta entregar todos.`
              : 'Pulsa Conectarme para recibir pedidos nuevos.')}
        </div>
      )}
    </div>
  );
}
