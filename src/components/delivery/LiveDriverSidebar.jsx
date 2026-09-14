import { useEffect, useRef } from 'react';
import { Eye, X } from 'lucide-react';
import { money } from '../../utils/format';
import { confirmPickup } from '../../services/dispatchService';

function OrderDetailPanel({
  detail,
  loading,
  color,
  driverName,
  onClose,
  canMarkPickup,
  onPickupDone,
}) {
  const orders = detail?.orders || [];
  const grandTotal = detail?.grandTotal || 0;
  const panelRef = useRef(null);

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [driverName]);

  return (
    <div
      ref={panelRef}
      className="relative z-30 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,.12)]"
      role="dialog"
      aria-label={`Pedidos de ${driverName || 'repartidor'}`}
    >
      <header className="flex items-start justify-between gap-2 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white shadow" style={{ background: color }} />
            <p className="truncate text-sm font-bold text-gray-900">{driverName || 'Repartidor'}</p>
          </div>
          <p className="mt-0.5 text-[10px] text-gray-500">
            {loading
              ? 'Cargando…'
              : `${orders.length} pedido${orders.length !== 1 ? 's' : ''} activo${orders.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose?.(); }}
          className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="max-h-[min(42vh,320px)] space-y-2.5 overflow-y-auto p-3">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-pollon-red border-t-transparent" />
          </div>
        )}
        {!loading && orders.length === 0 && (
          <p className="py-4 text-center text-xs text-gray-400">Sin pedidos activos</p>
        )}
        {orders.map((o) => (
          <div key={o.assignmentId} className="overflow-hidden rounded-lg border border-gray-200">
            <div className="bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
              Pedido {String(o.index).padStart(2, '0')}
              {o.ticket ? ` · #${o.ticket}` : ''}
              {o.customerName ? ` · ${o.customerName}` : ''}
            </div>
            <div className="space-y-1 px-2.5 py-2">
              {(o.items || []).length === 0 && (
                <p className="text-[11px] text-gray-400">Sin detalle de platos</p>
              )}
              {(o.items || []).map((it, i) => (
                <div key={`${o.assignmentId}-${i}`} className="flex justify-between gap-2 text-[12px]">
                  <span className="min-w-0 text-gray-700">
                    <span className="font-semibold text-gray-400">x{it.qty}</span>{' '}
                    <span className="break-words">{it.name}</span>
                  </span>
                  <span className="shrink-0 font-medium text-gray-800">{money(it.subtotal)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-gray-100 pt-1.5 text-[12px] font-bold">
                <span className="text-gray-600">Total</span>
                <span className="text-pollon-red">{money((o.orderTotal || 0) + (o.deliveryFee || 0))}</span>
              </div>
              {canMarkPickup && (o.phase === 'to_store' || o.phase === 'at_store') && (
                <button
                  type="button"
                  className="mt-1 w-full rounded-lg bg-pollon-red py-1.5 text-[11px] font-bold text-white transition hover:brightness-95"
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await confirmPickup(o.assignmentId);
                      onPickupDone?.();
                    } catch (err) {
                      alert(err.message || 'No se pudo marcar recogido');
                    }
                  }}
                >
                  Marcar pedido recogido
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {!loading && orders.length > 0 && (
        <footer className="border-t border-gray-100 p-3">
          <div className="w-full rounded-xl bg-pollon-red px-3 py-2.5 text-center text-base font-bold text-white shadow-sm">
            {money(grandTotal)}
          </div>
          <p className="mt-1 text-center text-[9px] text-gray-400">Total de pedidos del repartidor</p>
        </footer>
      )}
    </div>
  );
}

function DriverRow({
  item,
  onView,
  onSelect,
  isOpen,
  detail,
  detailLoading,
  onCloseDetail,
  canMarkPickup,
  onPickupDone,
}) {
  return (
    <div className={`rounded-xl transition ${isOpen ? 'ring-2 ring-pollon-red/25' : ''}`}>
      <div
        className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm"
        role="button"
        tabIndex={0}
        onClick={() => onSelect?.(item.driverId)}
        onKeyDown={(e) => e.key === 'Enter' && onSelect?.(item.driverId)}
      >
        <span
          className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white shadow"
          style={{ background: item.color }}
          title={item.phaseLabel}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
          <p className="text-[10px] text-gray-500">
            Actualizado {item.updatedLabel}
            {item.etaLabel ? ` · ${item.etaLabel}` : ''}
          </p>
          {item.gpsOk === false && (
            <p className="text-[10px] font-semibold text-amber-600">Sin GPS en vivo — el repartidor debe tener la app abierta</p>
          )}
          {item.gpsOk && item.routeOk === false && (
            <p className="text-[10px] font-semibold text-amber-600">Sin coords del cliente — geocodificando…</p>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isOpen) onCloseDetail?.();
            else onView?.(item);
          }}
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
            isOpen
              ? 'border-pollon-red bg-red-50 text-pollon-red'
              : 'border-pollon-red/70 text-pollon-red hover:bg-red-50'
          }`}
          title={isOpen ? 'Cerrar detalle' : 'Ver pedidos'}
          aria-expanded={isOpen}
        >
          <Eye className="h-3.5 w-3.5" />
          Ver
        </button>
      </div>

      {isOpen && (
        <OrderDetailPanel
          detail={detail}
          loading={detailLoading}
          color={item.color}
          driverName={item.name}
          onClose={onCloseDetail}
          canMarkPickup={canMarkPickup}
          onPickupDone={onPickupDone}
        />
      )}
    </div>
  );
}

export function LiveDriverSidebar({
  pickupDrivers = [],
  deliveryDrivers = [],
  onView,
  onSelect,
  selectedDriverId,
  openDriverId,
  detail,
  detailLoading,
  onCloseDetail,
  canMarkPickup = false,
  onPickupDone,
  className = '',
}) {
  const renderList = (drivers, emptyText) => (
    <div className="space-y-2">
      {drivers.map((d) => (
        <DriverRow
          key={d.driverId}
          item={d}
          onView={onView}
          onSelect={onSelect}
          isOpen={openDriverId === d.driverId}
          detail={openDriverId === d.driverId ? detail : null}
          detailLoading={openDriverId === d.driverId && detailLoading}
          onCloseDetail={onCloseDetail}
          canMarkPickup={canMarkPickup}
          onPickupDone={onPickupDone}
        />
      ))}
      {drivers.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
          {emptyText}
        </p>
      )}
    </div>
  );

  return (
    <aside className={`live-driver-sidebar relative z-20 flex h-full min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl border bg-white p-3 shadow-sm ${className}`}>
      <section>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Repartidores hacia recojo
        </p>
        {renderList(pickupDrivers, 'Nadie en camino a la sucursal')}
      </section>

      <section>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Repartidores hacia destino cliente
        </p>
        {renderList(deliveryDrivers, 'Sin entregas en curso hacia cliente')}
      </section>
    </aside>
  );
}
