import { createPortal } from 'react-dom';
import { Phone, X } from 'lucide-react';
import { WhatsAppIcon } from '../ui/WhatsAppIcon';
import { money, normalizeWhatsappPhone } from '../../utils/format';
import { getSupabase, isSupabaseConfigured } from '../../services/supabaseClient';
import { PAYMENT_METHODS } from '../../utils/constants';

export function paymentLabel(id) {
  return PAYMENT_METHODS.find((p) => p.id === id)?.label || id || '—';
}

/** Parsea sabores de bebida desde extras (array o string "A · B" / "#1: A"). */
export function parseDrinkFlavors(extras) {
  if (!extras || typeof extras !== 'object') return [];
  if (Array.isArray(extras.drinks) && extras.drinks.length) {
    return extras.drinks.map((d) => String(d || '').trim()).filter(Boolean);
  }
  const raw = String(extras.drink || '').trim();
  if (!raw) return [];
  if (raw.includes(' · ')) {
    return raw.split(' · ').map((s) => s.trim()).filter(Boolean);
  }
  if (/#\d+:/.test(raw)) {
    return raw
      .split(/\s*(?=#\d+:)/)
      .map((s) => s.replace(/^#\d+:\s*/, '').trim())
      .filter(Boolean);
  }
  return [raw];
}

export async function fetchOrderLines(orderId) {
  if (!orderId || !isSupabaseConfigured()) return [];
  const sb = getSupabase();
  const { data } = await sb
    .from('detalle_pedidos')
    .select('nombre_producto, cantidad, subtotal, extras')
    .eq('pedido_id', orderId);
  return (data || []).map((d) => {
    const extras = d.extras && typeof d.extras === 'object' ? d.extras : {};
    const drinks = parseDrinkFlavors(extras);
    return {
      name: d.nombre_producto,
      qty: d.cantidad,
      subtotal: d.subtotal,
      drinks,
      drink: extras.drink || drinks.join(' · ') || '',
      bagQty: Number(extras.bagQty) || 0,
      notes: extras.notes || '',
    };
  });
}

export function firstWord(name) {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

export function ticketShort(code) {
  const s = String(code || '').replace(/^0+/, '');
  return s || String(code || '—');
}

export function buildDriverWhatsappMessage({
  customerName,
  driverName,
  branchCity = 'Iquique',
  ticketCode,
}) {
  const client = String(customerName || 'Cliente').trim();
  const driver = firstWord(driverName) || 'repartidor';
  const city = String(branchCity || 'Iquique').trim().toLowerCase();
  const nro = ticketShort(ticketCode);
  return `Hola ${client}, le hable el repartidor ${driver}, del pollon de ${city}, sobre su pedido Nº ${nro}`;
}

export function openDriverWhatsapp(phone, message) {
  const wa = normalizeWhatsappPhone(phone);
  if (!wa) return false;
  const url = `https://wa.me/${wa}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function dialCustomer(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  if (!digits) return false;
  window.location.href = `tel:${digits}`;
  return true;
}

export function DriverContactButtons({ phone, message, className = '' }) {
  if (!phone) return null;
  const wa = normalizeWhatsappPhone(phone);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {wa && (
        <button
          type="button"
          onClick={() => openDriverWhatsapp(phone, message)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800"
          aria-label="WhatsApp al cliente"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pollon-red text-white shadow-sm transition active:scale-95">
            <WhatsAppIcon className="h-4 w-4" />
          </span>
          <span>{phone}</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => dialCustomer(phone)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800"
        aria-label="Llamar al cliente"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pollon-red text-white shadow-sm transition active:scale-95">
          <Phone className="h-4 w-4" />
        </span>
        {!wa && <span>{phone}</span>}
      </button>
    </div>
  );
}

/** Líneas de bebida bajo cada plato (ofertas familiares, etc.) */
function ItemDrinkLines({ item }) {
  const drinks = item.drinks?.length
    ? item.drinks
    : (item.drink ? parseDrinkFlavors({ drink: item.drink }) : []);
  if (!drinks.length) return null;

  return (
    <div className="mt-1 space-y-0.5">
      {drinks.length === 1 ? (
        <p className="text-[11px] font-medium text-pollon-orange">
          Bebida: <span className="text-gray-800">{drinks[0]}</span>
        </p>
      ) : (
        drinks.map((d, i) => (
          <p key={i} className="text-[11px] font-medium text-pollon-orange">
            Bebida plato {i + 1}: <span className="text-gray-800">{d}</span>
          </p>
        ))
      )}
    </div>
  );
}

/** Modal detalle del pedido (platos, bebidas, delivery, total, pago) */
export function OrderDetailModal({ open, onClose, job, fee, items, loading }) {
  if (!open) return null;
  const j = job || {};
  const subtotal = items.reduce((s, it) => s + (Number(it.subtotal) || 0), 0) || Number(j.order_total) || 0;
  const delivery = Number(fee ?? j.delivery_fee) || 0;
  const dist = j.delivery_distance_km != null ? Number(j.delivery_distance_km) : null;
  const total = subtotal + delivery;

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Detalle del pedido"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 rounded-full p-1.5 text-gray-400 hover:bg-gray-100"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="border-b border-gray-100 px-4 py-3 pr-10">
          <p className="text-xs font-bold uppercase tracking-wide text-pollon-red">Detalle del pedido</p>
          <p className="text-sm font-semibold text-gray-900">#{j.ticket_code || '—'}</p>
          {j.customer_name && (
            <p className="truncate text-xs text-gray-500">{j.customer_name}</p>
          )}
          {j.customer_address && (
            <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-snug text-pollon-red">
              {j.customer_address}
            </p>
          )}
        </div>
        <div className="max-h-64 space-y-3 overflow-y-auto px-4 py-3">
          {loading && <p className="py-4 text-center text-xs text-gray-400">Cargando…</p>}
          {!loading && items.length === 0 && (
            <p className="py-4 text-center text-xs text-gray-400">Sin detalle de platos</p>
          )}
          {items.map((it, i) => (
            <div key={i} className="border-b border-gray-50 pb-2.5 last:border-0 last:pb-0">
              <div className="flex justify-between gap-2 text-sm">
                <span className="min-w-0 font-medium text-gray-900">
                  <span className="font-bold text-gray-500">{it.qty || 1}x</span> {it.name}
                </span>
                {it.subtotal != null && (
                  <span className="shrink-0 font-semibold text-gray-700">{money(it.subtotal)}</span>
                )}
              </div>
              <ItemDrinkLines item={it} />
              {it.bagQty > 0 && (
                <p className="mt-0.5 text-[11px] text-gray-500">Bolsa x{it.bagQty}</p>
              )}
              {it.notes?.trim() && (
                <p className="mt-0.5 text-[11px] text-gray-500">Nota: {it.notes}</p>
              )}
            </div>
          ))}
        </div>
        <div className="space-y-1 border-t border-gray-100 px-4 py-3 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Delivery{dist != null ? ` (${dist.toFixed(1)} km)` : ''}</span>
            <span>{money(delivery)}</span>
          </div>
          <div className="flex justify-between pt-1 text-base font-bold text-gray-900">
            <span>TOTAL</span>
            <span className="text-pollon-red">{money(total)}</span>
          </div>
          <p className="pt-1 text-xs text-gray-500">
            Pago: <strong>{paymentLabel(j.payment_method)}</strong>
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
