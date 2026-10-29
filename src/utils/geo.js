/** Geo helpers — sin dependencias de pago */

export function haversineKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v == null || Number.isNaN(Number(v)))) return null;
  const R = 6371;
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km) {
  if (km == null) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatEta(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  if (minutes < 1) return '< 1 min';
  return `${Math.round(minutes)} min`;
}

/** Centro default Iquique (norte de Chile — El Pollón) */
export const DEFAULT_MAP_CENTER = { lng: -70.1357, lat: -20.2307 };
export const DEFAULT_MAP_ZOOM = 13;

/** Centro urbano por comuna, para abrir el mapa de checkout en las calles de esa sucursal. */
export const CITY_MAP_CENTERS = {
  iquique: { lat: -20.2307, lng: -70.1357 },
  'alto hospicio': { lat: -20.2675, lng: -70.1008 },
  arica: { lat: -18.4783, lng: -70.3126 },
};

function isUsableLatLng(lat, lng) {
  return Number.isFinite(lat)
    && Number.isFinite(lng)
    && Math.abs(lat) <= 85
    && Math.abs(lng) <= 180
    && !(Math.abs(lat) < 0.02 && Math.abs(lng) < 0.02);
}

export function mapCenterForCity(city, biasLat, biasLng) {
  const lat = Number(biasLat);
  const lng = Number(biasLng);
  if (isUsableLatLng(lat, lng)) return { lat, lng };
  const key = String(city || '').trim().toLowerCase();
  if (key.includes('hospicio')) return CITY_MAP_CENTERS['alto hospicio'];
  if (key.includes('arica')) return CITY_MAP_CENTERS.arica;
  return CITY_MAP_CENTERS.iquique;
}
