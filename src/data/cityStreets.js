/** Calles frecuentes del norte (autocompletado instantáneo en checkout). */

export const CITY_STREETS = {
  Iquique: [
    { name: 'Sotomayor', lat: -20.2142, lng: -70.1478 },
    { name: 'Bartolomé Vivar', lat: -20.2307, lng: -70.1357 },
    { name: 'Vivar', lat: -20.2307, lng: -70.1357 },
    { name: 'Thompson', lat: -20.2158, lng: -70.1462 },
    { name: 'Tarapacá', lat: -20.2135, lng: -70.1488 },
    { name: 'Baquedano', lat: -20.2148, lng: -70.1505 },
    { name: 'Orella', lat: -20.2164, lng: -70.1455 },
    { name: 'Vicente Zegers', lat: -20.2172, lng: -70.1448 },
    { name: 'Zegers', lat: -20.2172, lng: -70.1448 },
    { name: 'Bolívar', lat: -20.2151, lng: -70.1492 },
    { name: 'San Martín', lat: -20.2178, lng: -70.1484 },
    { name: 'Amunátegui', lat: -20.2194, lng: -70.1471 },
    { name: 'Patricio Lynch', lat: -20.2208, lng: -70.1458 },
    { name: 'Lynch', lat: -20.2208, lng: -70.1458 },
    { name: 'Chipana', lat: -20.2221, lng: -70.1442 },
    { name: 'Obispo Labbé', lat: -20.2234, lng: -70.1431 },
    { name: '21 de Mayo', lat: -20.2139, lng: -70.1522 },
    { name: 'Arturo Prat', lat: -20.2118, lng: -70.1514 },
    { name: 'Aníbal Pinto', lat: -20.2166, lng: -70.1518 },
    { name: 'Manuel Rodríguez', lat: -20.2189, lng: -70.1502 },
    { name: 'Esmeralda', lat: -20.2126, lng: -70.1496 },
    { name: 'Serrano', lat: -20.2112, lng: -70.1485 },
    { name: 'Riquelme', lat: -20.2196, lng: -70.1436 },
    { name: 'Latorre', lat: -20.2214, lng: -70.1424 },
    { name: "Bernardo O'Higgins", lat: -20.21876, lng: -70.14475 },
    { name: "O'Higgins", lat: -20.21876, lng: -70.14475 },
    { name: "Libertador Bernardo O'Higgins", lat: -20.21876, lng: -70.14475 },
    { name: 'Héroes de la Concepción', lat: -20.2286, lng: -70.1388 },
    { name: 'Salvador Allende', lat: -20.2364, lng: -70.1402 },
    { name: 'Circunvalación', lat: -20.2421, lng: -70.1368 },
    { name: 'Costanera', lat: -20.2268, lng: -70.1548 },
    { name: 'Playa Brava', lat: -20.2428, lng: -70.1462 },
    { name: 'Cavancha', lat: -20.2334, lng: -70.1516 },
    { name: 'Tadeo Haenke', lat: -20.2392, lng: -70.1324 },
    { name: 'La Tirana', lat: -20.2486, lng: -70.1288 },
    { name: 'Barros Arana', lat: -20.2144, lng: -70.1446 },
    { name: 'Ramírez', lat: -20.2131, lng: -70.1464 },
    { name: 'Sargento Aldea', lat: -20.2202, lng: -70.1496 },
    { name: 'Videla', lat: -20.2181, lng: -70.1466 },
    { name: 'Wilson', lat: -20.2256, lng: -70.1444 },
    // Centro aproximado cerca del tramo con números (~1181); ArcGIS afina la fachada
    { name: 'Juan Martínez', lat: -20.21927, lng: -70.14555 },
    { name: 'Centenario', lat: -20.2318, lng: -70.1294 },
    { name: 'Aeropuerto', lat: -20.538, lng: -70.181 },
    { name: 'Manuel Bulnes', lat: -20.2228, lng: -70.1476 },
    { name: 'Libertad', lat: -20.22537, lng: -70.14405 },
    { name: 'Labatut', lat: -20.2289, lng: -70.1442 },
    { name: 'Pasaje Labatut', lat: -20.2289, lng: -70.1442 },
    { name: 'Labattut', lat: -20.2289, lng: -70.1442 },
    { name: 'Hernán Fuenzalida', lat: -20.2292, lng: -70.1351 },
    { name: 'Brigadier General Hernán Fuenzalida', lat: -20.2292, lng: -70.1351 },
    { name: 'Arturo Fernández', lat: -20.2285, lng: -70.1438 },
    { name: 'Recabarren', lat: -20.24136, lng: -70.14384 },
    { name: 'Luis Emilio Recabarren', lat: -20.24136, lng: -70.14384 },
    { name: 'Av. Luis Emilio Recabarren', lat: -20.24136, lng: -70.14384 },
    { name: 'Avenida Luis Emilio Recabarren', lat: -20.24136, lng: -70.14384 },
    { name: 'Avenida Emilio Recabarren', lat: -20.24136, lng: -70.14384 },
    { name: 'Pisagua', lat: -20.2294, lng: -70.1418 },
    { name: 'Obispo Labbé', lat: -20.2234, lng: -70.1431 },
    { name: 'José Joaquín Pérez', lat: -20.2216, lng: -70.1398 },
    { name: 'Avenida Playa Brava', lat: -20.2436, lng: -70.1474 },
    { name: 'Avenida Arturo Prat', lat: -20.2118, lng: -70.1514 },
    { name: 'Avenida Salvador Allende', lat: -20.2364, lng: -70.1402 },
    { name: 'Avenida La Tirana', lat: -20.2486, lng: -70.1288 },
    { name: 'Avenida Circunvalación', lat: -20.2421, lng: -70.1368 },
    { name: 'Pedro Prado', lat: -20.2348, lng: -70.1342 },
    { name: 'Diego Portales', lat: -20.2282, lng: -70.1336 },
    { name: 'Chintaguaya', lat: -20.2198, lng: -70.1384 },
    { name: 'Las Américas', lat: -20.2472, lng: -70.1348 },
    { name: 'El Boro', lat: -20.2554, lng: -70.1262 },
    { name: 'Bajo Molle', lat: -20.2688, lng: -70.1184 },
    { name: 'Playa Blanca', lat: -20.2586, lng: -70.1228 },
    { name: 'Los Alamos', lat: -20.2388, lng: -70.1286 },
    { name: 'Los Pinos', lat: -20.2412, lng: -70.1304 },
    { name: 'Santa María', lat: -20.2326, lng: -70.1372 },
    { name: 'Colón', lat: -20.2156, lng: -70.1472 },
    { name: 'Cochrane', lat: -20.2124, lng: -70.1478 },
    { name: 'Washington', lat: -20.2108, lng: -70.1466 },
    { name: 'Patricio Lynch', lat: -20.2208, lng: -70.1458 },
    { name: 'Avenida Héroes de la Concepción', lat: -20.2286, lng: -70.1388 },
  ],
  'Alto Hospicio': [
    { name: 'Los Álamos', lat: -20.2678, lng: -70.1014 },
    { name: 'Los Pinos', lat: -20.2702, lng: -70.0988 },
    { name: 'Los Canelos', lat: -20.2724, lng: -70.0966 },
    { name: 'La Pampa', lat: -20.2756, lng: -70.0942 },
    { name: 'Santa Rosa', lat: -20.2694, lng: -70.1048 },
    { name: 'Villa El Cardenal', lat: -20.2648, lng: -70.1082 },
    { name: 'Los Aromos', lat: -20.2738, lng: -70.1024 },
    { name: 'Los Olivos', lat: -20.2762, lng: -70.0996 },
    { name: 'Los Copihues', lat: -20.2784, lng: -70.0972 },
    { name: 'Las Palmas', lat: -20.2716, lng: -70.1066 },
    { name: 'Avenida Los Canelos', lat: -20.2724, lng: -70.0966 },
    { name: 'Avenida La Pampa', lat: -20.2756, lng: -70.0942 },
    { name: 'René Schneider', lat: -20.2668, lng: -70.1002 },
    { name: 'José Miguel Carrera', lat: -20.2688, lng: -70.0974 },
    { name: 'Manuel Rodríguez', lat: -20.2706, lng: -70.1038 },
    { name: 'Bernardo O’Higgins', lat: -20.2742, lng: -70.1054 },
    { name: 'Las Parcelas', lat: -20.2812, lng: -70.0918 },
    { name: 'La Negra', lat: -20.2846, lng: -70.0884 },
    { name: 'Santa Cecilia', lat: -20.2634, lng: -70.1068 },
    { name: 'Villa Esmeralda', lat: -20.2658, lng: -70.0956 },
  ],
  Arica: [
    { name: '18 de Septiembre', lat: -18.4784, lng: -70.3212 },
    { name: '21 de Mayo', lat: -18.4768, lng: -70.3186 },
    { name: 'Diego Portales', lat: -18.4802, lng: -70.3164 },
    { name: 'Santa María', lat: -18.4826, lng: -70.3126 },
    { name: 'Máximo Lira', lat: -18.4754, lng: -70.3148 },
    { name: 'Chacabuco', lat: -18.4796, lng: -70.3194 },
    { name: 'Colón', lat: -18.4772, lng: -70.3224 },
    { name: 'Baquedano', lat: -18.4748, lng: -70.3206 },
    { name: 'San Martín', lat: -18.4814, lng: -70.3182 },
    { name: 'Sotomayor', lat: -18.4788, lng: -70.3156 },
    { name: 'Arturo Prat', lat: -18.4762, lng: -70.3238 },
    { name: 'Azapa', lat: -18.5194, lng: -70.2862 },
    { name: 'Avenida Santa María', lat: -18.4826, lng: -70.3126 },
    { name: 'Avenida Diego Portales', lat: -18.4802, lng: -70.3164 },
    { name: 'Saucache', lat: -18.4628, lng: -70.3048 },
    { name: 'Chinchorro', lat: -18.4622, lng: -70.3042 },
    { name: 'Playa Chinchorro', lat: -18.4586, lng: -70.3088 },
    { name: 'José Manuel Balmaceda', lat: -18.4838, lng: -70.3174 },
    { name: 'General Velásquez', lat: -18.4852, lng: -70.3142 },
    { name: 'Pedro de Valdivia', lat: -18.4874, lng: -70.3118 },
  ],
};

