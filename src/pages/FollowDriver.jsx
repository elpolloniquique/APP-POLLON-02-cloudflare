import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bike, MapPin, Navigation, Radio } from 'lucide-react';
import { LiveMap } from '../components/delivery/LiveMap';
import { DEFAULT_MAP_CENTER } from '../utils/geo';
import { isDriverGpsLive, gpsAgeSeconds } from '../utils/orderTrackingMode';

function phaseLabel(phase) {
  if (phase === 'to_customer') return 'Hacia el cliente';
  return 'Hacia la sucursal';
}

export function FollowDriver() {
  const { token } = useParams();
  const [live, setLive] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/driver-live?t=${encodeURIComponent(token || '')}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!data?.active || data.lat == null) {
          setLive(null);
          setError(data.error === 'kv_unbound'
            ? 'El seguimiento aún no está activo en el servidor.'
            : 'Este enlace ya no está activo. El pedido se entregó o el repartidor cerró la ruta.');
        } else {
          setLive(data);
          setError('');
        }
      } catch {
        if (!cancelled) setError('No se pudo cargar el seguimiento.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 8_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [token]);

  const mapModel = useMemo(() => {
    if (!live) return null;
    const markers = [];
    const routes = [];
    if (live.store?.lat != null && live.store?.lng != null) {
      markers.push({
        id: 'store',
        lat: Number(live.store.lat),
        lng: Number(live.store.lng),
        kind: 'store',
        label: live.store.name || 'El Pollón',
      });
    }
    if (live.customer?.lat != null && live.customer?.lng != null) {
      markers.push({
        id: 'customer',
        lat: Number(live.customer.lat),
        lng: Number(live.customer.lng),
        kind: 'destination',
        label: 'Cliente',
      });
    }
    markers.push({
      id: 'driver',
      lat: Number(live.lat),
      lng: Number(live.lng),
      kind: 'driver',
      color: '#c00000',
      label: live.driver_name || 'Repartidor',
    });
    const dest = live.phase === 'to_customer'
      ? { lat: live.customer?.lat, lng: live.customer?.lng }
      : { lat: live.store?.lat, lng: live.store?.lng };
    if (dest.lat != null && dest.lng != null) {
      routes.push({
        id: 'live',
        from: { lat: Number(live.lat), lng: Number(live.lng) },
        to: { lat: Number(dest.lat), lng: Number(dest.lng) },
        color: '#c00000',
      });
    }
    if (Array.isArray(live.trail) && live.trail.length >= 2) {
      routes.push({
        id: 'trail',
        positions: live.trail.map((p) => [p.lat, p.lng]),
        color: '#c00000',
        dashed: true,
      });
    }
    return {
      markers,
      routes,
      store: live.store?.lat != null ? live.store : null,
      center: { lat: Number(live.lat), lng: Number(live.lng) },
    };
  }, [live]);

  return (
    <div className="min-h-[100dvh] bg-[#f4f4f4]">
      <header className="border-b border-black/10 bg-black px-4 py-3 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <img src="/img/logo pollon.png" alt="" className="h-10 w-10 rounded-full border border-white/20 bg-white object-contain" />
          <div>
            <p className="font-display text-lg leading-none tracking-wide">EL POLLÓN</p>
            <p className="mt-0.5 text-[11px] font-semibold text-white/60">Seguimiento del repartidor</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 p-4">
        {loading && (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-gray-500">Cargando ruta en vivo…</p>
        )}

        {!loading && error && !live && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <Bike className="mx-auto h-8 w-8 text-amber-700" />
            <p className="mt-3 text-sm font-semibold text-amber-950">{error}</p>
            <Link to="/" className="mt-4 inline-block text-sm font-bold text-pollon-red">Ir a El Pollón</Link>
          </div>
        )}

        {live && mapModel && (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                <Navigation className="h-4 w-4 text-pollon-red" />
                {phaseLabel(live.phase)}
                {live.ticket_code ? ` · #${live.ticket_code}` : ''}
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-800">
                <Radio className="h-3 w-3" />
                {isDriverGpsLive({ driver: { lat: live.lat, lng: live.lng, updated_at: live.updated_at } })
                  ? 'En vivo'
                  : 'Última posición'}
              </span>
            </div>
            <div className="h-[420px] w-full sm:h-[520px]">
              <LiveMap
                className="h-full w-full rounded-none border-0"
                center={mapModel.center || DEFAULT_MAP_CENTER}
                zoom={15}
                markers={mapModel.markers}
                routes={mapModel.routes}
                store={mapModel.store}
                followId="driver"
                showLegend={false}
                autoFit
              />
            </div>
            <div className="space-y-1 border-t border-gray-100 px-4 py-3 text-xs text-gray-600">
              <p className="font-semibold text-gray-800">{live.driver_name || 'Repartidor'}</p>
              {live.customer?.address && (
                <p className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {live.customer.address}
                </p>
              )}
              {live.updated_at && (
                <p className="text-[11px] text-gray-400">
                  Actualizado hace {Math.max(1, Math.round((gpsAgeSeconds(live.updated_at) || 0)))} s
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
