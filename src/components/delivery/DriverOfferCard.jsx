import { useState } from 'react';
import { ChevronDown, User } from 'lucide-react';
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
  focused = false,
  alertsOnly = false,
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
      <div className={`drv-offer drv-offer--compact ${focused ? 'is-focus' : ''}`}>
        <div className="flex items-center justify-between gap-2 px-2.5 pt-1.5">
          <span className="drv-badge-new">Nuevo pedido</span>
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[9px] font-semibold text-gray-500">Hasta que alguien acepte</span>
            <button
              type="button"
              onClick={openDetail}
              className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-gray-800"
            >
              Ver
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 px-2.5 pt-1">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <User className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold leading-tight text-gray-900">{job.customer_name || 'Cliente'}</p>
            <p className="truncate text-[10px] font-medium leading-tight text-pollon-red">
              {job.customer_address || 'Sin dirección'}
            </p>
          </div>
          <DriverContactButtons phone={phone} message={waMessage} variant="pills" className="shrink-0" />
        </div>

        <div className="drv-offer-money mx-2.5 mt-1 grid grid-cols-3 overflow-hidden rounded-md border border-gray-200">
          <div className="border-r border-gray-200 px-1 py-0.5 text-center">
            <p className="text-[8px] font-medium uppercase leading-none text-gray-400">Monto pedido</p>
            <p className="text-[11px] font-bold leading-tight text-gray-900">{money(orderTotal)}</p>
          </div>
          <div className="border-r border-gray-200 px-1 py-0.5 text-center">
            <p className="text-[8px] font-medium uppercase leading-none text-gray-400">Delivery</p>
            <p className="text-[11px] font-bold leading-tight text-gray-900">{money(fee)}</p>
          </div>
          <div className="px-1 py-0.5 text-center">
            <p className="text-[8px] font-medium uppercase leading-none text-gray-400">Total a cobrar</p>
            <p className="text-[11px] font-bold leading-tight text-gray-900">{money(charge)}</p>
          </div>
        </div>

        {alertsOnly ? (
          <p className="px-2.5 py-1 text-center text-[11px] font-semibold text-pollon-red">
            Este aviso es solo para que sepas que hay pedido nuevo. Acepta en la app nativa de repartidor.
          </p>
        ) : (
        <div className="grid grid-cols-2 gap-1.5 px-2.5 py-1.5">
          <button
            type="button"
            disabled={loading}
            onPointerDown={(e) => {
              if (loading) return;
              e.preventDefault();
              onReject?.(offer);
            }}
            className="drv-btn-rej touch-manipulation active:scale-95"
          >
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
            className="drv-btn-ok touch-manipulation active:scale-95"
          >
            {loading ? 'Aceptando…' : (canAccept ? 'Aceptar' : 'Cupo lleno')}
          </button>
        </div>
        )}
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