function fold(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Colapsa letras dobles: Labattut → labatut (typos frecuentes en pasajes). */
function foldLoose(s) {
  return fold(s).replace(/(.)\1+/g, '$1');
}

/** Distancia de edición (Levenshtein) para typos: vecente→vicente, tomson→thompson */
function editDistance(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const rows = s.length + 1;
  const cols = t.length + 1;
  const d = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) d[i][0] = i;
  for (let j = 0; j < cols; j += 1) d[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
    }
  }
  return d[s.length][t.length];
}

function tokenScore(queryToken, streetToken) {
  if (!queryToken || !streetToken) return 0;
  if (streetToken === queryToken) return 100;
  const qLoose = foldLoose(queryToken);
  const sLoose = foldLoose(streetToken);
  if (qLoose && sLoose && qLoose === sLoose) return 98;

  // Prefijo de tipeo: "zege"→"zegers" OK; "libertad"→"libertador" NO (otra calle)
  if (streetToken.startsWith(queryToken) && streetToken !== queryToken) {
    const rest = streetToken.slice(queryToken.length);
    if (queryToken.length >= 5 && rest.length >= 2) return 0;
    if (queryToken.length >= 4 && rest.length >= 3) return 0;
    if (queryToken.length <= 5) return 90;
    return 0;
  }
  if (queryToken.startsWith(streetToken) && streetToken.length >= 4) {
    const rest = queryToken.slice(streetToken.length);
    if (rest.length >= 2) return 0;
    return 78;
  }
  if (queryToken.length >= 4 && streetToken.length >= 4) {
    const dist = editDistance(queryToken, streetToken);
    if (dist === 1) return 88;
    if (dist === 2 && queryToken.length >= 6) return 72;
    const distLoose = editDistance(qLoose, sLoose);
    if (distLoose === 0) return 96;
    if (distLoose === 1) return 86;
  }
  return 0;
}

