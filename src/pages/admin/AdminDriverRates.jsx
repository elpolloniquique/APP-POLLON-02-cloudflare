import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Plus, Trash2, X, RefreshCw, Save } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { useAdminBranchFilter } from '../../hooks/useAdminBranchFilter';
import { AdminBranchFilter } from '../../components/admin/AdminBranchFilter';
import { RatesZoneMap } from '../../components/delivery/RatesZoneMap';
import { BranchLocationBar } from '../../components/delivery/BranchLocationBar';
import {
  getBranchDeliveryZones,
  saveBranchDeliveryZones,
  setTiersRuleActive,
} from '../../services/pricingService';
import { adminListAllBranches, adminUpdateBranchLocation } from '../../services/branchService';
import {
  DEFAULT_DELIVERY_ZONES,
  coverageKm,
  formatKmRange,
  nextZoneColor,
  nextZoneName,
  normalizeZones,
  quoteFromZones,
} from '../../utils/deliveryZones';
import { money } from '../../utils/format';
import { Loader } from '../../components/ui/Loader';
import { DEFAULT_MAP_CENTER } from '../../utils/geo';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import '../../styles/admin-rates.css';
function emptyZoneForm(zones) {
  const sorted = normalizeZones(zones);
  const lastTo = sorted.length ? sorted[sorted.length - 1].to_km : 0;
  return {
    id: `z-${Date.now()}`,
    name: nextZoneName(sorted),
    color: nextZoneColor(sorted),
    from_km: lastTo,
    to_km: Number((lastTo + 0.5).toFixed(1)),
    fee: sorted.length ? sorted[sorted.length - 1].fee + 500 : 2500,
  };
}

