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
  const [drafts, setDrafts] = useState({});

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
      setDrafts({});
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

  const patchDraft = (id, patch) => {
    setDrafts((m) => ({ ...m, [id]: { ...(m[id] || {}), ...patch } }));
    setFlash('');
    setError('');
  };

  const rowDraft = (d) => {
    const draft = drafts[d.id] || {};
    return {
      max_orders: draft.max_orders ?? normalizeMaxOrders(d.max_orders),
      commission_percent: Object.prototype.hasOwnProperty.call(draft, 'commission_percent')
        ? draft.commission_percent
        : String(normalizeCommissionPercent(d.commission_percent, 5)),
      preferred_branch_id: Object.prototype.hasOwnProperty.call(draft, 'preferred_branch_id')
        ? draft.preferred_branch_id
        : (d.preferred_branch_id || ''),
    };
  };

  const isDirty = (d) => {
    if (!drafts[d.id]) return false;
    const cur = rowDraft(d);
    return (
      cur.max_orders !== normalizeMaxOrders(d.max_orders)
      || normalizeCommissionPercent(cur.commission_percent, 5) !== normalizeCommissionPercent(d.commission_percent, 5)
      || String(cur.preferred_branch_id || '') !== String(d.preferred_branch_id || '')
    );
  };

  const saveRow = async (id) => {
    const prev = drivers.find((d) => d.id === id);
    if (!prev || !isDirty(prev)) return;
    const cur = rowDraft(prev);
    const nextMax = normalizeMaxOrders(cur.max_orders);
    const nextComm = normalizeCommissionPercent(cur.commission_percent, 5);
    const nextBranch = cur.preferred_branch_id || null;

    setBusyId(id);
    setError('');
    setFlash('');
    try {
      const ops = [];
      if (nextMax !== normalizeMaxOrders(prev.max_orders)) {
        ops.push(updateDriverMaxOrders(id, nextMax));
      }
      if (nextComm !== normalizeCommissionPercent(prev.commission_percent, 5)) {
        ops.push(updateDriverCommission(id, nextComm));
      }
      if (String(nextBranch || '') !== String(prev.preferred_branch_id || '')) {
        ops.push(updateDriverProfile(id, { preferred_branch_id: nextBranch }));
      }
      await Promise.all(ops);
      setDrafts((m) => {
        const copy = { ...m };
        delete copy[id];
        return copy;
      });
      const email = prev?.profiles?.email ? ` (${prev.profiles.email})` : '';
      setFlash(`Guardado: ${prev?.profiles?.full_name || 'repartidor'}${email} · cupo ${nextMax} · comisión ${nextComm}%.`);
      await load();
    } catch (err) {
      const msg = String(err.message || '');
      if (/ep_admin_set_driver_max_orders|schema cache|cupo no/i.test(msg)) {
        setError('Para que el cupo quede por cada correo, ejecuta en Supabase: supabase/fix-driver-max-orders-per-account.sql');
      } else if (/commission_percent|column/i.test(msg)) {
        setError('Falta la columna de comisión. Ejecuta en Supabase: supabase/fix-driver-commission-percent.sql');
      } else {
        setError(err.message);
      }
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
          <li>Cambia el cupo (2, 3 o 4), la comisión o la sucursal y pulsa <strong>Guardar</strong> en esa fila. Si no guardas, no se aplica.</li>
          <li>El número es <strong>solo de esa cuenta</strong> (ese correo). Si a un repartidor le pones 3, él puede aceptar y llevar 3; los demás siguen con el suyo.</li>
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
                  const draft = rowDraft(d);
                  const dirty = isDirty(d);
                  return (
                    <tr key={d.id} className={`border-t ${dirty ? 'bg-amber-50/60' : ''}`}>
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
                          value={draft.max_orders}
                          disabled={busyId === d.id}
                          aria-label={`Máximo de pedidos para ${name}`}
                          title={`Máximo de pedidos simultáneos para ${d.profiles?.email || name}. Pulsa Guardar para aplicar.`}
                          onChange={(e) => patchDraft(d.id, { max_orders: normalizeMaxOrders(e.target.value) })}
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
                            value={draft.commission_percent}
                            disabled={busyId === d.id}
                            aria-label={`Comisión % de ${name}`}
                            title="Porcentaje de comisión sobre el delivery. Pulsa Guardar para aplicar."
                            onChange={(e) => patchDraft(d.id, { commission_percent: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && dirty) saveRow(d.id);
                            }}
                          />
                          <span className="text-xs font-bold text-slate-500">%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="rounded-lg border px-2 py-1 text-xs"
                          value={draft.preferred_branch_id}
                          disabled={busyId === d.id}
                          onChange={(e) => patchDraft(d.id, { preferred_branch_id: e.target.value })}
                        >
                          <option value="">Sin preferencia</option>
                          {allBranches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name || b.nombre}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            className="!px-3 !py-1.5 text-xs"
                            disabled={busyId === d.id || !dirty}
                            onClick={() => saveRow(d.id)}
                          >
                            {busyId === d.id ? 'Guardando…' : 'Guardar'}
                          </Button>
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
