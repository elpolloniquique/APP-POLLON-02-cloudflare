import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Phone, RefreshCw } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { useAdminBranchFilter } from '../../hooks/useAdminBranchFilter';
import { CajaPagoControl } from '../../components/admin/CajaPagoControl';
import { Loader } from '../../components/ui/Loader';
import {
  fetchDriverReportRows,
  fetchDriverOptionsForReport,
  updateDriverCommissionCobro,
} from '../../services/driverReportService';
import { todayISO } from '../../utils/format';
import { CAJA_PAGO, cajaPagoLabel, resolveCajaPagoStatus } from '../../utils/cajaPago';
import '../../styles/driver-report.css';

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

function formatMoneyReport(v) {
  const n = Number(v) || 0;
  // Formato cercano al diseño: "$ 25.700"
  return `$ ${Math.round(n).toLocaleString('es-CL')}`;
}

function formatCommission(v) {
  const n = Math.round(Number(v) || 0);
  return `$ ${n.toLocaleString('es-CL')}`;
}

/**
 * Reporte profesional de repartidores — layout según diseño admin.
 */
export function AdminDriverReports() {
  const {
    selectedBranchId,
    setSelectedBranchId,
    branches,
    showBranchFilter,
    branchId: staffBranchId,
    branchName: staffBranchName,
    isSuperAdmin,
  } = useAdminBranchFilter();

  const filterBranch = isSuperAdmin ? (selectedBranchId || null) : staffBranchId;

  const [desde, setDesde] = useState(() => todayISO());
  const [hasta, setHasta] = useState(() => todayISO());
  const [horaIni, setHoraIni] = useState('00:00');
  const [horaFin, setHoraFin] = useState('23:00');
  const [cobroFilter, setCobroFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [driverOptions, setDriverOptions] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, drivers] = await Promise.all([
        fetchDriverReportRows({
          fromDate: desde,
          toDate: hasta,
          fromTime: horaIni,
          toTime: horaFin === '23:00' ? '23:59' : horaFin,
          branchId: filterBranch,
          driverId: driverFilter || null,
        }),
        fetchDriverOptionsForReport(filterBranch),
      ]);
      setRows(data);
      setDriverOptions(drivers);
    } catch (err) {
      setError(err.message || 'Error al cargar reporte');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, horaIni, horaFin, filterBranch, driverFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!cobroFilter) return rows;
    return rows.filter((r) => resolveCajaPagoStatus({ cajaPago: r.comisionCobro }) === cobroFilter);
  }, [rows, cobroFilter]);

  const uniqueDrivers = useMemo(
    () => new Set(filtered.map((r) => r.driverId).filter(Boolean)).size,
    [filtered]
  );

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.subTotal += Number(r.subTotal) || 0;
        acc.delivery += Number(r.deliveryFee) || 0;
        acc.total += Number(r.total) || 0;
        acc.commission += Number(r.commission) || 0;
        return acc;
      },
      { subTotal: 0, delivery: 0, total: 0, commission: 0 }
    );
  }, [filtered]);

  const onChangeCobro = async (row, next) => {
    setBusyId(row.id);
    try {
      await updateDriverCommissionCobro(row.orderId, next);
      setRows((prev) => prev.map((r) => (
        r.id === row.id
          ? { ...r, comisionCobro: next, cobro: next }
          : r
      )));
    } catch (err) {
      alert(err.message || 'No se pudo actualizar el cobro de comisión');
    } finally {
      setBusyId('');
    }
  };

  const exportCsv = () => {
    const header = [
      'Repartidor', 'Sucursal', 'Cliente', 'Telefono',
      'Sub Total', 'Delivery', 'Total', 'Comision', 'Cobro comision repartidor', 'Ticket', 'Fecha',
    ];
    const body = filtered.map((r) => [
      r.driverName,
      r.branchName,
      r.customerName,
      r.customerPhone,
      r.subTotal,
      r.deliveryFee,
      r.total,
      r.commission,
      cajaPagoLabel(resolveCajaPagoStatus({ cajaPago: r.comisionCobro })),
      r.ticket,
      r.createdAt,
    ]);
    const csv = [header, ...body].map((line) => line.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `reporte-repartidores-${desde}_${hasta}.csv`;
    a.click();
  };

  const branchSelectValue = showBranchFilter
    ? (selectedBranchId || '')
    : (filterBranch || '');

  return (
    <div className="admin-page driver-report">
      <AdminPageHeader
        title="Reporte de repartidores"
        subtitle="Control operativo de entregas, delivery y cobros de caja"
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2f2f2f] px-3 py-2 text-xs font-bold text-white shadow-sm"
              title="Descargar CSV"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar
            </button>
          </div>
        )}
      />

      {/* Filtros — barra profesional */}
      <div className="driver-report__filters">
        <label className="driver-report__field">
          <span>Desde</span>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="driver-report__field">
          <span>Hasta</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <label className="driver-report__field">
          <span>Hora inicial</span>
          <select value={horaIni} onChange={(e) => setHoraIni(e.target.value)}>
            {HOURS.map((h) => <option key={`i-${h}`} value={h}>{h}</option>)}
          </select>
        </label>
        <label className="driver-report__field">
          <span>Hora final</span>
          <select value={horaFin} onChange={(e) => setHoraFin(e.target.value)}>
            {HOURS.map((h) => <option key={`f-${h}`} value={h}>{h}</option>)}
            <option value="23:59">23:59</option>
          </select>
        </label>

        <div className="driver-report__count" title="Repartidores distintos en el filtro">
          <span className="driver-report__count-label">Repartidores</span>
          <strong>{uniqueDrivers}</strong>
        </div>

        <label className="driver-report__field driver-report__field--grow">
          <span>Cobro comisión</span>
          <select value={cobroFilter} onChange={(e) => setCobroFilter(e.target.value)} title="Si el repartidor ya pagó su comisión">
            <option value="">Todos</option>
            <option value={CAJA_PAGO.NA}>N/A</option>
            <option value={CAJA_PAGO.POR_PAGAR}>Por pagar</option>
            <option value={CAJA_PAGO.PAGADO}>Pagado</option>
          </select>
        </label>

        <label className="driver-report__field driver-report__field--grow">
          <span>Repartidores</span>
          <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}>
            <option value="">Todos los repartidores</option>
            {driverOptions.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>

        <label className="driver-report__field driver-report__field--grow">
          <span>Sucursal</span>
          {showBranchFilter ? (
            <select
              value={branchSelectValue}
              onChange={(e) => setSelectedBranchId(e.target.value)}
            >
              <option value="">Todas las sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          ) : (
            <select value={branchSelectValue || 'staff'} disabled>
              <option value={branchSelectValue || 'staff'}>
                {staffBranchName || 'Mi sucursal'}
              </option>
            </select>
          )}
        </label>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <Loader text="Cargando reporte…" />
      ) : (
        <div className="driver-report__panel">
          <div className="driver-report__scroll">
            <table className="driver-report__table">
              <thead>
                <tr>
                  <th>Repartidor</th>
                  <th>Sucursal</th>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th className="is-num">Sub Total</th>
                  <th className="is-num">Delivery</th>
                  <th className="is-num">Total</th>
                  <th className="is-num">Comision</th>
                  <th className="is-cobro">Cobro</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="driver-report__empty">
                      Sin entregas en el rango seleccionado
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id}>
                      <td className="is-strong">{r.driverName}</td>
                      <td>{r.branchName}</td>
                      <td>{r.customerName}</td>
                      <td className="is-phone">
                        {r.customerPhone ? (
                          <a href={`tel:${r.customerPhone}`} className="driver-report__phone">
                            <Phone className="h-3.5 w-3.5" />
                            {r.customerPhone}
                          </a>
                        ) : '—'}
                      </td>
                      <td className="is-num">{formatMoneyReport(r.subTotal)}</td>
                      <td className="is-num">{formatMoneyReport(r.deliveryFee)}</td>
                      <td className="is-num is-strong">{formatMoneyReport(r.total)}</td>
                      <td className="is-num">{formatCommission(r.commission)}</td>
                      <td className="is-cobro">
                        <CajaPagoControl
                          order={{ cajaPago: r.comisionCobro }}
                          disabled={busyId === r.id}
                          onChange={(next) => onChangeCobro(r, next)}
                          menuHint="Comisión del repartidor"
                          title="Marcar si el repartidor ya pagó su comisión"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="driver-report__footer">
            <div className="driver-report__footer-label">TOTAL</div>
            <div className="driver-report__footer-spacer" aria-hidden />
            <div className="driver-report__footer-num">{formatMoneyReport(totals.subTotal)}</div>
            <div className="driver-report__footer-num">{formatMoneyReport(totals.delivery)}</div>
            <div className="driver-report__footer-num">{formatMoneyReport(totals.total)}</div>
            <div className="driver-report__footer-num">{formatCommission(totals.commission)}</div>
            <div className="driver-report__footer-cobro">
              {filtered.length} pedido{filtered.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      )}

      <p className="px-1 text-[11px] text-gray-500">
        Comisión = 5% del delivery (ej. $4.000 → $200). Cobro = si el repartidor ya pagó esa comisión (no es el pago del cliente).
      </p>
    </div>
  );
}
