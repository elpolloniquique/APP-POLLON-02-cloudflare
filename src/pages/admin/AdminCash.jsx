import { useState, useMemo, useEffect } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { useAdminBranchFilter } from '../../hooks/useAdminBranchFilter';
import { money, todayISO } from '../../utils/format';
import { Button } from '../../components/ui/Button';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';

function cajaKey(branchId) {
  return branchId ? `pollon_caja_v1_${branchId}` : 'pollon_caja_v1';
}

function loadCaja(branchId) {
  try { return JSON.parse(localStorage.getItem(cajaKey(branchId)) || '{}'); } catch { return {}; }
}

export function AdminCash() {
  const { orders } = useOrders();
  const { applyBranchFilter, headerBranchLabel, isBranchScoped, branchId } = useAdminBranchFilter();
  const ordersScoped = useMemo(() => applyBranchFilter(orders), [orders, applyBranchFilter]);
  const [caja, setCaja] = useState(() => loadCaja(branchId));
  const today = todayISO();

  useEffect(() => {
    setCaja(loadCaja(branchId));
  }, [branchId]);

  const ventasHoy = useMemo(() => {
    const pedidos = ordersScoped.filter((o) => (o.createdAt || '').startsWith(today) && o.estado === 'entregado');
    const efectivo = pedidos.filter((o) => o.metodo_pago === 'efectivo').reduce((s, o) => s + o.total, 0);
    const transferencia = pedidos.filter((o) => o.metodo_pago === 'transferencia').reduce((s, o) => s + o.total, 0);
    const tarjeta = pedidos.filter((o) => o.metodo_pago === 'tarjeta').reduce((s, o) => s + o.total, 0);
    const total = pedidos.reduce((s, o) => s + o.total, 0);
    return { efectivo, transferencia, tarjeta, total, count: pedidos.length };
  }, [ordersScoped, today]);

  const abrirCaja = () => {
    const monto = prompt('Monto inicial de caja (CLP):', '0');
    const data = { abierta: true, apertura: new Date().toISOString(), montoInicial: Number(monto) || 0, egresos: [] };
    localStorage.setItem(cajaKey(branchId), JSON.stringify(data));
    setCaja(data);
  };

  const cerrarCaja = () => {
    const data = { ...caja, abierta: false, cierre: new Date().toISOString(), ventas: ventasHoy };
    localStorage.setItem(cajaKey(branchId), JSON.stringify(data));
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
            {!caja.abierta ? (
              <Button onClick={abrirCaja}>Abrir caja</Button>
            ) : (
              <Button variant="dark" onClick={cerrarCaja}>Cerrar caja</Button>
            )}
            <span className={`rounded-full px-3 py-1 text-xs font-semibold sm:text-sm ${caja.abierta ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
              {caja.abierta ? 'Caja abierta' : 'Caja cerrada'}
            </span>
          </div>
        )}
      />

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
        </p>
      )}
    </div>
  );
}
