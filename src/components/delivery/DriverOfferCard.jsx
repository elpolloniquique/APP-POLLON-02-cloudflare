import { useState } from 'react';
import {
  Check, ChevronDown, ShoppingBag, Bike, Banknote, X, User,
} from 'lucide-react';
import { money } from '../../utils/format';
import {
  OrderDetailModal,
  DriverContactButtons,
  fetchOrderLines,
  buildDriverWhatsappMessage,
} from './DriverOrderHelpers';

/**
 * Card oferta "Nuevo pedido" — aceptar / rechazar + Ver + WhatsApp / Tel.
 */
export function DriverOfferCard({
  offer,
  onAccept,
  onReject,
  loading,
  driverName = 'repartidor',
  branchCity = 'Iquique',
  canAccept = true,
}) {
  const job = offer?.ep_delivery_jobs || offer?.job || {};
  const fee = offer?.offered_fee || job.delivery_fee || 0;
  const orderTotal = job.order_total || 0;
  const charge = orderTotal + fee;
  const phone = job.customer_phone || '';

  const [detailOpen, setDetailOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const waMessage = buildDriverWhatsappMessage({
    customerName: job.customer_name,
    driverName,
    branchCity,
    ticketCode: job.ticket_code,
  });

  const openDetail = async () => {
    setDetailOpen(true);
    setItemsLoading(true);
    try {
      const lines = await fetchOrderLines(job.source_order_id);
      setItems(lines);
    } finally {
      setItemsLoading(false);
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 px-3.5 pt-3.5">
          <span className="rounded-full bg-pollon-red px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            Nuevo pedido
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-emerald-700">Hasta que alguien acepte</span>
            <button
              type="button"
              onClick={openDetail}
              className="inline-flex items-center gap-1 rounded-lg border border-pollon-red bg-white px-2.5 py-1 text-[11px] font-bold text-pollon-red"
            >
              Ver
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2.5 px-3.5 py-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pollon-red text-white">
            <User className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-gray-900">{job.customer_name || 'Cliente'}</p>
            <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-snug text-pollon-red">
              {job.customer_address || 'Sin dirección'}
            </p>
          </div>
        </div>

        <DriverContactButtons phone={phone} message={waMessage} className="px-3.5 pb-2" />

        <div className="mx-3.5 mb-3 grid grid-cols-3 gap-0 overflow-hidden rounded-xl border border-gray-200">
          <div className="border-r border-gray-200 px-2 py-2.5 text-center">
            <ShoppingBag className="mx-auto h-4 w-4 text-pollon-red" />
            <p className="mt-1 text-[9px] font-medium uppercase text-gray-400">Monto pedido</p>
            <p className="text-xs font-bold text-gray-900">{money(orderTotal)}</p>
          </div>
          <div className="border-r border-gray-200 px-2 py-2.5 text-center">
            <Bike className="mx-auto h-4 w-4 text-pollon-red" />
            <p className="mt-1 text-[9px] font-medium uppercase text-gray-400">Delivery</p>
            <p className="text-xs font-bold text-gray-900">{money(fee)}</p>
          </div>
          <div className="px-2 py-2.5 text-center">
            <Banknote className="mx-auto h-4 w-4 text-pollon-red" />
            <p className="mt-1 text-[9px] font-medium uppercase text-gray-400">Total a cobrar</p>
            <p className="text-xs font-bold text-pollon-red">{money(charge)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 px-3.5 pb-3.5">
          <button
            type="button"
            disabled={loading}
            onPointerDown={(e) => {
              if (loading) return;
              e.preventDefault();
              onReject?.(offer);
            }}
            className="inline-flex touch-manipulation items-center justify-center gap-1.5 rounded-xl border-2 border-pollon-red bg-white py-3 text-sm font-bold text-pollon-red active:scale-95 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
            Rechazar
          </button>
          <button
            type="button"
            disabled={loading || !canAccept}
            onPointerDown={(e) => {
              if (loading || !canAccept) return;
              e.preventDefault();
              onAccept?.(offer);
            }}
            className="inline-flex touch-manipulation items-center justify-center gap-1.5 rounded-xl bg-pollon-red py-3 text-sm font-bold text-white active:scale-95 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {canAccept ? 'Aceptar' : 'Cupo lleno'}
          </button>
        </div>
      </div>

      <OrderDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        job={job}
        fee={fee}
        items={items}
        loading={itemsLoading}
      />
    </>
  );
}
