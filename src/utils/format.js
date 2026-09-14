import { buildOrderReceiptText } from './orderReceipt';
import { normalizeChilePhone, toWhatsappDigits, phonesMatch } from '../../lib/bot/phone.js';

export { normalizeChilePhone, toWhatsappDigits, phonesMatch };

const CURRENCY = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

export function money(v) {
  return CURRENCY.format(Number(v) || 0);
}

/** Valor crudo del costo delivery (número o texto descriptivo). */
export function normalizeDeliveryCost(value) {
  if (value == null) return '';
  return String(value).trim();
}

/** True si el valor es solo numérico (ej. 2500 o "3.500"). */
export function deliveryCostIsNumeric(value) {
  const raw = normalizeDeliveryCost(value);
  if (!raw) return false;
  const normalized = raw.replace(/\./g, '').replace(/\s/g, '').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(normalized);
}

/** Monto CLP para cálculos; 0 si es texto descriptivo. */
export function deliveryCostAsNumber(value) {
  if (!deliveryCostIsNumeric(value)) return 0;
  const raw = normalizeDeliveryCost(value);
  const normalized = raw.replace(/\./g, '').replace(/\s/g, '').replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

/** Muestra precio formateado o el texto tal cual (ej. "Varía según distancia"). */
export function formatDeliveryCost(value, { emptyLabel = 'Consultar' } = {}) {
  const raw = normalizeDeliveryCost(value);
  if (!raw) return emptyLabel;
  if (deliveryCostIsNumeric(raw)) return money(deliveryCostAsNumber(raw));
  return raw;
}

/** Normaliza rutas locales, URLs http(s) y rutas de storage para <img src>. */
export function resolveMediaUrl(path, fallback = '/img/todo el menu.png') {
  const raw = (path || '').trim();
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return raw;
  if (raw.startsWith('img/')) return `/${raw}`;
  return `/${raw}`;
}

/**
 * Reduce peso de imágenes remotas (Supabase Storage) con transformación en servidor.
 * Rutas locales se devuelven sin cambios.
 */
export function optimizeMediaUrl(path, { width = 480, quality = 78 } = {}, fallback = '/img/todo el menu.png') {
  const url = resolveMediaUrl(path, fallback);
  if (!/^https?:\/\//i.test(url)) return url;

  if (url.includes('/storage/v1/object/public/')) {
    const transformed = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    const sep = transformed.includes('?') ? '&' : '?';
    return `${transformed}${sep}width=${width}&quality=${quality}&resize=contain`;
  }

  return url;
}

/** URL de tienda con búsqueda de plato (deep link WhatsApp / SEO). */
export function storeSearchUrl(query, branchId) {
  const params = new URLSearchParams();
  if (branchId) params.set('branch', String(branchId));
  if (query) params.set('q', String(query));
  const qs = params.toString();
  return qs ? `/tienda?${qs}#store-products` : '/tienda';
}

/** URL de tienda filtrada por categoría (y opcionalmente sucursal). */
export function storeCategoryUrl(categoryId, branchId) {
  const params = new URLSearchParams();
  if (categoryId) params.set('cat', String(categoryId));
  if (branchId) params.set('branch', String(branchId));
  const qs = params.toString();
  const base = qs ? `/tienda?${qs}` : '/tienda';
  return categoryId ? `${base}#store-products` : base;
}

/** Resuelve la categoría de un producto del menú multi-sucursal. */
export function resolveProductCategoryId(product, productsByCategory, categories = []) {
  if (product?.categoryId) return product.categoryId;
  const id = product?.id;
  if (!id) return categories[0]?.id || null;
  for (const cat of categories) {
    if ((productsByCategory[cat.id] || []).some((p) => p.id === id)) return cat.id;
  }
  return categories[0]?.id || null;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CL');
  } catch {
    return iso;
  }
}

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export { getNextOrderEstado as nextEstado } from './constants';

export function estadoLabel(estado) {
  const labels = {
    pendiente: 'Nuevo',
    aceptado: 'Aceptado',
    confirmado: 'Confirmado',
    preparando: 'En cocina',
    listo: 'Listo',
    en_delivery: 'En reparto',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
  };
  return labels[estado] || estado;
}

export function elapsedMinutes(iso) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

const TICKET_LINE_LENGTH = 35;

export function wrapText(text, maxLen = TICKET_LINE_LENGTH) {
  const str = String(text || '').trim();
  if (!str) return '';
  const lines = [];
  let remaining = str;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      lines.push(remaining);
      break;
    }
    let chunk = remaining.slice(0, maxLen);
    const lastSpace = chunk.lastIndexOf(' ');
    if (lastSpace > 0) {
      chunk = chunk.slice(0, lastSpace);
      remaining = remaining.slice(lastSpace + 1).trim();
    } else {
      remaining = remaining.slice(maxLen);
    }
    lines.push(chunk);
  }
  return lines.join('\n');
}

export function buildWhatsappMessage(order, branch) {
  return buildOrderReceiptText(order, branch);
}

/** Dígitos para wa.me / WhatsApp Web (569…). Canónico: normalizeChilePhone → +569… */
export function normalizeWhatsappPhone(phone) {
  return toWhatsappDigits(phone);
}

const WHATSAPP_WINDOW_NAME = 'pollon_whatsapp_confirm';

/**
 * Abre chat con el cliente. Reutiliza la misma ventana/pestaña nombrada
 * para no abrir múltiples chats al confirmar varios pedidos.
 */
export function openWhatsappToCustomer(phone, message) {
  const normalized = normalizeWhatsappPhone(phone);
  if (!normalized) {
    throw new Error('Teléfono del cliente no válido para WhatsApp');
  }
  const text = encodeURIComponent(message);
  const webUrl = `https://web.whatsapp.com/send?phone=${normalized}&text=${text}`;
  const mobileUrl = `https://wa.me/${normalized}?text=${text}`;
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const url = isMobile ? mobileUrl : webUrl;
  const opened = window.open(url, WHATSAPP_WINDOW_NAME);
  if (!opened) {
    window.location.assign(mobileUrl);
  }
  return normalized;
}