import { useState } from 'react';
import { ChevronDown, Navigation, User, Banknote } from 'lucide-react';
import { money } from '../../utils/format';
import { openExternalNavigation } from '../../utils/osrm';
import {
  OrderDetailModal,
  DriverContactButtons,
  fetchOrderLines,
  buildDriverWhatsappMessage,
} from './DriverOrderHelpers';

/**
 * Pedido aceptado / en curso.
 * El detalle (Ver) permanece disponible hasta marcar Entregado.
 */
export function DriverActiveOrderCard({
  assignment,
  branch,
  driverName,
  branchCity = 'Iquique',
  loading,
  onPickup,
  onDelivered,
}) {
  const job = assignment?.ep_delivery_jobs || {};
  const toStore = assignment?.phase === 'to_store' || assignment?.phase === 'at_store';
  const fee = job.delivery_fee || 0;
  const charge = (job.order_total || 0) + fee;
  const phone = job.customer_phone || '';
  const accent = toStore ? 'text-pollon-red' : 'text-pollon-orange';
  const border = toStore ? 'border-red-200' : 'border-orange-200';
  const iconBg = toStore ? 'bg-pollon-red' : 'bg-pollon-orange';

  const [detailOpen, setDetailOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const waMessage = buildDriverWhatsappMessage({
    customerName: job.customer_name,
    driverName,
    branchCity: branchCity || branch?.city || 'Iquique',
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
      <div className={`overflow-hidden rounded-2xl border ${border} bg-white shadow-sm`}>
        <div className="flex items-center justify-between gap-2 px-3.5 pt-3.5">
          <p className={`text-[10px] font-bold uppercase tracking-wide ${accent}`}>
            {toStore ? 'Hacia sucursal · recojo' : 'Hacia cliente · entrega'}
          </p>
          <button
            type="button"
            onClick={openDetail}
            className="inline-flex items-center gap-1 rounded-lg border border-pollon-red bg-white px-2.5 py-1 text-[11px] font-bold text-pollon-red"
          >
            Ver
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-start gap-2.5 px-3.5 py-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconBg} text-white`}>
            <User className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-gray-900">
              #{job.ticket_code || '—'} · {job.customer_name || 'Cliente'}
            </p>
            <p className={`mt-0.5 line-clamp-2 text-xs font-medium leading-snug ${accent}`}>
              {toStore
                ? (branch?.address || branch?.name || 'Sucursal El Pollón')
                : (job.customer_address || 'Sin dirección')}
            </p>
            <p className="mt-1.5 inline-flex items-center gap-1 text-sm font-bold text-gray-900">
              <Banknote className="h-4 w-4 text-pollon-red" />
              Cobrar {money(charge)}
            </p>
          </div>
        </div>

        <DriverContactButtons
          phone={phone}
          message={waMessage}
          className="px-3.5 pb-2"
        />

        <div className="grid gap-2 px-3.5 pb-3.5">
          {toStore && branch?.lat != null && (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white"
              onClick={() => openExternalNavigation(branch.lat, branch.lng, branch.name || 'Sucursal')}
            >
              <Navigation className="h-4 w-4" />
              Navegar a sucursal
            </button>
          )}
          {!toStore && job.customer_lat != null && (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white"
              onClick={() => openExternalNavigation(job.customer_lat, job.customer_lng, job.customer_name)}
            >
              <Navigation className="h-4 w-4" />
              Navegar al cliente
            </button>
          )}
          {toStore ? (
            <button
              type="button"
              disabled={loading}
              className="rounded-xl bg-pollon-red py-3 text-sm font-bold text-white disabled:opacity-50"
              onClick={() => onPickup?.(assignment)}
            >
              Pedido recogido
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              className="rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50"
              onClick={() => onDelivered?.(assignment)}
            >
              Entregado
            </button>
          )}
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