function ZoneEditorModal({ open, initial, onClose, onSave }) {
  const [form, setForm] = useState(initial);
  useEffect(() => { if (open) setForm(initial); }, [open, initial]);
  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    const to = Number(form.to_km);
    const from = Number(form.from_km) || 0;
    const fee = Math.round(Number(form.fee) || 0);
    if (!form.name?.trim()) return alert('Nombre obligatorio');
    if (!(to > from)) return alert('El km máximo debe ser mayor que el mínimo');
    if (fee <= 0) return alert('Ingresa un precio válido');
    onSave({
      ...form,
      name: form.name.trim(),
      from_km: from,
      to_km: to,
      fee,
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
      onClick={onClose}
      role="presentation"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="relative z-[10001] w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Editar zona"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">{initial?._isNew ? 'Nueva tarifa' : 'Editar tarifa'}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-semibold text-gray-500">
            Nombre
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
              placeholder="Zona 01"
              autoFocus
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-gray-500">
              Desde (km)
              <input
                type="number"
                min={0}
                step={0.1}
                value={form.from_km}
                onChange={(e) => setForm({ ...form, from_km: e.target.value })}
                className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-gray-500">
              Hasta (km)
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={form.to_km}
                onChange={(e) => setForm({ ...form, to_km: e.target.value })}
                className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-gray-500">
            Precio delivery ($)
            <input
              type="number"
              min={0}
              step={100}
              value={form.fee}
              onChange={(e) => setForm({ ...form, fee: e.target.value })}
              className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
            />
          </label>

          <label className="block text-xs font-semibold text-gray-500">
            Color en mapa
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded-lg border bg-white p-1"
              />
              <span className="text-sm text-gray-600">{form.color}</span>
            </div>
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" className="flex-1 rounded-xl bg-pollon-red py-2.5 text-sm font-bold text-white hover:brightness-95">
            Guardar
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

export function AdminDriverRates() {
  const { profile } = useAuth();
  const { refreshBranches } = useBranch();
  const auditUser = { id: profile?.id, email: profile?.email };

  const {
    selectedBranchId,
    setSelectedBranchId,
    branches: filterBranches,
    showBranchFilter,
    branchId: staffBranchId,
    isSuperAdmin,
  } = useAdminBranchFilter();

  const filterBranch = isSuperAdmin ? selectedBranchId || null : staffBranchId;

  const [allBranches, setAllBranches] = useState([]);
  const [zones, setZones] = useState(DEFAULT_DELIVERY_ZONES);
  const [rule, setRule] = useState(null);
  const [kmActive, setKmActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [styleId, setStyleId] = useState('streets');
  const [editor, setEditor] = useState(null); // zone form or null
  const [highlightId, setHighlightId] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saveOk, setSaveOk] = useState('');
  const [locEditing, setLocEditing] = useState(false);
  const [locSaving, setLocSaving] = useState(false);
  const [locDraft, setLocDraft] = useState(null);
  const chainZones = useCallback((list) => {
    const sorted = normalizeZones(list);
    return sorted.map((item, i) => ({
      ...item,
      from_km: i === 0 ? 0 : sorted[i - 1].to_km,
    }));
  }, []);

  const activeBranch = useMemo(() => {
    const list = allBranches.length ? allBranches : filterBranches;
    if (filterBranch) return list.find((b) => b.id === filterBranch) || list[0];
    return list[0] || null;
  }, [allBranches, filterBranches, filterBranch]);

  const storeCenter = useMemo(() => {
    if (locEditing && locDraft?.lat != null && locDraft?.lng != null) {
      return { lat: Number(locDraft.lat), lng: Number(locDraft.lng) };
    }
    if (activeBranch?.lat != null && activeBranch?.lng != null) {
      return { lat: Number(activeBranch.lat), lng: Number(activeBranch.lng) };
    }
    return DEFAULT_MAP_CENTER;
  }, [activeBranch, locEditing, locDraft]);

  useEffect(() => {
    setLocEditing(false);
    setLocDraft(null);
  }, [activeBranch?.id]);

  const startLocEdit = () => {
    setLocDraft({
      address: activeBranch?.address || '',
      lat: activeBranch?.lat != null ? Number(activeBranch.lat) : storeCenter.lat,
      lng: activeBranch?.lng != null ? Number(activeBranch.lng) : storeCenter.lng,
    });
    setLocEditing(true);
    setSaveOk('');
    setError('');
  };

  const cancelLocEdit = () => {
    setLocEditing(false);
    setLocDraft(null);
  };

  const saveLoc = async (draft) => {
    const branchId = filterBranch || activeBranch?.id;
    if (!branchId) {
      setError('Selecciona una sucursal');
      return;
    }
    setLocSaving(true);
    setError('');
    setSaveOk('');
    try {
      const updated = await adminUpdateBranchLocation({
        branchId,
        address: draft.address,
        lat: draft.lat,
        lng: draft.lng,
        user: auditUser,
      });
      setAllBranches((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
      setLocEditing(false);
      setLocDraft(null);
      setSaveOk('Ubicación de sucursal (Zona 00) actualizada. El mapa y las tarifas usan este punto.');
      refreshBranches?.().catch(() => {});
    } catch (e) {
      setError(e.message || 'No se pudo guardar la ubicación');
    } finally {
      setLocSaving(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [br, pack] = await Promise.all([
        adminListAllBranches().catch(() => filterBranches || []),
        getBranchDeliveryZones(filterBranch),
      ]);
      setAllBranches(br || []);
      setZones(normalizeZones(pack.zones));
      setRule(pack.rule);
      setKmActive(pack.rule?.is_active !== false);
      setDirty(false);
    } catch (e) {
      setError(e.message || 'No se pudieron cargar las tarifas');
      setZones(DEFAULT_DELIVERY_ZONES);
    } finally {
      setLoading(false);
    }
  }, [filterBranch, filterBranches]);

  useEffect(() => { load(); }, [load]);

  const persist = async (nextZones, nextActive = kmActive) => {
    setSaving(true);
    setError('');
    setSaveOk('');
    try {
      const chained = chainZones(nextZones);
      const saved = await saveBranchDeliveryZones({
        branchId: filterBranch || activeBranch?.id || null,
        zones: chained,
        ruleId: rule?.id,
        isActive: nextActive,
      });
      setRule(saved);
      setZones(normalizeZones(saved.tiers || chained));
      setDirty(false);
      setSaveOk('Tarifas actualizadas y guardadas correctamente.');
      return saved;
    } catch (e) {
      setError(e.message || 'No se pudo guardar');
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    try {
      await persist(zones, kmActive);
    } catch {
      /* error shown */
    }
  };

  const toggleKmActive = async () => {
    const next = !kmActive;
    setKmActive(next);
    try {
      if (rule?.id && !String(rule.id).startsWith('demo-')) {
        await setTiersRuleActive(rule.id, next);
      } else {
        await persist(zones, next);
      }
    } catch (e) {
      setKmActive(!next);
      setError(e.message);
    }
  };

  const openNew = () => setEditor({ ...emptyZoneForm(zones), _isNew: true });
  const openEdit = (z) => setEditor({ ...z, _isNew: false });

  const saveZone = async (z) => {
    const { _isNew, ...zone } = z;
    let next;
    if (_isNew) {
      next = normalizeZones([...zones, zone]);
    } else {
      next = normalizeZones(zones.map((x) => (x.id === zone.id ? zone : x)));
    }
    // Recalc from_km chain
    next = chainZones(next);
    setZones(next);
    setEditor(null);
    try {
      await persist(next);
    } catch {
      setDirty(true);
    }
  };

  const removeZone = async (id) => {
    if (!confirm('¿Eliminar esta zona de tarifa?')) return;
    const chained = chainZones(zones.filter((z) => z.id !== id));
    setZones(chained);
    try {
      await persist(chained);
    } catch {
      setDirty(true);
    }
  };

  const resetDefaults = async () => {
    if (!confirm('¿Restaurar las 4 zonas por defecto (2.5 / 3 / 3.5 / 5 km)?')) return;
    setZones(DEFAULT_DELIVERY_ZONES);
    try {
      await persist(DEFAULT_DELIVERY_ZONES);
    } catch {
      setDirty(true);
    }
  };

  const maxKm = coverageKm(zones);
  const updatedLabel = rule?.updated_at
    ? new Date(rule.updated_at).toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

  const previewQuotes = useMemo(() => {
    const samples = [0.05, 0.8, 2.5, 6];
    return samples.map((km) => {
      const q = quoteFromZones(zones, km);
      return { km, ...q };
    });
  }, [zones]);

  return (
    <div className="rates-admin">
      <AdminPageHeader
        title="Tarifas de Delivery"
        subtitle="Configura las tarifas por kilómetro o por zonas de entrega"
        actions={showBranchFilter ? (
          <div className="flex w-full flex-col items-stretch gap-1 sm:w-auto sm:items-end">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Sucursal actual</span>
            <AdminBranchFilter
              value={selectedBranchId || activeBranch?.id || ''}
              onChange={setSelectedBranchId}
              branches={filterBranches}
            />
          </div>
        ) : null}
      />

      {saveOk && (
        <div className="rates-admin__alert rates-admin__alert--ok">{saveOk}</div>
      )}

      {error && (
        <div className="rates-admin__alert rates-admin__alert--err">{error}</div>
      )}

      {loading ? (
        <Loader text="Cargando tarifas…" />
      ) : (
        <div className="rates-admin-scroll">
          <BranchLocationBar
            branch={activeBranch}
            center={
              activeBranch?.lat != null
                ? { lat: Number(activeBranch.lat), lng: Number(activeBranch.lng) }
                : null
            }
            editing={locEditing}
            draft={locDraft}
            onDraftChange={setLocDraft}
            onStartEdit={startLocEdit}
            onCancel={cancelLocEdit}
            onSave={saveLoc}
            saving={locSaving}
          />

          <div className="rates-admin-grid">
            <div className="rates-admin-map">
              <RatesZoneMap
                className="h-full w-full"
                center={storeCenter}
                zones={kmActive ? zones : []}
                storeLabel="EL POLLÓN"
                styleId={styleId}
                onStyleChange={setStyleId}
                highlightZoneId={highlightId}
                editableCenter={locEditing}
                onCenterChange={({ lat, lng }) => {
                  setLocDraft((prev) => ({
                    address: prev?.address || activeBranch?.address || '',
                    lat,
                    lng,
                  }));
                }}
              />
            </div>
            <aside className="rates-admin-side">
              <section className="rates-card">
                <div className="rates-card__head">
                  <div>
                    <h3 className="rates-card__title">Tarifas por Kilómetro</h3>
                    <p className="rates-card__sub">Desde Zona 00 (ubicación de la sucursal)</p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleKmActive}
                    className={`rates-badge ${kmActive ? 'rates-badge--on' : 'rates-badge--off'}`}
                  >
                    {kmActive ? 'Activo' : 'Inactivo'}
                  </button>
                </div>

                <div className="rates-btn-stack">
                  <button
                    type="button"
                    onClick={openNew}
                    disabled={!kmActive || saving}
                    className="rates-btn rates-btn--primary"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar Tarifa
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAll}
                    disabled={saving || !kmActive}
                    className="rates-btn rates-btn--save"
                  >
                    <Save className={`h-4 w-4 ${saving ? 'animate-pulse' : ''}`} />
                    {saving ? 'Guardando…' : 'Actualizar y guardar'}
                  </button>
                </div>

                <div className="rates-zone-list">
                  {zones.map((z) => (
                    <div
                      key={z.id}
                      className="rates-zone-row"
                      onMouseEnter={() => setHighlightId(z.id)}
                      onMouseLeave={() => setHighlightId(null)}
                    >
                      <span className="rates-zone-row__dot" style={{ background: z.color }} />
                      <div className="min-w-0">
                        <p className="rates-zone-row__name">{z.name}</p>
                        <p className="rates-zone-row__range">{formatKmRange(z.from_km, z.to_km)}</p>
                      </div>
                      <p className="rates-zone-row__fee">{money(z.fee)}</p>
                      <div className="rates-zone-row__actions">
                        <button
                          type="button"
                          className="rates-icon-btn"
                          onClick={() => openEdit(z)}
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rates-icon-btn rates-icon-btn--danger"
                          onClick={() => removeZone(z.id)}
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {zones.length === 0 && (
                    <p className="rates-empty">Sin zonas. Agrega la primera tarifa.</p>
                  )}
                </div>

                <p className="rates-card__hint">
                  Las tarifas se calculan automáticamente según la distancia desde la sucursal hasta la dirección del cliente.
                </p>
              </section>

              <section className="rates-card rates-card--muted">
                <div className="rates-card__head">
                  <div>
                    <h3 className="rates-card__title">Tarifas Fijas por Zona</h3>
                    <p className="rates-card__sub">Polígonos personalizados (próximamente)</p>
                  </div>
                  <span className="rates-badge rates-badge--off">Inactivo</span>
                </div>
                <button type="button" disabled className="rates-btn rates-btn--ghost">
                  <Plus className="h-4 w-4" />
                  Agregar Tarifas Fijas
                </button>
                <p className="rates-card__hint">Las tarifas fijas están desactivadas.</p>
              </section>
            </aside>
          </div>

          <div className="rates-footer">
            <div className="rates-footer__meta">
              <div>
                <p className="rates-footer__label">Centro</p>
                <p className="rates-footer__value">
                  {activeBranch?.name || 'El Pollón'}
                  {activeBranch?.city ? ` — ${activeBranch.city}` : ''}
                </p>
              </div>
              <div>
                <p className="rates-footer__label">Actualizado</p>
                <p className="rates-footer__value">{updatedLabel}</p>
              </div>
              <div>
                <p className="rates-footer__label">Zonas</p>
                <p className="rates-footer__value">
                  {zones.length} {kmActive ? 'activas' : 'inactivas'}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="rates-footer__label">Cobertura</p>
                  <p className="rates-footer__value">Hasta {maxKm || '—'} km</p>
                </div>
                <button
                  type="button"
                  onClick={resetDefaults}
                  className="rates-icon-btn"
                  title="Restaurar zonas por defecto"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${saving ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {zones.length > 0 && (
              <div className="rates-footer__zones">
                {zones.map((z) => (
                  <div
                    key={`sum-${z.id}`}
                    className="rates-zone-chip"
                    style={{ borderColor: `${z.color}55`, background: `${z.color}12` }}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: z.color }} />
                    <span className="rates-zone-chip__name">{z.name}</span>
                    <span className="rates-zone-chip__range">{formatKmRange(z.from_km, z.to_km)}</span>
                    <span className="rates-zone-chip__fee" style={{ color: z.color }}>{money(z.fee)}</span>
                  </div>
                ))}
              </div>
            )}

            {dirty && (
              <p className="rates-footer__warn">
                Hay cambios sin guardar. Pulsa <strong>Actualizar y guardar</strong> para aplicarlos en el checkout.
              </p>
            )}

            {kmActive && zones.length > 0 && (
              <div className="rates-footer__verify">
                <p className="rates-footer__verify-title">Verificación de cotización</p>
                <ul className="rates-verify-grid">
                  {previewQuotes.map(({ km, fee, zone, outOfRange }) => (
                    <li key={km}>
                      <span>
                        {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}
                      </span>
                      <span>
                        {outOfRange ? 'Fuera' : `${zone?.name || 'Zona'} · ${money(fee)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!activeBranch?.lat && (
              <p className="rates-footer__warn">
                Esta sucursal no tiene coordenadas GPS. Configura lat/lng en Sucursales para centrar el mapa correctamente.
              </p>
            )}
          </div>
        </div>
      )}

      <ZoneEditorModal
        open={!!editor}
        initial={editor || emptyZoneForm(zones)}
        onClose={() => setEditor(null)}
        onSave={saveZone}
      />
    </div>
  );
}
