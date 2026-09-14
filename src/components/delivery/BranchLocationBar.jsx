import { useEffect, useState } from 'react';
import { MapPin, Pencil, Check, X, Loader2, Navigation } from 'lucide-react';
import { AddressAutocomplete } from '../cart/AddressAutocomplete';
import { searchPreciseAddresses, reverseGeocodePrecise } from '../../utils/addressGeocode';

/**
 * Barra de ubicación de sucursal (Zona 00): punto central del cálculo por km.
 */
export function BranchLocationBar({
  branch,
  center,
  editing,
  onStartEdit,
  onCancel,
  onSave,
  saving = false,
  draft,
  onDraftChange,
}) {
  const [resolving, setResolving] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!editing) setLocalError('');
  }, [editing]);

  const displayAddress = branch?.address?.trim()
    || (branch?.city ? `${branch.city}` : '')
    || 'Sin dirección configurada';

  const hasGps = center?.lat != null && center?.lng != null;

  const applyHit = (hit) => {
    if (!hit) return;
    onDraftChange?.({
      address: hit.label || hit.address || draft?.address || '',
      lat: Number(hit.lat),
      lng: Number(hit.lng),
    });
    setLocalError('');
  };

  const resolveTypedAddress = async () => {
    const q = (draft?.address || '').trim();
    if (q.length < 4) {
      setLocalError('Escribe una dirección completa (calle y número).');
      return null;
    }
    setResolving(true);
    setLocalError('');
    try {
      const hits = await searchPreciseAddresses(q, {
        city: branch?.city || 'Iquique',
        lat: draft?.lat ?? center?.lat,
        lng: draft?.lng ?? center?.lng,
        limit: 5,
      });
      const best = hits?.[0];
      if (!best?.lat || !best?.lng) {
        setLocalError('No se encontró esa dirección. Prueba otra o mueve el pin en el mapa.');
        return null;
      }
      applyHit(best);
      return best;
    } catch {
      setLocalError('No se pudo geocodificar. Revisa la dirección o mueve el pin.');
      return null;
    } finally {
      setResolving(false);
    }
  };

  const handleConfirm = async () => {
    let next = draft;
    if (next?.lat == null || next?.lng == null || !Number.isFinite(Number(next.lat))) {
      const hit = await resolveTypedAddress();
      if (!hit) return;
      next = {
        address: hit.label || hit.address || draft?.address,
        lat: Number(hit.lat),
        lng: Number(hit.lng),
      };
    }
    if (!String(next?.address || '').trim()) {
      setLocalError('La dirección es obligatoria.');
      return;
    }
    await onSave?.(next);
  };

  const handleMapSyncLabel = async () => {
    if (draft?.lat == null || draft?.lng == null) return;
    setResolving(true);
    try {
      const rev = await reverseGeocodePrecise(draft.lat, draft.lng, {
        city: branch?.city || 'Iquique',
      });
      if (rev?.label || rev?.address) {
        onDraftChange?.({
          ...draft,
          address: rev.label || rev.address,
        });
      }
    } catch {
      /* keep coords */
    } finally {
      setResolving(false);
    }
  };

  return (
    <section className="branch-location-bar">
      <div className="branch-location-bar__row">
        <div className="branch-location-bar__lead">
          <div className="branch-location-bar__icon">
            <MapPin className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div className="branch-location-bar__titles">
            <div className="branch-location-bar__title-row">
              <h3 className="branch-location-bar__title">Ubicación de Sucursal</h3>
              <span className="branch-location-bar__badge">Zona 00</span>
            </div>
            <p className="branch-location-bar__hint">
              Punto central desde el que se calcula el delivery por kilometraje
            </p>
          </div>
        </div>

        <div className="branch-location-bar__body">
          {editing ? (
            <div>
              <AddressAutocomplete
                mode="search"
                value={draft?.address || ''}
                onChange={(v) => onDraftChange?.({ ...draft, address: v, lat: null, lng: null })}
                onSelect={(hit) => {
                  if (!hit) {
                    onDraftChange?.({ ...draft, address: draft?.address || '', lat: null, lng: null });
                    return;
                  }
                  applyHit(hit);
                }}
                cityBias={branch?.city || 'Iquique'}
                biasLat={draft?.lat ?? center?.lat}
                biasLng={draft?.lng ?? center?.lng}
                branchAddress={branch?.address || ''}
              />
              {localError && (
                <p className="branch-location-bar__error">{localError}</p>
              )}
              <p className="branch-location-bar__edit-hint">
                Elige una sugerencia o arrastra el pin rojo en el mapa para afinar el punto exacto.
              </p>
            </div>
          ) : (
            <div className="branch-location-bar__address">
              <Navigation className={`h-4 w-4 shrink-0 ${hasGps ? 'text-emerald-600' : 'text-amber-500'}`} />
              <div className="min-w-0 flex-1">
                <p className="branch-location-bar__address-text" title={displayAddress}>
                  {displayAddress}
                </p>
                <p className="branch-location-bar__coords">
                  {hasGps
                    ? `${Number(center.lat).toFixed(6)}, ${Number(center.lng).toFixed(6)}`
                    : 'GPS pendiente — edita para fijar el centro en el mapa'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="branch-location-bar__actions">
          {editing ? (
            <>
              <button
                type="button"
                onClick={handleMapSyncLabel}
                disabled={saving || resolving || draft?.lat == null}
                className="branch-location-bar__btn branch-location-bar__btn--ghost hidden md:inline-flex"
                title="Actualizar texto desde el pin del mapa"
              >
                Desde mapa
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="branch-location-bar__btn branch-location-bar__btn--ghost"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={saving || resolving}
                className="branch-location-bar__btn branch-location-bar__btn--primary"
              >
                {saving || resolving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {saving ? 'Guardando…' : resolving ? 'Detectando…' : 'Guardar'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onStartEdit}
              className="branch-location-bar__btn branch-location-bar__btn--primary"
            >
              <Pencil className="h-4 w-4" />
              Editar
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
