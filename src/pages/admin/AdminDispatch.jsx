import { useEffect, useMemo, useState, useCallback } from 'react';
import { Calendar, MapPin, RefreshCw, Search, Send, Bike } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminBranchFilter } from '../../components/admin/AdminBranchFilter';
import { useAdminBranchFilter } from '../../hooks/useAdminBranchFilter';
import { listDeliveryJobs, startDriverSearch, upsertJobFromOrder, subscribeDispatch } from '../../services/dispatchService';
import { retryStaleDriverSearches } from '../../services/orderDeliveryService';
import { fetchOrdersAdmin } from '../../services/orderService';
import { money } from '../../utils/format';
import { toInputDate } from '../../utils/productReportAnalytics';
import { Loader } from '../../components/ui/Loader';
import '../../styles/dispatch-panel.css';

const STATUS_META = {
  ready_for_dispatch: { label: 'Listo', tone: 'ready' },
  searching_driver: { label: 'Buscando', tone: 'search' },
  offered: { label: 'Ofertado', tone: 'offer' },
  assigned: { label: 'Asignado', tone: 'assigned' },
  heading_to_branch: { label: 'A local', tone: 'route' },
  picked_up: { label: 'Recogido', tone: 'picked' },
  delivering: { label: 'En ruta', tone: 'route' },
  delivered: { label: 'Entregado', tone: 'done' },
  cancelled: { label: 'Cancelado', tone: 'cancel' },
};

const OFFERABLE = new Set(['ready_for_dispatch', 'searching_driver', 'offered']);

function todayInput() {
  return toInputDate(new Date());
}

