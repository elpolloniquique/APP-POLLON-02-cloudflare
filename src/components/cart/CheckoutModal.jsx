import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { X, CheckCircle, Bike, Loader2, Banknote, Landmark, CreditCard, Check, Clock } from 'lucide-react';
import { AddressAutocomplete } from './AddressAutocomplete';
import { WhatsAppIcon } from '../ui/WhatsAppIcon';
import { useCart } from '../../context/CartContext';
import { useBranch } from '../../context/BranchContext';
import { useAuth } from '../../context/AuthContext';
import { money, formatDateTime, normalizeChilePhone, buildWhatsappMessage } from '../../utils/format';
import { ORDER_TYPE_LABELS } from '../../utils/constants';
import {
  getAvailableOrderTypes,
  getDefaultOrderType,
  validateOrderTypeChoice,
  getOrderTypeHint,
} from '../../utils/orderTypeConfig';
import {
  getAvailablePaymentMethods,
  getDefaultPaymentMethod,
  isPaymentMethodAllowed,
} from '../../utils/paymentMethods';
import * as orderService from '../../services/orderService';
import { quoteDelivery } from '../../services/pricingService';
import { haversineKm, formatDistance } from '../../utils/geo';
import { parseAddressQuery, snapAddressCoordsForBranch } from '../../utils/addressGeocode';
import { useToast } from '../../hooks/useToast';

const ORDER_TYPES = ['delivery', 'retiro', 'reserva'];

function OrderTypeHint({ hint }) {
  if (!hint) return null;
  const isWarning = hint.variant === 'warning';
  return (
    <p
      className={`mb-2 rounded-[0.32rem] px-2.5 py-1.5 text-[11px] leading-snug ${
        isWarning ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200' : 'bg-blue-50 text-blue-900 ring-1 ring-blue-100'
      }`}
    >
      {hint.text}
    </p>
  );
}

const PAYMENT_ICONS = {
  efectivo: Banknote,
  transferencia: Landmark,
  tarjeta: CreditCard,
};

