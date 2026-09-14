import { X, Printer, RefreshCw, Ban } from 'lucide-react';
import { money, formatDateTime, estadoLabel, nextEstado, openWhatsappToCustomer } from '../../utils/format';
import { getOrderReceiptMeta, paymentLabel, buildCustomerOrderConfirmationMessage } from '../../utils/orderReceipt';
import { printThermalReceiptSmart } from '../../utils/networkPrinter';
import { canAdvanceOrderEstado, canCancelOrder, ORDER_TYPE_LABELS } from '../../utils/constants';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { WhatsAppIcon } from '../ui/WhatsAppIcon';

function itemExtras(it) {
  const lines = [];
  if (it.drinks?.length) lines.push(...it.drinks.filter(Boolean));
  else if (it.drink?.trim()) lines.push(`Bebida: ${it.drink}`);
  if (it.bagQty > 0) lines.push(`Bolsa x${it.bagQty}`);
  if (it.notes?.trim()) lines.push(`Nota: ${it.notes}`);
  return lines;
}

export function OrderDetailModal({ order, branch, onClose, onChangeEstado, onCancelOrder, onPrint, cajaPagoSlot }) {
  if (!order) return null;

  const m = getOrderReceiptMeta(order, branch);
  const orderTypeLabel = ORDER_TYPE_LABELS[m.orderType] || m.orderType;
  const canAdvance = canAdvanceOrderEstado(order.estado);
  const canCancel = canCancelOrder(order.estado);
  const nextLabel = estadoLabel(nextEstado(order.estado));
  const ticketCode = order.codigo_pedido || order.ticketNumber;

  const handlePrint = async () => {
    try {
      await printThermalReceiptSmart(order, branch);
      onPrint?.();
    } catch (e) {
      alert(e.message || 'No se pudo imprimir');
    }
  };

  const handleWhatsApp = () => {
    try {
      const message = buildCustomerOrderConfirmationMessage(order, branch);
      openWhatsappToCustomer(m.customer.phone, message);
    } catch (e) {
      alert(e.message || 'No se pudo abrir WhatsApp');
    }
  };

  const handleEstado = async () => {
    if (!canAdvance) return;
    await onChangeEstado?.(order);
  };

  const handleCancel = async () => {
    if (!canCancel) return;
    await onCancelOrder?.(order);
  };

  return (
    <div className="order-detail-overlay" onClick={onClose} role="presentation">
      <div
        className="order-detail-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="order-detail-title"
      >
        <header className="order-detail-modal__header">
          <div className="min-w-0 flex-1">
            <p className="order-detail-modal__eyebrow">Detalle del pedido</p>
            <h2 id="order-detail-title" className="order-detail-modal__title">#{ticketCode}</h2>
            <p className="order-detail-modal__meta">
              {formatDateTime(order.createdAt)} · {m.sucursal}
            </p>
          </div>
          <button type="button" onClick={onClose} className="order-detail-modal__close" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="order-detail-modal__body admin-scroll-panel">
          <div className="order-detail-modal__badges">
            <Badge estado={order.estado}>{estadoLabel(order.estado)}</Badge>
            <span className="order-detail-modal__chip">{orderTypeLabel}</span>
            <span className="order-detail-modal__chip order-detail-modal__chip--pay">
              {paymentLabel(order.metodo_pago)}
            </span>
            {cajaPagoSlot ? (
              <span className="order-detail-modal__caja" title="Solo control interno de caja">
                {cajaPagoSlot}
              </span>
            ) : null}
          </div>

          {!canAdvance && order.estado === 'entregado' && (
            <p className="order-detail-modal__alert order-detail-modal__alert--ok">
              Pedido entregado. El estado ya no puede modificarse.
            </p>
          )}
          {order.estado === 'cancelado' && (
            <p className="order-detail-modal__alert order-detail-modal__alert--err">
              Pedido cancelado. No se pueden realizar más cambios.
            </p>
          )}

          <section className="order-detail-modal__block">
            <h3 className="order-detail-modal__label">Cliente</h3>
            <dl className="order-detail-modal__dl">
              <div className="order-detail-modal__row">
                <dt>Nombre</dt>
                <dd>{m.customer.name || '—'}</dd>
              </div>
              <div className="order-detail-modal__row">
                <dt>Teléfono</dt>
                <dd>
                  <a href={`tel:${m.customer.phone}`} className="order-detail-modal__phone">
                    {m.customer.phone || '—'}
                  </a>
                </dd>
              </div>
              <div className="order-detail-modal__row order-detail-modal__row--stack">
                <dt>Dirección</dt>
                <dd>{m.customer.address || '—'}</dd>
              </div>
              {m.customer.reference?.trim() && (
                <div className="order-detail-modal__row order-detail-modal__row--stack">
                  <dt>Referencia</dt>
                  <dd>{m.customer.reference}</dd>
                </div>
              )}
              {m.customer.comments?.trim() && (
                <div className="order-detail-modal__row order-detail-modal__row--stack">
                  <dt>Observaciones</dt>
                  <dd className="order-detail-modal__obs">{m.customer.comments}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="order-detail-modal__block">
            <h3 className="order-detail-modal__label">Productos</h3>
            <ul className="order-detail-modal__items">
              {m.items.map((it, i) => {
                const extras = itemExtras(it);
                return (
                  <li key={i} className="order-detail-modal__item">
                    <span className="order-detail-modal__qty">{it.qty ?? 1}</span>
                    <div className="order-detail-modal__item-body">
                      <div className="order-detail-modal__item-head">
                        <p className="order-detail-modal__item-name">{it.name}</p>
                        <span className="order-detail-modal__item-price">{money(it.total)}</span>
                      </div>
                      {extras.map((line) => (
                        <p key={line} className="order-detail-modal__item-extra">{line}</p>
                      ))}
                    </div>
                  </li>
                );
              })}
              {!m.items.length && (
                <li className="order-detail-modal__empty">Sin productos</li>
              )}
            </ul>
          </section>

          <div className="order-detail-modal__total">
            {m.deliveryFee > 0 && (
              <div className="order-detail-modal__total-row">
                <span>Delivery</span>
                <span>{money(m.deliveryFee)}</span>
              </div>
            )}
            <div className="order-detail-modal__total-row order-detail-modal__total-row--main">
              <span>Total</span>
              <span>{money(m.total)}</span>
            </div>
          </div>
        </div>

        <footer className="order-detail-modal__footer">
          <div className="order-detail-modal__actions">
            <Button type="button" onClick={handlePrint} className="order-detail-modal__btn-main">
              <Printer className="h-4 w-4" />
              <span>Imprimir</span>
            </Button>
            <button
              type="button"
              onClick={handleWhatsApp}
              className="order-detail-modal__wa"
              title="Confirmar pedido por WhatsApp"
              aria-label="Enviar confirmación por WhatsApp al cliente"
            >
              <WhatsAppIcon className="h-5 w-5" title="" />
            </button>
            {canAdvance && (
              <Button type="button" variant="ghost" onClick={handleEstado} className="order-detail-modal__btn-ghost">
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">{nextLabel}</span>
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onClose} className="order-detail-modal__btn-ghost">
              Cerrar
            </Button>
          </div>
          {canCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              className="order-detail-modal__cancel"
            >
              <Ban className="h-4 w-4" />
              Cancelar pedido
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
