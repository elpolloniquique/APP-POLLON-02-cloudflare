import { useEffect, useState } from 'react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminBranchFilter } from '../../components/admin/AdminBranchFilter';
import { useAdminBranchFilter } from '../../hooks/useAdminBranchFilter';
import {
  listDrivers,
  updateDriverAdminStatus,
  updateDriverProfile,
  updateDriverMaxOrders,
  updateDriverCommission,
  normalizeCommissionPercent,
} from '../../services/driverService';
import { adminListAllBranches } from '../../services/branchService';
import { Loader } from '../../components/ui/Loader';
import { Button } from '../../components/ui/Button';

const STATUS_LABELS = {
  pending: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Aprobado', cls: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rechazado', cls: 'bg-red-100 text-red-800' },
  suspended: { label: 'Suspendido', cls: 'bg-orange-100 text-orange-800' },
  blocked: { label: 'Bloqueado', cls: 'bg-red-100 text-red-800' },
};

const MAX_ORDER_OPTIONS = [2, 3, 4];

function normalizeMaxOrders(value) {
  const n = Number(value);
  if (MAX_ORDER_OPTIONS.includes(n)) return n;
  return 2;
}

export function AdminDrivers() {
  const {
    selectedBranchId,
    setSelectedBranchId,
    branches: filterBranches,
    isSuperAdmin,
    showBranchFilter,
    branchId: staffBranchId,
  } = useAdminBranchFilter();
  const [drivers, setDrivers] = useState([]);
  const [allBranches, setAllBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [commissionDraft, setCommissionDraft] = useState({});

  const filterId = isSuperAdmin ? selectedBranchId || null : staffBranchId;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [data, br] = await Promise.all([
        listDrivers({ branchId: filterId }),
        adminListAllBranches().catch(() => filterBranches),
      ]);
      setDrivers(data);
      setAllBranches(br?.length ? br : filterBranches);
      setCommissionDraft({});
    } catch (err) {
      setError(err.message || 'Error al cargar repartidores. ¿Ejecutaste migration-repartidores-delivery.sql?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterId]);

  const setStatus = async (id, status) => {
    setBusyId(id);
    setFlash('');
    try {
      await updateDriverAdminStatus(id, status);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const setBranch = async (id, preferredBranchId) => {
    setBusyId(id);
    setFlash('');
    try {
      await updateDriverProfile(id, { preferred_branch_id: preferredBranchId || null });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const setMaxOrders = async (id, maxOrders) => {
    const next = normalizeMaxOrders(maxOrders);
    const prev = drivers.find((d) => d.id === id);
    if (prev && normalizeMaxOrders(prev.max_orders) === next) return;

    setBusyId(id);
    setError('');
    setFlash('');
    setDrivers((list) => list.map((d) => (d.id === id ? { ...d, max_orders: next } : d)));
    try {
      await updateDriverMaxOrders(id, next);
      const email = prev?.profiles?.email ? ` (${prev.profiles.email})` : '';
      setFlash(`Cupo de ${prev?.profiles?.full_name || 'este repartidor'}${email}: máximo ${next} pedido${next === 1 ? '' : 's'} a la vez.`);
    } catch (err) {
      const msg = String(err.message || '');
      setError(
        /ep_admin_set_driver_max_orders|schema cache|cupo no/i.test(msg)
          ? 'Para que el cupo quede por cada correo, ejecuta en Supabase: supabase/fix-driver-max-orders-per-account.sql'
          : msg,
      );
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const commissionValue = (d) => {
    if (Object.prototype.hasOwnProperty.call(commissionDraft, d.id)) {
      return commissionDraft[d.id];
    }
    return String(normalizeCommissionPercent(d.commission_percent, 5));
  };

  const setCommission = async (id) => {
    const prev = drivers.find((d) => d.id === id);
    const raw = Object.prototype.hasOwnProperty.call(commissionDraft, id)
      ? commissionDraft[id]
      : prev?.commission_percent;
    const next = normalizeCommissionPercent(raw, 5);
    const prevN = normalizeCommissionPercent(prev?.commission_percent, 5);
    if (prev && prevN === next) {
      setCommissionDraft((m) => {
        const copy = { ...m };
        delete copy[id];
        return copy;
      });
      return;
    }

    setBusyId(id);
    setError('');
    setFlash('');
    setDrivers((list) => list.map((d) => (d.id === id ? { ...d, commission_percent: next } : d)));
    setCommissionDraft((m) => {
      const copy = { ...m };
      delete copy[id];
      return copy;
    });
    try {
      await updateDriverCommission(id, next);
      setFlash(`Comisión actualizada: ${next}% sobre el delivery.`);
    } catch (err) {
      const msg = String(err.message || '');
      if (/commission_percent|column/i.test(msg)) {
        setError('Falta la columna de comisión. Ejecuta en Supabase: supabase/fix-driver-commission-percent.sql');
      } else {
        setError(err.message);
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-page admin-page--fill">
      <AdminPageHeader
        title="Repartidores"
        subtitle="Aprueba, suspende, asigna sucursal, cupo de pedidos y comisión % de cada repartidor."
        actions={showBranchFilter ? (
          <AdminBranchFilter value={selectedBranchId} onChange={setSelectedBranchId} branches={filterBranches} />
        ) : null}
      />

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Cómo funciona el cupo máximo</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs sm:text-sm">
          <li>El número es <strong>solo de esa cuenta</strong> (ese correo). Si a un repartidor le pones 3, él puede llevar 3; los demás siguen con el suyo.</li>
          <li>Mientras va a la sucursal (pedidos aún no recogidos), puede aceptar hasta su máximo (2, 3 o 4).</li>
          <li>En cuanto marca <strong>pedido recogido</strong>, ya no recibe ofertas nuevas.</li>
          <li>Solo cuando entrega <strong>todos</strong> sus pedidos activos vuelve a recibir ofertas.</li>
          <li><strong>Comisión:</strong> porcentaje que cobras sobre el delivery de cada pedido (editable por repartidor).</li>
        </ul>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {flash && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{flash}</div>}

      {loading ? (
        <Loader text="Cargando repartidores…" />
      ) : (
        <div className="admin-list-shell">
          <div className="admin-scroll-fill overflow-auto">
            <table className="admin-data-table min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3">Repartidor</th>
                  <th className="px-4 py-3">Vehículo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Operativo</th>
                  <th className="px-4 py-3">
                    Máx. pedidos
                    <span className="mt-0.5 block font-normal normal-case text-[11px] text-gray-400">
                      Cupo simultáneo
                    </span>
                  </th>
                  <th className="px-4 py-3">
                    Comisión
                    <span className="mt-0.5 block font-normal normal-case text-[11px] text-gray-400">
                      % sobre delivery
                    </span>
                  </th>
                  <th className="px-4 py-3">Sucursal</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => {
                  const st = STATUS_LABELS[d.admin_status] || STATUS_LABELS.pending;
                  const name = d.profiles?.full_name || d.profiles?.email || 'Sin nombre';
                  const maxOrders = normalizeMaxOrders(d.max_orders);
                  return (
                    <tr key={d.id} className="border-t">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{name}</p>
                        <p className="text-xs text-gray-500">{d.profiles?.email || d.phone}</p>
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {(d.vehicle_type || '').replace('_', ' ')} {d.vehicle_plate && `· ${d.vehicle_plate}`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-600">{d.operational_status}</td>
                      <td className="px-4 py-3">
                        <select
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                          value={maxOrders}
                          disabled={busyId === d.id}
                          aria-label={`Máximo de pedidos para ${name}`}
                          title={`Máximo de pedidos simultáneos para ${d.profiles?.email || name}. No aplica a otros repartidores.`}
                          onChange={(e) => setMaxOrders(d.id, e.target.value)}
                        >
                          {MAX_ORDER_OPTIONS.map((n) => (
                            <option key={n} value={n}>
                              {n} pedido{n === 1 ? '' : 's'}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-[11px] text-gray-400">2 · 3 · 4</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-100">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            inputMode="decimal"
                            className="w-14 border-0 bg-transparent p-0 text-xs font-semibold text-slate-800 outline-none"
                            value={commissionValue(d)}
                            disabled={busyId === d.id}
                            aria-label={`Comisión % de ${name}`}
                            title="Porcentaje de comisión sobre el delivery"
                            onChange={(e) => {
                              setCommissionDraft((m) => ({ ...m, [d.id]: e.target.value }));
                            }}
                            onBlur={() => setCommission(d.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                          />
                          <span className="text-xs font-bold text-slate-500">%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="rounded-lg border px-2 py-1 text-xs"
                          value={d.preferred_branch_id || ''}
                          disabled={busyId === d.id}
                          onChange={(e) => setBranch(d.id, e.target.value)}
                        >
                          <option value="">Sin preferencia</option>
                          {allBranches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name || b.nombre}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          {d.admin_status !== 'approved' && (
                            <Button className="!px-3 !py-1.5 text-xs" disabled={busyId === d.id} onClick={() => setStatus(d.id, 'approved')}>Aprobar</Button>
                          )}
                          {d.admin_status === 'approved' && (
                            <Button variant="outline" className="!px-3 !py-1.5 text-xs" disabled={busyId === d.id} onClick={() => setStatus(d.id, 'suspended')}>Suspender</Button>
                          )}
                          {d.admin_status !== 'rejected' && (
                            <Button variant="ghost" className="!px-3 !py-1.5 text-xs" disabled={busyId === d.id} onClick={() => setStatus(d.id, 'rejected')}>Rechazar</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {drivers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                      No hay repartidores. En Supabase Auth crea el usuario y en <code>profiles.role</code> pon <strong>delivery</strong>.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
