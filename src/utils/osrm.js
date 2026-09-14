/**
 * OSRM routing — gratis (demo público o self-host vía env).
 * Producción: VITE_OSRM_URL=https://tu-osrm.dominio
 */

import { searchPreciseAddresses } from './addressGeocode';

const OSRM_BASE = (import.meta.env.VITE_OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, '');

/**
 * @param {{lng:number,lat:number}} from
 * @param {{lng:number,lat:number}} to
 * @returns {Promise<{coordinates:number[][], distanceKm:number, durationMin:number}|null>}
 */
export async function fetchOsrmRoute(from, to) {
  const flng = Number(from?.lng);
  const flat = Number(from?.lat);
  const tlng = Number(to?.lng);
  const tlat = Number(to?.lat);
  if (![flng, flat, tlng, tlat].every(Number.isFinite)) return null;

  const url =
    `${OSRM_BASE}/route/v1/driving/` +
    `${flng},${flat};${tlng},${tlat}` +
    `?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return null;
    return {
      coordinates: route.geometry?.coordinates || [],
      distanceKm: (route.distance || 0) / 1000,
      durationMin: (route.duration || 0) / 60,
    };
  } catch {
    return null;
  }
}

/** Geocoding preciso (calle + nº) vía Nominatim/Photon/Overpass */
export async function geocodeAddress(query, _countryCode = 'cl') {
  if (!query?.trim()) return null;
  try {
    const hits = await searchPreciseAddresses(query, { limit: 1 });
    const hit = hits?.[0];
    if (!hit) return null;
    return { lat: hit.lat, lng: hit.lng, label: hit.shortLabel, precision: hit.precision };
  } catch {
    return null;
  }
}

export function openExternalNavigation(lat, lng, label = 'Destino') {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&destination_place_id=`;
  window.open(url, '_blank', 'noopener,noreferrer');
  void label;
}
