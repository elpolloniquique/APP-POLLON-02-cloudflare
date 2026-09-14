import { useEffect, useMemo, useState, useCallback } from 'react';
import { Bike, ChevronLeft } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminBranchFilter } from '../../components/admin/AdminBranchFilter';
import { useAdminBranchFilter } from '../../hooks/useAdminBranchFilter';
import { LiveMap } from '../../components/delivery/LiveMap';
import { LiveDriverSidebar } from '../../components/delivery/LiveDriverSidebar';
import { LiveVoiceAlertToggle } from '../../components/delivery/LiveVoiceAlertToggle';
import {
  listLiveLocations,
  listLiveAssignments,
  getDriverActiveOrdersDetail,
  getDispatchSettings,
} from '../../services/trackingService';
import { subscribeDispatch } from '../../services/dispatchService';
import { fetchOsrmRoute } from '../../utils/osrm';
import {
  colorForDriver,
  isPickupPhase,
  isDeliveryPhase,
  shortBranchLabel,
} from '../../utils/liveMapColors';
import {
  isValidLatLng,
  toLatLng,
  resolveCustomerDestination,
} from '../../utils/liveRouteHelpers';
import { Loader } from '../../components/ui/Loader';
import { adminListAllBranches } from '../../services/branchService';
import { useLiveVoiceAlerts } from '../../hooks/useLiveVoiceAlerts';
import {
  loadVoiceAlertEnabled,
  saveVoiceAlertEnabled,
  unlockSpeech,
  stopVoiceAlerts,
} from '../../utils/liveVoiceAlert';
import '../../styles/live-map-stage.css';

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('es-CL', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  } catch {
    return '—';
  }
}

function deliveryJobOf(group) {
  return group.assignments.find((a) => a.phase === 'to_customer')?.ep_delivery_jobs
    || group.assignments[0]?.ep_delivery_jobs
    || null;
}

