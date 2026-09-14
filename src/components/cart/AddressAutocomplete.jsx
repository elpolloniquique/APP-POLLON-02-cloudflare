import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Loader2, X, Crosshair, LocateFixed, ChevronRight } from 'lucide-react';
import {
  searchAddressesProgressive,
  parseAddressQuery,
  previewLocalAddresses,
  filterAddressSuggestionsForCheckout,
  snapAddressCoordsForBranch,
} from '../../utils/addressGeocode';
import {
  gpsErrorMessage,
  locateWithPrecisePermission,
  ADDRESS_LIST_HINT,
} from '../../utils/gpsLocation';
import { GpsMapPickerModal } from './GpsMapPickerModal';

/**
 * Dirección de entrega.
 * - mode="map": botón que abre mapa GPS (checkout cliente).
 * - mode="search": autocompletado por texto (admin / ubicación sucursal).
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  required,
  disabled,
  cityBias = 'Iquique',
  biasLat,
  biasLng,
  branchHouseNumber = null,
  branchAddress = '',
  mode = 'map',
}) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsPhase, setGpsPhase] = useState('');
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [gpsError, setGpsError] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(!!value);
  const [selectedPrecision, setSelectedPrecision] = useState(null);
  const [fromGps, setFromGps] = useState(false);
  const [askGps, setAskGps] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [mapPickerCenter, setMapPickerCenter] = useState(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const containerRef = useRef(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!value) {
      setQuery('');
      setSelected(false);
      setSelectedPrecision(null);
      setFromGps(false);
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setQuery(value);
    setSelected(true);
  }, [value]);

  const search = useCallback((q) => {
    clearTimeout(timerRef.current);
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
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
      setOpen(true);
      setActiveIdx(0);
    }

    const applyHits = (hits, reqId) => {
      if (reqId !== reqIdRef.current) return;
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
      list = list.map((h) => snapAddressCoordsForBranch(h, branchRef));
      if (!list.length && localNow.length) return;
      const display = list.length ? list : localNow.map((h) => snapAddressCoordsForBranch(h, branchRef));
      setSuggestions(display);
      setOpen(display.length > 0);
      setActiveIdx(display.length ? 0 : -1);
    };

    const reqId = ++reqIdRef.current;
    setLoading(true);

    timerRef.current = setTimeout(async () => {
      try {
        await searchAddressesProgressive(q, opts, (hits) => applyHits(hits, reqId));
      } catch {
        if (reqId === reqIdRef.current && !localNow.length) {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        if (reqId === reqIdRef.current) setLoading(false);
      }
    }, 140);
  }, [cityBias, biasLat, biasLng, branchHouseNumber, branchAddress]);

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    setSelected(false);
    setSelectedPrecision(null);
    setFromGps(false);
    setGpsError('');
    onChange?.(q, null);
    search(q);
  };

  const handleSelect = (item) => {
    if (!item) return;
    const parsed = parseAddressQuery(query);
    if (mode === 'search' && parsed.houseNumber && !item?.houseNumber) return;
    const finalItem = snapAddressCoordsForBranch(item, {
      lat: biasLat,
      lng: biasLng,
      address: branchAddress || (branchHouseNumber ? `${item.road || ''} ${branchHouseNumber}` : ''),
      city: cityBias,
    });
    const label = finalItem.shortLabel || finalItem.label || '';
    setQuery(label);
    setSelected(true);
    setSelectedPrecision(finalItem.precision);
    setFromGps(finalItem.source === 'gps' || mode === 'map');
    setOpen(false);
    setSuggestions([]);
    setGpsError('');
    onChange?.(label, finalItem);
    onSelect?.(finalItem);
  };

  const handleClear = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setQuery('');
    setSelected(false);
    setSelectedPrecision(null);
    setFromGps(false);
    setSuggestions([]);
    setOpen(false);
    setGpsError('');
    onChange?.('', null);
    onSelect?.(null);
    if (mode === 'search') inputRef.current?.focus();
  };

  const handleUseGps = () => {
    if (disabled || gpsLoading) return;
    setGpsError('');
    setAskGps(true);
  };

  const handleAllowPreciseGps = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (disabled || gpsLoading) return;
    setAskGps(false);
    setGpsError('');
    setGpsLoading(true);
    setGpsPhase('permission');
    setGpsAccuracy(null);

    const branchFallback =
      Number.isFinite(Number(biasLat)) && Number.isFinite(Number(biasLng))
        ? { lat: Number(biasLat), lng: Number(biasLng) }
        : null;

    try {
      const pos = await locateWithPrecisePermission({
        onProgress: (p) => {
          setGpsPhase('reading');
          setGpsAccuracy(p?.coords?.accuracy ?? null);
        },
        onImprove: (p) => {
          setGpsPhase('reading');
          setGpsAccuracy(p?.coords?.accuracy ?? null);
        },
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setGpsAccuracy(pos.coords.accuracy ?? null);
      setMapPickerCenter({ lat, lng });
      setMapPickerOpen(true);
      setGpsError('');
    } catch (err) {
      // iPhone/Safari: si el GPS está bloqueado, igual abrimos el mapa
      // centrado en la sucursal para que el cliente marque su puerta a mano.
      if (branchFallback) {
        setMapPickerCenter(branchFallback);
        setMapPickerOpen(true);
        setGpsError(
          `${gpsErrorMessage(err)} Puedes mover el mapa y confirmar con Listo.`,
        );
      } else {
        setGpsError(gpsErrorMessage(err));
      }
    } finally {
      setGpsLoading(false);
      setGpsPhase('');
      setGpsAccuracy(null);
    }
  };

  const handleMapConfirm = (item) => {
    if (!item) return;
    setGpsError('');
    handleSelect({
      ...item,
      source: 'gps',
      precision: item.houseNumber ? (item.precision || 'exact') : 'street',
    });
    setMapPickerOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (mode !== 'search') return undefined;
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mode]);

  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelectorAll('li')[activeIdx];
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const parsed = parseAddressQuery(query);
  const borderColor = selected
    ? 'border-emerald-600'
    : query && !selected && !loading && !gpsLoading
      ? 'border-amber-500'
      : 'border-[#d4d4d4]';

  const primaryLine = (label) => {
    const i = label.indexOf(',');
    return i === -1 ? label : label.slice(0, i);
  };
  const secondaryLine = (label) => {
    const i = label.indexOf(',');
    return i === -1 ? '' : label.slice(i + 1).trim();
  };

  const highlightMatch = (text) => {
    const needle = (parsed.street || query).trim();
    if (!needle || needle.length < 2) return text;
    const idx = text.toLowerCase().indexOf(needle.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="rounded-sm bg-amber-100 px-0.5 font-extrabold text-pollon-black">{text.slice(idx, idx + needle.length)}</mark>
        {text.slice(idx + needle.length)}
      </>
    );
  };

  const permissionDialog = askGps && typeof document !== 'undefined' && createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gps-perm-title"
      onClick={() => setAskGps(false)}
    >
      <div
        className="w-full max-w-sm rounded-[0.4rem] bg-white p-5 shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-pollon-red">
          <LocateFixed className="h-6 w-6" strokeWidth={2.3} />
        </div>
        <h3 id="gps-perm-title" className="text-center text-base font-extrabold text-pollon-black">
          Ubicación precisa
        </h3>
        <p className="mt-2 text-center text-[13px] leading-snug text-gray-600">
          Para abrir el mapa cerca de ti necesitamos el GPS del teléfono. En iPhone elige <span className="font-semibold text-gray-700">Permitir</span> (ubicación precisa si aparece).
        </p>
        <p className="mt-2 text-center text-[12px] leading-snug text-gray-500">
          Si Safari bloqueó la ubicación antes, puedes abrir el mapa igual y marcar tu puerta a mano.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAskGps(false)}
            className="rounded-[0.32rem] border border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleAllowPreciseGps}
            className="rounded-[0.32rem] bg-pollon-red px-3 py-2.5 text-sm font-extrabold text-white hover:bg-red-700"
          >
            Permitir GPS
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );

  if (mode === 'map') {
    return (
      <div ref={containerRef} className="relative">
        {/* Campo oculto para validación HTML required */}
        <input
          type="text"
          required={required}
          value={query}
          readOnly
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />

        <button
          type="button"
          onClick={handleUseGps}
          disabled={disabled || gpsLoading}
          className={`flex w-full min-h-[2.55rem] items-center gap-2.5 rounded-[0.32rem] border bg-white px-2.5 py-[0.45rem] text-left transition disabled:opacity-50 ${borderColor} ${
            selected ? 'hover:border-emerald-700' : 'hover:border-pollon-red/50'
          }`}
          aria-label={selected ? 'Cambiar dirección en el mapa' : 'Seleccionar dirección en el mapa'}
        >
          <span
            className={`flex h-8 w-8 flex-none items-center justify-center rounded-[0.28rem] ${
              selected ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-pollon-red'
            }`}
          >
            {gpsLoading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <MapPin className="h-4 w-4" strokeWidth={2.3} />}
          </span>
          <span className="min-w-0 flex-1">
            {selected && query ? (
              <>
                <span className="block truncate text-sm font-semibold text-[#3b82f6]">{query}</span>
                <span className="mt-0.5 block text-[11px] text-emerald-700">Toca para ajustar en el mapa</span>
              </>
            ) : (
              <>
                <span className="block text-sm font-semibold text-gray-700">Seleccionar en el mapa</span>
                <span className="mt-0.5 block text-[11px] text-gray-500">GPS preciso · calle y número exactos</span>
              </>
            )}
          </span>
          {selected && query && !gpsLoading && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') handleClear(ev);
              }}
              className="flex-none rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Limpiar dirección"
            >
              <X className="h-4 w-4" />
            </span>
          )}
          {!gpsLoading && (
            <ChevronRight className={`h-4 w-4 flex-none ${selected ? 'text-emerald-600' : 'text-pollon-red'}`} />
          )}
        </button>

        {gpsLoading && (
          <p className="checkout-label__hint mt-1 px-0.5">
            {gpsPhase === 'permission' && 'Permite la ubicación precisa en el aviso del teléfono…'}
            {gpsPhase === 'reading' && (
              gpsAccuracy != null
                ? `Afinando GPS… precisión ${Math.round(gpsAccuracy)} m${gpsAccuracy <= 20 ? ' ✓' : ' (espera)'}`
                : 'GPS activado — afinando ubicación…'
            )}
            {!gpsPhase && 'Abriendo mapa…'}
          </p>
        )}
        {!gpsLoading && (
          <p
            className={`checkout-label__hint mt-1 flex items-start gap-1.5 px-0.5 ${
              gpsError ? 'text-red-600' : selected ? 'text-emerald-700' : ''
            }`}
          >
            {selected && <Crosshair className="mt-0.5 h-3 w-3 shrink-0" />}
            <span>
              {gpsError
                || (selected
                  ? 'Ubicación confirmada en el mapa'
                  : 'Toca el campo para abrir el mapa y marcar tu punto exacto.')}
            </span>
          </p>
        )}

        <GpsMapPickerModal
          open={mapPickerOpen}
          initialCenter={mapPickerCenter}
          onClose={() => setMapPickerOpen(false)}
          onConfirm={handleMapConfirm}
          cityBias={cityBias}
          biasLat={biasLat}
          biasLng={biasLng}
          branchAddress={branchAddress}
          branchHouseNumber={branchHouseNumber}
        />
        {permissionDialog}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex min-h-[2.4rem] items-center gap-1.5 rounded-[0.32rem] border px-2.5 py-[0.38rem] transition ${borderColor} bg-white`}>
        <MapPin className={`h-4 w-4 flex-none ${selected ? 'text-emerald-600' : 'text-gray-400'}`} />
        <input
          ref={inputRef}
          type="text"
          required={required}
          disabled={disabled || gpsLoading}
          placeholder="Ej: Sotomayor 785, Iquique"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length && setOpen(true)}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-haspopup="listbox"
          role="combobox"
          aria-label="Dirección"
        />
        {(loading || gpsLoading) && <Loader2 className="h-4 w-4 animate-spin text-gray-400 flex-none" />}
        {query && !loading && !gpsLoading && (
          <button type="button" onClick={handleClear} className="flex-none rounded-md p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Limpiar">
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={handleUseGps}
          disabled={disabled || gpsLoading}
          title="Usar ubicación precisa del teléfono"
          aria-label="Pedir permiso de GPS preciso y completar calle y número"
          className={`flex h-7 w-7 flex-none items-center justify-center rounded-[0.28rem] transition disabled:opacity-50 ${
            fromGps
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-red-50 text-pollon-red hover:bg-pollon-red hover:text-white'
          }`}
        >
          <LocateFixed className="h-4 w-4" strokeWidth={2.3} />
        </button>
      </div>

      {gpsLoading && (
        <p className="mt-1 px-0.5 text-[11px] leading-snug text-gray-600">
          {gpsPhase === 'permission' && 'Permite la ubicación precisa en el aviso del teléfono…'}
          {gpsPhase === 'reading' && (
            gpsAccuracy != null
              ? `Afinando GPS… precisión ${Math.round(gpsAccuracy)} m${gpsAccuracy <= 20 ? ' ✓' : ' (espera)'}`
              : 'GPS activado — afinando ubicación…'
          )}
          {!gpsPhase && 'Obteniendo tu dirección exacta…'}
        </p>
      )}
      {!gpsLoading && (
        <p
          className={`mt-1 flex items-start gap-1.5 px-0.5 text-[11px] leading-snug ${
            gpsError ? 'text-red-600' : selected ? 'text-emerald-700' : 'text-gray-500'
          }`}
        >
          {selected && <Crosshair className="mt-0.5 h-3 w-3 shrink-0" />}
          <span>{gpsError || ADDRESS_LIST_HINT}</span>
        </p>
      )}

      <GpsMapPickerModal
        open={mapPickerOpen}
        initialCenter={mapPickerCenter}
        onClose={() => setMapPickerOpen(false)}
        onConfirm={handleMapConfirm}
        cityBias={cityBias}
        biasLat={biasLat}
        biasLng={biasLng}
        branchAddress={branchAddress}
        branchHouseNumber={branchHouseNumber}
      />
      {permissionDialog}

      {open && suggestions.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 z-[200] mt-1 max-h-72 overflow-y-auto rounded-[0.32rem] border border-gray-200 bg-white shadow-xl"
        >
          {suggestions.map((s, idx) => (
            <li
              key={s.id}
              role="option"
              aria-selected={activeIdx === idx}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
              onMouseEnter={() => setActiveIdx(idx)}
              className={`flex cursor-pointer items-start gap-3 border-b border-gray-50 px-3.5 py-2.5 text-sm last:border-0 transition ${
                activeIdx === idx ? 'bg-red-50' : 'hover:bg-gray-50'
              }`}
            >
              <MapPin
                className={`mt-0.5 h-4 w-4 flex-none ${
                  s.precision === 'exact' || s.precision === 'interpolated'
                    ? 'text-pollon-red'
                    : 'text-gray-400'
                }`}
                aria-hidden
              />
              <span className="min-w-0 flex-1 leading-snug">
                <span className="font-semibold text-gray-900">{highlightMatch(primaryLine(s.shortLabel))}</span>
                {secondaryLine(s.shortLabel) && (
                  <span className="mt-0.5 block text-[12px] text-gray-500">{secondaryLine(s.shortLabel)}</span>
                )}
                <span className="mt-1 inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                  {(s.precision === 'exact' || s.precision === 'interpolated') && 'Exacto'}
                  {s.precision === 'street' && 'Calle'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
