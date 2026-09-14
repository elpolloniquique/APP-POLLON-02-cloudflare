/** Modos de seguimiento del pedido para el cliente. */
export const TRACKING_MODE = {
  /** Repartidor aceptó desde la app → candidato a mapa en vivo + ETA */
  LIVE_MAP: 'live_map',
  /** Destino manual / sin app / sin GPS → solo barra de progreso */
  STATUS_LINE: 'status_line',
};

/** GPS “en vivo” (badge verde). El pin del mapa NO se oculta si hay última coordenada. */
export const GPS_LIVE_MAX_AGE_SEC = 180;

/** Pasos visibles al cliente en modo barra (sin mapa). */
export const STATUS_LINE_STEPS = [
  'confirmado',
  'preparando',
  'en_delivery',
  'entregado',
];

/** Pasos cuando hubo aceptación por app (con o sin mapa visible). */
export const LIVE_FLOW_STEPS = [
  'aceptado',
  'preparando',
  'en_delivery',
  'entregado',
];

export function gpsAgeSeconds(updatedAt) {
  if (!updatedAt) return null;
  const t = new Date(updatedAt).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (Date.now() - t) / 1000);
}

export function isDriverGpsLive(liveMeta, maxAgeSec = GPS_LIVE_MAX_AGE_SEC) {
  if (!liveMeta) return false;
  if (liveMeta.gps_live === true) return true;
  if (liveMeta.gps_live === false && liveMeta.gps_age_seconds != null) {
    return Number(liveMeta.gps_age_seconds) <= maxAgeSec;
  }
  const lat = liveMeta?.driver?.lat;
  const lng = liveMeta?.driver?.lng;
  if (lat == null || lng == null) return false;
  const age = liveMeta.gps_age_seconds != null
    ? Number(liveMeta.gps_age_seconds)
    : gpsAgeSeconds(liveMeta?.driver?.updated_at);
  if (age == null) return false;
  return age <= maxAgeSec;
}

/**
 * ¿El pedido fue aceptado por un repartidor con app?
 * (no destino manual sin app)
 */
export function wasAcceptedViaDriverApp(order, liveMeta = null) {
  if (liveMeta?.driver_accepted_via_app === true) return true;
  if (liveMeta?.driver_accepted_via_app === false && liveMeta?.has_driver) return false;
  const mode = order?.trackingMode || order?.datos_json?.tracking_mode || liveMeta?.tracking_mode;
  if (mode === TRACKING_MODE.LIVE_MAP) return true;
  if (mode === TRACKING_MODE.STATUS_LINE) return false;
  // Si hay assignment/GPS en liveMeta y no está marcado status_line
  if (liveMeta?.has_driver && liveMeta?.driver?.updated_at) return true;
  return false;
}

export function resolveTrackingMode(order, liveMeta = null) {
  // Destino manual explícito → siempre barra
  const fromOrder = order?.trackingMode || order?.datos_json?.tracking_mode;
  if (fromOrder === TRACKING_MODE.STATUS_LINE && liveMeta?.driver_accepted_via_app !== true) {
    return TRACKING_MODE.STATUS_LINE;
  }
  if (wasAcceptedViaDriverApp(order, liveMeta)) return TRACKING_MODE.LIVE_MAP;
  if (fromOrder === TRACKING_MODE.LIVE_MAP) return TRACKING_MODE.LIVE_MAP;
  if (liveMeta?.tracking_mode === TRACKING_MODE.LIVE_MAP) return TRACKING_MODE.LIVE_MAP;
  return TRACKING_MODE.STATUS_LINE;
}

/**
 * Mapa al cliente si hay pedido delivery, aceptación por app y al menos
 * una coordenada del repartidor. No se oculta el pin por GPS “stale”:
 * se muestra la última ubicación conocida.
 */
export function shouldShowLiveMap(order, liveMeta = null) {
  if (order?.orderType && order.orderType !== 'delivery') return false;
  if (order?.estado === 'entregado' || order?.estado === 'cancelado') return false;
  if (!wasAcceptedViaDriverApp(order, liveMeta)) return false;
  if (!liveMeta?.has_driver) return false;
  const lat = liveMeta?.driver?.lat;
  const lng = liveMeta?.driver?.lng;
  return lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

/** Motivo legible cuando no hay mapa (para el cliente). */
export function liveMapFallbackReason(order, liveMeta = null) {
  if (order?.estado === 'entregado') return null;
  if (order?.estado === 'cancelado') return null;
  if (!wasAcceptedViaDriverApp(order, liveMeta)) {
    return 'Seguimiento por estados: tu pedido fue gestionado en local (sin ubicación en vivo del repartidor).';
  }
  if (liveMeta?.has_driver && !shouldShowLiveMap(order, liveMeta)) {
    return 'Esperando la ubicación del repartidor. El mapa aparece en cuanto el GPS envíe el primer punto.';
  }
  return null;
}
