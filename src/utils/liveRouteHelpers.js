import { geocodeAddress, fetchOsrmRoute } from './osrm';

/** Coords válidas (incluye negativos de Chile). */
export function isValidLatLng(lat, lng) {
  const a = Number(lat);
  const b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180;
}

export function toLatLng(lat, lng) {
  if (!isValidLatLng(lat, lng)) return null;
  return { lat: Number(lat), lng: Number(lng) };
}

const geocodeCache = new Map();

/**
 * Destino cliente para mapa en vivo.
 * 1) customer_lat/lng del job
 * 2) geocode de customer_address (cache en memoria)
 */
export async function resolveCustomerDestination(job) {
  if (!job) return null;
  const direct = toLatLng(job.customer_lat, job.customer_lng);
  if (direct) {
    return { ...direct, label: job.customer_name || 'Cliente', source: 'job' };
  }

  const addr = String(job.customer_address || '').trim();
  if (!addr) return null;

  const key = addr.toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key);

  const hit = await geocodeAddress(addr);
  if (!hit || !isValidLatLng(hit.lat, hit.lng)) {
    geocodeCache.set(key, null);
    return null;
  }

  const dest = {
    lat: Number(hit.lat),
    lng: Number(hit.lng),
    label: job.customer_name || 'Cliente',
    source: 'geocode',
    address: addr,
  };
  geocodeCache.set(key, dest);
  return dest;
}

export async function resolveRoutePolyline(from, to) {
  const a = toLatLng(from?.lat, from?.lng);
  const b = toLatLng(to?.lat, to?.lng);
  if (!a || !b) return null;

  const osrm = await fetchOsrmRoute(a, b);
  if (osrm?.coordinates?.length) {
    return {
      positions: osrm.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceKm: osrm.distanceKm,
      durationMin: osrm.durationMin,
      mode: 'osrm',
    };
  }

  return {
    positions: [[a.lat, a.lng], [b.lat, b.lng]],
    distanceKm: null,
    durationMin: null,
    mode: 'straight',
  };
}