export function AdminDispatch() {
  const {
    selectedBranchId,
    setSelectedBranchId,
    branches,
    showBranchFilter,
    applyBranchFilter,
    branchId: staffBranchId,
    isSuperAdmin,
  } = useAdminBranchFilter();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [dateFrom, setDateFrom] = useState(todayInput);
  const [dateTo, setDateTo] = useState(todayInput);
  const [search, setSearch] = useState('');

  const filterBranch = isSuperAdmin ? selectedBranchId || null : staffBranchId;
  const isTodayOnly = dateFrom === todayInput() && dateTo === todayInput();

  const load = useCallback(async () => {
    try {
      const data = await listDeliveryJobs({
        branchId: filterBranch,
        dateFrom,
        dateTo,
      });
      setJobs(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Error cargando despacho');
    } finally {
      setLoading(false);
    }
  }, [filterBranch, dateFrom, dateTo]);

  useEffect(() => {
    setLoading(true);
    load();
    const unsub = subscribeDispatch(() => load());
    const t = setInterval(() => {
      load();
      retryStaleDriverSearches().catch(() => {});
    }, 15000);
    return () => { unsub(); clearInterval(t); };
  }, [load]);

  const setToday = () => {
    const t = todayInput();
    setDateFrom(t);
    setDateTo(t);
  };

  const syncFromOrders = async () => {
    setBusy('sync');
    setMsg('');
    try {
      const orders = applyBranchFilter(await fetchOrdersAdmin());
      const deliveryReady = orders.filter(
        (o) => o.orderType === 'delivery' && ['listo', 'preparando', 'confirmado', 'en_cocina', 'en_delivery'].includes(o.estado)
      );
      const batch = deliveryReady.slice(0, 30);
      const results = await Promise.allSettled(
        batch.map((o) => upsertJobFromOrder(o.id)),
      );
      const n = results.filter((r) => r.status === 'fulfilled').length;
      setMsg(`Sincronizados ${n} pedidos delivery → cola de despacho`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const offer = async (jobId) => {
    setBusy(jobId);
    setError('');
    try {
      const res = await startDriverSearch(jobId);
      setMsg(`Oferta enviada a ${res?.offered ?? 0} repartidor(es)`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) => {
      const driver = j.ep_driver_profiles?.profiles?.full_name || '';
      const hay = [
        j.ticket_code,
        j.customer_name,
        j.customer_address,
        j.customer_phone,
        j.status,
        driver,
        STATUS_META[j.status]?.label,
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [jobs, search]);

  const pendingCount = filteredJobs.filter((j) => OFFERABLE.has(j.status)).length;

  return (
    <div className="admin-page admin-page--fill dispatch-panel">
      <AdminPageHeader
        title="Despacho"
        subtitle="Cola de delivery · ofertar a repartidores en tiempo real"
        actions={(
          <div className="dispatch-panel__actions">
            {showBranchFilter && (
              <AdminBranchFilter value={selectedBranchId} onChange={setSelectedBranchId} branches={branches} />
            )}
            <button
              type="button"
              className="dispatch-panel__btn dispatch-panel__btn--primary"
              disabled={busy === 'sync'}
              onClick={syncFromOrders}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy === 'sync' ? 'animate-spin' : ''}`} />
              {busy === 'sync' ? 'Sincronizando…' : 'Sincronizar pedidos'}
            </button>
          </div>
        )}
      />

      <div className="dispatch-panel__filters">
        <label className="dispatch-panel__field">
          <span>Desde</span>
          <div className="dispatch-panel__field-control">
            <Calendar className="h-3.5 w-3.5 opacity-55" aria-hidden />
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value || todayInput())}
            />
          </div>
        </label>
        <label className="dispatch-panel__field">
          <span>Hasta</span>
          <div className="dispatch-panel__field-control">
            <Calendar className="h-3.5 w-3.5 opacity-55" aria-hidden />
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value || todayInput())}
            />
          </div>
        </label>
        <button
          type="button"
          className={`dispatch-panel__today ${isTodayOnly ? 'is-active' : ''}`}
          onClick={setToday}
        >
          Hoy
        </button>
        <label className="dispatch-panel__search">
          <Search className="h-3.5 w-3.5 opacity-55" aria-hidden />
          <input
            type="search"
            placeholder="Buscar pedido, cliente, dirección…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {(error || msg) && (
        <div className="dispatch-panel__alerts">
          {error && <div className="dispatch-panel__alert dispatch-panel__alert--error">{error}</div>}
          {msg && <div className="dispatch-panel__alert dispatch-panel__alert--ok">{msg}</div>}
        </div>
      )}

      <div className="dispatch-panel__meta">
        <span>
          {loading
            ? 'Cargando…'
            : `${filteredJobs.length} en lista`}
          {!loading && pendingCount > 0 ? ` · ${pendingCount} por ofertar` : ''}
          {!loading && isTodayOnly ? ' · solo hoy' : ''}
        </span>
      </div>

      {loading ? (
        <Loader text="Cargando cola…" />
      ) : (
        <section className="dispatch-panel__shell" aria-label="Cola de despacho">
          <div className="dispatch-panel__scroll">
            <table className="dispatch-panel__table">
              <thead>
                <tr>
                  <th className="col-ticket">Pedido</th>
                  <th className="col-client">Cliente</th>
                  <th className="col-address">Dirección</th>
                  <th className="col-money is-num">Pedido</th>
                  <th className="col-money is-num">Delivery</th>
                  <th className="col-driver">Repartidor</th>
                  <th className="col-status">Estado</th>
                  <th className="col-action">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => {
                  const st = STATUS_META[job.status] || { label: job.status, tone: 'other' };
                  const driverName = job.ep_driver_profiles?.profiles?.full_name;
                  const canOffer = OFFERABLE.has(job.status);
                  return (
                    <tr key={job.id} className={canOffer ? 'is-actionable' : undefined}>
                      <td className="col-ticket">
                        <span className="dispatch-panel__ticket">#{job.ticket_code || '—'}</span>
                      </td>
                      <td className="col-client">
                        <span className="dispatch-panel__name" title={job.customer_name || ''}>
                          {job.customer_name || '—'}
                        </span>
                      </td>
                      <td className="col-address">
                        <span className="dispatch-panel__address" title={job.customer_address || ''}>
                          <MapPin className="dispatch-panel__pin" aria-hidden />
                          {job.customer_address || '—'}
                        </span>
                      </td>
                      <td className="col-money is-num">{money(job.order_total)}</td>
                      <td className="col-money is-num dispatch-panel__fee">{money(job.delivery_fee)}</td>
                      <td className="col-driver">
                        {driverName ? (
                          <span className="dispatch-panel__driver">
                            <Bike className="h-3 w-3" aria-hidden />
                            {driverName}
                          </span>
                        ) : (
                          <span className="dispatch-panel__muted">Sin asignar</span>
                        )}
                      </td>
                      <td className="col-status">
                        <span className={`dispatch-panel__badge dispatch-panel__badge--${st.tone}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="col-action">
                        {canOffer ? (
                          <button
                            type="button"
                            className="dispatch-panel__offer"
                            disabled={busy === job.id}
                            onClick={() => offer(job.id)}
                          >
                            <Send className="h-3.5 w-3.5" />
                            {busy === job.id ? 'Ofertando…' : 'Ofertar'}
                          </button>
                        ) : (
                          <span className="dispatch-panel__muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredJobs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="dispatch-panel__empty">
                      {jobs.length === 0
                        ? (
                          <>
                            Sin pedidos en este rango. Por defecto se muestra <strong>solo hoy</strong>.
                            {' '}Cambia las fechas o pulsa <strong>Sincronizar pedidos</strong>.
                          </>
                        )
                        : 'Sin resultados para la búsqueda.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
