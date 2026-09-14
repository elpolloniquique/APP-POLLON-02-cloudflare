import { getSupabase, isSupabaseConfigured } from './supabaseClient';

/** Mínimo entre publicaciones GPS. El mapa ya refresca cada 8–10 s. */
export const GPS_PUBLISH_INTERVAL_MS = 8000;

const DEMO_LOCATIONS = [
  {
    driver_id: 'demo-drv-1',
    lat: -20.232,
    lng: -70.15,
    heading: 45,
    speed: 18,
    updated_at: new Date().toISOString(),
    driver: { vehicle_plate: 'AB-12-34', profiles: { full_name: 'Carlos Repartidor' } },
  },
];

async function loadDriverCards(driverIds) {
  const ids = [...new Set((driverIds || []).filter(Boolean))];
  if (!ids.length) return {};
  const sb = getSupabase();
  const { data: drivers, error } = await sb
    .from('ep_driver_profiles')
    .select('id, vehicle_plate, operational_status, profile_id')
    .in('id', ids);
  if (error) throw new Error(error.message || 'Error perfiles GPS');

  const profileIds = [...new Set((drivers || []).map((d) => d.profile_id).filter(Boolean))];
  let profilesById = {};
  if (profileIds.length) {
    const { data: profiles, error: pErr } = await sb
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', profileIds);
    if (pErr) throw new Error(pErr.message || 'Error profiles GPS');
    profilesById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  }

  return Object.fromEntries(
    (drivers || []).map((d) => [
      d.id,
      {
        id: d.id,
        vehicle_plate: d.vehicle_plate,
        operational_status: d.operational_status,
        profiles: profilesById[d.profile_id] || null,
      },
    ])
  );
}

export async function upsertMyLocation({ lat, lng, heading, speed, accuracy }) {
  if (!isSupabaseConfigured()) return { ok: true };
  const sb = getSupabase();
  const { data, error } = await sb.rpc('ep_upsert_driver_location', {
    p_lat: lat,
    p_lng: lng,
    p_heading: heading ?? null,
    p_speed: speed ?? null,
    p_accuracy: accuracy ?? null,
  });
  if (error) {
    const msg = error.message || '';
    if (msg.includes('telefono')) {
      throw new Error('Ejecuta fix-delivery-production-ready.sql en Supabase');
    }
    throw new Error(msg || 'No se pudo publicar GPS');
  }
  return data;
}

export async function listLiveLocations() {
  if (!isSupabaseConfigured()) return DEMO_LOCATIONS;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('ep_driver_location_latest')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message || 'Error GPS en vivo');

  const byDriver = await loadDriverCards((data || []).map((r) => r.driver_id));
  return (data || []).map((row) => ({
    ...row,
    ep_driver_profiles: byDriver[row.driver_id] || null,
    driver: byDriver[row.driver_id] || null,
  }));
}