function streetsForCity(city) {
  const key = Object.keys(CITY_STREETS).find((k) => fold(k) === fold(city));
  if (key) return CITY_STREETS[key];
  if (/hospicio/i.test(city || '')) return CITY_STREETS['Alto Hospicio'];
  if (/arica/i.test(city || '')) return CITY_STREETS.Arica;
  return CITY_STREETS.Iquique;
}

/**
 * Nombre canónico local. Nunca reescribe "Libertad" → "Libertador…".
 */
export function preferredLocalRoadName(road, city = 'Iquique') {
  const raw = String(road || '')
    .replace(/^(calle|av\.?|avenida|pasaje|psje\.?)\s+/i, '')
    .trim();
  if (!raw) return '';
  const nRoad = fold(raw);
  const list = streetsForCity(city);

  const exact = list.find((s) => fold(s.name) === nRoad);
  if (exact) return exact.name;

  const looseRoad = foldLoose(raw);
  const exactLoose = list.find((s) => foldLoose(s.name) === looseRoad);
  if (exactLoose) return exactLoose.name;

  const roadWords = nRoad.split(' ').filter((w) => w.length > 2);
  const scored = [];
  for (const s of list) {
    const n = fold(s.name);
    const words = n.split(' ').filter((w) => w.length > 2);
    if (!words.length || !roadWords.length) continue;

    // Todas las palabras de la query deben existir como tokens exactos en la calle (o viceversa)
    const short = roadWords.length <= words.length ? roadWords : words;
    const long = roadWords.length <= words.length ? words : roadWords;
    if (!short.every((w) => long.includes(w))) continue;

    // Evitar que una sola palabra corta reescriba a un nombre mucho más largo no equivalente
    if (roadWords.length === 1 && words.length > 1 && !words.includes(roadWords[0])) continue;

    scored.push({ name: s.name, len: n.length, wordHits: short.length });
  }
  if (!scored.length) return raw;
  scored.sort((a, b) => b.wordHits - a.wordHits || b.len - a.len);
  return scored[0].name;
}

