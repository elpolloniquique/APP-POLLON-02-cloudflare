import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, Circle, Clock, MapPin, Navigation, Radio } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getOrderById,
  getOrderStatusHistory,
  subscribeOrderUpdates,
  getCustomerOrderLiveTracking,
} from '../../services/customerService';
import { ORDER_STATUS_LABELS } from '../../utils/constants';
import {
  STATUS_LINE_STEPS,
  LIVE_FLOW_STEPS,
  resolveTrackingMode,
  shouldShowLiveMap,
  wasAcceptedViaDriverApp,
  liveMapFallbackReason,
  TRACKING_MODE,
  isDriverGpsLive,
  gpsAgeSeconds,
} from '../../utils/orderTrackingMode';
import { money, formatDateTime } from '../../utils/format';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import { fetchOsrmRoute } from '../../utils/osrm';
import { LiveMap } from '../../components/delivery/LiveMap';
import { DELIVERY_COLORS } from '../../utils/liveMapColors';

function StatusTimeline({ steps, current }) {
  const idx = Math.max(0, steps.indexOf(current));
  let activeIdx = idx;
  if (activeIdx < 0) {
    if (current === 'pendiente') activeIdx = -1;
    else if (current === 'aceptado' && steps[0] === 'confirmado') activeIdx = 0;
    else if (current === 'confirmado') activeIdx = steps.indexOf('confirmado');
    else if (current === 'listo') activeIdx = steps.indexOf('en_delivery');
    else activeIdx = 0;
  }

  return (
    <div className="mt-8 space-y-0">
      {steps.map((step, i) => {
        const meta = ORDER_STATUS_LABELS[step];
        const reached = activeIdx >= i;
        const active = activeIdx === i;
        return (
          <div key={step} className="flex gap-4">
            <div className="flex flex-col items-center">
              {reached ? (
                <CheckCircle className={`h-8 w-8 ${active ? 'text-pollon-red' : 'text-green-500'}`} />
              ) : (
                <Circle className="h-8 w-8 text-gray-200" />
              )}
              {i < steps.length - 1 && (
                <div className={`w-0.5 flex-1 min-h-[40px] ${reached ? 'bg-pollon-red' : 'bg-gray-200'}`} />
              )}
            </div>
            <div className="pb-8 pt-1">
              <p className={`font-bold ${active ? 'text-pollon-red' : reached ? 'text-gray-800' : 'text-gray-400'}`}>
                {meta?.label || step}
              </p>
              {active && (
                <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" /> Actualización en tiempo real
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OrderTracking() {
  const { orderId } = useParams();
  const { profile } = useAuth();
  const [order, setOrder] = useState(null);
  const [history, setHistory] = useState([]);
  const [live, setLive] = useState(null);
  const [etaMin, setEtaMin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveError, setLiveError] = useState('');

  const refreshLive = async () => {
    if (!orderId) return;
    try {
      const data = await getCustomerOrderLiveTracking(orderId);
      setLive((prev) => {
        const nextLat = data?.driver?.lat;
        const nextLng = data?.driver?.lng;
        if (
          prev?.driver?.lat != null
          && prev?.driver?.lng != null
          && (nextLat == null || nextLng == null)
        ) {
          return {
            ...data,
            driver: {
              ...(data?.driver || {}),
              lat: prev.driver.lat,
              lng: prev.driver.lng,
              updated_at: data?.driver?.updated_at || prev.driver.updated_at,
            },
            has_driver: true,
          };
        }
        return data;
      });
      setLiveError('');
    } catch (e) {
      setLiveError(e?.message || 'No se pudo cargar el mapa en vivo');
    }
  };

  useEffect(() => {
    if (!orderId || !profile?.id) return undefined;

    async function load() {
      setLoading(true);
      try {
        if (isSupabaseConfigured() && !String(profile.id).startsWith('local-')) {
          const o = await getOrderById(orderId, profile.id);
          setOrder(o);
          const h = await getOrderStatusHistory(orderId);
          setHistory(h);
          await refreshLive();
        }
      } finally {
        setLoading(false);
      }
    }
    load();

    if (!isSupabaseConfigured() || String(profile.id).startsWith('local-')) return undefined;

    const unsub = subscribeOrderUpdates(orderId, async (updated) => {
      if (updated) setOrder(updated);
      const h = await getOrderStatusHistory(orderId);
      setHistory(h);
      await refreshLive();
    });

    const poll = setInterval(() => { void refreshLive(); }, 3000);
    return () => {
      unsub();
      clearInterval(poll);
    };
  }, [orderId, profile?.id]);

  const mode = resolveTrackingMode(order, live);
  const showMap = shouldShowLiveMap(order, live);
  const acceptedViaApp = wasAcceptedViaDriverApp(order, live);
  const fallbackMsg = liveMapFallbackReason(order, live);

  const mapModel = useMemo(() => {
    if (!showMap || !live) return null;
    const driver = live.driver || {};
    const store = live.store || {};
    const customer = live.customer || {};
    const phase = live.phase || 'to_store';
    const markers = [];
    const routes = [];

    if (store.lat != null && store.lng != null) {
      markers.push({
        id: 'store',
        lat: Number(store.lat),
        lng: Number(store.lng),
        kind: 'store',
        label: store.name || 'El Pollón',
      });
    }
    if (customer.lat != null && customer.lng != null) {
      markers.push({
        id: 'customer',
        lat: Number(customer.lat),
        lng: Number(customer.lng),
        kind: 'destination',
        color: DELIVERY_COLORS[0] || '#2563eb',
        label: 'Tu dirección',
      });
    }
    if (driver.lat != null && driver.lng != null) {
      markers.push({
        id: 'driver',
        lat: Number(driver.lat),
        lng: Number(driver.lng),
        kind: 'driver',
        color: '#c62828',
        label: 'Repartidor',
      });

      const to = phase === 'to_customer'
        ? { lat: Number(customer.lat), lng: Number(customer.lng) }
        : { lat: Number(store.lat), lng: Number(store.lng) };

      if (Number.isFinite(to.lat) && Number.isFinite(to.lng)) {
        routes.push({
          id: 'live-route',
          from: { lat: Number(driver.lat), lng: Number(driver.lng) },
          to,
          color: '#c62828',
        });
      }
    }

    const center = markers.find((m) => m.id === 'driver')
      || markers.find((m) => m.id === 'customer')
      || markers[0]
      || { lat: -20.23, lng: -70.15 };

    return { markers, routes, store: store.lat != null ? store : null, center, phase };
  }, [showMap, live]);

  useEffect(() => {
    let cancelled = false;
    async function calcEta() {
      if (!mapModel?.routes?.[0]) {
        setEtaMin(null);
        return;
      }
      const r = mapModel.routes[0];
      const route = await fetchOsrmRoute(r.from, r.to);
      if (!cancelled) {
        setEtaMin(route?.durationMin != null ? Math.max(1, Math.round(route.durationMin)) : null);
      }
    }
    void calcEta();
    return () => { cancelled = true; };
  }, [mapModel]);

  if (loading) return <div className="rounded-2xl bg-white p-8 text-center shadow-sm">Cargando seguimiento…</div>;
  if (!order) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p>Pedido no encontrado</p>
        <Link to="/cuenta/pedidos" className="mt-4 font-semibold text-pollon-red">← Mis pedidos</Link>
      </div>
    );
  }

  const current = order.estado || 'pendiente';
  const isCancelled = current === 'cancelado';
  const isDelivered = current === 'entregado';
  const timelineSteps = (acceptedViaApp || mode === TRACKING_MODE.LIVE_MAP)
    ? LIVE_FLOW_STEPS
    : STATUS_LINE_STEPS;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <Link to="/cuenta/pedidos" className="text-sm font-semibold text-pollon-red hover:underline">← Mis pedidos</Link>
      <h1 className="mt-4 font-display text-3xl text-pollon-black">Seguimiento del pedido</h1>
      <p className="text-sm text-gray-500">#{order.ticketNumber} · {formatDateTime(order.createdAt)}</p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className={`inline-flex rounded-full px-4 py-2 text-sm font-bold text-white ${ORDER_STATUS_LABELS[current]?.color || 'bg-gray-500'}`}>
          {ORDER_STATUS_LABELS[current]?.label || current}
        </div>
        {showMap && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-800">
            <Radio className="h-3 w-3" /> En vivo en mapa
          </span>
        )}
      </div>

      {showMap && mapModel && !isCancelled && !isDelivered && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
              <Navigation className="h-4 w-4 text-pollon-red" />
              {mapModel.phase === 'to_customer'
                ? 'Tu pedido va en camino'
                : 'El repartidor va a retirar tu pedido'}
            </div>
            {etaMin != null && (
              <div className="rounded-full bg-pollon-red px-3 py-1 text-xs font-extrabold text-white">
                Llega en ~{etaMin} min
              </div>
            )}
          </div>
          <div className="h-[280px] w-full sm:h-[360px]">
            <LiveMap
              className="h-full w-full"
              center={mapModel.center}
              zoom={15}
              markers={mapModel.markers}
              routes={mapModel.routes}
              store={mapModel.store}
              followId="driver"
              showLegend={false}
              autoFit
            />
          </div>
          {!isDriverGpsLive(live) && (
            <p className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-[11px] font-semibold text-amber-900">
              Última ubicación conocida
              {live?.driver?.updated_at
                ? ` (hace ${Math.max(1, Math.round(gpsAgeSeconds(live.driver.updated_at) / 60))} min)`
                : ''}
              . El pin se actualiza en cuanto el GPS del repartidor envíe un punto nuevo.
            </p>
          )}
          {live?.customer?.address && (
            <p className="flex items-start gap-2 border-t border-gray-100 px-4 py-3 text-xs text-gray-600">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {live.customer.address}
                {live.customer.reference?.trim() ? (
                  <span className="mt-1 block text-[11px] text-gray-500">
                    Ref: {live.customer.reference}
                  </span>
                ) : null}
              </span>
            </p>
          )}
        </div>
      )}

      {!showMap && !isCancelled && !isDelivered && fallbackMsg && (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          {fallbackMsg}
        </p>
      )}

      {liveError && (
        <p className="mt-3 text-xs font-semibold text-red-600">{liveError}</p>
      )}

      {!isCancelled && (
        <StatusTimeline steps={timelineSteps} current={current} />
      )}

      {isCancelled && <p className="mt-6 font-medium text-red-600">Este pedido fue cancelado.</p>}

      <div className="mt-8 rounded-xl bg-pollon-cream p-4">
        <p className="font-bold">Resumen</p>
        <p className="mt-1 text-sm text-gray-600">Total: {money(order.total)}</p>
        <ul className="mt-3 space-y-1 text-sm">
          {(order.items || []).map((it, i) => (
            <li key={i}>{it.qty}× {it.name}</li>
          ))}
        </ul>
      </div>

      {history.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-semibold">Historial</p>
          <ul className="mt-2 space-y-2">
            {history.map((h) => (
              <li key={h.id} className="flex justify-between text-xs text-gray-500">
                <span>{ORDER_STATUS_LABELS[h.status]?.label || h.status}</span>
                <span>{formatDateTime(h.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