export function CheckoutModal() {
  const { items, subtotal, clearCart, checkoutOpen, setCheckoutOpen } = useCart();
  const { branch, whatsapp, branchOpen } = useBranch();
  const { profile, isCustomer } = useAuth();
  const { show, Toast } = useToast();

  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    addressLat: null,
    addressLng: null,
    referencia: '',
    orderType: 'delivery',
    payment: 'efectivo',
    comments: '',
  });
  const [deliveryQuote, setDeliveryQuote] = useState(null); // { fee, distanceKm, zone, outOfRange, loading }
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState('form');
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const submitLock = useRef(false);

  const isDelivery = form.orderType === 'delivery';
  const availableOrderTypes = getAvailableOrderTypes(branch);
  const availablePaymentMethods = getAvailablePaymentMethods(branch);
  const orderTypeHint = getOrderTypeHint(branch, form.orderType, subtotal);
  const deliveryFee = isDelivery && deliveryQuote && !deliveryQuote.outOfRange && !deliveryQuote.loading
    ? (deliveryQuote.fee || 0)
    : 0;
  const orderTotal = subtotal + (isDelivery ? deliveryFee : 0);

  useEffect(() => {
    if (!checkoutOpen) return undefined;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [checkoutOpen]);

  useEffect(() => {
    if (!checkoutOpen) {
      setStep('form');
      setConfirmedOrder(null);
      submitLock.current = false;
      return;
    }
    if (!items.length && step === 'form') setCheckoutOpen(false);
  }, [checkoutOpen, items.length, step, setCheckoutOpen]);

  useEffect(() => {
    if (checkoutOpen && isCustomer && profile) {
      setForm((f) => ({
        ...f,
        name: f.name || profile.fullName || profile.nombre || '',
        phone: f.phone || profile.phone || '',
      }));
    }
  }, [checkoutOpen, isCustomer, profile]);

  useEffect(() => {
    if (!checkoutOpen || !branch) return;
    const types = getAvailableOrderTypes(branch);
    if (!types.length) return;
    setForm((f) => (types.includes(f.orderType) ? f : { ...f, orderType: getDefaultOrderType(branch) }));
  }, [checkoutOpen, branch]);

  useEffect(() => {
    if (!checkoutOpen || !branch) return;
    setForm((f) => (
      isPaymentMethodAllowed(branch, f.payment)
        ? f
        : { ...f, payment: getDefaultPaymentMethod(branch) }
    ));
  }, [checkoutOpen, branch]);

  // Cotiza delivery automático al confirmar dirección (coords)
  useEffect(() => {
    if (!checkoutOpen || form.orderType !== 'delivery') {
      setDeliveryQuote(null);
      return undefined;
    }
    const lat = form.addressLat;
    const lng = form.addressLng;
    if (lat == null || lng == null || branch?.lat == null || branch?.lng == null) {
      setDeliveryQuote(null);
      return undefined;
    }

    let cancelled = false;
    setDeliveryQuote((q) => ({ ...(q || {}), loading: true, fee: q?.fee ?? 0 }));

    (async () => {
      try {
        const km = haversineKm(branch.lat, branch.lng, lat, lng);
        if (km == null) {
          if (!cancelled) setDeliveryQuote({ fee: 0, distanceKm: null, outOfRange: true, loading: false });
          return;
        }
        const quote = await quoteDelivery(branch.id, km);
        if (cancelled) return;
        setDeliveryQuote({
          fee: Number(quote.fee) || 0,
          distanceKm: Number(quote.distance_km) || km,
          zone: quote.zone || null,
          outOfRange: !!quote.out_of_range,
          maxKm: quote.max_km,
          loading: false,
        });
      } catch {
        if (!cancelled) setDeliveryQuote({ fee: 0, distanceKm: null, outOfRange: true, loading: false, error: true });
      }
    })();

    return () => { cancelled = true; };
  }, [checkoutOpen, form.orderType, form.addressLat, form.addressLng, branch?.id, branch?.lat, branch?.lng]);

  if (!checkoutOpen) {
    return Toast;
  }

  if (!items.length && step !== 'success') {
    return Toast;
  }

  const closeModal = () => {
    setCheckoutOpen(false);
    setStep('form');
    setConfirmedOrder(null);
    setDeliveryQuote(null);
    submitLock.current = false;
  };

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const scrollToField = (e) => {
    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const validate = () => {
    if (!form.name.trim()) return 'Ingresa tu nombre';
    if (!normalizeChilePhone(form.phone)) return 'Ingresa un teléfono válido (ej. 9 2558 6256)';
    if (form.orderType === 'delivery') {
      if (!form.address.trim()) return 'Selecciona tu dirección en el mapa';
      if (!form.addressLat || !form.addressLng) return 'Confirma tu punto exacto en el mapa (botón Listo) para calcular el delivery';
      if (!form.referencia.trim()) return 'Ingresa una referencia para ubicar tu dirección';
      if (branch?.lat == null || branch?.lng == null) return 'La sucursal no tiene ubicación GPS configurada';
      if (deliveryQuote?.loading) return 'Calculando costo de delivery…';
      if (deliveryQuote?.outOfRange) {
        const max = deliveryQuote.maxKm ? ` (máx. ${deliveryQuote.maxKm} km)` : '';
        return `Tu dirección está fuera de la zona de cobertura${max}`;
      }
      if (!deliveryQuote || !(deliveryQuote.fee > 0)) return 'No se pudo calcular el delivery. Revisa tu dirección';
    }
    if (!items.length) return 'Tu carrito está vacío';
    if (!branch) return 'Selecciona una sucursal';
    if (!branchOpen) return 'La sucursal está cerrada en este momento';
    const typeErr = validateOrderTypeChoice(branch, form.orderType, subtotal);
    if (typeErr) return typeErr;
    if (!isPaymentMethodAllowed(branch, form.payment)) {
      return 'Selecciona un método de pago válido para esta sucursal';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLock.current || submitting) return;

    const err = validate();
    if (err) { show(err); return; }

    submitLock.current = true;
    setSubmitting(true);
    try {
      const order = {
        id: orderService.generateOrderId(),
        createdAt: new Date().toISOString(),
        customer: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.orderType === 'delivery' ? form.address.trim() : branch.address,
          addressLat: form.orderType === 'delivery' ? form.addressLat : (branch?.lat ?? null),
          addressLng: form.orderType === 'delivery' ? form.addressLng : (branch?.lng ?? null),
          reference: form.orderType === 'delivery' ? form.referencia.trim() : '',
          comments: form.comments.trim(),
        },
        items: [...items],
        subtotal,
        deliveryFee: form.orderType === 'delivery' ? deliveryFee : 0,
        deliveryDistanceKm: form.orderType === 'delivery' ? (deliveryQuote?.distanceKm ?? null) : null,
        total: orderTotal,
        orderType: form.orderType,
        metodo_pago: form.payment,
        estado: 'pendiente',
        branchId: branch.id,
        customerId: isCustomer && profile?.id && !String(profile.id).startsWith('local-') ? profile.id : null,
      };

      const saved = await orderService.saveOrder(order);
      clearCart();
      setConfirmedOrder(saved);
      setStep('success');
    } catch (ex) {
      submitLock.current = false;
      show(ex.message || 'Error al guardar el pedido');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhatsApp = () => {
    if (!confirmedOrder || !whatsapp) return;
    const msg = buildWhatsappMessage(confirmedOrder, branch);
    const phone = String(whatsapp).replace(/\D/g, '');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    const opened = window.open(url, '_blank');
    if (!opened) window.location.assign(url);
  };

  if (step === 'success' && confirmedOrder) {
    const code = confirmedOrder.ticketNumber || confirmedOrder.codigo_pedido;
    return (
      <>
        {Toast}
        <div className="checkout-overlay" onClick={closeModal} role="presentation">
          <div
            className="checkout-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="checkout-success-title"
          >
            <header className="checkout-modal__header">
              <button
                type="button"
                onClick={closeModal}
                className="checkout-modal__close"
                aria-label="Cerrar"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
              <div className="flex flex-col items-center text-center">
                <CheckCircle className="h-12 w-12 text-green-600 sm:h-14 sm:w-14" strokeWidth={1.5} />
                <h2 id="checkout-success-title" className="checkout-modal__title is-plain mt-2">
                  ¡Pedido recibido!
                </h2>
                <p className="checkout-modal__subtitle">
                  Tu pedido ya está visible en la sucursal.
                </p>
              </div>
            </header>

            <div className="checkout-modal__body admin-scroll-panel">
              <div className="rounded-[0.4rem] border border-green-200 bg-green-50/80 p-5 text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-green-800">Código de seguimiento</p>
                <p className="mt-2 font-display text-4xl tracking-wider text-pollon-black">#{code}</p>
                <p className="mt-3 text-xs text-gray-500 break-all">ID: {confirmedOrder.id}</p>
              </div>

              <div className="rounded-[0.32rem] bg-pollon-cream/80 px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total pagado</span>
                  <span className="font-bold text-pollon-red">{money(confirmedOrder.total)}</span>
                </div>
                <div className="mt-1 flex justify-between text-gray-600">
                  <span>Fecha</span>
                  <span>{formatDateTime(confirmedOrder.createdAt)}</span>
                </div>
                <div className="mt-1 flex justify-between text-gray-600">
                  <span>Sucursal</span>
                  <span className="text-right">{branch?.name}</span>
                </div>
              </div>

              <p className="text-center text-xs text-gray-500">
                Guarda tu código #{code} para consultar el estado de tu pedido en cualquier momento.
              </p>
            </div>

            <footer className="checkout-modal__footer space-y-3">
              <button
                type="button"
                onClick={handleWhatsApp}
                className="checkout-wa-btn"
              >
                <span className="checkout-wa-btn__icon-wrap" aria-hidden>
                  <WhatsAppIcon className="checkout-wa-btn__icon" />
                </span>
                <span className="checkout-wa-btn__copy">
                  <span className="checkout-wa-btn__title">
                    Enviar comprobante de mi pedido por WhatsApp
                  </span>
                  <span className="checkout-wa-btn__hint">
                    Se abre WhatsApp con el detalle completo listo para enviar a El Pollón.
                  </span>
                </span>
              </button>
              {confirmedOrder.id && (
                <Link
                  to={`/cuenta/seguimiento/${confirmedOrder.id}`}
                  onClick={closeModal}
                  className="block w-full rounded-[0.32rem] border-2 border-pollon-red py-3 text-center text-sm font-bold uppercase tracking-wide text-pollon-red transition hover:bg-red-50"
                >
                  Seguir mi pedido
                </Link>
              )}
              <button
                type="button"
                onClick={closeModal}
                className="w-full rounded-[0.32rem] bg-gray-100 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-200"
              >
                Seguir comprando
              </button>
            </footer>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {Toast}
      <div className="checkout-overlay" onClick={closeModal} role="presentation">
        <div
          className="checkout-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby="checkout-modal-title"
        >
          <header className="checkout-modal__header">
            <button
              type="button"
              onClick={closeModal}
              className="checkout-modal__close"
              aria-label="Cerrar"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
            <div className="checkout-modal__headline">
              <h2 id="checkout-modal-title" className="checkout-modal__title">
                Confirmar pedido
              </h2>
              {availableOrderTypes.length > 0 && (
                <span className="checkout-label checkout-modal__type-label">Tipo de pedido</span>
              )}
              <p className="checkout-modal__subtitle">Sucursal: {branch?.name}</p>
              {availableOrderTypes.length > 0 && (
                <div className="checkout-type-row checkout-type-row--compact" role="group" aria-label="Tipo de pedido">
                  {ORDER_TYPES.filter((t) => availableOrderTypes.includes(t)).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => update('orderType', t)}
                      className={`checkout-type-btn checkout-type-btn--compact ${form.orderType === t ? 'is-selected' : ''}`}
                    >
                      {ORDER_TYPE_LABELS[t] || t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </header>

          <form onSubmit={handleSubmit} className="checkout-modal__form">
            <div className="checkout-modal__body admin-scroll-panel">
              {!availableOrderTypes.length && (
                <p className="mb-2 rounded-[0.32rem] bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
                  Esta sucursal no tiene tipos de pedido habilitados. Contacta al local.
                </p>
              )}
              {availableOrderTypes.length > 0 && <OrderTypeHint hint={orderTypeHint} />}

              <div className="checkout-identity">
                <div className="checkout-field">
                  <label htmlFor="checkout-name" className="checkout-label">Nombre</label>
                  <input
                    id="checkout-name"
                    required
                    placeholder="Nombre completo"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    onFocus={scrollToField}
                    className="checkout-input"
                  />
                </div>
                <div className="checkout-field">
                  <label htmlFor="checkout-phone" className="checkout-label">Teléfono</label>
                  <input
                    id="checkout-phone"
                    required
                    placeholder="Ej: 9 2558 6256"
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    onFocus={scrollToField}
                    className="checkout-input"
                    inputMode="tel"
                  />
                </div>
              </div>

              {form.orderType === 'delivery' && (
                <div className="checkout-field">
                  <label className="checkout-label">Dirección de entrega</label>
                  <AddressAutocomplete
                    value={form.address}
                    required
                    mode="map"
                    cityBias={branch?.city || 'Iquique'}
                    biasLat={branch?.lat}
                    biasLng={branch?.lng}
                    branchAddress={branch?.address || ''}
                    branchHouseNumber={parseAddressQuery(branch?.address || '').houseNumber}
                    onChange={(label, geo) => {
                      const snapped = geo
                        ? snapAddressCoordsForBranch(geo, branch)
                        : null;
                      setForm((f) => ({
                        ...f,
                        address: label,
                        addressLat: snapped?.lat ?? geo?.lat ?? null,
                        addressLng: snapped?.lng ?? geo?.lng ?? null,
                      }));
                    }}
                    onSelect={(geo) => {
                      if (geo) {
                        const snapped = snapAddressCoordsForBranch(geo, branch);
                        setForm((f) => ({
                          ...f,
                          address: snapped.shortLabel || geo.shortLabel,
                          addressLat: snapped.lat,
                          addressLng: snapped.lng,
                        }));
                      }
                    }}
                  />
                </div>
              )}

              {form.orderType === 'delivery' && (
                <div className="checkout-field">
                  <label htmlFor="checkout-referencia" className="checkout-label">
                    Referencia
                  </label>
                  <input
                    id="checkout-referencia"
                    type="text"
                    required
                    placeholder="Vivar 1086, al frente de cruz verde en la esquina con O'Higgins"
                    value={form.referencia}
                    onChange={(e) => update('referencia', e.target.value)}
                    onFocus={scrollToField}
                    className="checkout-input"
                    autoComplete="off"
                  />
                  <p className="checkout-label__hint">
                    Indica un punto de referencia cercano (tienda, esquina, color de la casa) para que el repartidor te ubique rápido.
                  </p>
                </div>
              )}

              <div className="checkout-field">
                <label htmlFor="checkout-comments" className="checkout-label">
                  Comentarios <span className="checkout-label__opt">(opcional)</span>
                </label>
                <input
                  id="checkout-comments"
                  type="text"
                  placeholder="Ej: pollo trozado en 8 piezas, más ají"
                  value={form.comments}
                  onChange={(e) => update('comments', e.target.value)}
                  onFocus={scrollToField}
                  className="checkout-input"
                />
              </div>

              <div className="checkout-field">
                <label className="checkout-label">Método de pago</label>
                <p className="checkout-label__hint">Selecciona cómo pagarás al recibir tu pedido</p>
                <div
                  className="checkout-pay-grid"
                  style={{ '--pay-count': Math.max(1, availablePaymentMethods.length) }}
                >
                  {availablePaymentMethods.map((p) => {
                    const selected = form.payment === p.id;
                    const Icon = PAYMENT_ICONS[p.id] || Banknote;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => update('payment', p.id)}
                        aria-pressed={selected}
                        className={`checkout-pay-card checkout-pay-card--${p.tone} ${selected ? 'is-selected' : ''}`}
                      >
                        <span className={`checkout-pay-card__icon checkout-pay-card__icon--${p.tone}`} aria-hidden>
                          <Icon size={15} strokeWidth={2.2} />
                        </span>
                        <span className="checkout-pay-card__label">{p.label}</span>
                        <span className={`checkout-pay-card__mark ${selected ? 'is-on' : ''}`} aria-hidden>
                          {selected ? <Check size={9} strokeWidth={3.4} /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="checkout-pay-notice">
                  <Clock className="checkout-pay-notice__icon" aria-hidden />
                  <p className="checkout-pay-notice__text">
                    <strong>Importante:</strong> Todos los métodos de pago son al momento de recibir el pedido.
                  </p>
                </div>
              </div>
            </div>

            <footer className="checkout-modal__footer">
              <div className="checkout-totals">
                <div className="checkout-totals__row">
                  <span>Subtotal</span>
                  <span>{money(subtotal)}</span>
                </div>
                {isDelivery && (
                  <div className="checkout-delivery-notice">
                    <div className="checkout-delivery-notice__row">
                      <span className="checkout-delivery-notice__head">
                        <Bike className="checkout-delivery-notice__icon" aria-hidden />
                        <span className="checkout-delivery-notice__title">Costo de delivery</span>
                      </span>
                      {form.addressLat && deliveryQuote && !deliveryQuote.loading && !deliveryQuote.outOfRange && deliveryFee > 0 && (
                        <span
                          className="checkout-delivery-notice__range"
                          style={deliveryQuote.zone?.color ? { color: deliveryQuote.zone.color } : undefined}
                        >
                          {money(deliveryFee)}
                        </span>
                      )}
                    </div>
                    {!form.addressLat && (
                      <p className="checkout-delivery-notice__body">
                        Marca tu punto en el mapa (Listo) para calcular el delivery.
                      </p>
                    )}
                    {form.addressLat && deliveryQuote?.loading && (
                      <p className="checkout-delivery-notice__body inline-flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando distancia…
                      </p>
                    )}
                    {form.addressLat && deliveryQuote && !deliveryQuote.loading && deliveryQuote.outOfRange && (
                      <p className="text-[11px] font-semibold leading-snug text-red-600">
                        Fuera de cobertura{deliveryQuote.maxKm ? ` (máx. ${deliveryQuote.maxKm} km)` : ''}.
                        {deliveryQuote.distanceKm != null && ` Estás a ${formatDistance(deliveryQuote.distanceKm)}.`}
                      </p>
                    )}
                    {form.addressLat && deliveryQuote && !deliveryQuote.loading && !deliveryQuote.outOfRange && deliveryFee > 0 && (
                      <p className="checkout-delivery-notice__body">
                        {deliveryQuote.zone?.name || 'Zona'}
                        {deliveryQuote.distanceKm != null ? ` · ${formatDistance(deliveryQuote.distanceKm)} desde la sucursal` : ''}
                      </p>
                    )}
                  </div>
                )}
                <div className="checkout-totals__total">
                  <span>Total{isDelivery && deliveryFee > 0 ? ' a pagar' : ''}</span>
                  <span className="checkout-totals__amount">{money(orderTotal)}</span>
                </div>
                {isDelivery && deliveryFee > 0 && (
                  <p className="checkout-totals__note">
                    Incluye productos ({money(subtotal)}) + delivery ({money(deliveryFee)}).
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={
                  submitting
                  || !availableOrderTypes.length
                  || (isDelivery && (
                    !!deliveryQuote?.loading
                    || !!deliveryQuote?.outOfRange
                    || !(deliveryFee > 0)
                    || !form.addressLat
                    || !form.referencia.trim()
                  ))
                }
                className="checkout-submit"
              >
                {submitting ? 'Registrando pedido…' : 'Confirmar pedido'}
              </button>
            </footer>
          </form>
        </div>
      </div>
    </>
  );
}