/**
 * Sugerencias instantáneas al escribir iniciales / typos:
 * "zege" | "zegers" | "vicente" | "vecente zegers" → Vicente Zegers / Zegers
 */
export function matchLocalStreets(query, { city = 'Iquique', houseNumber = null, limit = 6 } = {}) {
  const q = fold(query);
  if (q.length < 2) return [];
  const qWords = q.split(' ').filter((w) => w.length >= 2);
  const list = streetsForCity(city);
  const scored = [];

  for (const s of list) {
    const n = fold(s.name);
    if (!n) continue;
    const words = n.split(' ').filter(Boolean);
    const lastWord = words[words.length - 1] || '';
    let score = 0;

    if (n === q) score = 100;
    else if (n.startsWith(`${q} `) || n === q) score = 96;
    else if (words.some((w) => w === q)) score = 94;
    else if (q.length <= 5 && words.some((w) => w.startsWith(q))) score = 88;
    // NO usar n.includes(q): "libertad" ⊂ "libertador…"

    // Cada token del usuario vs cada palabra de la calle
    for (const qw of qWords) {
      for (const sw of words) {
        score = Math.max(score, tokenScore(qw, sw));
      }
      if (lastWord) {
        const lastHit = tokenScore(qw, lastWord);
        if (lastHit >= 70) score = Math.max(score, lastHit + 8);
      }
    }

    // Bonus si varios tokens encajan (vicente + zegers)
    if (qWords.length > 1) {
      let hits = 0;
      for (const qw of qWords) {
        if (words.some((sw) => tokenScore(qw, sw) >= 70) || tokenScore(qw, n) >= 70) hits += 1;
      }
      if (hits >= 2) score = Math.max(score, 98);
      else if (hits === 1 && score >= 70) score += 6;
    }

    if (score < 48) continue;
    scored.push({ ...s, score });
  }

  scored.sort((a, b) => b.score - a.score || b.name.length - a.name.length || a.name.localeCompare(b.name, 'es'));

  const seen = new Set();
  const out = [];
  for (const s of scored) {
    const k = fold(s.name);
    if (seen.has(k)) continue;
    // Preferir nombre largo si hay duplicado de coords (Vicente Zegers > Zegers)
    const longerKey = [...seen].find((prev) => {
      const prevStreet = list.find((x) => fold(x.name) === prev);
      return prevStreet && prevStreet.lat === s.lat && prevStreet.lng === s.lng;
    });
    if (longerKey && fold(s.name).length <= longerKey.length) continue;
    if (longerKey && fold(s.name).length > longerKey.length) {
      const idx = out.findIndex((o) => fold(o.road) === longerKey);
      if (idx >= 0) out.splice(idx, 1);
      seen.delete(longerKey);
    }
    seen.add(k);
    out.push({
      id: `local-${k}`,
      road: s.name,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      city,
      houseNumber: houseNumber || null,
      precision: houseNumber ? 'interpolated' : 'street',
      matchScore: s.score,
    });
    if (out.length >= limit) break;
  }
  return out;
}
