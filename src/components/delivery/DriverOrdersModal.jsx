import { X } from 'lucide-react';
import { money } from '../../utils/format';
import { confirmPickup } from '../../services/dispatchService';

export function DriverOrdersModal({
  open,
  onClose,
  detail,
  loading,
  color,
  driverName,
  onPickupDone,
  canMarkPickup = false,
}) {
  if (!open) return null;

  const orders = detail?.orders || [];
  const grandTotal = detail?.grandTotal || 0;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-3 sm:items-center" onClick={onClose} role="presentation">
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Pedidos del repartidor"
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: color }} />
              <h3 className="truncate font-bold text-gray-900">{driverName || 'Repartidor'}</h3>
            </div>
            <p className="text-xs text-gray-500">{orders.length} pedido{orders.length !== 1 ? 's' : ''} activo{orders.length !== 1 ? 's' : ''}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[55dvh] space-y-3 overflow-y-auto p-4">
          {loading && <p className="text-sm text-gray-500">Cargando pedidos…</p>}
          {!loading && orders.length === 0 && (
            <p className="text-sm text-gray-500">Sin pedidos activos</p>
          )}
          {orders.map((o) => (
            <div key={o.assignmentId} className="overflow-hidden rounded-xl border border-gray-200">
              <div className="bg-amber-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-amber-900">
                Pedido {String(o.index).padStart(2, '0')}
                {o.ticket ? ` · #${o.ticket}` : ''}
                {o.customerName ? ` · ${o.customerName}` : ''}
              </div>
              <div className="space-y-1.5 px-3 py-2">
                {(o.items || []).length === 0 && (
                  <p className="text-xs text-gray-400">Sin detalle de platos</p>
                )}
                {(o.items || []).map((it, i) => (
                  <div key={`${o.assignmentId}-${i}`} className="flex justify-between gap-2 text-sm">
                    <span className="text-gray-700">
                      <span className="font-semibold text-gray-500">x {it.qty}</span>{' '}
                      {it.name}
                    </span>
                    <span className="shrink-0 font-medium">{money(it.subtotal)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2 text-sm font-bold">
                  <span>Total</span>
                  <span className="text-pollon-red">{money((o.orderTotal || 0) + (o.deliveryFee || 0))}</span>
                </div>
                {canMarkPickup && (o.phase === 'to_store' || o.phase === 'at_store') && (
                  <button
                    type="button"
                    className="mt-1 w-full rounded-lg bg-pollon-red py-2 text-xs font-bold text-white"
                    onClick={async () => {
                      try {
                        await confirmPickup(o.assignmentId);
                        onPickupDone?.();
                      } catch (e) {
                        alert(e.message || 'No se pudo marcar recogido');
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

        <footer className="border-t p-4">
          <div className="w-full rounded-xl bg-pollon-red px-4 py-3 text-center text-lg font-bold text-white shadow-md">
            {money(grandTotal)}
          </div>
          <p className="mt-1 text-center text-[10px] text-gray-400">Total de todos los pedidos del repartidor</p>
        </footer>
      </div>
    </div>
  );
}
