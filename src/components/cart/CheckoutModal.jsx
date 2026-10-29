import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { X, CheckCircle, Bike, Loader2, Banknote, Landmark, CreditCard, Check, Clock, MapPin } from 'lucide-react';
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
import { followOrderPath } from '../../utils/guestOrderTrack';
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
  const [addressPicked, setAddressPicked] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const submitLock = useRef(false);
  const addressJumpTimer = useRef(0);

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
      setAddressPicked(false);
      setConfirmedOrder(null);
      submitLock.current = false;
      return;
    }
    const types = getAvailableOrderTypes(branch);
    const type = types.includes(form.orderType) ? form.orderType : getDefaultOrderType(branch);
    setStep(type === 'delivery' ? 'address' : 'form');
    if (!items.length) setCheckoutOpen(false);
    // Solo al abrir el modal: el paso de dirección es el primero en delivery.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutOpen]);

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
    setAddressPicked(false);
    setDeliveryQuote(null);
    submitLock.current = false;
  };

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const setOrderType = (t) => {
    update('orderType', t);
    if (t === 'delivery') {
      if (!form.addressLat || !form.addressLng) setStep('address');
    } else {
      setStep('form');
    }
  };

  const scrollToField = (e) => {
    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const focusCheckoutField = (id) => {
    window.setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (typeof el.focus === 'function') {
        try { el.focus({ preventScroll: true }); } catch { el.focus(); }
      }
    }, 60);
  };

  const jumpAfterAddress = () => {
    window.clearTimeout(addressJumpTimer.current);
    const punto = document.getElementById('checkout-punto-seleccionado');
    punto?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const goToDetails = () => {
    if (!availableOrderTypes.length) {
      show('Esta sucursal no tiene tipos de pedido habilitados');
      return;
    }
    if (!isDelivery) {
      setStep('form');
      focusCheckoutField('checkout-name');
      return;
    }
    if (!addressPicked || !form.address.trim() || form.addressLat == null || form.addressLng == null) {
      show('Te falta seleccionar tu dirección de entrega');
      focusCheckoutField('checkout-address-search');
      return;
    }
    if (!parseAddressQuery(form.address).houseNumber) {
      show('Elige una dirección con calle y número');
      focusCheckoutField('checkout-address-search');
      return;
    }
    if (deliveryQuote?.loading) {
      show('Calculando costo de delivery…');
      return;
    }
    if (deliveryQuote?.outOfRange) {
      const max = deliveryQuote.maxKm ? ` (máx. ${deliveryQuote.maxKm} km)` : '';
      show(`Tu dirección está fuera de la zona de cobertura${max}`);
      return;
    }
    if (!deliveryQuote || !(deliveryQuote.fee > 0)) {
      show('No se pudo calcular el delivery. Revisa tu dirección');
      return;
    }
    setStep('form');
    focusCheckoutField('checkout-name');
  };

  const deliveryNotice = isDelivery ? (
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
          Elige un resultado de la lista con calle y número para calcular el delivery.
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
  ) : null;

  const goNextFromName = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    focusCheckoutField('checkout-phone');
  };

  const goNextFromPhone = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (isDelivery) focusCheckoutField('checkout-referencia');
    else focusCheckoutField('checkout-comments');
  };

  const goNextFromReferencia = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    focusCheckoutField('checkout-comments');
  };

  const goNextFromComments = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.currentTarget.form?.requestSubmit?.();
  };

  const validate = () => {
    if (!form.name.trim()) return { message: 'Te falta llenar el nombre', field: 'checkout-name' };
    if (!normalizeChilePhone(form.phone)) {
      return {
        message: form.phone.trim() ? 'Ingresa un teléfono válido (ej. 9 2558 6256)' : 'Te falta llenar el teléfono',
        field: 'checkout-phone',
      };
    }
    if (form.orderType === 'delivery') {
      if (!addressPicked || !form.address.trim() || form.addressLat == null || form.addressLng == null) {
        return { message: 'Te falta seleccionar tu dirección de entrega', field: null };
      }
      if (!parseAddressQuery(form.address).houseNumber) {
        return { message: 'Elige una dirección con calle y número', field: null };
      }
      if (branch?.lat == null || branch?.lng == null) {
        return { message: 'La sucursal no tiene ubicación GPS configurada', field: null };
      }
      if (deliveryQuote?.loading) return { message: 'Calculando costo de delivery…', field: null };
      if (deliveryQuote?.outOfRange) {
        const max = deliveryQuote.maxKm ? ` (máx. ${deliveryQuote.maxKm} km)` : '';
        return { message: `Tu dirección está fuera de la zona de cobertura${max}`, field: null };
      }
      if (!deliveryQuote || !(deliveryQuote.fee > 0)) {
        return { message: 'No se pudo calcular el delivery. Revisa tu dirección', field: null };
      }
    }
    if (!items.length) return { message: 'Tu carrito está vacío', field: null };
    if (!branch) return { message: 'Selecciona una sucursal', field: null };
    if (!branchOpen) return { message: 'La sucursal está cerrada en este momento', field: null };
    const typeErr = validateOrderTypeChoice(branch, form.orderType, subtotal);
    if (typeErr) return { message: typeErr, field: null };
    if (!isPaymentMethodAllowed(branch, form.payment)) {
      return { message: 'Te falta seleccionar el método de pago', field: null };
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLock.current || submitting) return;

    const err = validate();
    if (err) {
      show(err.message);
      if (err.field) focusCheckoutField(err.field);
      return;
    }

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
                  to={followOrderPath(confirmedOrder, { loggedInCustomer: isCustomer })}
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

  const visibleStep = step === 'success'
    ? 'success'
    : (!isDelivery
      ? 'form'
      : ((step === 'form' && !addressPicked && form.addressLat == null) ? 'address' : step));

  const typeSwitcher = availableOrderTypes.length > 0 ? (
    <div className="checkout-type-row checkout-type-row--compact" role="group" aria-label="Tipo de pedido">
      {ORDER_TYPES.filter((t) => availableOrderTypes.includes(t)).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setOrderType(t)}
          className={`checkout-type-btn checkout-type-btn--compact ${form.orderType === t ? 'is-selected' : ''}`}
        >
          {ORDER_TYPE_LABELS[t] || t}
        </button>
      ))}
    </div>
  ) : null;

  if (visibleStep === 'address') {
    return (
      <>
        {Toast}
        <div className="checkout-overlay" onClick={closeModal} role="presentation">
          <div
            className="checkout-modal checkout-modal--address"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="checkout-modal-title"
          >
            <header className="checkout-modal__header checkout-modal__header--address">
              <button
                type="button"
                onClick={closeModal}
                className="checkout-modal__close"
                aria-label="Cerrar"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
              <h2 id="checkout-modal-title" className="checkout-modal__title checkout-modal__title--address">
                Confirma tu dirección de entrega
              </h2>
            </header>

            <div className="checkout-modal__form">
              <div className="checkout-modal__body checkout-modal__body--address admin-scroll-panel">
                {availableOrderTypes.length > 1 && (
                  <div className="checkout-address-types">
                    {typeSwitcher}
                  </div>
                )}
                {!availableOrderTypes.length && (
                  <p className="mx-4 mt-3 rounded-[0.32rem] bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
                    Esta sucursal no tiene tipos de pedido habilitados. Contacta al local.
                  </p>
                )}
                <AddressAutocomplete
                  key={branch?.id || branch?.city || 'branch-map'}
                  value={form.address}
                  required
                  mode="map"
                  pickerChrome="overlay"
                  hideHint
                  initialLat={form.addressLat}
                  initialLng={form.addressLng}
                  cityBias={branch?.city || 'Iquique'}
                  biasLat={branch?.lat}
                  biasLng={branch?.lng}
                  branchAddress={branch?.address || ''}
                  branchHouseNumber={parseAddressQuery(branch?.address || '').houseNumber}
                  onChange={(label, geo) => {
                    if (!geo) {
                      setAddressPicked(false);
                      setForm((f) => ({
                        ...f,
                        address: label,
                        addressLat: null,
                        addressLng: null,
                      }));
                      return;
                    }
                    const snapped = snapAddressCoordsForBranch(geo, branch);
                    setForm((f) => ({
                      ...f,
                      address: label,
                      addressLat: snapped?.lat ?? geo?.lat ?? null,
                      addressLng: snapped?.lng ?? geo?.lng ?? null,
                    }));
                  }}
                  onSelect={(geo) => {
                    if (!geo?.houseNumber || !Number.isFinite(Number(geo.lat))) {
                      setAddressPicked(false);
                      return;
                    }
                    const snapped = snapAddressCoordsForBranch(geo, branch);
                    setAddressPicked(true);
                    setForm((f) => ({
                      ...f,
                      address: snapped.shortLabel || geo.shortLabel,
                      addressLat: snapped.lat,
                      addressLng: snapped.lng,
                    }));
                    jumpAfterAddress();
                  }}
                />
              </div>

              <footer className="checkout-modal__footer">
                {deliveryNotice}
                <button
                  type="button"
                  onClick={goToDetails}
                  className="checkout-submit"
                >
                  {addressPicked && deliveryQuote?.loading ? 'Calculando delivery…' : 'Siguiente'}
                </button>
              </footer>
            </div>
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
              {typeSwitcher}
            </div>
          </header>

          <form onSubmit={handleSubmit} className="checkout-modal__form" noValidate>
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
                    placeholder="Nombre completo"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    onFocus={scrollToField}
                    onKeyDown={goNextFromName}
                    className="checkout-input"
                    autoComplete="name"
                  />
                </div>
                <div className="checkout-field">
                  <label htmlFor="checkout-phone" className="checkout-label">Teléfono</label>
                  <input
                    id="checkout-phone"
                    placeholder="Ej: 9 2558 6256"
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    onFocus={scrollToField}
                    onKeyDown={goNextFromPhone}
                    className="checkout-input"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </div>
              </div>

              {isDelivery && form.address && (
                <div className="checkout-address-summary">
                  <span className="checkout-address-summary__icon" aria-hidden>
                    <MapPin size={15} strokeWidth={2.4} />
                  </span>
                  <div className="checkout-address-summary__copy">
                    <p className="checkout-address-summary__label">Dirección de entrega</p>
                    <p className="checkout-address-summary__value">{form.address}</p>
                  </div>
                  <button
                    type="button"
                    className="checkout-address-summary__change"
                    onClick={() => setStep('address')}
                  >
                    Cambiar
                  </button>
                </div>
              )}

              {isDelivery && (
                <div className="checkout-field">
                  <label htmlFor="checkout-referencia" className="checkout-label">
                    Referencia <span className="checkout-label__opt">(opcional)</span>
                  </label>
                  <input
                    id="checkout-referencia"
                    type="text"
                    placeholder="Ej: casa verde, esquina"
                    value={form.referencia}
                    onChange={(e) => update('referencia', e.target.value)}
                    onFocus={scrollToField}
                    onKeyDown={goNextFromReferencia}
                    className="checkout-input"
                    autoComplete="off"
                  />
                  <p className="checkout-label__hint">tienda, esquina, color de la casa</p>
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
                  onKeyDown={goNextFromComments}
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
                {isDelivery && deliveryNotice}
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
                disabled={submitting}
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
