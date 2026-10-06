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
  alertsOnly = false,
}) {
  const job = assignment?.ep_delivery_jobs || {};
  const toStore = assignment?.phase === 'to_store' || assignment?.phase === 'at_store';
  const fee = job.delivery_fee || 0;
  const charge = (job.order_total || 0) + fee;
  const phone = job.customer_phone || '';

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
      <div className="drv-offer">
        <div className="flex items-center justify-between gap-2 px-3.5 pt-3">
          <span className="drv-badge-new">
            {toStore ? 'Hacia sucursal' : 'En ruta al cliente'}
          </span>
          <button
            type="button"
            onClick={openDetail}
            className="inline-flex items-center gap-0.5 text-[12px] font-bold text-gray-800"
          >
            Ver
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-start gap-2.5 px-3.5 py-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <User className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-gray-900">
              #{job.ticket_code || '—'} · {job.customer_name || 'Cliente'}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-snug text-pollon-red">
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
          variant="pills"
          className="px-3.5 pb-2"
        />

        <div className="grid gap-2 px-3.5 pb-3.5">
          {toStore && branch?.lat != null && (
            <button
              type="button"
              className="drv-btn-ok inline-flex items-center justify-center gap-2"
              onClick={() => openExternalNavigation(branch.lat, branch.lng, branch.name || 'Sucursal')}
            >
              <Navigation className="h-4 w-4" />
              Navegar a sucursal
            </button>
          )}
          {!toStore && job.customer_lat != null && (
            <button
              type="button"
              className="drv-btn-ok inline-flex items-center justify-center gap-2"
              onClick={() => openExternalNavigation(job.customer_lat, job.customer_lng, job.customer_name)}
            >
              <Navigation className="h-4 w-4" />
              Navegar al cliente
            </button>
          )}
          {toStore ? (
            alertsOnly ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 py-3 text-center text-xs font-semibold text-amber-900">
                Recojo y entrega se marcan en la app nativa de repartidor.
              </p>
            ) : (
            <button
              type="button"
              disabled={loading}
              className="drv-btn-rej disabled:opacity-50"
              onClick={() => onPickup?.(assignment)}
            >
              Pedido recogido
            </button>
            )
          ) : (
            alertsOnly ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 py-3 text-center text-xs font-semibold text-amber-900">
                Recojo y entrega se marcan en la app nativa de repartidor.
              </p>
            ) : (
            <button
              type="button"
              disabled={loading}
              className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-emerald-600 text-[15px] font-extrabold text-white disabled:opacity-50"
              onClick={() => onDelivered?.(assignment)}
            >
              Entregado
            </button>
            )
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
