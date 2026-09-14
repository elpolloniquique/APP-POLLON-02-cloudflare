import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, Polyline, TileLayer, useMap, Pane } from 'react-leaflet';
import { Maximize2, Minimize2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '../../utils/geo';
import { resolveRoutePolyline } from '../../utils/liveRouteHelpers';
import { PICKUP_COLORS, DELIVERY_COLORS } from '../../utils/liveMapColors';

function makeDivIcon(kind, color, label) {
  if (kind === 'store') {
    return L.divIcon({
      className: '',
      html: `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:34px;height:34px;border-radius:10px;background:#2563eb;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;">🏠</div>
        <div style="margin-top:2px;padding:2px 6px;border-radius:6px;background:#1e3a8a;color:#fff;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.25);">${label || 'EL POLLON'}</div>
      </div>`,
      iconSize: [80, 52],
      iconAnchor: [40, 26],
      popupAnchor: [0, -20],
    });
  }

  if (kind === 'destination') {
    return L.divIcon({
      className: '',
      html: `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:30px;height:30px;border-radius:9999px;background:${color || '#2563eb'};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:14px;">📍</div>
        <div style="margin-top:2px;padding:2px 7px;border-radius:999px;background:#0f172a;color:#fff;font-size:10px;font-weight:700;white-space:nowrap;max-width:110px;overflow:hidden;text-overflow:ellipsis;">${label || 'Cliente'}</div>
      </div>`,
      iconSize: [100, 52],
      iconAnchor: [50, 22],
      popupAnchor: [0, -16],
    });
  }

  const nameHtml = label
    ? `<div style="margin-top:2px;padding:2px 7px;border-radius:999px;background:${color || '#c00000'};color:#fff;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.3);">${label}</div>`
    : '';

  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="width:28px;height:28px;border-radius:9999px;background:${color || '#c00000'};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:12px;">🛵</div>
      ${nameHtml}
    </div>`,
    iconSize: [90, 48],
    iconAnchor: [45, 20],
    popupAnchor: [0, -16],
  });
}

function FollowMarker({ followId, markers }) {
  const map = useMap();

  useEffect(() => {
    const target = markers.find((m) => m.id === followId);
    if (target?.lat != null && target?.lng != null) {
      map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 15), { duration: 0.7 });
    }
  }, [map, followId, markers]);

  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 80);
    return () => clearTimeout(t);
  }, [map]);

  useEffect(() => {
    const onDrawer = () => {
      setTimeout(() => map.invalidateSize({ animate: false }), 280);
    };
    window.addEventListener('ep-admin-drawer', onDrawer);
    return () => window.removeEventListener('ep-admin-drawer', onDrawer);
  }, [map]);

  return null;
}

/** Recalcula tiles al expandir / colapsar el contenedor. */
function MapSizeSync({ revision = 0 }) {
  const map = useMap();
  useEffect(() => {
    const run = () => {
      try {
        map.invalidateSize({ animate: false });
      } catch {
        /* ignore */
      }
    };
    run();
    const t1 = setTimeout(run, 60);
    const t2 = setTimeout(run, 280);
    const t3 = setTimeout(run, 520);
    window.addEventListener('resize', run);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', run);
    };
  }, [map, revision]);
  return null;
}

function FitRoutes({ routes, store, markers, enabled }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    const pts = [];
    for (const r of routes || []) {
      for (const p of r.positions || []) {
        if (Array.isArray(p) && p.length >= 2) pts.push(L.latLng(p[0], p[1]));
      }
    }
    for (const m of markers || []) {
      if (m.lat != null && m.lng != null) pts.push(L.latLng(m.lat, m.lng));
    }
    if (store?.lat != null && store?.lng != null) {
      pts.push(L.latLng(store.lat, store.lng));
    }
    if (pts.length >= 2) {
      map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 16, animate: true });
    } else if (pts.length === 1) {
      map.setView(pts[0], Math.max(map.getZoom(), 14));
    }
  }, [map, routes, store, markers, enabled]);
  return null;
}

function MapCenterSync({ center, lock }) {
  const map = useMap();
  useEffect(() => {
    if (lock) return;
    if (center?.lat != null && center?.lng != null) {
      map.setView([center.lat, center.lng], map.getZoom(), { animate: false });
    }
  }, [map, center?.lat, center?.lng, lock]);
  return null;
}

/**
 * markers: [{ id, lat, lng, label, color, kind: 'driver'|'destination'|'store' }]
 * routes: [{ id, from:{lat,lng}, to:{lat,lng}, color }]
 */
export function LiveMap({
  className = '',
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  markers = [],
  routes = [],
  store = null,
  followId = null,
  styleId = 'streets',
  onStyleChange,
  showLegend = true,
  autoFit = true,
  expanded = false,
  onToggleExpand,
  sizeRevision = 0,
}) {
  const [mapError, setMapError] = useState('');
  const [resolvedRoutes, setResolvedRoutes] = useState([]);
  const [fitLock, setFitLock] = useState(false);

  const tileUrl = styleId === 'satellite'
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const attribution = styleId === 'satellite'
    ? '&copy; Esri'
    : '&copy; OpenStreetMap contributors';

  const routeKey = useMemo(
    () => routes.map((r) => `${r.id}:${r.from?.lat},${r.from?.lng}->${r.to?.lat},${r.to?.lng}`).join('|'),
    [routes]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = [];
      for (const route of routes) {
        if (!route?.from || !route?.to) continue;
        const result = await resolveRoutePolyline(route.from, route.to);
        if (cancelled) return;
        if (result?.positions?.length) {
          next.push({
            id: route.id,
            color: route.color || '#c00000',
            positions: result.positions,
            dashed: result.mode === 'straight',
          });
        }
      }
      if (!cancelled) {
        setResolvedRoutes(next);
        setFitLock(false);
      }
    })().catch(() => {
      if (!cancelled) setResolvedRoutes([]);
    });
    return () => { cancelled = true; };
  }, [routeKey, routes]);

  const markerNodes = useMemo(
    () => markers.filter((m) => m.lat != null && m.lng != null),
    [markers]
  );

  return (
    <div className={`relative z-0 isolate overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 ${expanded ? 'rounded-none border-0' : ''} ${className}`}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom
        className={`relative z-0 h-full w-full ${expanded ? 'min-h-0' : 'min-h-[420px]'}`}
      >
        <TileLayer
          key={`${styleId}-${tileUrl}`}
          url={tileUrl}
          attribution={attribution}
          eventHandlers={{
            loading: () => setMapError(''),
            tileerror: () => setMapError('No se pudieron cargar algunos tiles del mapa'),
          }}
        />

        {store?.lat != null && store?.lng != null && (
          <Marker
            position={[store.lat, store.lng]}
            icon={makeDivIcon('store', '#2563eb', store.label || 'EL POLLON')}
          >
            <Popup>{store.label || 'Sucursal'}</Popup>
          </Marker>
        )}

        <Pane name="routesPane" style={{ zIndex: 450 }}>
          {resolvedRoutes.map((route) => (
            <Polyline
              key={route.id}
              positions={route.positions}
              pathOptions={{
                color: route.color,
                weight: 6,
                opacity: 0.92,
                dashArray: route.dashed ? '8 10' : null,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          ))}
        </Pane>

        {markerNodes.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={makeDivIcon(m.kind, m.color, m.label)}>
            {m.label ? <Popup>{m.label}{m.subtitle ? ` — ${m.subtitle}` : ''}</Popup> : null}
          </Marker>
        ))}

        <FollowMarker followId={followId} markers={markerNodes} />
        <MapSizeSync revision={`${expanded ? 1 : 0}-${sizeRevision}`} />
        <MapCenterSync center={center} lock={fitLock || Boolean(followId) || (autoFit && resolvedRoutes.length > 0)} />
        <FitRoutes
          routes={resolvedRoutes}
          store={store}
          markers={markerNodes}
          enabled={autoFit && !followId && resolvedRoutes.length > 0}
        />
      </MapContainer>

      {mapError && (
        <div className="absolute inset-x-3 bottom-3 z-10 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow">
          Problema cargando tiles. Prueba Calles / Satelite.
        </div>
      )}

      <div className="absolute left-3 top-3 z-10 flex items-center gap-1">
        {typeof onStyleChange === 'function' && (
          <div className="flex gap-1 rounded-xl bg-white/95 p-1 shadow-md ring-1 ring-black/5">
            {['streets', 'satellite'].map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onStyleChange?.(id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  styleId === id ? 'bg-pollon-red text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {id === 'streets' ? 'Calles' : 'Satelite'}
              </button>
            ))}
          </div>
        )}
      </div>

      {typeof onToggleExpand === 'function' && (
        <button
          type="button"
          onClick={onToggleExpand}
          className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 text-gray-800 shadow-md ring-1 ring-black/5 transition hover:bg-white hover:text-pollon-red"
          title={expanded ? 'Salir de pantalla completa' : 'Pantalla completa'}
          aria-label={expanded ? 'Salir de pantalla completa' : 'Pantalla completa'}
          aria-pressed={expanded}
        >
          {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      )}

      {showLegend && (
        <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-2 sm:flex-row">
          <div className="rounded-xl bg-white/95 px-3 py-2 shadow text-[11px]">
            <p className="mb-1 font-bold uppercase tracking-wide text-gray-500">Hacia sucursal</p>
            <div className="flex gap-2">
              {PICKUP_COLORS.map((c) => (
                <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-white/95 px-3 py-2 shadow text-[11px]">
            <p className="mb-1 font-bold uppercase tracking-wide text-gray-500">Hacia cliente</p>
            <div className="flex gap-2">
              {DELIVERY_COLORS.map((c) => (
                <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />
              ))}
            </div>
            <p className="mt-1 text-[10px] text-gray-400">🛵 repartidor · 📍 destino</p>
          </div>
        </div>
      )}
    </div>
  );
}