export async function listLiveAssignments(branchId = null) {
  if (!isSupabaseConfigured()) {
    return [
      {
        id: 'demo-asg-1',
        status: 'active',
        phase: 'to_customer',
        driver_id: 'demo-drv-1',
        ep_delivery_jobs: {
          ticket_code: '0043',
          customer_name: 'Pedro Soto',
          customer_address: 'Calle Baquedano 500',
          customer_lat: -20.228,
          customer_lng: -70.148,
          branch_id: branchId,
        },
      },
    ];
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from('ep_delivery_assignments')
    .select('*, ep_delivery_jobs(*)')
    .eq('status', 'active')
    .order('accepted_at', { ascending: false });
  if (error) throw new Error(error.message || 'Error asignaciones en vivo');

  let rows = data || [];
  if (branchId) {
    rows = rows.filter((r) => !r.ep_delivery_jobs?.branch_id || r.ep_delivery_jobs.branch_id === branchId);
  }

  const byDriver = await loadDriverCards(rows.map((r) => r.driver_id));

  // Completar customer_lat/lng desde pedidos si el job no las tiene
  const needCoords = rows.filter(
    (r) => r.ep_delivery_jobs
      && (r.ep_delivery_jobs.customer_lat == null || r.ep_delivery_jobs.customer_lng == null)
      && r.ep_delivery_jobs.source_order_id
  );
  if (needCoords.length) {
    const orderIds = [...new Set(needCoords.map((r) => String(r.ep_delivery_jobs.source_order_id)))];
    const { data: pedidos } = await sb
      .from('pedidos')
      .select('id, cliente_lat, cliente_lng, cliente_direccion')
      .in('id', orderIds);
    const byOrder = Object.fromEntries((pedidos || []).map((p) => [String(p.id), p]));
    for (const r of rows) {
      const j = r.ep_delivery_jobs;
      if (!j || (j.customer_lat != null && j.customer_lng != null)) continue;
      const p = byOrder[String(j.source_order_id)];
      if (!p) continue;
      if (p.cliente_lat != null && p.cliente_lng != null) {
        j.customer_lat = Number(p.cliente_lat);
        j.customer_lng = Number(p.cliente_lng);
      }
    }
  }

  return rows.map((r) => ({
    ...r,
    ep_driver_profiles: byDriver[r.driver_id] || null,
  }));
}

/** Detalle de pedidos activos de un repartidor (para modal VER) */
export async function getDriverActiveOrdersDetail(driverId) {
  if (!isSupabaseConfigured() || !driverId) return { driver: null, orders: [], grandTotal: 0 };
  const sb = getSupabase();

  const { data: assignments, error } = await sb
    .from('ep_delivery_assignments')
    .select('*, ep_delivery_jobs(*)')
    .eq('driver_id', driverId)
    .eq('status', 'active')
    .order('accepted_at', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = assignments || [];
  const byDriver = await loadDriverCards([driverId]);
  const driver = byDriver[driverId] || null;

  const orderIds = rows
    .map((a) => a.ep_delivery_jobs?.source_order_id)
    .filter(Boolean);

  let itemsByOrder = {};
  if (orderIds.length) {
    const { data: details } = await sb
      .from('detalle_pedidos')
      .select('pedido_id, nombre_producto, cantidad, precio_unitario, subtotal')
      .in('pedido_id', orderIds);
    for (const d of details || []) {
      if (!itemsByOrder[d.pedido_id]) itemsByOrder[d.pedido_id] = [];
      itemsByOrder[d.pedido_id].push({
        name: d.nombre_producto,
        qty: d.cantidad,
        unitPrice: d.precio_unitario,
        subtotal: d.subtotal,
      });
    }
  }

  const orders = rows.map((a, idx) => {
    const job = a.ep_delivery_jobs || {};
    const oid = job.source_order_id;
    const items = itemsByOrder[oid] || [];
    const itemsTotal = items.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
    const total = itemsTotal || Number(job.order_total) || 0;
    return {
      assignmentId: a.id,
      phase: a.phase,
      acceptedAt: a.accepted_at,
      index: idx + 1,
      ticket: job.ticket_code,
      customerName: job.customer_name,
      customerAddress: job.customer_address,
      customerLat: job.customer_lat,
      customerLng: job.customer_lng,
      deliveryFee: job.delivery_fee || 0,
      orderTotal: total,
      items,
      sourceOrderId: oid,
      jobId: job.id,
    };
  });

  const grandTotal = orders.reduce((s, o) => s + (o.orderTotal || 0) + (o.deliveryFee || 0), 0);
  return { driver, orders, grandTotal };
}

export async function getDispatchReport(branchId = null, from = null, to = null) {
  if (!isSupabaseConfigured()) {
    return {
      delivered: 48,
      cancelled: 2,
      active: 3,
      total_fees: 120000,
      avg_delivery_minutes: 28.5,
    };
  }
  const sb = getSupabase();
  const { data, error } = await sb.rpc('ep_dispatch_report', {
    p_branch_id: branchId,
    p_from: from || new Date(Date.now() - 7 * 86400000).toISOString(),
    p_to: to || new Date().toISOString(),
  });
  if (error) throw new Error(error.message || 'Error reporte');
  return data;
}

export const DISPATCH_SETTINGS_DEFAULTS = {
  enabled: true,
  auto_offer: true,
  offer_ttl_seconds: 86400,
  retry_after_seconds: 60,
  max_search_radius_km: 8,
  arrival_radius_m: 80,
  customer_arrival_radius_m: 60,
  max_orders_per_driver: 2,
  default_commission_percent: 5,
  require_gps: true,
  voice_alerts: true,
  voice_eta_minutes: 5,
  voice_volume: 100,
  voice_rate: 1,
  voice_pitch: 1.25,
  notes: '',
};

export function normalizeDispatchSettings(raw = {}) {
  const n = (v, fb) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : fb;
  };
  return {
    enabled: raw.enabled !== false,
    auto_offer: raw.auto_offer !== false,
    offer_ttl_seconds: Math.min(604800, Math.max(86400, n(raw.offer_ttl_seconds, 86400))),
    retry_after_seconds: Math.min(600, Math.max(30, n(raw.retry_after_seconds, 60))),
    max_search_radius_km: Math.min(30, Math.max(1, n(raw.max_search_radius_km, 8))),
    arrival_radius_m: Math.min(300, Math.max(20, n(raw.arrival_radius_m, 80))),
    customer_arrival_radius_m: Math.min(300, Math.max(20, n(raw.customer_arrival_radius_m, 60))),
    max_orders_per_driver: Math.min(4, Math.max(2, Math.round(n(raw.max_orders_per_driver, 2)))),
    default_commission_percent: Math.min(100, Math.max(0, n(raw.default_commission_percent, 5))),
    require_gps: raw.require_gps !== false,
    voice_alerts: raw.voice_alerts !== false,
    voice_eta_minutes: Math.min(15, Math.max(3, Math.round(n(raw.voice_eta_minutes, 5)))),
    voice_volume: Math.min(100, Math.max(20, Math.round(n(raw.voice_volume, 100)))),
    voice_rate: Math.round(Math.min(1.4, Math.max(0.7, n(raw.voice_rate, 1))) * 100) / 100,
    voice_pitch: Math.round(Math.min(1.6, Math.max(0.8, n(raw.voice_pitch, 1.25))) * 100) / 100,
    notes: String(raw.notes || ''),
  };
}

export async function getDispatchSettings(branchId) {
  if (!isSupabaseConfigured() || !branchId) {
    return { ...DISPATCH_SETTINGS_DEFAULTS };
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from('ep_dispatch_settings')
    .select('*')
    .eq('branch_id', branchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return normalizeDispatchSettings(data || {});
}

export async function saveDispatchSettings(branchId, settings) {
  if (!isSupabaseConfigured()) return normalizeDispatchSettings(settings);
  if (!branchId) throw new Error('Selecciona una sucursal');
  const clean = normalizeDispatchSettings(settings);
  const sb = getSupabase();
  const payload = {
    branch_id: branchId,
    ...clean,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb
    .from('ep_dispatch_settings')
    .upsert(payload, { onConflict: 'branch_id' })
    .select()
    .single();
  if (error) {
    const msg = error.message || '';
    if (/default_commission_percent|column/i.test(msg)) {
      throw new Error('Falta SQL de config. Ejecuta supabase/fix-dispatch-config-v2.sql en Supabase.');
    }
    if (/voice_eta_minutes|voice_volume|voice_rate|voice_pitch|column/i.test(msg)) {
      throw new Error('Falta SQL de voz. Ejecuta supabase/fix-dispatch-voice-alerts.sql en Supabase.');
    }
    throw new Error(msg || 'No se pudo guardar');
  }
  return normalizeDispatchSettings(data || clean);
}

/** Aplica cupo y comisión por defecto a repartidores de la sucursal. */
export async function applyDispatchDefaultsToDrivers(branchId, {
  maxOrders,
  commissionPercent,
} = {}) {
  if (!isSupabaseConfigured() || !branchId) {
    return { updated: 0 };
  }
  const sb = getSupabase();
  const patch = { updated_at: new Date().toISOString() };
  if (maxOrders != null) patch.max_orders = Math.min(4, Math.max(2, Number(maxOrders) || 2));
  if (commissionPercent != null) {
    patch.commission_percent = Math.min(100, Math.max(0, Number(commissionPercent) || 0));
  }
  if (Object.keys(patch).length <= 1) return { updated: 0 };

  const { data, error } = await sb
    .from('ep_driver_profiles')
    .update(patch)
    .eq('preferred_branch_id', branchId)
    .select('id');
  if (error) {
    const msg = error.message || '';
    if (/commission_percent|column/i.test(msg)) {
      throw new Error('Falta columna commission_percent. Ejecuta fix-driver-commission-percent.sql');
    }
    throw new Error(msg || 'No se pudo aplicar a repartidores');
  }
  return { updated: (data || []).length };
}

/** Watch GPS. Si publishRef.current === false, solo actualiza UI local (no visible en admin). */
export function startGpsWatch(onUpdate, { intervalMs = GPS_PUBLISH_INTERVAL_MS, publishRef = null } = {}) {
  if (!navigator.geolocation) {
    onUpdate?.(null, new Error('Este dispositivo no tiene GPS / geolocalización'));
    return () => {};
  }

  let lastSent = 0;
  let stopped = false;
  let wakeLock = null;
  const shouldPublish = () => publishRef == null || publishRef.current !== false;

  const requestWake = async () => {
    try {
      if (shouldPublish() && navigator.wakeLock?.request) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch {
      /* algunos dispositivos no permiten wake lock */
    }
  };
  void requestWake();
  const onVis = () => {
    if (document.visibilityState === 'visible') void requestWake();
  };
  document.addEventListener('visibilitychange', onVis);

  const handlePos = async (pos, forceSend = false) => {
    if (stopped) return;
    const payload = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
      accuracy: pos.coords.accuracy,
    };
    const now = Date.now();
    const due = forceSend || now - lastSent >= intervalMs;

    if (!shouldPublish() || !due) {
      onUpdate?.(payload, null);
      return;
    }

    lastSent = now;
    try {
      await upsertMyLocation(payload);
      onUpdate?.(payload, null);
    } catch (err) {
      onUpdate?.(payload, err);
    }
  };

  navigator.geolocation.getCurrentPosition(
    (pos) => { void handlePos(pos, true); },
    (err) => onUpdate?.(null, new Error(err.message || 'Permiso de ubicación denegado')),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );

  const watchId = navigator.geolocation.watchPosition(
    (pos) => { void handlePos(pos, false); },
    (err) => onUpdate?.(null, new Error(err.message || 'Error GPS')),
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 }
  );

  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVis);
    try { wakeLock?.release?.(); } catch { /* ignore */ }
    wakeLock = null;
    navigator.geolocation.clearWatch(watchId);
  };
}
