import { useState, useMemo, useEffect } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { useAdminBranchFilter } from '../../hooks/useAdminBranchFilter';
import { money, todayISO } from '../../utils/format';
import { Button } from '../../components/ui/Button';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { closeCajaSession, loadCajaSession, openCajaSession } from '../../services/cajaStockService';

export function AdminCash() {
  const { orders } = useOrders();
  const {
    applyBranchFilter,
    headerBranchLabel,
    isBranchScoped,
    branchId,
    selectedBranchId,
    setSelectedBranchId,
    showBranchFilter,
    branches,
  } = useAdminBranchFilter();
  const cajaBranch = branchId || selectedBranchId || '';
  const ordersScoped = useMemo(() => applyBranchFilter(orders), [orders, applyBranchFilter]);
  const [caja, setCaja] = useState({});
  const [loading, setLoading] = useState(true);
  const today = todayISO();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadCajaSession(cajaBranch)
      .then((data) => {
        if (!cancelled) setCaja(data || {});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [cajaBranch]);

  const ventasHoy = useMemo(() => {
    const pedidos = ordersScoped.filter((o) => (o.createdAt || '').startsWith(today) && o.estado === 'entregado');
    const efectivo = pedidos.filter((o) => o.metodo_pago === 'efectivo').reduce((s, o) => s + o.total, 0);
    const transferencia = pedidos.filter((o) => o.metodo_pago === 'transferencia').reduce((s, o) => s + o.total, 0);
    const tarjeta = pedidos.filter((o) => o.metodo_pago === 'tarjeta').reduce((s, o) => s + o.total, 0);
    const total = pedidos.reduce((s, o) => s + o.total, 0);
    return { efectivo, transferencia, tarjeta, total, count: pedidos.length };
  }, [ordersScoped, today]);

  const abrirCaja = async () => {
    if (!cajaBranch) {
      alert('Elige una sucursal para abrir caja.');
      return;
    }
    const monto = prompt('Monto inicial de caja (CLP):', '0');
    if (monto == null) return;
    const data = await openCajaSession(cajaBranch, Number(monto) || 0);
    setCaja(data);
  };

  const cerrarCaja = async () => {
    const data = await closeCajaSession(cajaBranch, caja, ventasHoy);
    setCaja(data);
    alert(`Caja cerrada. Total vendido: ${money(ventasHoy.total)}`);
  };

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Caja diaria"
        branchLabel={headerBranchLabel}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {showBranchFilter && (
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="rounded-xl border px-3 py-2 text-sm"
              >
                <option value="">Todas / elige sucursal</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            {!caja.abierta ? (
              <Button onClick={abrirCaja} disabled={!cajaBranch || loading}>Abrir caja</Button>
            ) : (
              <Button variant="dark" onClick={cerrarCaja} disabled={loading}>Cerrar caja</Button>
            )}
            <span className={`rounded-full px-3 py-1 text-xs font-semibold sm:text-sm ${caja.abierta ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
              {caja.abierta ? 'Caja abierta' : 'Caja cerrada'}
            </span>
          </div>
        )}
      />

      {(isBranchScoped && !branchId) && (
        <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Tu usuario no tiene sucursal. Pídele al admin que te asigne un local en Usuarios.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        {[
          ['Efectivo', ventasHoy.efectivo],
          ['Transferencia', ventasHoy.transferencia],
          ['Tarjeta', ventasHoy.tarjeta],
          ['Total del día', ventasHoy.total],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:rounded-2xl sm:p-5">
            <p className="text-xs text-gray-500 sm:text-sm">{l}</p>
            <p className="text-lg font-bold text-pollon-red sm:text-xl">{money(v)}</p>
          </div>
        ))}
      </div>

      {caja.abierta && (
        <p className="text-xs text-gray-600 sm:text-sm">
          Monto inicial: {money(caja.montoInicial || 0)} · Pedidos entregados hoy: {ventasHoy.count}
          {caja.source === 'cloud' ? ' · Guardada en la nube' : ' · Guardada en este computador (ejecuta fix-web-ops-hardening.sql)'}
        </p>
      )}
    </div>
  );
}
