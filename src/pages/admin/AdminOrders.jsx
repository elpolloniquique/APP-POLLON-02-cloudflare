import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Eye,
  Printer,
  RefreshCw,
  Search,
  Volume2,
  VolumeX,
  Phone,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
import { useOrders } from '../../hooks/useOrders';
import { useStaffBranch } from '../../hooks/useStaffBranch';
import { useAdminBranchFilter } from '../../hooks/useAdminBranchFilter';
import { money, formatDateTime, estadoLabel, todayISO } from '../../utils/format';
import { printThermalReceiptSmart } from '../../utils/networkPrinter';
import { adminListAllBranches } from '../../services/branchService';
import { OrderDetailModal } from '../../components/admin/OrderDetailModal';
import { CajaPagoControl } from '../../components/admin/CajaPagoControl';
import { ORDER_STATES, canAdvanceOrderEstado, getNextOrderEstado } from '../../utils/constants';
import { cajaPagoLabel, resolveCajaPagoStatus } from '../../utils/cajaPago';
import { withCashierStatusLineMode } from '../../services/orderStatusSyncService';
import {
  fetchDeliveryJobMap,
  autoDispatchNewOrder,
  manualSearchDrivers,
  fetchDriverNamesForFilter,
  clearCache as clearDeliveryCache,
  retryStaleDriverSearches,
} from '../../services/orderDeliveryService';
import '../../styles/orders-panel.css';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => h);

/** Nombre largo → 2 líneas (ej. "Ari Alexandra" / "Esquivel Contreras") */
function formatClientNameLines(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { line1: '—', line2: '' };
  if (parts.length <= 2) return { line1: parts.join(' '), line2: '' };
  const mid = Math.ceil(parts.length / 2);
  return {
    line1: parts.slice(0, mid).join(' '),
    line2: parts.slice(mid).join(' '),
  };
}

function orderMoneyParts(order) {
  const total = Number(order.total) || 0;
  const deliveryRaw = Number(order.deliveryFee) || 0;
  const delivery = order.orderType === 'delivery' ? deliveryRaw : 0;
  const subtotal = Math.max(0, total - delivery);
  return { subtotal, delivery, total };
}

function orderHour(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours();
}

