import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, LocateFixed, MapPin, Navigation, Search, X } from 'lucide-react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  reverseGeocodePrecise,
  precisionHint,
  searchAddressesProgressive,
  previewLocalAddresses,
  filterAddressSuggestionsForCheckout,
  snapAddressCoordsForBranch,
  parseAddressQuery,
  resolveExactMapPin,
} from '../../utils/addressGeocode';
import { locateWithPrecisePermission, gpsErrorMessage } from '../../utils/gpsLocation';

const DEFAULT_ZOOM = 19;
const MAX_ZOOM = 21;

function MapSync({ center, recenterToken }) {
  const map = useMap();

  useEffect(() => {
    if (!center?.lat || !center?.lng) return;
    map.setView([center.lat, center.lng], map.getZoom(), { animate: false });
  }, [map, center?.lat, center?.lng]);

  useEffect(() => {
    if (!recenterToken || !center?.lat || !center?.lng) return;
    const targetZoom = Math.max(map.getZoom(), DEFAULT_ZOOM);
    map.setView([center.lat, center.lng], targetZoom, { animate: false });
    map.flyTo([center.lat, center.lng], targetZoom, { duration: 0.55 });
    const t = window.setTimeout(() => {
      try {
        map.invalidateSize({ animate: false });
        map.panTo([center.lat, center.lng], { animate: false });
      } catch {
        // ignore
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, [map, center?.lat, center?.lng, recenterToken]);

  useEffect(() => {
    const run = () => {
      try {
        map.invalidateSize({ animate: false });
      } catch {
        // ignore
      }
    };
    run();
    const t1 = setTimeout(run, 80);
    const t2 = setTimeout(run, 260);
    window.addEventListener('resize', run);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', run);
    };
  }, [map]);

  return null;
}

function MapMoveWatcher({ onCenterChange, suppressMoveRef }) {
  const map = useMapEvents({
    moveend: () => {
      if (suppressMoveRef?.current) return;
      const c = map.getCenter();
      onCenterChange({ lat: c.lat, lng: c.lng });
    },
  });

  useEffect(() => {
    const c = map.getCenter();
    onCenterChange({ lat: c.lat, lng: c.lng });
  }, [map, onCenterChange]);

  return null;
}

function FixedPin() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[700] flex items-center justify-center">
      {/* La punta roja inferior debe coincidir con el centro geográfico del mapa */}
      <div className="relative flex translate-y-[-100%] flex-col items-center">
        <div className="absolute left-1/2 top-[100%] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/20 blur-md" />
        <div className="relative flex flex-col items-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white bg-pollon-red text-white shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
            <MapPin className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <div className="-mt-1 h-0 w-0 border-l-[5px] border-r-[5px] border-t-[16px] border-l-transparent border-r-transparent border-t-pollon-red drop-shadow-[0_6px_10px_rgba(0,0,0,0.25)]" />
          <div className="-mt-[1px] h-5 w-[2px] rounded-full bg-white/95" />
          <div className="-mt-[1px] h-3.5 w-[2px] rounded-full bg-pollon-red" />
          <div className="mt-[1px] h-2 w-2 rounded-full border border-white bg-pollon-red shadow-[0_0_0_2px_rgba(255,255,255,0.34)]" />
        </div>
      </div>
    </div>
  );
}

function primaryLine(label) {
  const i = String(label || '').indexOf(',');
  return i === -1 ? label : label.slice(0, i);
}

function secondaryLine(label) {
  const i = String(label || '').indexOf(',');
  return i === -1 ? '' : label.slice(i + 1).trim();
}

export function GpsMapPickerModal({
  open,
  initialCenter,
  onClose,
  onConfirm,
  cityBias = 'Iquique',
  biasLat,
  biasLng,
  branchAddress = '',
  branchHouseNumber = null,
}) {
  const [center, setCenter] = useState(initialCenter);
  const [recenterToken, setRecenterToken] = useState(0);
  const [draft, setDraft] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const searchTimerRef = useRef(null);
  const searchReqRef = useRef(0);
  const skipReverseRef = useRef(false);
  const suppressMoveRef = useRef(false);
  const searchPinLockRef = useRef(false);
  const lockedPinRef = useRef(null);
  const searchBoxRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setCenter(initialCenter || null);
    setDraft(null);
    setError('');
    setGpsAccuracy(null);
    setSearchQuery('');
    setSuggestions([]);
    setSearchOpen(false);
    setSearchExpanded(false);
    setActiveIdx(-1);
    searchPinLockRef.current = false;
    lockedPinRef.current = null;
  }, [open, initialCenter?.lat, initialCenter?.lng]);

  useEffect(() => {
    if (!searchExpanded) return;
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [searchExpanded]);

  useEffect(() => {
    if (!open || !center?.lat || !center?.lng) return undefined;
    if (skipReverseRef.current) {
      skipReverseRef.current = false;
      return undefined;
    }
    // No pisar un pin exacto elegido por búsqueda (calle + número)
    if (searchPinLockRef.current && lockedPinRef.current) {
      const locked = lockedPinRef.current;
      const dist = Math.hypot(
        (Number(center.lat) - Number(locked.lat)) * 111320,
        (Number(center.lng) - Number(locked.lng)) * 111320 * Math.cos((Number(center.lat) * Math.PI) / 180),
      );
      // Solo liberar si el usuario arrastró el mapa claramente (>80 m)
      if (dist < 80) {
        return undefined;
      }
      searchPinLockRef.current = false;
      lockedPinRef.current = null;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      // Si se activó el candado mientras esperábamos, no reverse
      if (searchPinLockRef.current) return;
      setLoadingAddress(true);
      setError('');
      try {
        const geo = await reverseGeocodePrecise(center.lat, center.lng, {
          accuracy: Number.isFinite(gpsAccuracy) ? gpsAccuracy : 18,
        });
        if (!cancelled && !searchPinLockRef.current) {
          setDraft(geo ? { ...geo, lat: center.lat, lng: center.lng, source: 'gps' } : null);
        }
      } catch (err) {
        if (!cancelled && !searchPinLockRef.current) {
          setDraft(null);
          setError(err?.message || 'No se pudo leer la dirección del punto seleccionado.');
        }
      } finally {
        if (!cancelled) setLoadingAddress(false);
      }
    }, 260);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, center?.lat, center?.lng, gpsAccuracy]);

  const runSearch = useCallback((q) => {
    clearTimeout(searchTimerRef.current);
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearchOpen(false);
      setSearchLoading(false);
      return;
    }

    const opts = {
      city: cityBias,
      lat: biasLat,
      lng: biasLng,
      branchHouseNumber,
      branchAddress,
      limit: 8,
    };

    const localNow = previewLocalAddresses(q, opts);
    if (localNow.length) {
      setSuggestions(localNow);
      setSearchOpen(true);
      setActiveIdx(0);
    }

    const applyHits = (hits, reqId) => {
      if (reqId !== searchReqRef.current) return;
      let list = filterAddressSuggestionsForCheckout(hits || [], q, cityBias, {
        lat: biasLat,
        lng: biasLng,
      });
      const branchRef = {
        lat: biasLat,
        lng: biasLng,
        address: branchAddress || (branchHouseNumber ? `Vivar ${branchHouseNumber}` : ''),
        city: cityBias,
      };
      // Solo snap si es la misma calle de la sucursal; no mover otras calles
      list = list.map((h) => snapAddressCoordsForBranch(h, branchRef));
      // Preferir resultados OSM/Photon sobre "local" cuando hay número
      list = [...list].sort((a, b) => {
        const score = (h) => {
          let s = 0;
          if (h.source === 'arcgis') s += 55;
          if (h.source === 'nominatim' || h.source === 'photon' || h.source === 'overpass') s += 40;
          if (h.source === 'local') s -= 10;
          if (h.precision === 'exact' || h.precision === 'interpolated') s += 20;
          if (h.addrType === 'PointAddress') s += 15;
          return s;
        };
        return score(b) - score(a);
      });
      if (!list.length && localNow.length) return;
      const display = list.length ? list : localNow.map((h) => snapAddressCoordsForBranch(h, branchRef));
      setSuggestions(display);
      setSearchOpen(display.length > 0);
      setActiveIdx(display.length ? 0 : -1);
    };

    const reqId = ++searchReqRef.current;
    setSearchLoading(true);

    searchTimerRef.current = setTimeout(async () => {
      try {
        await searchAddressesProgressive(q, opts, (hits) => applyHits(hits, reqId));
      } catch {
        if (reqId === searchReqRef.current && !localNow.length) {
          setSuggestions([]);
          setSearchOpen(false);
        }
      } finally {
        if (reqId === searchReqRef.current) setSearchLoading(false);
      }
    }, 40);
  }, [cityBias, biasLat, biasLng, branchHouseNumber, branchAddress]);

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    runSearch(q);
  };

  const applySelectionToMap = (finalHit) => {
    if (!finalHit || !Number.isFinite(Number(finalHit.lat)) || !Number.isFinite(Number(finalHit.lng))) return;
    const branchRef = {
      lat: biasLat,
      lng: biasLng,
      address: branchAddress || '',
      city: cityBias,
    };
    // snap solo afecta misma calle de la tienda
    const snapped = snapAddressCoordsForBranch(finalHit, branchRef);
    const lat = Number(snapped.lat);
    const lng = Number(snapped.lng);
    const labelText = snapped.shortLabel || finalHit.shortLabel || finalHit.label || '';
    const precision = snapped.precision
      || (snapped.houseNumber ? 'exact' : 'street');

    setSearchQuery(labelText);
    setSuggestions([]);
    setSearchOpen(false);
    setActiveIdx(-1);
    setError('');
    setGpsAccuracy(null);
    setLoadingAddress(false);

    skipReverseRef.current = true;
    suppressMoveRef.current = true;
    const nextDraft = {
      ...snapped,
      lat,
      lng,
      source: 'search',
      precision,
    };
    // Candado: no dejar que el reverse GPS pise la fachada / número buscado
    const hasHouse = !!(snapped.houseNumber || finalHit.houseNumber);
    if (precision === 'exact' || precision === 'interpolated' || hasHouse) {
      searchPinLockRef.current = true;
      lockedPinRef.current = { lat, lng };
    } else {
      searchPinLockRef.current = false;
      lockedPinRef.current = null;
    }
    setDraft(nextDraft);
    setCenter({ lat, lng });
    setRecenterToken((v) => v + 1);
    window.setTimeout(() => {
      suppressMoveRef.current = false;
    }, 2200);
  };

  const handleSelectSuggestion = async (item) => {
    if (!item) return;
    setSearchOpen(false);
    setSuggestions([]);
    setSearchLoading(true);
    setError('');

    // Si la sugerencia ya trae coords de la comuna correcta, mueve el pin al toque
    const hasItemCoords = Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng));
    const itemInCity = hasItemCoords && !(
      cityBias === 'Iquique' && Number(item.lng) > -70.12
    ) && !(
      /hospicio/i.test(cityBias || '') && Number(item.lng) < -70.12
    );
    if (hasItemCoords && itemInCity) {
      applySelectionToMap({
        ...item,
        precision: item.precision || (item.houseNumber ? 'interpolated' : 'street'),
        source: item.source || 'search',
      });
    }

    let finalHit = null;
    try {
      const timeoutMs = 14000;
      const exact = await Promise.race([
        resolveExactMapPin(item, {
          city: cityBias,
          lat: biasLat,
          lng: biasLng,
          branchAddress,
        }),
        new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ]);
      if (exact && Number.isFinite(Number(exact.lat)) && Number.isFinite(Number(exact.lng))) {
        finalHit = exact;
      } else if (hasItemCoords && itemInCity) {
        finalHit = item;
      } else if (item.houseNumber) {
        setError('No se pudo ubicar el número exacto en esta comuna. Prueba de nuevo o mueve la aguja a tu puerta.');
        setSearchLoading(false);
        setLoadingAddress(false);
        return;
      }
    } catch {
      if (hasItemCoords && itemInCity) {
        finalHit = item;
      } else if (item.houseNumber) {
        setError('No se pudo ubicar el número exacto en esta comuna. Prueba de nuevo o mueve la aguja a tu puerta.');
        setSearchLoading(false);
        setLoadingAddress(false);
        return;
      } else {
        finalHit = item;
      }
    } finally {
      setSearchLoading(false);
      setLoadingAddress(false);
    }

    if (finalHit && Number.isFinite(Number(finalHit.lat)) && Number.isFinite(Number(finalHit.lng))) {
      applySelectionToMap(finalHit);
    }
  };

  const label = useMemo(() => {
    if (!draft?.shortLabel) return '';
    return draft.shortLabel;
  }, [draft]);

  const canConfirm = !!(draft?.road && draft?.houseNumber);

  const handleRecenter = async () => {
    if (loadingGps) return;
    setLoadingGps(true);
    setError('');
    try {
      const pos = await locateWithPrecisePermission({
        onImprove: (p) => setGpsAccuracy(p?.coords?.accuracy ?? null),
        onProgress: (p) => setGpsAccuracy(p?.coords?.accuracy ?? null),
      });
      setGpsAccuracy(pos?.coords?.accuracy ?? null);
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCenter(next);
      setRecenterToken((v) => v + 1);
    } catch (err) {
      setError(gpsErrorMessage(err));
    } finally {
      setLoadingGps(false);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (!searchOpen || !suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
    }
  };

  useEffect(() => {
    if (!searchOpen) return undefined;
    const onDoc = (ev) => {
      if (!searchBoxRef.current?.contains(ev.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [searchOpen]);

  const parsedSearch = parseAddressQuery(searchQuery);

  const body = open ? (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/55 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gps-map-picker-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-[0.4rem] bg-white shadow-[0_28px_80px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#c00000] px-4 pb-3.5 pt-3.5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pr-1">
              <h3 id="gps-map-picker-title" className="text-[13.5px] font-bold leading-[1.35] tracking-[-0.01em] sm:text-[14px]">
                Selecciona tu ubicación exacta o busca manualmente desde este buscador
              </h3>
              <p className="mt-1.5 text-[11px] font-medium leading-[1.45] text-white/90">
                Mueve el mapa hasta dejar la aguja en tu puerta. Si el GPS no detecta bien tu dirección, toca el icono de búsqueda.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[0.28rem] p-1 text-white transition hover:bg-black/20"
              aria-label="Cerrar selector de mapa"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div ref={searchBoxRef} className="relative mt-3">
            {!searchExpanded ? (
              <button
                type="button"
                onClick={() => setSearchExpanded(true)}
                className="flex h-10 w-10 items-center justify-center rounded-[0.28rem] border border-white bg-white text-[#c00000] transition hover:bg-zinc-100"
                aria-label="Buscar manualmente solo en caso no detectó su dirección"
                title="Buscar manualmente solo en caso no detectó su dirección"
              >
                <Search className="h-[18px] w-[18px]" strokeWidth={2.5} />
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-[0.28rem] border border-white bg-white px-2.5 py-2">
                <Search className="h-4 w-4 flex-none text-[#c00000]" strokeWidth={2.4} />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={() => suggestions.length && setSearchOpen(true)}
                  placeholder="Escribe calle y número (ej: Zegers 789)"
                  autoComplete="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-black outline-none placeholder:font-normal placeholder:text-zinc-400"
                  aria-label="Buscar dirección"
                  aria-autocomplete="list"
                  aria-expanded={searchOpen}
                />
                {searchLoading && <Loader2 className="h-4 w-4 flex-none animate-spin text-[#c00000]" />}
                {searchQuery && !searchLoading && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSuggestions([]);
                      setSearchOpen(false);
                    }}
                    className="rounded p-0.5 text-zinc-500 hover:bg-zinc-100 hover:text-black"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {!searchQuery && !searchLoading && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchExpanded(false);
                      setSuggestions([]);
                      setSearchOpen(false);
                    }}
                    className="rounded p-0.5 text-zinc-500 hover:bg-zinc-100 hover:text-black"
                    aria-label="Cerrar búsqueda manual"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            {searchExpanded && searchOpen && suggestions.length > 0 && (
              <ul
                role="listbox"
                className="absolute left-0 right-0 z-[900] mt-1.5 max-h-56 overflow-y-auto rounded-[0.28rem] border border-zinc-300 bg-white"
              >
                {suggestions.map((s, idx) => {
                  const text = s.shortLabel || s.label || '';
                  return (
                    <li
                      key={s.id || `${text}-${idx}`}
                      role="option"
                      aria-selected={activeIdx === idx}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSuggestion(s);
                      }}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`flex cursor-pointer items-start gap-2.5 border-b border-zinc-100 px-3 py-2.5 text-left last:border-0 ${
                        activeIdx === idx ? 'bg-red-50' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <MapPin
                        className={`mt-0.5 h-4 w-4 flex-none ${
                          s.precision === 'exact' || s.precision === 'interpolated'
                            ? 'text-pollon-red'
                            : 'text-zinc-400'
                        }`}
                      />
                      <span className="min-w-0 flex-1 leading-snug">
                        <span className="block text-[13px] font-semibold text-black">
                          {primaryLine(text)}
                        </span>
                        {secondaryLine(text) && (
                          <span className="mt-0.5 block text-[11px] font-normal text-zinc-500">
                            {secondaryLine(text)}
                          </span>
                        )}
                        {(parsedSearch.houseNumber && String(s.houseNumber || '') === String(parsedSearch.houseNumber)) && (
                          <span className="mt-1 inline-flex rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            Coincidencia exacta
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="relative h-[52vh] min-h-[320px] bg-zinc-200">
          {center?.lat && center?.lng ? (
            <MapContainer
              center={[center.lat, center.lng]}
              zoom={DEFAULT_ZOOM}
              maxZoom={MAX_ZOOM}
              scrollWheelZoom
              className="h-full w-full"
            >
              <TileLayer
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
                maxZoom={MAX_ZOOM}
              />
              <MapSync center={center} recenterToken={recenterToken} />
              <MapMoveWatcher onCenterChange={setCenter} suppressMoveRef={suppressMoveRef} />
            </MapContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-600">
              Cargando mapa...
            </div>
          )}

          <FixedPin />

          <button
            type="button"
            onClick={handleRecenter}
            className="absolute bottom-4 right-4 z-[800] flex h-12 w-12 items-center justify-center rounded-full border-2 border-black bg-white text-black transition hover:bg-zinc-100"
            aria-label="Volver a mi ubicación GPS"
            title="Volver a mi ubicación GPS"
          >
            {loadingGps ? <Loader2 className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5" />}
          </button>
        </div>

        <div className="border-t border-zinc-300 bg-white px-4 py-3.5">
          <div className="rounded-[0.28rem] border border-black bg-[rgba(34,197,94,0.22)] px-3.5 py-3 backdrop-blur-[2px]">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 rounded-[0.22rem] bg-[#166534] p-1.5 text-white">
                <LocateFixed className="h-3.5 w-3.5" strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#14532d]">
                  Punto seleccionado
                </p>
                <p className="mt-1 text-[13.5px] font-semibold leading-[1.35] text-[#1d4ed8] sm:text-[14px]">
                  {loadingAddress ? 'Leyendo calle y número...' : (label || 'Mueve el mapa o busca manualmente tu dirección')}
                </p>
                <p className="mt-1 text-[11px] font-medium leading-[1.4] text-zinc-600">
                  {error
                    || (draft?.precision
                      ? precisionHint(draft.precision)
                      : 'Confirma solo cuando aparezca calle y número completos.')}
                  {gpsAccuracy != null ? ` Precisión GPS: ${Math.round(gpsAccuracy)} m.` : ''}
                </p>
              </div>
            </div>
          </div>

          {!canConfirm && !loadingAddress && (
            <p className="mt-2 text-[11px] font-medium leading-[1.4] text-[#c00000]">
              Aún no hay número de casa confirmado. Acerca la aguja a tu puerta o busca manualmente “calle número”.
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[0.28rem] border border-black bg-white px-3 py-2.5 text-[13px] font-semibold text-black transition hover:bg-zinc-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canConfirm || loadingAddress}
              onClick={() => canConfirm && onConfirm?.({ ...draft, lat: center.lat, lng: center.lng, source: draft?.source || 'gps' })}
              className="rounded-[0.28rem] bg-[#c00000] px-3 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#a00000] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  if (!body || typeof document === 'undefined') return null;
  return createPortal(body, document.body);
}
