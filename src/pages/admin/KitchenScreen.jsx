import { useMemo, useState, useEffect, useCallback } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import { useOrders } from '../../hooks/useOrders';
import { useAdminBranchFilter } from '../../hooks/useAdminBranchFilter';
import { elapsedMinutes, estadoLabel, nextEstado } from '../../utils/format';
import { ORDER_TYPE_LABELS, canAdvanceOrderEstado } from '../../utils/constants';
import { adminListAllBranches } from '../../services/branchService';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminScrollPanel } from '../../components/admin/AdminScrollPanel';
import { OrderDetailModal } from '../../components/admin/OrderDetailModal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

/** Pedidos visibles en cocina: todos excepto entregados o cancelados */
const KITCHEN_HIDDEN_STATES = new Set(['entregado', 'cancelado']);

function formatItemLine(it) {
  const qty = it.qty || 1;
  const name = it.name || 'Producto';
  return `${qty}x ${name}`;
}

function formatDrinks(it) {
  if (it.drinks?.length) return it.drinks.filter(Boolean);
  if (it.drink) return it.drink.split(' · ').map((s) => s.replace(/^#\d+:\s*/, '').trim()).filter(Boolean);
  return [];
}

function KitchenOrderCard({ order, onView, onAdvance }) {
  const mins = elapsedMinutes(order.createdAt);
  const typeLabel = ORDER_TYPE_LABELS[order.orderType] || order.orderType || 'delivery';
  const next = nextEstado(order.estado);
  const nextLabel = estadoLabel(next);
  const canAdvance = canAdvanceOrderEstado(order.estado) && next !== order.estado;

  return (
    <article className="kitchen-card">
      <header className="kitchen-card__head">
        <span className="kitchen-card__code">#{order.codigo_pedido || order.ticketNumber}</span>
        <span className="kitchen-card__timer">{mins} min</span>
      </header>

      <p className="kitchen-card__meta">
        {estadoLabel(order.estado)} · {typeLabel.toLowerCase()}
      </p>

      <ul className="kitchen-card__items">
        {(order.items || []).map((it, i) => (
          <li key={i}>
            <p className="kitchen-card__item-line">{formatItemLine(it)}</p>
            {formatDrinks(it).map((d, j) => (
              <p key={j} className="kitchen-card__item-extra">🥤 {d}</p>
            ))}
            {it.notes?.trim() && (
              <p className="kitchen-card__item-note">📝 {it.notes}</p>
            )}
          </li>
        ))}
        {!order.items?.length && (
          <li className="kitchen-card__item-empty">Sin productos</li>
        )}
      </ul>

      {order.customer?.reference?.trim() && (
        <p className="kitchen-card__obs">
          <strong>Ref:</strong> {order.customer.reference}
        </p>
      )}
      {order.customer?.comments?.trim() && (
        <p className="kitchen-card__obs">
          <strong>Obs:</strong> {order.customer.comments}
        </p>
      )}

      <footer className="kitchen-card__footer">
        <Badge estado={order.estado}>{estadoLabel(order.estado)}</Badge>
        <button type="button" className="kitchen-card__view" onClick={() => onView(order)}>
          <Eye className="h-4 w-4" aria-hidden />
          Ver
        </button>
        <button
          type="button"
          className="kitchen-card__advance disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => onAdvance(order)}
          disabled={!canAdvance}
          title={canAdvance ? `Avanzar a: ${nextLabel}` : 'Pedido finalizado'}
          aria-label={canAdvance ? `Avanzar estado a ${nextLabel}` : 'Pedido finalizado'}
        >
          <RefreshCw className="kitchen-card__advance-icon" aria-hidden />
          {canAdvance ? (
            <span className="kitchen-card__advance-label">{nextLabel}</span>
          ) : null}
        </button>
      </footer>
    </article>
  );
}

export function KitchenScreen() {
  const { orders, updateOrder, refresh, ready, realtimeStatus, isBackendReady } = useOrders({ alarmEnabled: true });
  const { applyBranchFilter, headerBranchLabel, showBranchFilter } = useAdminBranchFilter();
  const [viewOrder, setViewOrder] = useState(null);
  const [branches, setBranches] = useState([]);
  const [advancingId, setAdvancingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const ordersScoped = useMemo(() => applyBranchFilter(orders), [orders, applyBranchFilter]);

  useEffect(() => {
    adminListAllBranches().then(setBranches).catch(() => {});
  }, [showBranchFilter]);

  const branchFor = useCallback(
    (order) => branches.find((b) => b.id === order.branchId) || { name: headerBranchLabel || 'El Pollón' },
    [branches, headerBranchLabel],
  );

  const active = useMemo(
    () => ordersScoped
      .filter((o) => !KITCHEN_HIDDEN_STATES.has(o.estado))
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')),
    [ordersScoped],
  );

  const changeEstado = async (order) => {
    if (advancingId || !canAdvanceOrderEstado(order.estado)) return;
    const next = nextEstado(order.estado);
    if (next === order.estado) return;
    const updated = {
      ...order,
      estado: next,
      deliveredAt: next === 'entregado' ? new Date().toISOString() : order.deliveredAt,
    };
    setAdvancingId(order.id);
    try {
      await updateOrder(updated);
      await refresh();
      if (viewOrder?.id === order.id) {
        setViewOrder(next === 'entregado' ? null : updated);
      }
    } finally {
      setAdvancingId(null);
    }
  };

  const cancelOrder = async (order) => {
    if (!window.confirm(`¿Cancelar el pedido #${order.codigo_pedido || order.ticketNumber}?`)) return;
    const updated = { ...order, estado: 'cancelado' };
    await updateOrder(updated);
    await refresh();
    if (viewOrder?.id === order.id) setViewOrder(updated);
  };

  const markAllAsDelivered = async () => {
    if (markingAll || active.length === 0) return;
    const ok = window.confirm(
      `¿Marcar los ${active.length} pedido${active.length !== 1 ? 's' : ''} de cocina como ENTREGADO?\n\nDesaparecerán de esta pantalla.`,
    );
    if (!ok) return;

    setMarkingAll(true);
    const deliveredAt = new Date().toISOString();
    try {
      for (const order of active) {
        await updateOrder({
          ...order,
          estado: 'entregado',
          deliveredAt,
        });
      }
      setViewOrder(null);
      await refresh();
    } finally {
      setMarkingAll(false);
    }
  };

  const statusLine = ready && isBackendReady && realtimeStatus === 'live' ? (
    <span className="inline-flex items-center gap-1.5 text-green-700">
      <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
      Actualización en vivo
    </span>
  ) : ready && !isBackendReady ? (
    <span className="text-amber-700">Modo local</span>
  ) : null;

  return (
    <div className="admin-page admin-page--fill kitchen-page">
      <AdminPageHeader
        title="🍳 Cocina digital"
        subtitle={(
          <>
            {active.length} pedido{active.length !== 1 ? 's' : ''} en cola
            {statusLine && <span className="mx-2 text-gray-300">·</span>}
            {statusLine}
          </>
        )}
        branchLabel={headerBranchLabel}
        actions={(
          <div className="kitchen-page__header-actions">
            <Button
              variant="primary"
              className="kitchen-page__btn-deliver-all !px-3 !py-2 text-xs sm:!px-4 sm:text-sm"
              onClick={markAllAsDelivered}
              disabled={markingAll || active.length === 0}
            >
              {markingAll ? 'Marcando…' : 'Marcar todos como entregado'}
            </Button>
            <Button variant="ghost" onClick={refresh} disabled={markingAll}>
              Actualizar
            </Button>
          </div>
        )}
      />

      {active.length > 0 ? (
        <AdminScrollPanel maxRows={12} variant="grid" className="kitchen-board admin-scroll-fill">
          <div className="kitchen-grid">
            {active.map((o) => (
              <KitchenOrderCard
                key={o.id}
                order={o}
                onView={setViewOrder}
                onAdvance={changeEstado}
              />
            ))}
          </div>
        </AdminScrollPanel>
      ) : (
        <div className="kitchen-empty">
          <p className="text-lg font-bold sm:text-xl">Sin pedidos pendientes en cocina</p>
          <p className="mt-1 text-sm opacity-80">Los pedidos entregados desaparecen automáticamente de esta vista.</p>
        </div>
      )}

      {viewOrder && (
        <OrderDetailModal
          order={viewOrder}
          branch={branchFor(viewOrder)}
          onClose={() => setViewOrder(null)}
          onChangeEstado={changeEstado}
          onCancelOrder={cancelOrder}
        />
      )}
    </div>
  );
}
