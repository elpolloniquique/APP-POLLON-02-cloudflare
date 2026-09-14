/**
 * Geocoding preciso para Chile (calle + número + CP).
 * Fuentes: catálogo local + ArcGIS (GPS exacto) + Photon + Nominatim + Overpass.
 */

import { matchLocalStreets, preferredLocalRoadName } from '../data/cityStreets';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';
const PHOTON = 'https://photon.komoot.io/api/';
const PHOTON_REVERSE = 'https://photon.komoot.io/reverse';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const ARCGIS_REVERSE = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode';
const ARCGIS_FIND = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
const ARCGIS_SUGGEST = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest';
const searchCache = new Map();

/** Metros aproximados por unidad de numeración urbana en Chile (calibrado en avenidas de Iquique). */
const CHILE_METERS_PER_HOUSE = 1.8;

const FETCH_HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'es',
  // Nominatim exige identificación; en navegador este header se ignora (usa el UA real).
  'User-Agent': 'ElPollonApp/1.0 (delivery; https://www.el-pollon.cl)',
};

/** viewbox: west,south,east,north — Iquique y Alto Hospicio NO se solapan */
const VIEWBOX_BY_CITY = {
  Iquique: '-70.22,-20.32,-70.12,-20.15',
  'Alto Hospicio': '-70.12,-20.32,-70.05,-20.24',
  Arica: '-70.36,-18.54,-70.26,-18.44',
};
const DEFAULT_VIEWBOX = VIEWBOX_BY_CITY.Iquique;

/** Separación costa (Iquique) vs meseta (Alto Hospicio) */
const IQUIQUE_AH_LNG_SPLIT = -70.12;

function hitMatchesRequestedCity(hit, city) {
  if (!hit || !Number.isFinite(Number(hit.lat)) || !Number.isFinite(Number(hit.lng))) return false;
  const want = normalizeBranchCity(city);
  const lng = Number(hit.lng);
  const lat = Number(hit.lat);
  const labelCity = normalizeBranchCity(hit.city || hit.arcCity || '');
  const guessed = normalizeBranchCity(guessCityFromCoords(lat, lng));

  if (want === 'iquique') {
    if (labelCity === 'alto hospicio') return false;
    if (guessed === 'alto hospicio') return false;
    if (lng > IQUIQUE_AH_LNG_SPLIT) return false;
    return isInViewbox(lat, lng, VIEWBOX_BY_CITY.Iquique);
  }
  if (want === 'alto hospicio') {
    if (labelCity === 'iquique' && guessed === 'iquique') return false;
    if (lng < IQUIQUE_AH_LNG_SPLIT) return false;
    return isInViewbox(lat, lng, VIEWBOX_BY_CITY['Alto Hospicio']);
  }
  return isInViewbox(lat, lng, viewboxForCity(city));
}

/** CP referenciales por comuna (etiqueta Chile completa). */
const DEFAULT_POSTCODE_BY_CITY = {
  Iquique: '1101063',
  'Alto Hospicio': '1130000',
  Arica: '1000000',
};

function defaultPostcodeForCity(city) {
  const key = Object.keys(DEFAULT_POSTCODE_BY_CITY).find(
    (k) => normText(k) === normText(city),
  );
  if (key) return DEFAULT_POSTCODE_BY_CITY[key];
  const branch = normalizeBranchCity(city);
  if (branch === 'alto hospicio') return DEFAULT_POSTCODE_BY_CITY['Alto Hospicio'];
  if (branch === 'arica') return DEFAULT_POSTCODE_BY_CITY.Arica;
  return DEFAULT_POSTCODE_BY_CITY.Iquique;
}

/** Prefiere CP específico; evita genéricos tipo 1100000 si hay uno local. */
function resolvePostcode(city, ...candidates) {
  const list = candidates
    .map((c) => String(c || '').trim())
    .filter((c) => /^\d{7}$/.test(c));
  const specific = list.find((c) => !/0{4}$/.test(c));
  if (specific) return specific;
  if (list[0]) return list[0];
  return defaultPostcodeForCity(city);
}

function viewboxForCity(city) {
  const key = Object.keys(VIEWBOX_BY_CITY).find(
    (k) => normText(k) === normText(city),
  );
  return VIEWBOX_BY_CITY[key] || DEFAULT_VIEWBOX;
}

function normalizeBranchCity(city) {
  const n = normText(city);
  if (/hospicio/.test(n)) return 'alto hospicio';
  if (/arica/.test(n)) return 'arica';
  return 'iquique';
}

function viewboxKeyForBranch(city) {
  const branch = normalizeBranchCity(city);
  if (branch === 'alto hospicio') return 'Alto Hospicio';
  if (branch === 'arica') return 'Arica';
  return 'Iquique';
}

function isInViewbox(lat, lng, viewboxStr) {
  const parts = String(viewboxStr || DEFAULT_VIEWBOX).split(',').map(Number);
  if (parts.length !== 4 || parts.some((v) => !Number.isFinite(v))) return false;
  const [west, south, east, north] = parts;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

/** Solo direcciones de la comuna/sucursal activa (evita Santiago, Alto Hospicio↔Iquique cruzados). */
function hitMatchesBranchCity(hit, branchCity, bias) {
  if (!Number.isFinite(hit?.lat) || !Number.isFinite(hit?.lng)) return false;

  const blob = normText(`${hit.city || ''} ${hit.arcCity || ''} ${hit.state || ''}`);
  if (/santiago|metropolitan|metropolitana|valparaiso|concepcion|temuco|calama|la serena|coquimbo|rancagua|talca/.test(blob)) {
    return false;
  }

  if (!hitMatchesRequestedCity(hit, branchCity || 'Iquique')) return false;

  if (Number.isFinite(bias?.lat) && Number.isFinite(bias?.lng)) {
    const dM = haversineM({ lat: hit.lat, lng: hit.lng }, bias);
    if (dM > 28000) return false;
  }

  return true;
}

function filterByBranchCity(hits, branchCity, bias) {
  return (hits || []).filter((h) => hitMatchesBranchCity(h, branchCity || 'Iquique', bias));
}

function finalizeCheckoutHits(hits, parsed, branchCity, bias) {
  return filterCheckoutHits(filterByBranchCity(hits, branchCity, bias), parsed, bias);
}

/**
 * @typedef {{ street: string, houseNumber: string|null, postcode: string|null, city: string|null, region: string|null, rest: string }} ParsedAddress
 * @typedef {{ id: string, label: string, shortLabel: string, lat: number, lng: number, precision: 'exact'|'interpolated'|'street', houseNumber: string|null, postcode: string|null, road: string, city: string, state: string }} GeocodeHit
 */

export function parseAddressQuery(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return { street: '', houseNumber: null, postcode: null, city: null, region: null, rest: '' };
  }

  const postcodeMatch = text.match(/\b(\d{7})\b/);
  const postcode = postcodeMatch ? postcodeMatch[1] : null;

  let working = text;
  if (postcode) working = working.replace(postcode, ' ').replace(/\s+/g, ' ').trim();

  // Quita "Chile" / región genérica del final para parsear mejor
  working = working
    .replace(/,?\s*chile\s*$/i, '')
    .replace(/,?\s*regi[oó]n\s+de\s+tarapac[aá]\s*$/i, '')
    .replace(/,?\s*tarapac[aá]\s*$/i, '')
    .trim();

  const parts = working.split(',').map((p) => p.trim()).filter(Boolean);
  const head = parts[0] || working;
  const tail = parts.slice(1);

  let city = null;
  let region = null;
  for (const t of tail) {
    if (/tarapac/i.test(t) || /regi[oó]n/i.test(t)) region = t;
    else if (!city) city = t.replace(/\b\d{7}\b/, '').trim() || city;
  }

  // "Calle Foo 123" | "Foo 123" | "123 Foo"
  let street = head;
  let houseNumber = null;

  const m1 = head.match(/^(.+?)\s+(\d+[A-Za-z]?)\s*$/);
  const m2 = head.match(/^(\d+[A-Za-z]?)\s+(.+)$/);
  if (m1) {
    street = m1[1].replace(/^(calle|av\.?|avenida|pasaje|psje\.?)\s+/i, '').trim();
    houseNumber = m1[2];
  } else if (m2 && !/^\d{7}$/.test(m2[1])) {
    houseNumber = m2[1];
    street = m2[2].replace(/^(calle|av\.?|avenida|pasaje|psje\.?)\s+/i, '').trim();
  } else {
    street = head.replace(/^(calle|av\.?|avenida|pasaje|psje\.?)\s+/i, '').trim();
  }

  return {
    street,
    houseNumber,
    postcode,
    city: city || null,
    region: region || null,
    rest: text,
  };
}

function shortState(state) {
  if (!state) return '';
  return String(state)
    .replace(/^Regi[oó]n\s+de\s+/i, '')
    .replace(/^Provincia\s+de\s+/i, '')
    .trim();
}