export function AdminLiveMap() {
  const {
    selectedBranchId,
    setSelectedBranchId,
    branches: filterBranches,
    showBranchFilter,
    branchId: staffBranchId,
    isSuperAdmin,
  } = useAdminBranchFilter();
  const filterBranch = isSuperAdmin ? selectedBranchId || null : staffBranchId;

  const [allBranches, setAllBranches] = useState([]);
  const [locations, setLocations] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [styleId, setStyleId] = useState('streets');
  const [followId, setFollowId] = useState(null);
  const [error, setError] = useState('');
  const [etas, setEtas] = useState({});
  const [viewDriverId, setViewDriverId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [voiceAlertOn, setVoiceAlertOn] = useState(() => loadVoiceAlertEnabled());
  const [arrivalRadiusM, setArrivalRadiusM] = useState(80);
  const [voiceEtaMin, setVoiceEtaMin] = useState(5);
  const [voiceSpeech, setVoiceSpeech] = useState({ volume: 100, rate: 1, pitch: 1.25 });
  /** Destinos cliente resueltos (coords job o geocode) por driverId */
  const [destByDriver, setDestByDriver] = useState({});
  const [mapExpanded, setMapExpanded] = useState(false);
  const [expandedSideOpen, setExpandedSideOpen] = useState(false);
  const [mapSizeTick, setMapSizeTick] = useState(0);

  const setVoiceEnabled = (on) => {
    if (on) unlockSpeech();
    else stopVoiceAlerts();
    setVoiceAlertOn(on);
    saveVoiceAlertEnabled(on);
  };

  // Chrome/Safari: la voz requiere un gesto del usuario al menos una vez
  useEffect(() => {
    if (!voiceAlertOn) return undefined;
    const unlock = () => unlockSpeech();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.speechSynthesis?.getVoices?.();
    return () => window.removeEventListener('pointerdown', unlock);
  }, [voiceAlertOn]);

  useEffect(() => {
    adminListAllBranches()
      .then(setAllBranches)
      .catch(() => setAllBranches(filterBranches || []));
  }, [filterBranches]);

  // Config despacho de la sucursal activa → voz + radio llegada
  useEffect(() => {
    const branchId = filterBranch || null;
    if (!branchId) return undefined;
    let cancelled = false;
    getDispatchSettings(branchId)
      .then((s) => {
        if (cancelled) return;
        setArrivalRadiusM(s.arrival_radius_m || 80);
        setVoiceEtaMin(s.voice_eta_minutes || 5);
        setVoiceSpeech({
          volume: s.voice_volume ?? 100,
          rate: s.voice_rate ?? 1,
          pitch: s.voice_pitch ?? 1.25,
        });
        try {
          if (localStorage.getItem('ep_live_voice_alert_on') == null) {
            setVoiceAlertOn(!!s.voice_alerts);
          }
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [filterBranch]);

  const branches = allBranches.length ? allBranches : (filterBranches || []);

  const load = useCallback(async () => {
    try {
      const [locs, asgs] = await Promise.all([
        listLiveLocations(),
        listLiveAssignments(filterBranch),
      ]);
      setLocations(locs);
      setAssignments(asgs);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterBranch]);

  useEffect(() => {
    let cancelled = false;
    let debounceTimer = null;
    const safeLoad = () => {
      if (cancelled) return;
      load();
    };
    const debouncedLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(safeLoad, 400);
    };
    safeLoad();
    const unsub = subscribeDispatch(() => debouncedLoad());
    const t = setInterval(safeLoad, 8000);
    return () => {
      cancelled = true;
      unsub();
      clearInterval(t);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [load]);

  const activeBranch = useMemo(() => {
    if (filterBranch) return branches.find((b) => b.id === filterBranch) || null;
    // Prefer Iquique / first with coords
    const withGps = branches.find((b) => b.lat != null && b.lng != null);
    return withGps || branches[0] || null;
  }, [branches, filterBranch]);

  const store = useMemo(() => {
    if (activeBranch?.lat == null || activeBranch?.lng == null) {
      // fallback Vivar 1086 Iquique approx from known seed
      return {
        lat: -20.218584,
        lng: -70.148756,
        label: shortBranchLabel(activeBranch?.name) || 'EL POLLON',
      };
    }
    return {
      lat: Number(activeBranch.lat),
      lng: Number(activeBranch.lng),
      label: shortBranchLabel(activeBranch.name),
    };
  }, [activeBranch]);

  /** Agrupa asignaciones por driver con fase dominante */
  const driverGroups = useMemo(() => {
    const map = new Map();
    for (const a of assignments) {
      const did = a.driver_id;
      if (!did) continue;
      if (!map.has(did)) {
        map.set(did, {
          driverId: did,
          assignments: [],
          driver: a.ep_driver_profiles,
          phases: [],
        });
      }
      const g = map.get(did);
      g.assignments.push(a);
      g.phases.push(a.phase);
    }

    return [...map.values()].map((g) => {
      const hasDelivery = g.phases.some(isDeliveryPhase);
      const phase = hasDelivery ? 'to_customer' : (g.phases.find(isPickupPhase) || g.phases[0] || 'to_store');
      const color = colorForDriver(g.driverId, phase);
      const loc = locations.find((l) => l.driver_id === g.driverId);
      const name =
        g.driver?.profiles?.full_name
        || loc?.driver?.profiles?.full_name
        || 'Repartidor';
      const acceptedAt = g.assignments
        .map((a) => a.accepted_at)
        .filter(Boolean)
        .sort()[0];
      return {
        ...g,
        phase,
        color,
        name,
        lat: loc?.lat != null ? Number(loc.lat) : null,
        lng: loc?.lng != null ? Number(loc.lng) : null,
        hasGps: isValidLatLng(loc?.lat, loc?.lng),
        updatedAt: loc?.updated_at || acceptedAt,
        acceptedAt,
      };
    });
  }, [assignments, locations]);

  // Resolver destinos cliente (coords o geocode dirección) para rutas en vivo
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = { ...destByDriver };
      let changed = false;
      const toResolve = [];

      for (const d of driverGroups) {
        if (!isDeliveryPhase(d.phase)) continue;
        const job = deliveryJobOf(d);
        if (!job) continue;
        const key = d.driverId;
        const existing = next[key];
        const jobCoords = toLatLng(job.customer_lat, job.customer_lng);
        if (jobCoords) {
          const label = job.customer_name || 'Cliente';
          if (!existing || existing.lat !== jobCoords.lat || existing.lng !== jobCoords.lng) {
            next[key] = { ...jobCoords, label, source: 'job' };
            changed = true;
          }
          continue;
        }
        if (existing?.source === 'geocode') continue;
        toResolve.push({ key, job });
      }

      if (toResolve.length) {
        const resolved = await Promise.all(
          toResolve.map(async ({ key, job }) => {
            const dest = await resolveCustomerDestination(job);
            return { key, dest };
          }),
        );
        if (cancelled) return;
        for (const { key, dest } of resolved) {
          if (dest) {
            next[key] = dest;
            changed = true;
          }
        }
      }

      const liveIds = new Set(driverGroups.filter((d) => isDeliveryPhase(d.phase)).map((d) => d.driverId));
      for (const id of Object.keys(next)) {
        if (!liveIds.has(id)) {
          delete next[id];
          changed = true;
        }
      }
      if (!cancelled && changed) setDestByDriver(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverGroups]);

  const pickupDrivers = useMemo(
    () => driverGroups.filter((d) => isPickupPhase(d.phase)),
    [driverGroups]
  );
  const deliveryDrivers = useMemo(
    () => driverGroups.filter((d) => isDeliveryPhase(d.phase)),
    [driverGroups]
  );

  useLiveVoiceAlerts({
    enabled: voiceAlertOn,
    pickupDrivers,
    etas,
    store,
    arrivalRadiusM,
    etaAlertMin: voiceEtaMin,
    speech: voiceSpeech,
  });

  // ETA via OSRM (async, en paralelo)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const jobs = driverGroups
        .filter((d) => d.hasGps)
        .map((d) => {
          const to = isPickupPhase(d.phase)
            ? store
            : (destByDriver[d.driverId] || null);
          if (!to || !isValidLatLng(to.lat, to.lng)) return null;
          return { id: d.driverId, from: { lat: d.lat, lng: d.lng }, to };
        })
        .filter(Boolean);

      const results = await Promise.all(
        jobs.map(async (j) => {
          const route = await fetchOsrmRoute(j.from, j.to);
          return { id: j.id, min: route?.durationMin };
        }),
      );
      if (cancelled) return;
      const next = {};
      for (const r of results) {
        if (r.min != null) next[r.id] = Math.max(1, Math.round(r.min));
      }
      setEtas(next);
    })();
    return () => { cancelled = true; };
  }, [driverGroups, store, destByDriver]);

  const sidebarPickup = pickupDrivers.map((d) => ({
    driverId: d.driverId,
    name: d.name,
    color: d.color,
    phaseLabel: 'Hacia sucursal',
    updatedLabel: formatTime(d.updatedAt || d.acceptedAt),
    etaLabel: etas[d.driverId] != null ? `${etas[d.driverId]} min estimado` : null,
    gpsOk: d.hasGps,
    routeOk: d.hasGps,
  }));

  const sidebarDelivery = deliveryDrivers.map((d) => ({
    driverId: d.driverId,
    name: d.name,
    color: d.color,
    phaseLabel: 'Hacia cliente',
    updatedLabel: formatTime(d.updatedAt || d.acceptedAt),
    etaLabel: etas[d.driverId] != null ? `${etas[d.driverId]} min estimado` : null,
    gpsOk: d.hasGps,
    routeOk: d.hasGps && Boolean(destByDriver[d.driverId]),
  }));

  const markers = useMemo(() => {
    const list = [];
    for (const d of driverGroups) {
      if (d.hasGps) {
        list.push({
          id: `drv-${d.driverId}`,
          lat: d.lat,
          lng: d.lng,
          label: (d.name || 'Repartidor').split(' ')[0],
          color: d.color,
          kind: 'driver',
        });
      }
      if (isDeliveryPhase(d.phase) && destByDriver[d.driverId]) {
        const dest = destByDriver[d.driverId];
        list.push({
          id: `dst-${d.driverId}`,
          lat: dest.lat,
          lng: dest.lng,
          label: (dest.label || 'Cliente').split(' ')[0],
          color: d.color,
          kind: 'destination',
          subtitle: 'Destino entrega',
        });
      }
    }
    return list;
  }, [driverGroups, destByDriver]);

  const routes = useMemo(() => {
    return driverGroups
      .filter((d) => d.hasGps)
      .map((d) => {
        if (isPickupPhase(d.phase)) {
          return {
            id: `r-${d.driverId}`,
            from: { lat: d.lat, lng: d.lng },
            to: { lat: store.lat, lng: store.lng },
            color: d.color,
          };
        }
        const dest = destByDriver[d.driverId];
        if (!dest || !isValidLatLng(dest.lat, dest.lng)) return null;
        return {
          id: `r-${d.driverId}`,
          from: { lat: d.lat, lng: d.lng },
          to: { lat: dest.lat, lng: dest.lng },
          color: d.color,
        };
      })
      .filter(Boolean);
  }, [driverGroups, store, destByDriver]);

  const center = useMemo(() => {
    const withGps = driverGroups.find((d) => d.hasGps);
    if (withGps) return { lat: withGps.lat, lng: withGps.lng };
    const dest = Object.values(destByDriver)[0];
    if (dest) return { lat: dest.lat, lng: dest.lng };
    return { lat: store.lat, lng: store.lng };
  }, [driverGroups, destByDriver, store]);

  const loadDetail = async (driverId) => {
    setViewDriverId(driverId);
    setFollowId(`drv-${driverId}`);
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await getDriverActiveOrdersDetail(driverId);
      setDetail(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetail = async (item) => {
    // Mismo repartidor abierto → cerrar; otro → abrir (cierra el anterior)
    if (viewDriverId === item.driverId) {
      setViewDriverId(null);
      setDetail(null);
      return;
    }
    await loadDetail(item.driverId);
  };

  const closeDetail = () => {
    setViewDriverId(null);
    setDetail(null);
  };

  const exitMapExpanded = useCallback(() => {
    setMapExpanded(false);
    setExpandedSideOpen(false);
    setMapSizeTick((n) => n + 1);
  }, []);

  const enterMapExpanded = useCallback(() => {
    setMapExpanded(true);
    setExpandedSideOpen(false);
    setMapSizeTick((n) => n + 1);
  }, []);

  const toggleMapExpanded = useCallback(() => {
    if (mapExpanded) exitMapExpanded();
    else enterMapExpanded();
  }, [mapExpanded, enterMapExpanded, exitMapExpanded]);

  // Esc + bloquear scroll del body en pantalla completa
  useEffect(() => {
    if (!mapExpanded) return undefined;
    document.body.classList.add('live-map-expanded');
    const onKey = (e) => {
      if (e.key === 'Escape') exitMapExpanded();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('live-map-expanded');
      window.removeEventListener('keydown', onKey);
    };
  }, [mapExpanded, exitMapExpanded]);

  const activeDriverCount = sidebarPickup.length + sidebarDelivery.length;

  const sidebarProps = {
    pickupDrivers: sidebarPickup,
    deliveryDrivers: sidebarDelivery,
    selectedDriverId: viewDriverId,
    openDriverId: viewDriverId,
    detail,
    detailLoading,
    onSelect: (id) => setFollowId(`drv-${id}`),
    onView: openDetail,
    onCloseDetail: closeDetail,
    canMarkPickup: true,
    onPickupDone: () => {
      load();
      if (viewDriverId) loadDetail(viewDriverId);
    },
  };

  return (
    <div className={`admin-page flex h-[calc(100dvh-3.5rem)] flex-col ${mapExpanded ? 'live-map-page--expanded' : ''}`}>
      {!mapExpanded && (
        <AdminPageHeader
          title="En vivo"
          subtitle="GPS repartidores · seguimiento hacia sucursal y hacia cliente"
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              <LiveVoiceAlertToggle enabled={voiceAlertOn} onChange={setVoiceEnabled} />
              {showBranchFilter ? (
                <AdminBranchFilter
                  value={selectedBranchId || activeBranch?.id || ''}
                  onChange={setSelectedBranchId}
                  branches={branches}
                />
              ) : null}
            </div>
          )}
        />
      )}

      {error && !mapExpanded && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className={`live-map-stage ${mapExpanded ? 'is-expanded' : ''}`}>
        <div className="live-map-stage__map">
          {loading ? (
            <Loader text="Cargando mapa…" />
          ) : (
            <LiveMap
              className="h-full min-h-[420px]"
              center={center}
              markers={markers}
              routes={routes}
              store={store}
              styleId={styleId}
              onStyleChange={setStyleId}
              followId={followId}
              showLegend
              autoFit
              expanded={mapExpanded}
              onToggleExpand={toggleMapExpanded}
              sizeRevision={mapSizeTick}
            />
          )}
        </div>

        <div className={`live-map-stage__side ${mapExpanded && expandedSideOpen ? 'is-open' : ''}`}>
          {mapExpanded && !expandedSideOpen ? (
            <div className="live-map-stage__rail" role="toolbar" aria-label="Panel repartidores">
              <button
                type="button"
                className="live-map-stage__rail-btn"
                title="Mostrar repartidores"
                aria-label="Mostrar panel de repartidores"
                onClick={() => {
                  setExpandedSideOpen(true);
                  setMapSizeTick((n) => n + 1);
                }}
              >
                <Bike className="h-4 w-4" />
                {activeDriverCount > 0 && (
                  <span className="live-map-stage__rail-badge">{activeDriverCount}</span>
                )}
              </button>
            </div>
          ) : mapExpanded && expandedSideOpen ? (
            <div className="live-map-stage__side-panel">
              <div className="live-map-stage__side-toolbar">
                <p>Repartidores</p>
                <button
                  type="button"
                  title="Ocultar panel"
                  aria-label="Ocultar panel de repartidores"
                  onClick={() => {
                    setExpandedSideOpen(false);
                    setMapSizeTick((n) => n + 1);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
              <LiveDriverSidebar {...sidebarProps} />
            </div>
          ) : (
            <LiveDriverSidebar {...sidebarProps} />
          )}
        </div>
      </div>
    </div>
  );
}