function formatOrderTime(iso) {
  if (!iso) {
    return { clock: '—', meridiem: '', full: '—', short: '—' };
  }
  try {
    const d = new Date(iso);
    const parts12 = d.toLocaleTimeString('es-CL', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    // "1:46:20 p. m." → reloj + meridiano
    const match = parts12.match(/^(.+?)\s*([ap]\.?\s*m\.?)$/i);
    const clock12 = match ? match[1].trim() : parts12;
    const meridiem = match ? match[2].replace(/\s+/g, ' ').toLowerCase() : '';
    return {
      clock: clock12,
      meridiem,
      full: parts12,
      short: d.toLocaleTimeString('es-CL', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    };
  } catch {
    const fallback = formatDateTime(iso);
    return { clock: fallback, meridiem: '', full: fallback, short: fallback };
  }
}

/** "Akiles Tutacane huillca" → "Akiles T." */
function formatDriverShort(fullName) {
  if (!fullName) return null;
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const initial = parts[1].charAt(0).toUpperCase();
  return `${first} ${initial}.`;
}

function driverDisplay(fullName, isDelivery) {
  if (fullName) {
    return {
      full: fullName,
      short: formatDriverShort(fullName) || fullName,
    };
  }
  const fallback = isDelivery ? 'N/A' : '—';
  return { full: fallback, short: fallback };
}

function statusBadgeClass(estado) {
  if (estado === 'pendiente') return 'orders-panel__badge--nuevo';
  if (estado === 'aceptado' || estado === 'confirmado') return 'orders-panel__badge--aceptado';
  if (estado === 'en_delivery' || estado === 'listo' || estado === 'preparando') {
    return 'orders-panel__badge--reparto';
  }
  if (estado === 'entregado') return 'orders-panel__badge--entregado';
  if (estado === 'cancelado') return 'orders-panel__badge--cancelado';
  return 'orders-panel__badge--otro';
}

export function AdminOrders() {
  const [alarmOn, setAlarmOn] = useState(true);
  const { isBranchScoped } = useStaffBranch();
  const {
    applyBranchFilter,
    showBranchFilter,
    branches: branchList,
    selectedBranchId,
    setSelectedBranchId,
    headerBranchLabel,
  } = useAdminBranchFilter();
  const { orders, updateOrder, refresh, ready, realtimeStatus, isBackendReady } = useOrders({ alarmEnabled: alarmOn });
  const ordersScoped = useMemo(() => applyBranchFilter(orders), [orders, applyBranchFilter]);
  const [estado, setEstado] = useState('');
  const [search, setSearch] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [cajaPagoFilter, setCajaPagoFilter] = useState('');
  const [orderTypeFilter, setOrderTypeFilter] = useState('');
  const [horaInicial, setHoraInicial] = useState('');
  const [horaFinal, setHoraFinal] = useState('');
  const [desde, setDesde] = useState(() => todayISO());
  const [hasta, setHasta] = useState(() => todayISO());
  const [viewOrder, setViewOrder] = useState(null);
  const [branches, setBranches] = useState([]);
  const [cajaBusy, setCajaBusy] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(() => {
    try {
      const saved = sessionStorage.getItem('pollon-orders-filters-open');
      return saved == null ? true : saved === '1';
    } catch {
      return true;
    }
  });

  const [deliveryMap, setDeliveryMap] = useState({});
  const [driverNames, setDriverNames] = useState([]);
  const [searchingDriver, setSearchingDriver] = useState({});
  const autoDispatchedRef = useRef(new Set());

  const today = todayISO();
  const showingTodayOnly = desde === today && hasta === today;

  const resetToToday = () => {
    setDesde(todayISO());
    setHasta(todayISO());
  };

  useEffect(() => {
    if (showBranchFilter) {
      setBranches(branchList);
    } else {
      adminListAllBranches().then(setBranches).catch(() => {});
    }
  }, [showBranchFilter, branchList]);

  const branchFor = useCallback(
    (order) => branches.find((b) => b.id === order.branchId) || { name: 'El Pollón' },
    [branches],
  );

  const refreshDelivery = useCallback(async () => {
    const map = await fetchDeliveryJobMap();
    setDeliveryMap({ ...map });
  }, []);

  useEffect(() => {
    refreshDelivery();
    fetchDriverNamesForFilter().then(setDriverNames).catch(() => {});
    const t = setInterval(refreshDelivery, 12000);
    return () => clearInterval(t);
  }, [refreshDelivery]);

  useEffect(() => {
    if (!ready) return;
    const deliveryOrders = ordersScoped.filter(
      (o) => o.orderType === 'delivery' && o.estado === 'pendiente' && !autoDispatchedRef.current.has(o.id),
    );
    for (const o of deliveryOrders) {
      autoDispatchedRef.current.add(o.id);
      autoDispatchNewOrder(o.id).then(() => {
        setTimeout(refreshDelivery, 1500);
      });
    }
  }, [ordersScoped, ready, refreshDelivery]);

  useEffect(() => {
    if (!ready) return undefined;
    const tick = () => {
      retryStaleDriverSearches()
        .then((r) => {
          if (r?.retried > 0) setTimeout(refreshDelivery, 800);
        })
        .catch(() => {});
    };
    tick();
    const t = setInterval(tick, 15000);
    return () => clearInterval(t);
  }, [ready, refreshDelivery]);

  useEffect(() => {
    const syncing = new Set();
    const tasks = [];
    const doneKey = (id, estado) => `${id}:${estado}`;

    for (const o of ordersScoped) {
      const info = deliveryMap[o.id];
      if (!info?.jobStatus) continue;
      const st = info.jobStatus;
      const cur = o.estado;
      let nextEstado = null;
      let next = null;

      if (cur === 'pendiente' && (st === 'assigned' || st === 'heading_to_branch') && info.driverId) {
        nextEstado = 'aceptado';
        next = {
          ...o,
          estado: 'aceptado',
          trackingMode: 'live_map',
          driverAcceptedAt: new Date().toISOString(),
        };
      } else if (
        (st === 'picked_up' || st === 'delivering')
        && !['en_delivery', 'entregado', 'cancelado'].includes(cur)
      ) {
        nextEstado = 'en_delivery';
        next = {
          ...o,
          estado: 'en_delivery',
          trackingMode: o.trackingMode || 'live_map',
          pickedUpAt: new Date().toISOString(),
        };
      } else if (st === 'delivered' && cur !== 'entregado' && cur !== 'cancelado') {
        nextEstado = 'entregado';
        next = {
          ...o,
          estado: 'entregado',
          deliveredAt: new Date().toISOString(),
        };
      }

      if (!next || !nextEstado) continue;
      const key = doneKey(o.id, nextEstado);
      if (syncing.has(key) || autoDispatchedRef.current.has(`sync:${key}`)) continue;
      syncing.add(key);
      autoDispatchedRef.current.add(`sync:${key}`);
      tasks.push(updateOrder(next));
    }

    if (!tasks.length) return undefined;

    let cancelled = false;
    Promise.allSettled(tasks).then((results) => {
      if (cancelled) return;
      const ok = results.some((r) => r.status === 'fulfilled');
      if (ok) refresh();
    });

    return () => { cancelled = true; };
  }, [deliveryMap, ordersScoped, updateOrder, refresh]);

  const todayCount = useMemo(
    () => ordersScoped.filter((o) => (o.createdAt || '').substring(0, 10) === today).length,
    [ordersScoped, today],
  );

  const filtered = useMemo(() => ordersScoped.filter((o) => {
    const d = (o.createdAt || '').substring(0, 10);
    if (desde && d < desde) return false;
    if (hasta && d > hasta) return false;
    if (estado && o.estado !== estado) return false;
    if (orderTypeFilter && (o.orderType || 'delivery') !== orderTypeFilter) return false;
    if (horaInicial !== '' || horaFinal !== '') {
      const h = orderHour(o.createdAt);
      if (h == null) return false;
      if (horaInicial !== '' && h < Number(horaInicial)) return false;
      if (horaFinal !== '' && h > Number(horaFinal)) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const n = (o.customer?.name || '').toLowerCase();
      const t = (o.customer?.phone || '').toLowerCase();
      const c = String(o.codigo_pedido || o.ticketNumber || '').toLowerCase();
      if (!n.includes(q) && !t.includes(q) && !c.includes(q)) return false;
    }
    if (driverFilter) {
      const info = deliveryMap[o.id];
      if (driverFilter === '__none') {
        if (info?.driverId) return false;
      } else if (info?.driverId !== driverFilter) {
        return false;
      }
    }
    if (cajaPagoFilter) {
      const st = resolveCajaPagoStatus(o);
      if (st !== cajaPagoFilter) return false;
    }
    return true;
  }), [
    ordersScoped,
    estado,
    search,
    desde,
    hasta,
    driverFilter,
    cajaPagoFilter,
    deliveryMap,
    orderTypeFilter,
    horaInicial,
    horaFinal,
  ]);

  const totals = useMemo(() => filtered.reduce(
    (acc, o) => {
      const parts = orderMoneyParts(o);
      acc.subtotal += parts.subtotal;
      acc.delivery += parts.delivery;
      acc.total += parts.total;
      return acc;
    },
    { subtotal: 0, delivery: 0, total: 0 },
  ), [filtered]);

  const exportCsv = () => {
    const rows = [[
      'Código',
      'Sucursal',
      'Cliente',
      'Teléfono',
      'Subtotal',
      'Delivery',
      'Total',
      'Estado',
      'Repartidor',
      'Cobro caja',
      'Fecha',
    ]];
    filtered.forEach((o) => {
      const info = deliveryMap[o.id];
      const parts = orderMoneyParts(o);
      rows.push([
        o.codigo_pedido || o.ticketNumber,
        branchFor(o).name,
        o.customer?.name,
        o.customer?.phone,
        parts.subtotal,
        parts.delivery,
        parts.total,
        estadoLabel(o.estado),
        info?.driver?.full_name || 'N/A',
        cajaPagoLabel(resolveCajaPagoStatus(o)),
        o.createdAt,
      ]);
    });
    const csv = rows.map((r) => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `pedidos-pollon-${Date.now()}.csv`;
    a.click();
  };

  const applyEstado = async (order, next) => {
    if (!next || next === order.estado) return;
    let updated = {
      ...order,
      estado: next,
      deliveredAt: next === 'entregado' ? new Date().toISOString() : order.deliveredAt,
    };
    // Cajera avanza sin aceptación de app → cliente solo ve barra de estados
    if (order.trackingMode !== 'live_map' && next !== 'cancelado') {
      updated = withCashierStatusLineMode(updated, next);
    }
    await updateOrder(updated);
    refresh();
    if (viewOrder?.id === order.id) setViewOrder(updated);
  };

  const changeEstado = async (order) => {
    if (!canAdvanceOrderEstado(order.estado)) return;
    await applyEstado(order, getNextOrderEstado(order.estado));
  };

  const cancelOrder = async (order) => {
    if (!window.confirm(`¿Cancelar el pedido #${order.codigo_pedido || order.ticketNumber}? Esta acción no se puede deshacer.`)) {
      return;
    }
    await applyEstado(order, 'cancelado');
  };

  const handlePrint = async (order) => {
    try {
      await printThermalReceiptSmart(order, branchFor(order));
    } catch (e) {
      alert(e.message || 'No se pudo imprimir');
    }
  };

  const handleSearchDriver = async (order) => {
    setSearchingDriver((s) => ({ ...s, [order.id]: true }));
    try {
      const res = await manualSearchDrivers(order.id);
      const n = Number(res?.offered) || 0;
      const web = Number(res?.notify?.webSent) || 0;
      const fcm = Number(res?.notify?.fcmSent) || 0;
      if (n > 0 || res?.renotified) {
        alert(
          `Aviso enviado a repartidor(es)${n ? ` (${n})` : ''}.`
          + `\nPush web (pollito): ${web} · App nativa: ${fcm}.`
          + '\nDeben ver la notificación en la bandeja (deslizar desde arriba).',
        );
      } else {
        alert(res?.message || 'Ningún repartidor disponible con GPS en vivo. El moto debe estar Disponible y GPS no puede decir “Buscando…”.');
      }
      setTimeout(refreshDelivery, 2000);
    } catch (e) {
      alert(e.message || 'No se encontraron repartidores disponibles');
    } finally {
      setSearchingDriver((s) => ({ ...s, [order.id]: false }));
    }
  };

  const changeCajaPago = async (order, next) => {
    if (!next || !['na', 'por_pagar', 'pagado'].includes(next)) return;
    setCajaBusy((s) => ({ ...s, [order.id]: true }));
    try {
      const updated = { ...order, cajaPago: next };
      await updateOrder(updated);
      refresh();
      if (viewOrder?.id === order.id) setViewOrder(updated);
    } catch (e) {
      alert(e.message || 'No se pudo actualizar el cobro de caja');
    } finally {
      setCajaBusy((s) => ({ ...s, [order.id]: false }));
    }
  };

  const handleRefreshAll = () => {
    clearDeliveryCache();
    refresh();
    refreshDelivery();
  };

  const toggleFilters = () => {
    setFiltersOpen((open) => {
      const next = !open;
      try {
        sessionStorage.setItem('pollon-orders-filters-open', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const activeFiltersCount = [
    !showingTodayOnly,
    horaInicial !== '',
    horaFinal !== '',
    estado !== '',
    driverFilter !== '',
    orderTypeFilter !== '',
    cajaPagoFilter !== '',
    search.trim() !== '',
  ].filter(Boolean).length;

  const liveOk = ready && isBackendReady && realtimeStatus === 'live';

  return (
    <div className="orders-panel">
      <div className="orders-panel__top">
        <div className="orders-panel__status">
          <div className={`orders-panel__live ${liveOk ? 'is-live' : ready && !isBackendReady ? 'is-local' : 'is-wait'}`}>
            {liveOk ? (
              <>
                <span className="orders-panel__live-dot" aria-hidden />
                En tiempo real
              </>
            ) : ready && !isBackendReady ? (
              <span className="orders-panel__live-local">Modo local</span>
            ) : (
              <>
                <span className="orders-panel__live-dot is-muted" aria-hidden />
                Conectando…
              </>
            )}
          </div>
          {(isBranchScoped || selectedBranchId) && headerBranchLabel ? (
            <span className="orders-panel__branch-note">{headerBranchLabel}</span>
          ) : null}
        </div>

        <div className="orders-panel__actions">
          <button
            type="button"
            className={`orders-panel__btn ${alarmOn ? 'orders-panel__btn--alarm-on' : 'orders-panel__btn--alarm-off'}`}
            onClick={() => setAlarmOn(!alarmOn)}
            title={alarmOn ? 'Desactivar alarma de pedidos nuevos' : 'Activar alarma'}
          >
            {alarmOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {alarmOn ? 'Alarma ON' : 'Alarma OFF'}
          </button>
          <button
            type="button"
            className="orders-panel__btn orders-panel__btn--primary"
            onClick={handleRefreshAll}
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
          <button type="button" className="orders-panel__btn" onClick={exportCsv} title="Exportar CSV">
            CSV
          </button>
          {showBranchFilter && (
            <label className="orders-panel__branch">
              <span>Sucursal</span>
              <select
                value={selectedBranchId || ''}
                onChange={(e) => setSelectedBranchId(e.target.value)}
              >
                <option value="">Todas las sucursales</option>
                {branchList.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className={`orders-panel__filters-wrap ${filtersOpen ? 'is-open' : 'is-closed'}`}>
        <button
          type="button"
          className="orders-panel__filters-toggle"
          onClick={toggleFilters}
          aria-expanded={filtersOpen}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filtros</span>
          {activeFiltersCount > 0 && (
            <span className="orders-panel__filters-badge">{activeFiltersCount}</span>
          )}
          <span className="orders-panel__filters-hint">
            {filtersOpen ? 'Ocultar' : 'Mostrar'} · Hoy {todayCount}
          </span>
          <ChevronDown className={`orders-panel__filters-chevron ${filtersOpen ? 'is-open' : ''}`} />
        </button>

        {filtersOpen && (
          <div className="orders-panel__filters">
            <label className="orders-panel__field orders-panel__field--date">
              <span>Desde</span>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label className="orders-panel__field orders-panel__field--date">
              <span>Hasta</span>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </label>

            <button
              type="button"
              className={`orders-panel__today ${showingTodayOnly ? 'is-active' : ''}`}
              onClick={resetToToday}
              title="Ver pedidos de hoy"
            >
              <span>Hoy</span>
              <strong>{todayCount}</strong>
            </button>

            <label className="orders-panel__field orders-panel__field--hour">
              <span>Hora inicial</span>
              <select value={horaInicial} onChange={(e) => setHoraInicial(e.target.value)}>
                <option value="">Todas</option>
                {HOUR_OPTIONS.map((h) => (
                  <option key={`hi-${h}`} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>
                ))}
              </select>
            </label>
            <label className="orders-panel__field orders-panel__field--hour">
              <span>Hora final</span>
              <select value={horaFinal} onChange={(e) => setHoraFinal(e.target.value)}>
                <option value="">Todas</option>
                {HOUR_OPTIONS.map((h) => (
                  <option key={`hf-${h}`} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>
                ))}
              </select>
            </label>

            <label className="orders-panel__field orders-panel__field--estado">
              <span>Estaciones</span>
              <select value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="">Todas las estaciones</option>
                {ORDER_STATES.map((s) => (
                  <option key={s} value={s}>{estadoLabel(s)}</option>
                ))}
              </select>
            </label>

            <label className="orders-panel__field orders-panel__field--driver">
              <span>Repartidores</span>
              <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}>
                <option value="">Todos los repartidores</option>
                <option value="__none">Sin repartidor (N/A)</option>
                {driverNames.map((d) => (
                  <option key={d.driverId} value={d.driverId}>{d.name}</option>
                ))}
              </select>
            </label>

            <label className="orders-panel__field orders-panel__field--tipo">
              <span>Cocina asig.</span>
              <select value={orderTypeFilter} onChange={(e) => setOrderTypeFilter(e.target.value)}>
                <option value="">Todos</option>
                <option value="delivery">Delivery</option>
                <option value="retiro">Retiro</option>
                <option value="reserva">Reserva</option>
              </select>
            </label>

            <label className="orders-panel__field orders-panel__field--cobro">
              <span>Cobro caja</span>
              <select value={cajaPagoFilter} onChange={(e) => setCajaPagoFilter(e.target.value)}>
                <option value="">Todos</option>
                <option value="na">N/A</option>
                <option value="por_pagar">Por pagar</option>
                <option value="pagado">Pagado</option>
              </select>
            </label>

            <label className="orders-panel__field orders-panel__field--search">
              <span>Buscar</span>
              <div className="orders-panel__search">
                <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <input
                  type="search"
                  placeholder="Buscar por código, cliente o teléfono..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </label>
          </div>
        )}
      </div>

      <div className={`orders-panel__shell ${filtersOpen ? '' : 'is-expanded'}`}>
        {/* Vista móvil: cards sin scroll horizontal */}
        <div className="orders-panel__cards">
          {filtered.length === 0 ? (
            <p className="orders-panel__cards-empty">Sin pedidos con estos filtros</p>
          ) : (
            filtered.map((o) => {
              const info = deliveryMap[o.id];
              const driverName = info?.driver?.full_name || null;
              const isDelivery = o.orderType === 'delivery';
              const driver = driverDisplay(driverName, isDelivery);
              const isNew = o.estado === 'pendiente';
              const canSearch = isDelivery
                && !info?.driverId
                && !['entregado', 'cancelado', 'anulado'].includes(String(o.estado || '').toLowerCase());
              const parts = orderMoneyParts(o);
              const phone = o.customer?.phone || '';
              const time = formatOrderTime(o.createdAt);

              return (
                <article key={o.id} className={`orders-panel__card ${isNew ? 'is-new' : ''}`}>
                  <header className="orders-panel__card-head">
                    <div>
                      <span className="is-code">{o.codigo_pedido || o.ticketNumber}</span>
                      <span className={`orders-panel__badge ${statusBadgeClass(o.estado)}`}>
                        {estadoLabel(o.estado)}
                      </span>
                    </div>
                    <time className="orders-panel__time">
                      <span className="orders-panel__time-clock">{time.clock}</span>
                      {time.meridiem ? <span className="orders-panel__time-meridiem">{time.meridiem}</span> : null}
                    </time>
                  </header>
                  <div className="orders-panel__card-body">
                    <p className="orders-panel__card-name">{o.customer?.name || '—'}</p>
                    {phone ? (
                      <a className="orders-panel__phone" href={`tel:${phone}`}>
                        <Phone className="h-3.5 w-3.5" />
                        {phone}
                      </a>
                    ) : null}
                    <p className="orders-panel__card-meta">{branchFor(o).name} · {driver.short}</p>
                    <div className="orders-panel__card-money">
                      <span>Sub {money(parts.subtotal)}</span>
                      <span>Del {money(parts.delivery)}</span>
                      <strong>{money(parts.total)}</strong>
                    </div>
                    <div className="orders-panel__card-cobro">
                      <CajaPagoControl
                        order={o}
                        disabled={Boolean(cajaBusy[o.id])}
                        onChange={(next) => changeCajaPago(o, next)}
                      />
                    </div>
                  </div>
                  <footer className="orders-panel__card-actions">
                    <button type="button" className="orders-panel__icon-btn" onClick={() => setViewOrder(o)} title="Ver" aria-label="Ver">
                      <Eye className="orders-panel__icon-svg" />
                      <span className="orders-panel__icon-label">Ver</span>
                    </button>
                    <button type="button" className="orders-panel__icon-btn orders-panel__icon-btn--print" onClick={() => handlePrint(o)} title="Imprimir" aria-label="Imprimir">
                      <Printer className="orders-panel__icon-svg" />
                    </button>
                    <button
                      type="button"
                      className="orders-panel__icon-btn orders-panel__icon-btn--status"
                      onClick={() => changeEstado(o)}
                      disabled={!canAdvanceOrderEstado(o.estado)}
                      title="Avanzar estado"
                      aria-label="Avanzar estado"
                    >
                      <RefreshCw className="orders-panel__icon-svg" />
                    </button>
                    {canSearch ? (
                      <button
                        type="button"
                        className="orders-panel__icon-btn orders-panel__icon-btn--reassign"
                        onClick={() => handleSearchDriver(o)}
                        disabled={searchingDriver[o.id]}
                        title="Reasignar"
                        aria-label="Reasignar"
                      >
                        <Search className={`orders-panel__icon-svg ${searchingDriver[o.id] ? 'animate-spin' : ''}`} />
                        <span className="orders-panel__icon-label">Reasignar</span>
                      </button>
                    ) : (
                      <span className="orders-panel__icon-btn orders-panel__icon-btn--ghost" aria-hidden="true" />
                    )}
                  </footer>
                </article>
              );
            })
          )}
          {filtered.length > 0 && (
            <div className="orders-panel__cards-total">
              <strong>TOTAL</strong>
              <span>{money(totals.subtotal)}</span>
              <span>{money(totals.delivery)}</span>
              <strong>{money(totals.total)}</strong>
              <em>{filtered.length} pedido{filtered.length !== 1 ? 's' : ''}</em>
            </div>
          )}
        </div>

        {/* Vista tablet / PC 10" / desktop: tabla fluida sin scroll horizontal */}
        <div className="orders-panel__scroll">
          <table className="orders-panel__table">
            <thead>
              <tr>
                <th className="col-code">Código</th>
                <th className="col-branch">Sucursal</th>
                <th className="col-client">Cliente</th>
                <th className="col-phone">Teléfono</th>
                <th className="is-num col-sub">Subtotal</th>
                <th className="is-num col-del">Delivery</th>
                <th className="is-num col-total">Total</th>
                <th className="col-estado">Estado</th>
                <th className="col-driver">Repartidor</th>
                <th className="col-cobro">Cobro</th>
                <th className="col-hora">Hora</th>
                <th className="col-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="orders-panel__empty">Sin pedidos con estos filtros</td>
                </tr>
              ) : (
                filtered.map((o) => {
                  const info = deliveryMap[o.id];
                  const driverName = info?.driver?.full_name || null;
                  const isDelivery = o.orderType === 'delivery';
                  const driver = driverDisplay(driverName, isDelivery);
                  const isNew = o.estado === 'pendiente';
                  const canSearch = isDelivery
                    && !info?.driverId
                    && !['entregado', 'cancelado', 'anulado'].includes(String(o.estado || '').toLowerCase());
                  const parts = orderMoneyParts(o);
                  const phone = o.customer?.phone || '';
                  const time = formatOrderTime(o.createdAt);

                  return (
                    <tr key={o.id} className={isNew ? 'is-new' : ''}>
                      <td className="is-code col-code">{o.codigo_pedido || o.ticketNumber}</td>
                      <td className="col-branch orders-panel__clip">{branchFor(o).name}</td>
                      <td className="col-client">
                        {(() => {
                          const full = o.customer?.name || '';
                          const { line1, line2 } = formatClientNameLines(full);
                          return (
                            <span className="orders-panel__client-name" title={full}>
                              <span className="orders-panel__client-line">{line1}</span>
                              {line2 ? (
                                <span className="orders-panel__client-line">{line2}</span>
                              ) : null}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="col-phone">
                        {phone ? (
                          <a className="orders-panel__phone" href={`tel:${phone}`} title={phone}>
                            <Phone className="h-3.5 w-3.5" />
                            <span className="orders-panel__phone-text">{phone}</span>
                          </a>
                        ) : '—'}
                      </td>
                      <td className="is-num col-sub">{money(parts.subtotal)}</td>
                      <td className="is-num col-del">{money(parts.delivery)}</td>
                      <td className="is-num is-strong col-total">{money(parts.total)}</td>
                      <td className="is-center col-estado">
                        <span className={`orders-panel__badge ${statusBadgeClass(o.estado)}`}>
                          {estadoLabel(o.estado)}
                        </span>
                      </td>
                      <td className="col-driver" title={driver.full}>
                        <span className="orders-panel__driver-full">{driver.full}</span>
                        <span className="orders-panel__driver-short">{driver.short}</span>
                      </td>
                      <td className="col-cobro">
                        <CajaPagoControl
                          order={o}
                          disabled={Boolean(cajaBusy[o.id])}
                          onChange={(next) => changeCajaPago(o, next)}
                        />
                      </td>
                      <td className="col-hora">
                        <span className="orders-panel__time" title={time.full}>
                          <span className="orders-panel__time-clock">{time.clock}</span>
                          {time.meridiem ? (
                            <span className="orders-panel__time-meridiem">{time.meridiem}</span>
                          ) : null}
                        </span>
                      </td>
                      <td className="col-actions">
                        <div className="orders-panel__actions-cell" role="group" aria-label="Acciones del pedido">
                          <button
                            type="button"
                            className="orders-panel__icon-btn"
                            onClick={() => setViewOrder(o)}
                            title="Ver pedido"
                            aria-label="Ver pedido"
                          >
                            <Eye className="orders-panel__icon-svg" />
                          </button>
                          <button
                            type="button"
                            className="orders-panel__icon-btn orders-panel__icon-btn--print"
                            onClick={() => handlePrint(o)}
                            title="Imprimir"
                            aria-label="Imprimir"
                          >
                            <Printer className="orders-panel__icon-svg" />
                          </button>
                          <button
                            type="button"
                            className="orders-panel__icon-btn orders-panel__icon-btn--status"
                            onClick={() => changeEstado(o)}
                            disabled={!canAdvanceOrderEstado(o.estado)}
                            title={
                              canAdvanceOrderEstado(o.estado)
                                ? `Avanzar a ${estadoLabel(getNextOrderEstado(o.estado))}`
                                : 'Pedido finalizado'
                            }
                            aria-label="Avanzar estado"
                          >
                            <RefreshCw className="orders-panel__icon-svg" />
                          </button>
                          {canSearch ? (
                            <button
                              type="button"
                              className="orders-panel__icon-btn orders-panel__icon-btn--reassign"
                              onClick={() => handleSearchDriver(o)}
                              disabled={searchingDriver[o.id]}
                              title="Buscar / reasignar repartidor"
                              aria-label="Reasignar repartidor"
                            >
                              <Search className={`orders-panel__icon-svg ${searchingDriver[o.id] ? 'animate-spin' : ''}`} />
                            </button>
                          ) : (
                            <span className="orders-panel__icon-btn orders-panel__icon-btn--ghost" aria-hidden="true" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="orders-panel__tfoot">
                <td className="orders-panel__footer-label col-code">TOTAL</td>
                <td className="col-branch" />
                <td className="col-client" />
                <td className="col-phone" />
                <td className="is-num col-sub">{money(totals.subtotal)}</td>
                <td className="is-num col-del">{money(totals.delivery)}</td>
                <td className="is-num col-total">{money(totals.total)}</td>
                <td className="col-estado" />
                <td className="col-driver" />
                <td className="col-cobro" />
                <td className="col-hora" />
                <td className="orders-panel__footer-meta col-actions">
                  {filtered.length} pedido{filtered.length !== 1 ? 's' : ''}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {viewOrder && (
        <OrderDetailModal
          order={viewOrder}
          branch={branchFor(viewOrder)}
          onClose={() => setViewOrder(null)}
          onChangeEstado={changeEstado}
          onCancelOrder={cancelOrder}
          cajaPagoSlot={(
            <CajaPagoControl
              order={viewOrder}
              disabled={Boolean(cajaBusy[viewOrder.id])}
              onChange={(next) => changeCajaPago(viewOrder, next)}
            />
          )}
        />
      )}
    </div>
  );
}