function normText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Unifica apóstrofes tipográficos: O'Higgins / O’Higgins
    .replace(/[''`´]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function streetsMatch(a, b) {
  const na = normText(a);
  const nb = normText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const wa = na.split(/\s+/).filter((w) => w.length > 2);
  const wb = nb.split(/\s+/).filter((w) => w.length > 2);
  if (!wa.length || !wb.length) return false;
  // Solo tokens exactos (evita libertad ⊂ libertador)
  if (wa.length === 1 && wb.length === 1) {
    return wa[0] === wb[0] || tokensFuzzyEqual(wa[0], wb[0]);
  }
  const short = wa.length <= wb.length ? wa : wb;
  const long = wa.length <= wb.length ? wb : wa;
  return short.every((w) => long.includes(w) || long.some((lw) => tokensFuzzyEqual(w, lw)));
}

/** Typo tolerante: Labattut≈Labatut, Zeger≈Zegers (no libertad≈libertador). */
function tokensFuzzyEqual(a, b) {
  const na = normText(a);
  const nb = normText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const la = na.replace(/(.)\1+/g, '$1');
  const lb = nb.replace(/(.)\1+/g, '$1');
  if (la === lb) return true;
  // Evitar libertad/libertador (mismo prefijo, resto largo)
  if (na.startsWith(nb) || nb.startsWith(na)) {
    const short = na.length <= nb.length ? na : nb;
    const long = na.length <= nb.length ? nb : na;
    const rest = long.slice(short.length);
    if (short.length >= 5 && rest.length >= 2) return false;
  }
  if (na.length >= 5 && nb.length >= 5) {
    let dist = 0;
    // Levenshtein corto inline
    const s = na;
    const t = nb;
    if (Math.abs(s.length - t.length) > 2) return false;
    const rows = s.length + 1;
    const cols = t.length + 1;
    const d = Array.from({ length: rows }, () => new Array(cols).fill(0));
    for (let i = 0; i < rows; i += 1) d[i][0] = i;
    for (let j = 0; j < cols; j += 1) d[0][j] = j;
    for (let i = 1; i < rows; i += 1) {
      for (let j = 1; j < cols; j += 1) {
        const cost = s[i - 1] === t[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      }
    }
    dist = d[s.length][t.length];
    if (dist <= 1) return true;
    if (dist === 2 && Math.min(s.length, t.length) >= 7) return true;
  }
  return false;
}

const STREET_PREFIX_NOISE = new Set([
  'calle', 'avenida', 'av', 'pasaje', 'psje', 'general', 'brigadier',
  'presidente', 'doctor', 'dr', 'capitan', 'teniente', 'coronel',
]);

function streetTokens(name) {
  return normText(name)
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STREET_PREFIX_NOISE.has(w));
}

/** Matching estricto para pin exacto (evita Juan Martínez ≈ Luis Cruz Martínez y Libertad ≈ Libertador). */
function streetsMatchStrict(a, b) {
  const na = normText(a);
  const nb = normText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const wa = streetTokens(a);
  const wb = streetTokens(b);
  if (!wa.length || !wb.length) return false;

  // Una sola palabra: idéntica o typo (labattut≈labatut), nunca libertad≈libertador
  if (wa.length === 1 && wb.length === 1) return tokensFuzzyEqual(wa[0], wb[0]);

  const hits = wa.filter((w) => wb.some((x) => tokensFuzzyEqual(w, x))).length;
  if (wa.length >= 2 && wb.length >= 2) {
    if (hits >= 2) return true;
    if (tokensFuzzyEqual(wa[wa.length - 1], wb[wb.length - 1]) && hits >= 1) return true;
    return false;
  }
  const short = wa.length <= wb.length ? wa : wb;
  const long = wa.length <= wb.length ? wb : wa;
  return short.every((w) => long.some((x) => tokensFuzzyEqual(w, x)));
}

/**
 * Etiqueta estilo Chile: "Bartolomé Vivar 1086, 1101063 Iquique, Tarapacá"
 */
export function formatChileLabel({
  road,
  houseNumber,
  postcode,
  city,
  state,
  neighbourhood,
}) {
  const line1 = [road, houseNumber].filter(Boolean).join(' ').trim();
  const cityPart = [postcode, city].filter(Boolean).join(' ').trim();
  const region = shortState(state);
  const parts = [line1 || neighbourhood, cityPart, region].filter(Boolean);
  return parts.join(', ');
}

function haversineM(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Interpola / extrapola lat-lng con regresión lineal sobre números conocidos.
 * Opcionalmente recorta al bounding box de la calle (Nominatim: S,N,W,E).
 * @param {number} target
 * @param {{ n: number, lat: number, lng: number }[]} known
 * @param {string[]|number[]|null} [bbox]
 */
export function interpolateHouseCoords(target, known, bbox = null) {
  if (!Number.isFinite(target) || !known?.length) return null;
  const sorted = [...known].filter((k) => Number.isFinite(k.n)).sort((a, b) => a.n - b.n);
  if (!sorted.length) return null;

  const exact = sorted.find((k) => k.n === target);
  if (exact) return { lat: exact.lat, lng: exact.lng, precision: 'exact' };

  let lower = null;
  let upper = null;
  for (const k of sorted) {
    if (k.n < target) lower = k;
    if (k.n > target && !upper) upper = k;
  }

  let lat;
  let lng;

  if (lower && upper) {
    const t = (target - lower.n) / (upper.n - lower.n);
    lat = lower.lat + (upper.lat - lower.lat) * t;
    lng = lower.lng + (upper.lng - lower.lng) * t;
  } else if (sorted.length >= 2) {
    // Regresión lineal n → lat/lng (más estable que 2 puntos casi iguales)
    const fit = (key) => {
      const n = sorted.length;
      const sumX = sorted.reduce((s, k) => s + k.n, 0);
      const sumY = sorted.reduce((s, k) => s + k[key], 0);
      const sumXY = sorted.reduce((s, k) => s + k.n * k[key], 0);
      const sumXX = sorted.reduce((s, k) => s + k.n * k.n, 0);
      const den = n * sumXX - sumX * sumX;
      if (Math.abs(den) < 1e-9) return sumY / n;
      const slope = (n * sumXY - sumX * sumY) / den;
      const intercept = (sumY - slope * sumX) / n;
      return slope * target + intercept;
    };
    lat = fit('lat');
    lng = fit('lng');

    // Extrapolación: permitir hasta ~900 m del extremo (calles largas sin parcela ArcGIS)
    const edge = lower ? sorted[sorted.length - 1] : sorted[0];
    const dist = haversineM({ lat, lng }, edge);
    if (dist > 900) {
      const t = 900 / dist;
      lat = edge.lat + (lat - edge.lat) * t;
      lng = edge.lng + (lng - edge.lng) * t;
    }
  } else {
    const only = sorted[0];
    const meters = (target - only.n) * CHILE_METERS_PER_HOUSE;
    const dLat = meters / 111320;
    lat = only.lat + dLat;
    lng = only.lng;
  }

  if (bbox?.length === 4) {
    const south = Number(bbox[0]);
    const north = Number(bbox[1]);
    const west = Number(bbox[2]);
    const east = Number(bbox[3]);
    const padLat = (north - south) * 0.35 || 0.002;
    const padLng = (east - west) * 0.35 || 0.002;
    lat = Math.min(north + padLat, Math.max(south - padLat, lat));
    lng = Math.min(east + padLng, Math.max(west - padLng, lng));
  }

  return { lat, lng, precision: 'interpolated' };
}

/**
 * Desplaza `meters` desde `from` hacia `toward` (metros negativos = sentido opuesto).
 */
function offsetAlongDirection(from, toward, meters) {
  if (!Number.isFinite(meters) || !Number.isFinite(from?.lat) || !Number.isFinite(toward?.lat)) return null;
  const dist = haversineM(from, toward);
  if (dist < 0.5) {
    return {
      lat: from.lat + meters / 111320,
      lng: from.lng,
    };
  }
  const t = meters / dist;
  return {
    lat: from.lat + (toward.lat - from.lat) * t,
    lng: from.lng + (toward.lng - from.lng) * t,
  };
}

function estimateMetersPerHouse(refs) {
  if (!refs || refs.length < 2) return CHILE_METERS_PER_HOUSE;
  const sorted = [...refs].filter((k) => Number.isFinite(k.n)).sort((a, b) => a.n - b.n);
  if (sorted.length < 2) return CHILE_METERS_PER_HOUSE;
  const a = sorted[0];
  const b = sorted[sorted.length - 1];
  const dn = Math.abs(b.n - a.n);
  const dm = haversineM(a, b);
  if (dn < 1 || dm < 5) return CHILE_METERS_PER_HOUSE;
  const m = dm / dn;
  if (m < 0.4 || m > 6) return CHILE_METERS_PER_HOUSE;
  return m;
}

/**
 * Nominatim usa left,top,right,bottom (= west,north,east,south).
 */
function nominatimViewboxParam(city) {
  const [west, south, east, north] = String(viewboxForCity(city)).split(',').map(Number);
  if (![west, south, east, north].every(Number.isFinite)) return null;
  return `${west},${north},${east},${south}`;
}

/**
 * Geometría de la calle (LineString) dentro de la comuna.
 * @returns {Promise<{lat:number,lng:number}[]|null>}
 */
async function fetchStreetPolyline(road, city, near) {
  if (!road) return null;
  const viewbox = nominatimViewboxParam(city);
  const q = `Avenida ${road}, ${city}, Chile`;
  const q2 = `${road}, ${city}, Chile`;
  const params = {
    format: 'json',
    addressdetails: '1',
    limit: '6',
    polygon_geojson: '1',
    countrycodes: 'cl',
  };
  if (viewbox) {
    params.viewbox = viewbox;
    params.bounded = '1';
  }
  const batches = await Promise.all([
    nominatimSearch({ ...params, q }).catch(() => []),
    nominatimSearch({ ...params, q: q2 }).catch(() => []),
  ]);
  const rows = [...batches[0], ...batches[1]];
  let best = null;
  let bestLen = 0;
  for (const row of rows) {
    if (!streetsMatchStrict(row?.display_name || row?.name || '', road)
      && !normText(row?.display_name || '').includes(normText(streetTokens(road).slice(-1)[0] || road))) {
      continue;
    }
    const lat = Number(row.lat);
    const lng = Number(row.lon);
    if (!hitMatchesRequestedCity({ lat, lng, city }, city)) continue;
    const geo = row.geojson;
    const lines = [];
    if (geo?.type === 'LineString' && Array.isArray(geo.coordinates)) {
      lines.push(geo.coordinates);
    } else if (geo?.type === 'MultiLineString' && Array.isArray(geo.coordinates)) {
      lines.push(...geo.coordinates);
    }
    for (const line of lines) {
      const pts = line
        .map((c) => ({ lat: Number(c[1]), lng: Number(c[0]) }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      if (pts.length < 2) continue;
      let len = 0;
      for (let i = 1; i < pts.length; i += 1) len += haversineM(pts[i - 1], pts[i]);
      if (len > bestLen) {
        bestLen = len;
        best = pts;
      }
    }
  }
  if (!best && Number.isFinite(near?.lat)) {
    // Sin nombre estricto: tomar la línea más cercana al ancla
    for (const row of rows) {
      const geo = row.geojson;
      const coords = geo?.type === 'LineString' ? geo.coordinates : null;
      if (!coords?.length) continue;
      const pts = coords
        .map((c) => ({ lat: Number(c[1]), lng: Number(c[0]) }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      if (pts.length < 2) continue;
      const mid = pts[Math.floor(pts.length / 2)];
      if (!hitMatchesRequestedCity({ lat: mid.lat, lng: mid.lng, city }, city)) continue;
      let len = 0;
      for (let i = 1; i < pts.length; i += 1) len += haversineM(pts[i - 1], pts[i]);
      const d = haversineM(mid, near);
      if (d < 1200 && len > bestLen) {
        bestLen = len;
        best = pts;
      }
    }
  }
  return best;
}

/**
 * Anclas con número real en la misma calle (POIs ArcGIS suggest → magicKey).
 * Sirve para interpolar cuando no hay PointAddress.
 */
async function harvestStreetNumberRefs(road, city, near) {
  const lastToken = streetTokens(road).slice(-1)[0] || road;
  if (!lastToken || lastToken.length < 3) return [];
  const texts = [
    `${road}, ${city}`,
    `Av. ${road}, ${city}`,
    `${lastToken}, ${city}`,
  ];
  const suggestions = [];
  await Promise.all(
    texts.slice(0, 2).map(async (text) => {
      const url = new URL(ARCGIS_SUGGEST);
      url.searchParams.set('f', 'json');
      url.searchParams.set('text', text);
      url.searchParams.set('maxSuggestions', '12');
      url.searchParams.set('countryCode', 'CHL');
      if (Number.isFinite(near?.lat) && Number.isFinite(near?.lng)) {
        url.searchParams.set('location', `${near.lng},${near.lat}`);
      }
      const data = await fetchJsonTimeout(url.toString(), { headers: { Accept: 'application/json' } }, 4500);
      for (const s of data?.suggestions || []) {
        if (s?.text && s?.magicKey) suggestions.push(s);
      }
    }),
  );

  const wantCity = normalizeBranchCity(city);
  const tokenRe = new RegExp(`${lastToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(\\d{1,5})\\b`, 'i');
  const candidates = [];
  for (const s of suggestions) {
    const text = String(s.text || '');
    const blob = normText(text);
    if (!blob.includes(normText(lastToken))) continue;
    if (wantCity === 'iquique' && /alto hospicio/.test(blob)) continue;
    if (wantCity === 'alto hospicio' && /\biquique\b/.test(blob) && !/alto hospicio/.test(blob)) continue;
    if (wantCity === 'iquique' && !/iquique/.test(blob)) continue;
    if (wantCity === 'alto hospicio' && !/hospicio/.test(blob)) continue;
    const m = text.match(tokenRe);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || n < 1) continue;
    candidates.push({ text, magicKey: s.magicKey, n });
  }

  const refs = [];
  const seenN = new Set();
  await Promise.all(
    candidates.slice(0, 6).map(async (c) => {
      if (seenN.has(c.n)) return;
      const url = new URL(ARCGIS_FIND);
      url.searchParams.set('f', 'json');
      url.searchParams.set('singleLine', c.text);
      url.searchParams.set('magicKey', c.magicKey);
      url.searchParams.set('maxLocations', '1');
      url.searchParams.set('outFields', 'AddNum,StName,City,Addr_type,PlaceName,DisplayX,DisplayY');
      url.searchParams.set('forStorage', 'false');
      const data = await fetchJsonTimeout(url.toString(), { headers: { Accept: 'application/json' } }, 5000);
      const hit = data?.candidates?.[0];
      if (!hit?.location) return;
      const a = hit.attributes || {};
      const n = parseInt(String(a.AddNum || c.n).replace(/\D.*/, ''), 10);
      const lat = Number(a.DisplayY ?? hit.location.y);
      const lng = Number(a.DisplayX ?? hit.location.x);
      if (!Number.isFinite(n) || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (!hitMatchesRequestedCity({ lat, lng, city: a.City || city, arcCity: a.City }, city)) return;
      if (seenN.has(n)) return;
      seenN.add(n);
      refs.push({ n, lat, lng });
    }),
  );
  return refs.sort((a, b) => a.n - b.n);
}

/**
 * Cuando ArcGIS solo conoce el eje (StreetName), estima la fachada del número
 * con POIs ancla + metros/número típicos de Chile, anclado al sentido de la avenida.
 */
async function refineStreetNameToHousePin(road, houseNumber, city, streetAnchor) {
  const target = parseInt(String(houseNumber || '').replace(/\D.*/, ''), 10);
  if (!Number.isFinite(target) || !Number.isFinite(streetAnchor?.lat)) return null;

  const refs = await harvestStreetNumberRefs(road, city, streetAnchor).catch(() => []);
  const metersPer = estimateMetersPerHouse(refs);

  if (refs.length >= 2) {
    const interp = interpolateHouseCoords(target, refs);
    if (interp && Number.isFinite(interp.lat)) {
      return { lat: interp.lat, lng: interp.lng, precision: interp.precision || 'interpolated' };
    }
  }

  if (refs.length >= 1) {
    const ref = refs.reduce((best, r) => (
      Math.abs(r.n - target) < Math.abs(best.n - target) ? r : best
    ), refs[0]);
    if (ref.n === target) {
      return { lat: ref.lat, lng: ref.lng, precision: 'exact' };
    }
    // El centro ArcGIS de la calle indica el sentido de la avenida;
    // los números crecen hacia ese centro cuando el ancla está en el tramo bajo.
    const moved = offsetAlongDirection(
      ref,
      streetAnchor,
      (target - ref.n) * metersPer,
    );
    if (moved && Number.isFinite(moved.lat) && Number.isFinite(moved.lng)) {
      // Si salió de la comuna, descartar
      if (hitMatchesRequestedCity({ lat: moved.lat, lng: moved.lng, city }, city)) {
        return { lat: moved.lat, lng: moved.lng, precision: 'interpolated' };
      }
    }
  }

  // Sin anclas: proyectar a lo largo de la geometría OSM (norte→sur, nº ≈ metros)
  const line = await fetchStreetPolyline(road, city, streetAnchor).catch(() => null);
  if (line?.length >= 2) {
    const start = line[0].lat >= line[line.length - 1].lat ? line[0] : line[line.length - 1];
    const end = start === line[0] ? line[line.length - 1] : line[0];
    // Ordenar recorrido de norte a sur
    const ordered = start === line[0] ? line : [...line].reverse();
    let remain = Math.max(0, target * metersPer);
    let lat = ordered[0].lat;
    let lng = ordered[0].lng;
    for (let i = 0; i < ordered.length - 1; i += 1) {
      const seg = haversineM(ordered[i], ordered[i + 1]);
      if (seg <= 0) continue;
      if (remain <= seg) {
        const t = remain / seg;
        lat = ordered[i].lat + (ordered[i + 1].lat - ordered[i].lat) * t;
        lng = ordered[i].lng + (ordered[i + 1].lng - ordered[i].lng) * t;
        remain = 0;
        break;
      }
      remain -= seg;
      lat = ordered[i + 1].lat;
      lng = ordered[i + 1].lng;
    }
    if (hitMatchesRequestedCity({ lat, lng, city }, city)) {
      return { lat, lng, precision: 'interpolated' };
    }
    void end;
  }

  return null;
}

async function nominatimSearch(params) {
  const url = new URL(NOMINATIM);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  });
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('countrycodes', 'cl');
  try {
    const data = await fetchJsonTimeout(url.toString(), { headers: FETCH_HEADERS }, 5000);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function photonSearch(query, { lat, lng, limit = 7 } = {}) {
  const url = new URL(PHOTON);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('lang', 'en');
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
  }
  try {
    const data = await fetchJsonTimeout(url.toString(), { headers: FETCH_HEADERS }, 5000);
    return data?.features || [];
  } catch {
    return [];
  }
}

function mapNominatimHit(r, parsed, branchCity = 'Iquique') {
  const a = r.address || {};
  const road = a.road || a.pedestrian || a.footway || a.neighbourhood || r.name || '';
  const osmHouse = a.house_number || null;
  const houseNumber = osmHouse || parsed.houseNumber || null;
  const city = branchCity || a.city || a.town || a.village || a.municipality || parsed.city || '';
  const postcode = resolvePostcode(city, parsed.postcode, a.postcode);
  const state = a.state || parsed.region || (city === 'Arica' ? 'Arica y Parinacota' : 'Tarapacá');
  const shortLabel = formatChileLabel({
    road,
    houseNumber,
    postcode,
    city,
    state,
    neighbourhood: a.neighbourhood,
  });
  const hasExactHouse = houseNumbersMatch(osmHouse, parsed.houseNumber);
  return {
    id: `nom-${r.place_id}`,
    placeId: r.place_id,
    osmType: r.osm_type,
    osmId: r.osm_id,
    label: shortLabel,
    shortLabel,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    precision: hasExactHouse
      ? 'exact'
      : parsed.houseNumber
        ? 'interpolated'
        : osmHouse
          ? 'exact'
          : 'street',
    houseNumber,
    postcode,
    road,
    city,
    state,
    boundingbox: r.boundingbox,
    source: 'nominatim',
  };
}

function mapPhotonHit(f, parsed, branchCity = 'Iquique') {
  const p = f.properties || {};
  const [lng, lat] = f.geometry?.coordinates || [];
  const road = p.name || p.street || '';
  const osmHouse = p.housenumber || null;
  const houseNumber = osmHouse || parsed.houseNumber || null;
  const city = branchCity || p.city || parsed.city || '';
  const postcode = resolvePostcode(city, parsed.postcode, p.postcode);
  const state = p.state || parsed.region || (city === 'Arica' ? 'Arica y Parinacota' : 'Tarapacá');
  const shortLabel = formatChileLabel({
    road: p.street || road,
    houseNumber,
    postcode,
    city,
    state,
  });
  // Preferir "street" type with house in query over bus stops named like streets
  const isBusStop = p.osm_key === 'highway' && p.osm_value === 'bus_stop';
  if (isBusStop && !osmHouse) return null;
  const hasExactHouse = houseNumbersMatch(osmHouse, parsed.houseNumber);
  return {
    id: `pho-${p.osm_type}-${p.osm_id}`,
    osmType: p.osm_type === 'W' ? 'way' : p.osm_type === 'N' ? 'node' : 'relation',
    osmId: p.osm_id,
    label: shortLabel,
    shortLabel,
    lat: Number(lat),
    lng: Number(lng),
    precision: hasExactHouse
      ? 'exact'
      : parsed.houseNumber
        ? 'interpolated'
        : osmHouse
          ? 'exact'
          : 'street',
    houseNumber,
    postcode,
    road: p.street || road,
    city,
    state,
    source: 'photon',
  };
}

async function fetchStreetHouseNumbers(streetName, near) {
  if (!streetName || !near?.lat || !near?.lng) return [];
  // Usar el token más distintivo (última palabra > 3 chars) para tolerar acentos/prefijos
  const tokens = normText(streetName).split(/\s+/).filter((t) => t.length > 3);
  const token = tokens[tokens.length - 1] || normText(streetName).slice(0, 40);
  if (!token) return [];

  const q = `
[out:json][timeout:20];
(
  node["addr:housenumber"]["addr:street"~"${token}",i](around:2500,${near.lat},${near.lng});
  way["addr:housenumber"]["addr:street"~"${token}",i](around:2500,${near.lat},${near.lng});
);
out center 120;
`.trim();

  try {
    const data = await fetchOverpass(q, 9000);
    if (!data?.elements) return [];
    return (data.elements || [])
      .map((el) => {
        const n = parseInt(String(el.tags?.['addr:housenumber'] || '').replace(/\D.*/, ''), 10);
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        if (!Number.isFinite(n) || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { n, lat: Number(lat), lng: Number(lng), street: el.tags?.['addr:street'] || streetName };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function dedupeHits(hits) {
  const seen = new Set();
  const out = [];
  for (const h of hits) {
    if (!h || !Number.isFinite(h.lat) || !Number.isFinite(h.lng)) continue;
    const key = `${h.shortLabel}|${h.lat.toFixed(5)}|${h.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

function houseNumbersMatch(a, b) {
  if (!a || !b) return false;
  const na = parseInt(String(a).replace(/\D.*/, ''), 10);
  const nb = parseInt(String(b).replace(/\D.*/, ''), 10);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

/** Una sola entrada por dirección; prioriza calidad (OSM) sobre cercanía a la sucursal. */
function hitSourceScore(h) {
  if (h?.source === 'arcgis') return 70;
  if (h?.source === 'nominatim') return 50;
  if (h?.source === 'overpass') return 45;
  if (h?.source === 'photon') return 40;
  if (h?.source === 'gps') return 35;
  if (h?.source === 'local') return 12;
  return 5;
}

function dedupeByLabelPreferClosest(hits, bias) {
  const byLabel = new Map();
  for (const h of hits) {
    const key = normText(h.shortLabel);
    const prev = byLabel.get(key);
    if (!prev) {
      byLabel.set(key, h);
      continue;
    }
    const qNew = hitSourceScore(h) + (h.precision === 'exact' ? 20 : h.precision === 'interpolated' ? 8 : 0);
    const qPrev = hitSourceScore(prev) + (prev.precision === 'exact' ? 20 : prev.precision === 'interpolated' ? 8 : 0);
    if (qNew !== qPrev) {
      if (qNew > qPrev) byLabel.set(key, h);
      continue;
    }
    if (!Number.isFinite(bias?.lat) || !Number.isFinite(bias?.lng)) {
      continue;
    }
    const dPrev = haversineM(prev, bias);
    const dNew = haversineM(h, bias);
    // Si ambos son "local", preferir el más cercano; si no, no arrastrar a la sucursal
    if (prev.source === 'local' && h.source === 'local' && dNew < dPrev) {
      byLabel.set(key, h);
    }
  }
  return [...byLabel.values()];
}

/**
 * Checkout: prioriza el número exacto de la sucursal.
 * Si hay duplicados con el mismo texto, conserva el más cercano a la sucursal.
 */
function filterCheckoutHits(hits, parsed, bias) {
  let list = dedupeHits(hits).filter((h) => {
    // Evita basura tipo "1032, Iquique" sin nombre de calle
    if (parsed.houseNumber && !String(h.road || '').trim()) return false;
    return true;
  });
  if (parsed.houseNumber) {
    const withHouse = list.filter(
      (h) => h.houseNumber && houseNumbersMatch(h.houseNumber, parsed.houseNumber),
    );
    const exact = withHouse.filter((h) => h.precision === 'exact');
    if (exact.length) return dedupeByLabelPreferClosest(exact, bias);
    const localFallback = withHouse.filter(
      (h) => h.source === 'local' || h.source === 'overpass' || streetsMatch(h.road, parsed.street),
    );
    const pool = localFallback.length ? localFallback : withHouse;
    return dedupeByLabelPreferClosest(pool, bias);
  }
  return list.filter((h) => h.precision !== 'interpolated');
}

function rankHits(hits, parsed, bias) {
  return [...hits].sort((a, b) => {
    const score = (h) => {
      let s = 0;
      if (h.precision === 'exact') s += 100;
      if (h.precision === 'interpolated') s += 70;
      if (parsed.houseNumber && h.houseNumber === parsed.houseNumber) s += 40;
      if (parsed.street && streetsMatch(h.road, parsed.street)) s += 25;
      const nRoad = normText(h.road);
      const nStreet = normText(parsed.street);
      if (nStreet && nRoad.startsWith(nStreet)) s += 45;
      if (nStreet && nRoad.split(/\s+/).some((w) => w.startsWith(nStreet))) s += 20;
      // Tokens sueltos: "zegers" dentro de "vecente zegers"
      if (nStreet) {
        const qTokens = nStreet.split(/\s+/).filter((w) => w.length >= 3);
        const rTokens = nRoad.split(/\s+/);
        for (const qt of qTokens) {
          if (rTokens.some((rt) => rt.startsWith(qt) || qt.startsWith(rt) || rt === qt)) s += 35;
        }
      }
      if (h.source === 'local') s += 30;
      if (h.matchScore) s += Math.min(40, h.matchScore / 3);
      if (parsed.postcode && h.postcode === parsed.postcode) s += 15;
      if (bias?.lat && bias?.lng) {
        const d = haversineM({ lat: h.lat, lng: h.lng }, { lat: bias.lat, lng: bias.lng });
        s += Math.max(0, 30 - d / 200);
      }
      return s;
    };
    return score(b) - score(a);
  });
}

/**
 * Ancla coordenadas de entrega a la sucursal real (GPS del local).
 * Corrige: escribir "Vivar 1086" devolvía un punto OSM a ~1.9 km
 * mientras el GPS en la tienda cotizaba bien Zona 01 ($2500).
 */
export function snapAddressCoordsForBranch(hit, branch) {
  if (!hit || branch?.lat == null || branch?.lng == null) return hit;
  const bLat = Number(branch.lat);
  const bLng = Number(branch.lng);
  if (!Number.isFinite(bLat) || !Number.isFinite(bLng)) return hit;
  if (!Number.isFinite(Number(hit.lat)) || !Number.isFinite(Number(hit.lng))) return hit;

  const branchParsed = parseAddressQuery(branch.address || '');
  const sameStreet = streetsMatch(hit.road, branchParsed.street);
  if (!sameStreet) return hit;

  const branchNum = branchParsed.houseNumber
    ? parseInt(String(branchParsed.houseNumber).replace(/\D.*/, ''), 10)
    : null;
  const hitNum = hit.houseNumber
    ? parseInt(String(hit.houseNumber).replace(/\D.*/, ''), 10)
    : null;

  // Misma calle + mismo número que la sucursal → GPS exacto del local
  if (Number.isFinite(branchNum) && Number.isFinite(hitNum) && branchNum === hitNum) {
    return { ...hit, lat: bLat, lng: bLng, precision: 'exact' };
  }

  const dM = haversineM(
    { lat: Number(hit.lat), lng: Number(hit.lng) },
    { lat: bLat, lng: bLng },
  );
  // Misma calle pero coords lejos: re-interpola desde la sucursal
  if (Number.isFinite(branchNum) && Number.isFinite(hitNum) && dM > 700) {
    const interp = interpolateHouseCoords(hitNum, [{ n: branchNum, lat: bLat, lng: bLng }]);
    if (interp) {
      return { ...hit, lat: interp.lat, lng: interp.lng, precision: 'exact', source: 'local' };
    }
    return { ...hit, lat: bLat, lng: bLng, precision: 'exact', source: 'local' };
  }

  return hit;
}

async function resolveLocalHouseCoords(parsed, opts = {}) {
  if (!parsed.houseNumber || !(parsed.street || parsed.rest)) return null;
  const city = opts.city || parsed.city || 'Iquique';
  const targetNum = parseInt(String(parsed.houseNumber).replace(/\D.*/, ''), 10);
  if (!Number.isFinite(targetNum)) return null;

  const matches = matchLocalStreets(parsed.street || parsed.rest, { city, limit: 4 });
  if (!matches.length) return null;

  const hasBranch = Number.isFinite(opts.lat) && Number.isFinite(opts.lng);
  const branchParsed = parseAddressQuery(opts.branchAddress || '');
  const branchNum = opts.branchHouseNumber
    ? parseInt(String(opts.branchHouseNumber).replace(/\D.*/, ''), 10)
    : (branchParsed.houseNumber
      ? parseInt(String(branchParsed.houseNumber).replace(/\D.*/, ''), 10)
      : null);
  const postcode = resolvePostcode(city, parsed.postcode);
  const state = city === 'Arica' ? 'Arica y Parinacota' : 'Tarapacá';

  for (const s of matches) {
    const roadName = preferredLocalRoadName(s.name, city) || s.name;
    // Solo anclar a GPS de sucursal si es la MISMA calle del local
    const sameAsBranch = hasBranch && streetsMatch(roadName, branchParsed.street || '');

    const anchor = sameAsBranch
      ? { lat: Number(opts.lat), lng: Number(opts.lng), road: roadName, city }
      : { lat: s.lat, lng: s.lng, road: roadName, city };

    // Caso crítico: cliente escribe la misma dirección de la tienda
    if (sameAsBranch && Number.isFinite(branchNum) && branchNum === targetNum) {
      const label = formatChileLabel({
        road: roadName,
        houseNumber: String(parsed.houseNumber),
        postcode,
        city,
        state,
      });
      return {
        id: `branch-exact-${normText(roadName)}-${targetNum}`,
        label,
        shortLabel: label,
        lat: anchor.lat,
        lng: anchor.lng,
        precision: 'exact',
        houseNumber: String(parsed.houseNumber),
        postcode,
        road: roadName,
        city,
        state,
        source: 'local',
      };
    }

    let known = await fetchStreetHouseNumbers(roadName, anchor);
    known = known.filter((k) => haversineM(k, anchor) <= (sameAsBranch ? 700 : 2500));

    if (sameAsBranch && Number.isFinite(branchNum)) {
      known = known.filter((k) => k.n !== branchNum);
      known.push({
        n: branchNum,
        lat: anchor.lat,
        lng: anchor.lng,
        street: roadName,
        postcode,
      });
    }

    if (!known.length && sameAsBranch) {
      known = [{
        n: Number.isFinite(branchNum) ? branchNum : targetNum,
        lat: anchor.lat,
        lng: anchor.lng,
        street: roadName,
        postcode,
      }];
    }

    if (!known.length) {
      known = [{ n: targetNum, lat: s.lat, lng: s.lng, street: roadName, postcode }];
    }

    let exactKnown = known.find((k) => k.n === targetNum);
    if (exactKnown && sameAsBranch && haversineM(exactKnown, anchor) > 700) exactKnown = null;

    const interp = exactKnown
      ? { lat: exactKnown.lat, lng: exactKnown.lng, precision: 'exact' }
      : interpolateHouseCoords(targetNum, known);

    if (!interp) continue;

    let lat = interp.lat;
    let lng = interp.lng;
    // Nunca arrastrar otra calle al GPS de la sucursal
    if (sameAsBranch && haversineM({ lat, lng }, anchor) > 800) {
      lat = anchor.lat;
      lng = anchor.lng;
    }

    const label = formatChileLabel({
      road: roadName,
      houseNumber: String(parsed.houseNumber),
      postcode,
      city,
      state,
    });
    return {
      id: `local-house-${normText(roadName)}-${targetNum}`,
      label,
      shortLabel: label,
      lat,
      lng,
      precision: 'exact',
      houseNumber: String(parsed.houseNumber),
      postcode,
      road: roadName,
      city,
      state,
      source: 'local',
    };
  }
  return null;
}

/** @deprecated alias */
async function resolveLocalExactHouse(parsed, opts) {
  return resolveLocalHouseCoords(parsed, opts);
}

function localStreetHits(parsed, opts) {
  const city = opts.city || parsed.city || 'Iquique';
  const state = city === 'Arica' ? 'Arica y Parinacota' : 'Tarapacá';
  const postcode = resolvePostcode(city, parsed.postcode);
  const hasBranch = Number.isFinite(opts.lat) && Number.isFinite(opts.lng);
  const branchStreet = parseAddressQuery(opts.branchAddress || '').street;
  const branchNum = opts.branchHouseNumber
    ? parseInt(String(opts.branchHouseNumber).replace(/\D.*/, ''), 10)
    : null;
  const targetNum = parsed.houseNumber
    ? parseInt(String(parsed.houseNumber).replace(/\D.*/, ''), 10)
    : null;
  const seenCoords = new Set();
  return matchLocalStreets(parsed.street || parsed.rest, {
    city,
    houseNumber: parsed.houseNumber,
    limit: opts.limit || 7,
  }).flatMap((s) => {
    const road = preferredLocalRoadName(s.road, city) || s.road;
    const sameAsBranch = hasBranch && streetsMatch(road, branchStreet || '');
    // Solo usar GPS de sucursal si es la misma calle del local
    let lat = s.lat;
    let lng = s.lng;
    if (sameAsBranch && parsed.houseNumber) {
      if (Number.isFinite(branchNum) && Number.isFinite(targetNum) && branchNum === targetNum) {
        lat = Number(opts.lat);
        lng = Number(opts.lng);
      } else if (Number.isFinite(branchNum) && Number.isFinite(targetNum)) {
        const interp = interpolateHouseCoords(targetNum, [{
          n: branchNum,
          lat: Number(opts.lat),
          lng: Number(opts.lng),
        }]);
        if (interp) {
          lat = interp.lat;
          lng = interp.lng;
        } else {
          lat = Number(opts.lat);
          lng = Number(opts.lng);
        }
      } else {
        lat = Number(opts.lat);
        lng = Number(opts.lng);
      }
    }
    const coordKey = `${Number(lat).toFixed(4)}|${Number(lng).toFixed(4)}`;
    if (seenCoords.has(coordKey)) return [];
    seenCoords.add(coordKey);
    const shortLabel = formatChileLabel({
      road,
      houseNumber: parsed.houseNumber,
      postcode,
      city: s.city || city,
      state,
    });
    return [{
      id: parsed.houseNumber ? `${s.id}-${parsed.houseNumber}` : s.id,
      label: shortLabel,
      shortLabel,
      lat,
      lng,
      precision: parsed.houseNumber ? 'exact' : 'street',
      houseNumber: parsed.houseNumber || null,
      postcode,
      road,
      city: s.city || city,
      state,
      source: 'local',
    }];
  });
}

function cacheKey(query, opts) {
  return `${normText(query)}|${normText(opts.city || '')}|${opts.lat || ''}|${opts.lng || ''}|${opts.limit || 7}|${opts.skipSlow ? 'fast' : 'full'}|${opts.skipLocalResolve ? 'nloc' : 'loc'}`;
}

/**
 * Busca direcciones precisas para autocompletado / checkout.
 * @param {string} query
 * @param {{ city?: string, lat?: number, lng?: number, limit?: number, skipSlow?: boolean, skipLocalResolve?: boolean, branchAddress?: string, branchHouseNumber?: string|number }} [opts]
 * @returns {Promise<GeocodeHit[]>}
 */
export async function searchPreciseAddresses(query, opts = {}) {
  const parsed = parseAddressQuery(query);
  if ((parsed.street || parsed.rest).length < 2) return [];

  const key = cacheKey(query, opts);
  if (searchCache.has(key)) {
    return finalizeCheckoutHits(searchCache.get(key), parsed, opts.city, {
      lat: opts.lat,
      lng: opts.lng,
    });
  }

  const city = opts.city || parsed.city || 'Iquique';
  const bias = {
    lat: opts.lat != null ? Number(opts.lat) : -20.23,
    lng: opts.lng != null ? Number(opts.lng) : -70.14,
  };
  const limit = opts.limit || 7;

  if (parsed.houseNumber && !opts.skipLocalResolve) {
    const localResolved = await resolveLocalHouseCoords(parsed, { ...opts, city });
    if (localResolved) {
      const quick = finalizeCheckoutHits([localResolved], parsed, city, bias);
      if (quick.length) {
        searchCache.set(key, quick);
        return quick;
      }
    }
  }

  const local = localStreetHits(parsed, { ...opts, city, limit });

  const freeQ = [
    parsed.houseNumber ? `${parsed.street} ${parsed.houseNumber}` : parsed.street,
    parsed.postcode,
    city,
    'Chile',
  ]
    .filter(Boolean)
    .join(', ');

  const streetParam = parsed.houseNumber
    ? `${parsed.houseNumber} ${parsed.street}`
    : parsed.street;

  const photonQ = parsed.houseNumber
    ? `${parsed.street} ${parsed.houseNumber}, ${city}, Chile`
    : `${parsed.street}, ${city}, Chile`;

  const hasHouse = !!parsed.houseNumber;
  const tasks = [
    photonSearch(photonQ, { ...bias, limit: limit + 3 }).catch(() => []),
  ];
  if (hasHouse || !opts.skipSlow) {
    tasks.push(
      nominatimSearch({
        q: freeQ,
        limit: String(limit),
        viewbox: viewboxForCity(city),
        bounded: '1',
      }).catch(() => []),
    );
  }
  if (hasHouse) {
    tasks.push(
      nominatimSearch({
        street: streetParam,
        city,
        country: 'Chile',
        postalcode: parsed.postcode || undefined,
        limit: String(limit),
      }).catch(() => []),
    );
  }

  const settled = await Promise.all(tasks);
  const photon = settled[0] || [];
  const nomFree = settled[1] || [];
  const nomStruct = settled[2] || [];

  let hits = [
    ...local,
    ...nomFree.map((r) => mapNominatimHit(r, parsed, city)),
    ...nomStruct.map((r) => mapNominatimHit(r, parsed, city)),
    ...photon.map((f) => mapPhotonHit(f, parsed, city)).filter(Boolean),
  ];

  hits = filterByBranchCity(hits, city, bias);
  hits = dedupeHits(hits);

  const targetNum = parsed.houseNumber
    ? parseInt(String(parsed.houseNumber).replace(/\D.*/, ''), 10)
    : null;

  if (Number.isFinite(targetNum) && hits.length && parsed.houseNumber) {
    const localMatch = matchLocalStreets(parsed.street || parsed.rest, { city, limit: 1 })[0];
    const streetCandidates = hits
      .filter((h) => h.road && streetsMatch(h.road, parsed.street || h.road))
      .sort((a, b) => {
        const da = haversineM({ lat: a.lat, lng: a.lng }, bias);
        const db = haversineM({ lat: b.lat, lng: b.lng }, bias);
        return da - db;
      });
    const near = localMatch
      ? { lat: localMatch.lat, lng: localMatch.lng, road: localMatch.name, city }
      : streetCandidates[0] || hits.find((h) => h.road) || hits[0];
    const roadName = localMatch
      ? (preferredLocalRoadName(localMatch.name, city) || localMatch.name)
      : (preferredLocalRoadName(near.road, city) || near.road || parsed.street);
    const known = await fetchStreetHouseNumbers(roadName, near);
    let knownWithBranch = known;
    const branchNum = opts.branchHouseNumber
      ? parseInt(String(opts.branchHouseNumber).replace(/\D.*/, ''), 10)
      : null;
    if (Number.isFinite(branchNum) && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)) {
      if (!knownWithBranch.some((k) => k.n === branchNum)) {
        knownWithBranch = [...knownWithBranch, {
          n: branchNum,
          lat: bias.lat,
          lng: bias.lng,
          street: roadName,
        }];
      }
    }
    const bbox = near.boundingbox || null;

    if (knownWithBranch.length) {
      let exactKnown = knownWithBranch.find((k) => k.n === targetNum);
      if (exactKnown && Number.isFinite(bias.lat)) {
        const dBranch = haversineM(exactKnown, bias);
        if (dBranch > 700) exactKnown = null;
      }
      // Si es el número de la sucursal, forzar GPS del local
      if (Number.isFinite(branchNum) && branchNum === targetNum && Number.isFinite(bias.lat)) {
        exactKnown = { n: targetNum, lat: bias.lat, lng: bias.lng };
      }
      const interp = exactKnown
        ? { lat: exactKnown.lat, lng: exactKnown.lng, precision: 'exact' }
        : interpolateHouseCoords(targetNum, knownWithBranch, bbox);

      if (interp) {
        const postcode = resolvePostcode(city, parsed.postcode, near.postcode, exactKnown?.postcode);
        const label = formatChileLabel({
          road: roadName,
          houseNumber: String(parsed.houseNumber),
          postcode,
          city,
          state: city === 'Arica' ? 'Arica y Parinacota' : 'Tarapacá',
        });
        const enriched = {
          id: `prec-${normText(roadName)}-${targetNum}`,
          label,
          shortLabel: label,
          lat: interp.lat,
          lng: interp.lng,
          precision: interp.precision === 'interpolated' ? 'exact' : interp.precision,
          houseNumber: String(parsed.houseNumber),
          postcode,
          road: roadName,
          city,
          state: city === 'Arica' ? 'Arica y Parinacota' : 'Tarapacá',
          source: 'overpass',
        };
        hits = [
          enriched,
          ...hits.map((h) => {
            if (!parsed.houseNumber) return h;
            const sameStreet = streetsMatch(h.road, roadName) || streetsMatch(h.road, parsed.street);
            const nextLabel = formatChileLabel({
              road: h.road,
              houseNumber: String(parsed.houseNumber),
              postcode: parsed.postcode || h.postcode,
              city: h.city,
              state: h.state,
            });
            const next = {
              ...h,
              houseNumber: String(parsed.houseNumber),
              postcode: parsed.postcode || h.postcode,
              shortLabel: nextLabel,
              label: nextLabel,
            };
            if (!sameStreet) return next;
            if (interp.precision === 'exact') {
              return { ...next, lat: interp.lat, lng: interp.lng, precision: 'exact' };
            }
            if (h.precision !== 'exact') {
              return { ...next, lat: interp.lat, lng: interp.lng, precision: interp.precision };
            }
            return next;
          }),
        ];
        hits = dedupeHits(hits);
      }
    } else if (parsed.houseNumber) {
      hits = hits.map((h) => {
        const nextLabel = formatChileLabel({
          road: h.road,
          houseNumber: String(parsed.houseNumber),
          postcode: parsed.postcode || h.postcode,
          city: h.city || city,
          state: h.state,
        });
        return {
          ...h,
          houseNumber: String(parsed.houseNumber),
          postcode: parsed.postcode || h.postcode,
          shortLabel: nextLabel,
          label: nextLabel,
        };
      });
    }
  }

  const ranked = finalizeCheckoutHits(rankHits(hits, parsed, bias), parsed, city, bias).slice(0, limit);
  if (ranked.length && !opts.skipSlow) searchCache.set(key, ranked);
  if (searchCache.size > 80) {
    const first = searchCache.keys().next().value;
    searchCache.delete(first);
  }
  return ranked;
}

/** Filtra sugerencias del checkout: solo exactas cuando hay número de casa. */
export function filterAddressSuggestionsForCheckout(hits, query, branchCity, bias = {}) {
  return finalizeCheckoutHits(hits || [], parseAddressQuery(query), branchCity, bias);
}

/**
 * Sugerencias instantáneas (catálogo local) al escribir las primeras letras.
 */
export function previewLocalAddresses(query, opts = {}) {
  const parsed = parseAddressQuery(query);
  if ((parsed.street || parsed.rest).length < 2) return [];
  const local = localStreetHits(parsed, opts);
  return finalizeCheckoutHits(
    rankHits(local, parsed, { lat: opts.lat, lng: opts.lng }),
    parsed,
    opts.city,
    { lat: opts.lat, lng: opts.lng },
  );
}

/** Reescribe la query con el nombre correcto de calle del catálogo (vecente→Vicente Zegers). */
function correctedRemoteQuery(parsed, opts = {}) {
  const city = opts.city || parsed.city || 'Iquique';
  const streetRaw = String(parsed.street || parsed.rest || '').trim();
  if (!streetRaw) return null;

  // Si el usuario ya escribió exactamente una calle del catálogo, no reescribir
  const folded = streetRaw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const exactPreferred = preferredLocalRoadName(streetRaw, city);
  const exactFold = String(exactPreferred || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // preferredLocalRoadName ahora solo reescribe con tokens exactos
  const road = exactPreferred && exactFold === folded
    ? exactPreferred
    : (matchLocalStreets(streetRaw, { city, houseNumber: parsed.houseNumber, limit: 1 })[0]?.road || exactPreferred || streetRaw);

  // Si el mejor match local es otra palabra (libertad≠libertador), preferir lo escrito
  const match = matchLocalStreets(streetRaw, { city, houseNumber: parsed.houseNumber, limit: 3 });
  let chosen = road;
  if (match.length) {
    const best = match[0];
    const bestFold = String(best.road || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (bestFold === folded || bestFold.split(' ').includes(folded) || folded.split(' ').every((w) => bestFold.split(' ').includes(w))) {
      chosen = best.road;
    } else if (best.matchScore >= 94) {
      chosen = best.road;
    } else {
      chosen = streetRaw;
    }
  }

  return parsed.houseNumber
    ? `${chosen} ${parsed.houseNumber}, ${city}, Chile`
    : `${chosen}, ${city}, Chile`;
}

export async function searchAddressesProgressive(query, opts = {}, onUpdate) {
  const parsed = parseAddressQuery(query);
  if ((parsed.street || parsed.rest).length < 2) {
    onUpdate?.([]);
    return [];
  }
  const bias = { lat: opts.lat, lng: opts.lng };
  const city = opts.city || parsed.city || 'Iquique';

  const local = localStreetHits(parsed, opts);
  if (local.length) {
    onUpdate?.(finalizeCheckoutHits(
      rankHits(local, parsed, bias),
      parsed,
      opts.city,
      bias,
    ));
  }

  // ArcGIS primero cuando hay número: trae calles reales del mapa (typos: Labattut→Labatut)
  if (parsed.houseNumber && parsed.street) {
    try {
      const streetClean = String(parsed.street).replace(/^(calle|av\.?|avenida|pasaje|psje\.?)\s+/i, '').trim();
      const arcQueries = [
        `${streetClean} ${parsed.houseNumber}, ${city}, Tarapacá, Chile`,
        `Pasaje ${streetClean} ${parsed.houseNumber}, ${city}, Chile`,
        `Calle ${streetClean} ${parsed.houseNumber}, ${city}, Chile`,
        `${parsed.street} ${parsed.houseNumber}, ${city}, Chile`,
      ];
      const batches = await Promise.all(
        [...new Set(arcQueries)].slice(0, 3).map((arcQ) => arcgisFindAddress(arcQ, {
          lat: Number.isFinite(opts.lat) ? opts.lat : (city === 'Iquique' ? -20.22 : undefined),
          lng: Number.isFinite(opts.lng) ? opts.lng : (city === 'Iquique' ? -70.145 : undefined),
          limit: 6,
          timeoutMs: 8000,
        }).catch(() => [])),
      );
      const arcHits = batches.flat()
        .map((c) => mapArcGisCandidate(c, parsed, city))
        .filter(Boolean)
        .filter((h) => hitMatchesRequestedCity(h, city))
        .filter((h) => houseNumbersMatch(h.houseNumber, parsed.houseNumber) || h.addrType === 'StreetName')
        .filter((h) => (
          streetsMatchStrict(h.road, parsed.street)
          || streetsMatchStrict(h.road, streetClean)
          || streetTokens(parsed.street).every((t) => streetTokens(h.road).some((x) => tokensFuzzyEqual(t, x)))
        ));
      if (arcHits.length) {
        onUpdate?.(finalizeCheckoutHits(
          rankHits([...arcHits, ...(local || [])], parsed, bias),
          parsed,
          opts.city,
          bias,
        ));
      }
    } catch {
      // continuar con OSM
    }
  }

  if (parsed.houseNumber && !opts.skipLocalResolve) {
    const localResolved = await resolveLocalHouseCoords(parsed, opts).catch(() => null);
    if (localResolved) {
      // No mezclar si la calle resuelta no coincide con lo escrito
      if (streetsMatchStrict(localResolved.road, parsed.street) || !parsed.street) {
        const exactList = finalizeCheckoutHits(
          [localResolved, ...local],
          parsed,
          opts.city,
          bias,
        );
        if (exactList.length) onUpdate?.(exactList);
      }
    }
  }

  // Buscar en OSM con nombre de calle corregido (más preciso y rápido)
  const remoteQ = correctedRemoteQuery(parsed, opts) || query;
  const fast = await searchPreciseAddresses(remoteQ, { ...opts, skipSlow: true });
  if (fast.length) {
    const filteredFast = parsed.street
      ? fast.filter((h) => !h.road || streetsMatchStrict(h.road, parsed.street) || streetsMatch(h.road, parsed.street))
      : fast;
    onUpdate?.(finalizeCheckoutHits(
      rankHits([...(local || []), ...filteredFast], parsed, bias),
      parsed,
      opts.city,
      bias,
    ));
  }

  if (parsed.houseNumber) {
    const full = await searchPreciseAddresses(remoteQ, { ...opts, skipSlow: false });
    const filteredFull = parsed.street
      ? (full || []).filter((h) => !h.road || streetsMatchStrict(h.road, parsed.street) || streetsMatch(h.road, parsed.street))
      : full;
    if (filteredFull?.length) {
      onUpdate?.(finalizeCheckoutHits(
        rankHits([...(local || []), ...filteredFull], parsed, bias),
        parsed,
        opts.city,
        bias,
      ));
    }
    return filteredFull?.length ? filteredFull : fast.length ? fast : local;
  }
  return fast.length ? fast : local;
}

async function fetchJsonTimeout(url, opts = {}, timeoutMs = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: { ...FETCH_HEADERS, ...(opts.headers || {}) },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchOverpass(query, timeoutMs = 6500) {
  const body = new URLSearchParams({ data: query });
  const tryUrl = async (url) => {
    const data = await fetchJsonTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
      },
      timeoutMs,
    );
    if (!data?.elements) throw new Error('overpass');
    return data;
  };
  try {
    return await Promise.any(OVERPASS_ENDPOINTS.map((url) => tryUrl(url)));
  } catch {
    return null;
  }
}

function guessCityFromCoords(lat, lng) {
  if (lat > -18.62 && lat < -18.4 && lng > -70.4 && lng < -70.24) return 'Arica';
  if (lng > IQUIQUE_AH_LNG_SPLIT) return 'Alto Hospicio';
  return 'Iquique';
}

function betterPostcode(a, b) {
  const score = (p) => {
    if (!p) return 0;
    if (/0{4}$/.test(String(p))) return 1;
    return 2;
  };
  return score(a) >= score(b) ? a || b : b || a;
}

function buildGpsHit({ lat, lng, road, houseNumber, postcode, city, state, precision, source = 'gps', buildingLat, buildingLng }) {
  const cityName = city || guessCityFromCoords(lat, lng);
  const roadName = preferredLocalRoadName(road, cityName) || road || '';
  const shortLabel = formatChileLabel({
    road: roadName || 'Ubicación',
    houseNumber: houseNumber || null,
    postcode: postcode || null,
    city: cityName,
    state: state || 'Tarapacá',
  });
  return {
    id: `rev-${source}-${lat}-${lng}-${houseNumber || 's'}`,
    label: shortLabel,
    shortLabel,
    lat,
    lng,
    precision: houseNumber ? precision || 'exact' : 'street',
    houseNumber: houseNumber ? String(houseNumber) : null,
    postcode: postcode || null,
    road: roadName,
    city: cityName,
    state: state || 'Tarapacá',
    source: 'gps',
    via: source,
    buildingLat: Number.isFinite(buildingLat) ? buildingLat : null,
    buildingLng: Number.isFinite(buildingLng) ? buildingLng : null,
  };
}

function projectFactor(p, a, b) {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-14) return 0;
  const t = ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / len2;
  return Math.max(0, Math.min(1, t));
}

function estimateHouseFromNearby(lat, lng, houses) {
  if (!houses?.length) return null;
  const withDist = houses
    .map((h) => ({
      ...h,
      d: haversineM({ lat, lng }, { lat: h.lat, lng: h.lng }),
    }))
    .sort((a, b) => a.d - b.d);
  const closest = withDist[0];
  if (!closest) return null;
  if (closest.d <= 18) {
    return {
      n: closest.n,
      street: closest.street,
      postcode: closest.postcode,
      precision: 'exact',
      lat: closest.lat,
      lng: closest.lng,
      distM: closest.d,
    };
  }

  const parity = closest.n % 2;
  const sameStreet = withDist.filter((h) => streetsMatch(h.street, closest.street));
  const sameSide = sameStreet.filter((h) => h.n % 2 === parity);
  const pool = sameSide.length >= 2 ? sameSide : sameStreet;

  if (pool.length >= 2) {
    const a = pool[0];
    const b = pool[1];
    const t = projectFactor({ lat, lng }, a, b);
    let n = Math.round(a.n + (b.n - a.n) * t);
    if (n % 2 !== parity) n += 1;
    if (!Number.isFinite(n) || n < 1) n = closest.n;
    return {
      n,
      street: closest.street,
      postcode: closest.postcode || a.postcode,
      precision: 'interpolated',
      lat,
      lng,
      distM: closest.d,
    };
  }

  return {
    n: closest.n,
    street: closest.street,
    postcode: closest.postcode,
    precision: closest.d < 28 ? 'exact' : 'interpolated',
    lat: closest.lat,
    lng: closest.lng,
    distM: closest.d,
  };
}

function parseOverpassHouses(data) {
  return (data?.elements || [])
    .map((el) => {
      const raw = String(el.tags?.['addr:housenumber'] || '').trim();
      const n = parseInt(raw.replace(/\D.*/, ''), 10);
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (!Number.isFinite(n) || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {
        n,
        lat: Number(lat),
        lng: Number(lng),
        street: el.tags?.['addr:street'] || '',
        postcode: el.tags?.['addr:postcode'] || null,
        city: el.tags?.['addr:city'] || null,
      };
    })
    .filter(Boolean);
}

async function reverseOverpassNearby(lat, lng, radiusM = 55) {
  const around = Math.max(25, Math.min(80, Math.round(radiusM)));
  const q = `
[out:json][timeout:6];
(
  node["addr:housenumber"](around:${around},${lat},${lng});
  way["addr:housenumber"](around:${around},${lat},${lng});
);
out center 40;
`.trim();
  const data = await fetchOverpass(q, 6500);
  const houses = parseOverpassHouses(data);
  const est = estimateHouseFromNearby(lat, lng, houses);
  if (!est) return { hit: null, houses };
  const city = houses.find((h) => h.city)?.city || guessCityFromCoords(lat, lng);
  const hit = buildGpsHit({
    lat,
    lng,
    road: est.street,
    houseNumber: String(est.n),
    postcode: est.postcode,
    city,
    state: city === 'Arica' ? 'Arica y Parinacota' : 'Tarapacá',
    precision: est.precision,
    source: 'overpass',
    buildingLat: est.lat,
    buildingLng: est.lng,
  });
  return { hit, houses };
}

function mapReverseNominatim(data, lat, lng) {
  if (!data?.address) return null;
  const a = data.address;
  const road = a.road || a.pedestrian || a.footway || a.neighbourhood || '';
  const houseNumber = a.house_number || null;
  const city = a.city || a.town || a.village || a.municipality || guessCityFromCoords(lat, lng);
  if (!road && !houseNumber) return null;
  return buildGpsHit({
    lat,
    lng,
    road: road || a.suburb || '',
    houseNumber,
    postcode: a.postcode || null,
    city,
    state: a.state || '',
    source: 'nominatim',
  });
}

function mapReversePhoton(data, lat, lng) {
  const f = data?.features?.[0];
  if (!f) return null;
  const p = f.properties || {};
  const road = p.street || p.name || '';
  const houseNumber = p.housenumber || null;
  if (!road && !houseNumber) return null;
  return buildGpsHit({
    lat,
    lng,
    road,
    houseNumber,
    postcode: p.postcode || null,
    city: p.city || guessCityFromCoords(lat, lng),
    state: p.state || '',
    source: 'photon',
  });
}

function parseHouseFromAddressLine(address) {
  const m = String(address || '').trim().match(/(\d+[A-Za-z]?)\s*$/);
  return m ? m[1] : null;
}

function mapArcGisReverse(data, lat, lng) {
  const a = data?.address;
  if (!a) return null;
  const country = String(a.CountryCode || a.CntryName || '').toUpperCase();
  if (country && country !== 'CHL' && !/chile/i.test(a.CntryName || '')) return null;

  let houseNumber = String(a.AddNum || '').trim();
  if (houseNumber.includes('-')) houseNumber = parseHouseFromAddressLine(a.Address) || houseNumber.split('-')[0];
  if (!houseNumber) houseNumber = parseHouseFromAddressLine(a.Address) || '';

  let road = String(a.StName || '').trim();
  if (!road && a.Address) {
    road = String(a.Address)
      .replace(/,.*$/, '')
      .replace(/\s+\d+[A-Za-z]?(?:\s*-\s*\d+)?\s*$/, '')
      .trim();
  }
  road = road.replace(/^(calle|av\.?|avenida|pasaje|psje\.?)\s+/i, '').trim();
  if (!road && !houseNumber) return null;

  const precision = a.Addr_type === 'PointAddress'
    ? 'exact'
    : houseNumber
      ? 'interpolated'
      : 'street';

  return buildGpsHit({
    lat,
    lng,
    road,
    houseNumber: houseNumber || null,
    postcode: a.Postal || null,
    city: a.City || guessCityFromCoords(lat, lng),
    state: a.Region || 'Tarapacá',
    precision,
    source: 'arcgis',
    buildingLat: Number(data.location?.y ?? a.Y),
    buildingLng: Number(data.location?.x ?? a.X),
  });
}

async function reverseArcGis(lat, lng, distanceM = 32) {
  const url = new URL(ARCGIS_REVERSE);
  url.searchParams.set('f', 'json');
  url.searchParams.set('location', `${lng},${lat}`);
  url.searchParams.set('outSR', '4326');
  url.searchParams.set('langCode', 'es');
  url.searchParams.set('distance', String(Math.max(16, Math.min(40, Math.round(distanceM)))));
  url.searchParams.set('featureTypes', 'PointAddress,StreetAddress');
  const data = await fetchJsonTimeout(
    url.toString(),
    { headers: { Accept: 'application/json', 'Accept-Language': 'es' } },
    2800,
  );
  return mapArcGisReverse(data, lat, lng);
}

/**
 * Geocodificación hacia adelante (calle + número → coords de la casa).
 * PointAddress = parcela/fachada; StreetAddress = interpolación en el tramo.
 */
function mapArcGisCandidate(c, parsed, city) {
  if (!c?.location) return null;
  const a = c.attributes || {};
  const addrType = String(a.Addr_type || '');
  // DisplayX/Y = punto de la fachada/parcela; X/Y a veces cae en el eje de la calle
  const lat = Number(a.DisplayY ?? c.location.y);
  const lng = Number(a.DisplayX ?? c.location.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  let road = String(a.StName || '').trim();
  if (!road && a.ShortLabel) {
    road = String(a.ShortLabel)
      .replace(/^(calle|av\.?|avenida|pasaje|psje\.?)\s+/i, '')
      .replace(/\s+\d+[A-Za-z]?\s*$/i, '')
      .trim();
  }
  road = road.replace(/^(calle|av\.?|avenida|pasaje|psje\.?)\s+/i, '').trim();
  const houseNumber = a.AddNum ? String(a.AddNum) : null;
  const hasRealHouse = !!houseNumber;
  const displayHouse = houseNumber || parsed.houseNumber || null;
  const postcode = resolvePostcode(city, parsed.postcode, a.Postal);
  const state = a.Region || (city === 'Arica' ? 'Arica y Parinacota' : 'Tarapacá');
  const hitCity = a.City || city;
  const shortLabel = formatChileLabel({
    road: preferredLocalRoadName(road, city) || road,
    houseNumber: displayHouse,
    postcode,
    city: hitCity,
    state,
  });

  const hasExactHouse = hasRealHouse && houseNumbersMatch(houseNumber, parsed.houseNumber);
  const precision = addrType === 'PointAddress' && hasExactHouse
    ? 'exact'
    : addrType === 'StreetAddress' && hasExactHouse
      ? 'interpolated'
      : addrType === 'StreetName'
        ? (parsed.houseNumber ? 'interpolated' : 'street')
        : displayHouse
          ? 'interpolated'
          : 'street';

  return {
    id: `arcgis-${a.MatchID || `${lat}-${lng}`}`,
    label: shortLabel,
    shortLabel,
    lat,
    lng,
    precision,
    houseNumber: displayHouse,
    realHouseNumber: hasRealHouse,
    postcode,
    road: preferredLocalRoadName(road, city) || road,
    city: hitCity,
    arcCity: a.City || hitCity,
    state,
    source: 'arcgis',
    addrType,
    score: Number(c.score) || Number(a.Score) || 0,
    buildingLat: Number(a.Y ?? c.location.y),
    buildingLng: Number(a.X ?? c.location.x),
  };
}

async function arcgisFindAddress(query, opts = {}) {
  const url = new URL(ARCGIS_FIND);
  url.searchParams.set('f', 'json');
  url.searchParams.set('singleLine', query);
  url.searchParams.set('maxLocations', String(opts.limit || 6));
  url.searchParams.set('outFields', '*');
  url.searchParams.set('forStorage', 'false');
  url.searchParams.set('langCode', 'es');
  url.searchParams.set('countryCode', 'CHL');
  if (opts.category !== false) {
    // Prioriza fachadas / números de casa (no POIs)
    url.searchParams.set('category', 'Address');
  }
  if (Number.isFinite(opts.lat) && Number.isFinite(opts.lng)) {
    url.searchParams.set('location', `${opts.lng},${opts.lat}`);
    url.searchParams.set('maxDistance', '30000');
  }
  const data = await fetchJsonTimeout(
    url.toString(),
    { headers: { Accept: 'application/json', 'Accept-Language': 'es' } },
    opts.timeoutMs || 9000,
  );
  return Array.isArray(data?.candidates) ? data.candidates : [];
}

async function reverseNominatim(lat, lng) {
  const url = new URL(NOMINATIM_REVERSE);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('zoom', '18');
  url.searchParams.set('countrycodes', 'cl');
  const data = await fetchJsonTimeout(url.toString(), {}, 4000);
  return mapReverseNominatim(data, lat, lng);
}

async function reversePhoton(lat, lng) {
  const url = new URL(PHOTON_REVERSE);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('lang', 'en');
  const data = await fetchJsonTimeout(url.toString(), {}, 4000);
  return mapReversePhoton(data, lat, lng);
}

function mergeReverseHits(hits, lat, lng) {
  const list = hits.filter(Boolean);
  if (!list.length) return null;
  const rank = (h) => {
    let s = 0;
    if (h.houseNumber) s += 20;
    if (h.via === 'arcgis') s += 18;
    if (h.via === 'overpass') s += 12;
    if (h.via === 'nominatim') s += 14;
    if (h.precision === 'exact') s += 8;
    if (h.road) s += 3;
    return s;
  };
  const withHouse = list.filter((h) => h.houseNumber).sort((a, b) => rank(b) - rank(a));
  const preferred = withHouse[0] || list[0];
  const houseNumber = preferred.houseNumber || list.find((h) => h.houseNumber)?.houseNumber || null;
  const postcode = list.reduce((acc, h) => betterPostcode(acc, h.postcode), null);
  const city = preferred.city || list.find((h) => h.city)?.city || guessCityFromCoords(lat, lng);
  const state = preferred.state || list.find((h) => h.state)?.state || '';

  const roads = list.filter((h) => h.road).map((h) => h.road);
  const road = roads.sort((a, b) => b.length - a.length)[0] || '';

  return buildGpsHit({
    lat,
    lng,
    road,
    houseNumber,
    postcode,
    city,
    state,
    precision: preferred.precision || (houseNumber ? 'exact' : 'street'),
  });
}

function firstUsefulReverse(promises, lat, lng) {
  return new Promise((resolve) => {
    let pending = promises.length;
    let settled = false;
    const gathered = [];
    if (!pending) {
      resolve(null);
      return;
    }
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(mergeReverseHits(gathered, lat, lng));
    };
    promises.forEach((p) => {
      Promise.resolve(p)
        .then((hit) => {
          if (hit) gathered.push(hit);
          if (hit?.houseNumber && hit?.road && !settled) {
            const specificCp = hit.postcode && !/0{4}$/.test(String(hit.postcode));
            const done = () => {
              if (settled) return;
              settled = true;
              resolve(mergeReverseHits(gathered, lat, lng));
            };
            if (specificCp && gathered.length >= 2) done();
            else setTimeout(done, 280);
            return;
          }
          pending -= 1;
          if (pending === 0) finish();
        })
        .catch(() => {
          pending -= 1;
          if (pending === 0) finish();
        });
    });
  });
}

function pickClosestHit(hits, lat, lng) {
  let best = null;
  let bestD = Infinity;
  for (const h of hits.filter(Boolean)) {
    const bLat = Number(h.buildingLat);
    const bLng = Number(h.buildingLng);
    if (!Number.isFinite(bLat) || !Number.isFinite(bLng)) continue;
    const d = haversineM({ lat, lng }, { lat: bLat, lng: bLng });
    if (d < bestD) {
      bestD = d;
      best = { ...h, distM: d };
    }
  }
  return best;
}

function housesToHits(houses, lat, lng) {
  const city = houses.find((h) => h.city)?.city || guessCityFromCoords(lat, lng);
  return houses.map((h) => buildGpsHit({
    lat,
    lng,
    road: h.street,
    houseNumber: String(h.n),
    postcode: h.postcode,
    city,
    state: city === 'Arica' ? 'Arica y Parinacota' : 'Tarapacá',
    precision: 'exact',
    source: 'overpass',
    buildingLat: h.lat,
    buildingLng: h.lng,
  }));
}

/**
 * Dirección exacta (calle + número) a partir del GPS real del teléfono.
 */
function applyLocalRoadName(hit, city) {
  if (!hit?.road) return hit;
  const corrected = preferredLocalRoadName(hit.road, city) || hit.road;
  if (corrected === hit.road) return hit;
  const label = formatChileLabel({
    road: corrected,
    houseNumber: hit.houseNumber,
    postcode: hit.postcode,
    city: hit.city || city,
    state: hit.state || 'Tarapacá',
  });
  return { ...hit, road: corrected, label, shortLabel: label };
}

/**
 * Resuelve coordenadas EXACTAS para el pin del mapa al elegir una sugerencia.
 * Prioridad: ArcGIS PointAddress (fachada) → Overpass número → OSM → interpolación.
 * No usa el GPS de la sucursal como ancla.
 */
export async function resolveExactMapPin(selection, opts = {}) {
  const city = opts.city || 'Iquique';
  const parsed = parseAddressQuery(
    selection?.shortLabel || selection?.label || [selection?.road, selection?.houseNumber].filter(Boolean).join(' '),
  );
  const road = String(selection?.road || parsed.street || '').trim();
  const houseNumber = String(selection?.houseNumber || parsed.houseNumber || '').trim() || null;
  if (!road) return null;

  const state = city === 'Arica' ? 'Arica y Parinacota' : 'Tarapacá';
  const postcode = resolvePostcode(city, selection?.postcode || parsed.postcode);
  const preferredRoad = preferredLocalRoadName(road, city) || road;
  const label = formatChileLabel({
    road: preferredRoad,
    houseNumber,
    postcode,
    city,
    state,
  });
  const parsedRef = { street: road, houseNumber, postcode, city };

  const branchParsedEarly = parseAddressQuery(opts.branchAddress || '');
  const branchBias = Number.isFinite(opts.lat) && Number.isFinite(opts.lng)
    ? { lat: Number(opts.lat), lng: Number(opts.lng) }
    : null;
  const nearBranchButOtherStreet = (h) => {
    if (!branchBias) return false;
    if (streetsMatch(road, branchParsedEarly.street || '')) return false;
    return haversineM({ lat: Number(h.lat), lng: Number(h.lng) }, branchBias) < 160;
  };

  const packHit = (h, precision, source) => ({
    ...h,
    road: preferredLocalRoadName(h.road || road, city) || preferredRoad,
    houseNumber: houseNumber || h.houseNumber,
    shortLabel: label,
    label,
    postcode: h.postcode || postcode,
    city: h.city || city,
    state: h.state || state,
    lat: Number(h.lat),
    lng: Number(h.lng),
    precision,
    source,
  });

  // 1) ArcGIS: fachada exacta del número (PointAddress). Sin esto el pin cae al centro de calle.
  if (houseNumber) {
    const lastToken = streetTokens(preferredRoad).slice(-1)[0]
      || streetTokens(road).slice(-1)[0]
      || null;

    const queries = [
      `${preferredRoad} ${houseNumber}, ${city}, Tarapacá, Chile`,
      `${road} ${houseNumber}, ${city}, Chile`,
      `Calle ${preferredRoad} ${houseNumber}, ${city}, Chile`,
      `Pasaje ${preferredRoad} ${houseNumber}, ${city}, Chile`,
      `Pasaje ${road} ${houseNumber}, ${city}, Chile`,
    ];
    if (lastToken && lastToken.length >= 4) {
      queries.push(`${lastToken} ${houseNumber}, ${city}, Tarapacá, Chile`);
      queries.push(`Pasaje ${lastToken} ${houseNumber}, ${city}, Chile`);
    }
    if (/higgins/i.test(`${preferredRoad} ${road}`)) {
      queries.unshift(`Libertador Bernardo O'Higgins ${houseNumber}, ${city}, Tarapacá, Chile`);
    }

    const uniqueQueries = [...new Set(queries.filter(Boolean))];

    try {
      // Consultas en paralelo (más fiable que secuencial con timeouts)
      const batches = await Promise.all(
        uniqueQueries.slice(0, 4).map((q) => arcgisFindAddress(q, {
          lat: city === 'Iquique' ? -20.22 : opts.lat,
          lng: city === 'Iquique' ? -70.145 : opts.lng,
          limit: 5,
          timeoutMs: 9000,
        }).catch(() => [])),
      );
      const allCandidates = batches.flat();

      const mapped = allCandidates
        .map((c) => mapArcGisCandidate(c, parsedRef, city))
        .filter(Boolean)
        .filter((h) => Number.isFinite(Number(h.lat)) && Number.isFinite(Number(h.lng)))
        .filter((h) => hitMatchesRequestedCity(h, city))
        .filter((h) => !nearBranchButOtherStreet(h));

      const ranked = mapped
        .map((h) => {
          let s = Number(h.score) || 0;
          if (h.addrType === 'PointAddress') s += 60;
          if (h.addrType === 'StreetAddress') s += 25;
          if (h.addrType === 'StreetName') s += 15;
          if (h.realHouseNumber && houseNumbersMatch(h.houseNumber, houseNumber)) s += 80;
          else if (h.realHouseNumber) s -= 100;
          if (streetsMatchStrict(h.road, road) || streetsMatchStrict(h.road, preferredRoad)) s += 50;
          else if (lastToken && streetTokens(h.road).some((t) => tokensFuzzyEqual(t, lastToken))) s += 35;
          else s -= 40;
          // Preferir comuna pedida (Iquique ≠ Alto Hospicio)
          if (hitMatchesRequestedCity(h, city)) s += 40;
          else s -= 200;
          const labelCity = normalizeBranchCity(h.arcCity || h.city || '');
          if (labelCity === normalizeBranchCity(city)) s += 25;
          return { h, s };
        })
        .sort((a, b) => b.s - a.s);

      const streetOk = (h) => (
        streetsMatchStrict(h.road, road)
        || streetsMatchStrict(h.road, preferredRoad)
        || (!!lastToken && streetTokens(h.road).some((t) => tokensFuzzyEqual(t, lastToken)))
      );

      const bestArc = ranked.find(({ h }) => {
        if (!hitMatchesRequestedCity(h, city)) return false;
        if (!streetOk(h)) return false;
        if (h.addrType === 'PointAddress' && h.realHouseNumber && houseNumbersMatch(h.houseNumber, houseNumber)) {
          return true;
        }
        if (h.addrType === 'StreetAddress' && h.realHouseNumber && houseNumbersMatch(h.houseNumber, houseNumber)) {
          return true;
        }
        if (h.addrType === 'StreetName') return true;
        return false;
      });

      if (bestArc) {
        const arcLabel = formatChileLabel({
          road: preferredLocalRoadName(bestArc.h.road || preferredRoad, city) || bestArc.h.road || preferredRoad,
          houseNumber,
          postcode: bestArc.h.postcode || postcode,
          city,
          state,
        });
        const isFacade = bestArc.h.addrType === 'PointAddress'
          && bestArc.h.realHouseNumber
          && houseNumbersMatch(bestArc.h.houseNumber, houseNumber);
        const isStreetAddr = bestArc.h.addrType === 'StreetAddress'
          && bestArc.h.realHouseNumber
          && houseNumbersMatch(bestArc.h.houseNumber, houseNumber);

        let lat = Number(bestArc.h.lat);
        let lng = Number(bestArc.h.lng);
        let precision = isFacade ? 'exact' : 'interpolated';
        let source = 'arcgis';

        // Solo eje de calle (StreetName): interpolar el número hacia la fachada
        if (!isFacade && !isStreetAddr && bestArc.h.addrType === 'StreetName' && houseNumber) {
          const refined = await refineStreetNameToHousePin(
            preferredRoad || road,
            houseNumber,
            city,
            { lat, lng },
          ).catch(() => null);
          if (refined && Number.isFinite(refined.lat) && Number.isFinite(refined.lng)) {
            lat = refined.lat;
            lng = refined.lng;
            precision = refined.precision || 'interpolated';
            source = 'arcgis-interp';
          }
        }

        return {
          ...bestArc.h,
          road: preferredLocalRoadName(bestArc.h.road || preferredRoad, city) || preferredRoad,
          houseNumber,
          shortLabel: arcLabel,
          label: arcLabel,
          postcode: bestArc.h.postcode || postcode,
          city,
          state,
          lat,
          lng,
          precision,
          source,
        };
      }
    } catch {
      // seguir con otras fuentes
    }
  }

  // 2) Overpass (rápido, timeout corto): solo si aún no hay pin
  const localSeed = matchLocalStreets(road, { city, houseNumber, limit: 1 })[0];
  if (localSeed && houseNumber) {
    const known = await fetchStreetHouseNumbers(localSeed.road || road, {
      lat: localSeed.lat,
      lng: localSeed.lng,
      road: localSeed.road || road,
      city,
    }).catch(() => []);
    const target = parseInt(String(houseNumber).replace(/\D.*/, ''), 10);
    const exact = known.find((k) => k.n === target);
    if (exact && Number.isFinite(exact.lat) && Number.isFinite(exact.lng)) {
      return packHit(
        {
          id: `map-pin-op-${normText(road)}-${houseNumber}`,
          road: localSeed.road || preferredRoad,
          lat: exact.lat,
          lng: exact.lng,
        },
        'exact',
        'overpass',
      );
    }

    const interp = interpolateHouseCoords(
      target,
      known.length ? known : [],
      null,
    );
    if (known.length >= 2 && interp && Number.isFinite(interp.lat) && Number.isFinite(interp.lng)) {
      if (!(
        Number.isFinite(opts.lat)
        && Number.isFinite(opts.lng)
        && !streetsMatch(road, branchParsedEarly.street || '')
        && haversineM(interp, { lat: Number(opts.lat), lng: Number(opts.lng) }) < 120
      )) {
        return packHit(
          {
            id: `map-pin-op-i-${normText(road)}-${houseNumber}`,
            road: localSeed.road || preferredRoad,
            lat: interp.lat,
            lng: interp.lng,
          },
          'interpolated',
          'overpass',
        );
      }
    }

    // Fallback inmediato: centro de esa calle del catálogo (mejor que colgarse)
    if (Number.isFinite(localSeed.lat) && Number.isFinite(localSeed.lng)) {
      return packHit(
        {
          id: `map-pin-local-${normText(road)}-${houseNumber}`,
          road: localSeed.road || preferredRoad,
          lat: localSeed.lat,
          lng: localSeed.lng,
        },
        'interpolated',
        'local',
      );
    }
  }

  // 3) Nominatim / Photon: solo si traen número de casa REAL de OSM (no el de la query)
  const streetParam = houseNumber ? `${houseNumber} ${road}` : road;
  const freeQ = [road, houseNumber, city, 'Chile'].filter(Boolean).join(', ');

  const [structRaw, freeRaw, photonFeats] = await Promise.all([
    nominatimSearch({
      street: streetParam,
      city,
      country: 'Chile',
      postalcode: postcode || undefined,
      limit: '6',
    }).catch(() => []),
    nominatimSearch({
      q: freeQ,
      limit: '6',
    }).catch(() => []),
    photonSearch(`${road}${houseNumber ? ` ${houseNumber}` : ''}, ${city}, Chile`, {
      lat: city === 'Iquique' ? -20.22 : opts.lat,
      lng: city === 'Iquique' ? -70.145 : opts.lng,
      limit: 6,
    }).catch(() => []),
  ]);

  const fromNom = [...(structRaw || []), ...(freeRaw || [])]
    .map((r) => {
      const a = r.address || {};
      const osmHouse = a.house_number || null;
      const h = mapNominatimHit(r, parsedRef, city);
      if (!h) return null;
      // Marcar si el número vino de OSM o solo se rellenó desde la query
      return { ...h, osmHouseNumber: osmHouse };
    })
    .filter(Boolean);
  const fromPho = (photonFeats || [])
    .map((f) => {
      const osmHouse = f?.properties?.housenumber || null;
      const h = mapPhotonHit(f, parsedRef, city);
      if (!h) return null;
      return { ...h, osmHouseNumber: osmHouse };
    })
    .filter(Boolean);

  const candidates = [...fromNom, ...fromPho].filter(
    (h) => Number.isFinite(Number(h.lat)) && Number.isFinite(Number(h.lng)),
  );

  const scored = candidates
    .map((h) => {
      let s = hitSourceScore(h);
      const realHouse = !!h.osmHouseNumber && houseNumbersMatch(h.osmHouseNumber, houseNumber);
      if (realHouse) s += 100;
      if (streetsMatch(h.road, road)) s += 60;
      if (nearBranchButOtherStreet(h)) s -= 200;
      // Penalizar calle sin número real cuando pedimos un número concreto
      if (houseNumber && !h.osmHouseNumber) s -= 50;
      return { h, s, realHouse };
    })
    .sort((a, b) => b.s - a.s);

  for (const { h, realHouse } of scored) {
    if (!streetsMatch(h.road, road) && !normText(h.shortLabel || '').includes(normText(road).split(' ').pop() || '___')) {
      continue;
    }
    if (nearBranchButOtherStreet(h)) continue;
    // Con número: no aceptar centro de calle como si fuera la casa
    if (houseNumber && !realHouse) continue;
    return packHit(h, realHouse ? 'exact' : (h.precision || 'street'), h.source || 'nominatim');
  }

  // 4) Último recurso: centro de calle SOLO si no hay número
  if (localSeed && !houseNumber) {
    return packHit(
      {
        id: `map-pin-${normText(road)}-street`,
        road: localSeed.road || preferredRoad,
        lat: localSeed.lat,
        lng: localSeed.lng,
      },
      'street',
      'local',
    );
  }

  // Con número: NUNCA usar centro de calle. Reintento ArcGIS sin filtro category.
  if (houseNumber) {
    try {
      const q = /higgins/i.test(`${road} ${preferredRoad}`)
        ? `Libertador Bernardo O'Higgins ${houseNumber}, ${city}, Tarapacá, Chile`
        : `${preferredRoad} ${houseNumber}, ${city}, Tarapacá, Chile`;
      const raw = await arcgisFindAddress(q, {
        lat: city === 'Iquique' ? -20.22 : opts.lat,
        lng: city === 'Iquique' ? -70.145 : opts.lng,
        limit: 8,
        timeoutMs: 10000,
        category: false,
      }).catch(() => []);
      const mapped = (raw || [])
        .map((c) => mapArcGisCandidate(c, parsedRef, city))
        .filter(Boolean)
        .filter((h) => houseNumbersMatch(h.houseNumber, houseNumber))
        .filter((h) => h.addrType === 'PointAddress' || h.addrType === 'StreetAddress')
        .filter((h) => {
          const last = streetTokens(preferredRoad).slice(-1)[0] || streetTokens(road).slice(-1)[0];
          return streetsMatchStrict(h.road, preferredRoad)
            || streetsMatchStrict(h.road, road)
            || (last && streetTokens(h.road).includes(last));
        })
        .sort((a, b) => {
          const score = (h) => (h.addrType === 'PointAddress' ? 20 : 0) + (Number(h.score) || 0);
          return score(b) - score(a);
        });
      if (mapped[0]) {
        const h = mapped[0];
        const arcLabel = formatChileLabel({
          road: preferredLocalRoadName(h.road || preferredRoad, city) || h.road || preferredRoad,
          houseNumber,
          postcode: h.postcode || postcode,
          city,
          state,
        });
        return {
          ...h,
          road: preferredLocalRoadName(h.road || preferredRoad, city) || preferredRoad,
          houseNumber,
          shortLabel: arcLabel,
          label: arcLabel,
          postcode: h.postcode || postcode,
          city,
          state,
          lat: Number(h.lat),
          lng: Number(h.lng),
          precision: h.addrType === 'PointAddress' ? 'exact' : 'interpolated',
          source: 'arcgis',
        };
      }
    } catch {
      // sin resultado exacto
    }
  }

  return null;
}

export async function reverseGeocodePrecise(lat, lng, opts = {}) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;

  const accuracy = Number(opts.accuracy);
  const overpassRadius = Number.isFinite(accuracy)
    ? Math.max(20, Math.min(80, Math.round(accuracy * 1.5)))
    : 45;
  const arcRadius = Number.isFinite(accuracy)
    ? Math.max(18, Math.min(50, accuracy * 1.35))
    : 35;

  const key = `rev:${la.toFixed(6)},${ln.toFixed(6)},${Math.round(arcRadius)}`;
  if (searchCache.has(key)) return searchCache.get(key);

  // Lanzar todas las fuentes en paralelo
  const [ovResult, arc, pho, nom] = await Promise.all([
    reverseOverpassNearby(la, ln, overpassRadius).catch(() => ({ hit: null, houses: [] })),
    reverseArcGis(la, ln, arcRadius).catch(() => null),
    reversePhoton(la, ln).catch(() => null),
    reverseNominatim(la, ln).catch(() => null),
  ]);

  const city = guessCityFromCoords(la, ln);

  // Overpass es la fuente más fiable para OSM Chile — tiene prioridad si tiene número
  if (ovResult?.hit?.houseNumber) {
    const corrected = applyLocalRoadName(ovResult.hit, city);
    const result = { ...corrected, lat: la, lng: ln, source: 'gps' };
    searchCache.set(key, result);
    if (searchCache.size > 80) searchCache.delete(searchCache.keys().next().value);
    return result;
  }

  const best = mergeReverseHits([arc, pho, nom], la, ln);

  const finalHit = best
    ? applyLocalRoadName({ ...best, lat: la, lng: ln, source: 'gps', city: best.city || city }, city)
    : {
        id: `rev-raw-${la}-${ln}`,
        label: `Ubicación GPS (${la.toFixed(5)}, ${ln.toFixed(5)})`,
        shortLabel: `Ubicación GPS (${la.toFixed(5)}, ${ln.toFixed(5)})`,
        lat: la,
        lng: ln,
        precision: 'street',
        houseNumber: null,
        postcode: null,
        road: '',
        city,
        state: '',
        source: 'gps',
      };

  if (finalHit.houseNumber) searchCache.set(key, finalHit);
  if (searchCache.size > 80) searchCache.delete(searchCache.keys().next().value);
  return finalHit;
}

export function precisionHint(precision) {
  if (precision === 'exact') return 'Ubicación exacta del número';
  if (precision === 'interpolated') return 'Ubicación estimada por número de casa';
  return 'Calle confirmada — indica el número para más precisión';
}
