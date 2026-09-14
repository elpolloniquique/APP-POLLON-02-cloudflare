import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { fetchOsrmRoute } from '../utils/osrm';
import { TRACKING_MODE } from '../utils/orderTrackingMode';

const nearStoreDone = new Set();

function haversineKm(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** ETA aprox. en auto urbano ~22 km/h promedio. */
function etaMinutesFromKm(km) {
  if (!Number.isFinite(km) || km <= 0) return 0;
  return (km / 22) * 60;
}

async function patchPedidoEstado(orderId, estado, datosPatch = {}) {
  if (!isSupabaseConfigured() || !orderId) return null;
  const sb = getSupabase();

  // Preferir RPC (SECURITY DEFINER) — el repartidor no siempre puede UPDATE pedidos
  try {
    const { data: rpcData, error: rpcErr } = await sb.rpc('ep_sync_pedido_estado_from_driver', {
      p_order_id: String(orderId),
      p_estado: estado,
      p_datos_patch: datosPatch,
    });
    if (!rpcErr && rpcData) return rpcData;
  } catch {
    /* fallback abajo */
  }

  const { data: row, error: readErr } = await sb
    .from('pedidos')
    .select('id, estado, datos_json')
    .eq('id', orderId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!row) return null;
  if (row.estado === 'entregado' || row.estado === 'cancelado') return row;
  if (estado && row.estado === estado && !Object.keys(datosPatch).length) return row;

  const nextDatos = {
    ...(row.datos_json || {}),
    ...datosPatch,
  };

  const payload = { datos_json: nextDatos };
  if (estado && row.estado !== estado) payload.estado = estado;
  if (estado === 'entregado') payload.entregado_en = new Date().toISOString();

  const { data, error } = await sb
    .from('pedidos')
    .update(payload)
    .eq('id', orderId)
    .select('id, estado, datos_json')
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Tras aceptar oferta (refuerzo si SQL viejo aún pone en_delivery). */
export async function syncAfterDriverAccept(orderId) {
  if (!orderId) return null;
  try {
    return await patchPedidoEstado(orderId, 'aceptado', {
      tracking_mode: TRACKING_MODE.LIVE_MAP,
      driver_accepted_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[Pollón] syncAfterDriverAccept:', e?.message || e);
    return null;
  }
}

/** Pedido recogido → En reparto. */
export async function syncAfterDriverPickup(orderId) {
  if (!orderId) return null;
  try {
    return await patchPedidoEstado(orderId, 'en_delivery', {
      picked_up_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[Pollón] syncAfterDriverPickup:', e?.message || e);
    return null;
  }
}

/**
 * Si el repartidor está a ≤5 min de la sucursal (yendo a retirar),
 * pasa el pedido a "preparando" (En cocina).
 */
export async function maybeAdvanceNearStore({
  orderId,
  driverLat,
  driverLng,
  storeLat,
  storeLng,
  currentEstado,
}) {
  if (!orderId) return null;
  if (!['aceptado', 'confirmado'].includes(currentEstado)) return null;
  if (nearStoreDone.has(orderId)) return null;
  if (![driverLat, driverLng, storeLat, storeLng].every(Number.isFinite)) return null;

  let etaMin = null;
  try {
    const route = await fetchOsrmRoute(
      { lat: driverLat, lng: driverLng },
      { lat: storeLat, lng: storeLng },
    );
    if (route?.durationMin != null) etaMin = route.durationMin;
  } catch {
    /* fallback haversine */
  }
  if (etaMin == null) {
    etaMin = etaMinutesFromKm(haversineKm(driverLat, driverLng, storeLat, storeLng));
  }

  if (etaMin > 5) return null;

  nearStoreDone.add(orderId);
  try {
    return await patchPedidoEstado(orderId, 'preparando', {
      near_store_at: new Date().toISOString(),
      near_store_eta_min: Math.round(etaMin * 10) / 10,
    });
  } catch (e) {
    nearStoreDone.delete(orderId);
    console.warn('[Pollón] maybeAdvanceNearStore:', e?.message || e);
    return null;
  }
}

/** Cajera avanza sin aceptación de app → solo barra de estados. */
export function withCashierStatusLineMode(order, nextEstado) {
  if (!order) return order;
  if (order.trackingMode === TRACKING_MODE.LIVE_MAP) return { ...order, estado: nextEstado };
  // Si ya hay modo live (driver aceptó), no degradar
  const keepLive = order.trackingMode === TRACKING_MODE.LIVE_MAP;
  return {
    ...order,
    estado: nextEstado,
    trackingMode: keepLive ? TRACKING_MODE.LIVE_MAP : TRACKING_MODE.STATUS_LINE,
  };
}
