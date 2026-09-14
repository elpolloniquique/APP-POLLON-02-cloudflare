import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { ORDERS_KEY } from '../utils/constants';
import { normalizeChilePhone } from '../utils/format';
import { filterOrdersInRange, getPeriodRange } from '../utils/dashboardAnalytics';

let orders = [];
let channel = null;
let backendReady = false;
let initPromise = null;
let listeners = new Set();
let realtimeConnectionStatus = 'connecting';
let lastRealtimeAt = 0;
let pollTimer = null;
let refetchTimer = null;

function sanitize(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize).filter((v) => v !== undefined);
  const out = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined) continue;
    out[k] = sanitize(obj[k]);
  }
  return out;
}

function rowToOrder(row) {
  const datos = row.datos_json || {};
  return {
    id: row.id,
    createdAt: row.creado_en,
    ticketNumber: row.codigo_pedido || datos.ticketNumber,
    codigo_pedido: row.codigo_pedido,
    customer: datos.customer || {
      name: row.cliente_nombre,
      phone: row.cliente_telefono,
      address: row.cliente_direccion,
      addressLat: row.cliente_lat ?? datos.customer?.addressLat ?? null,
      addressLng: row.cliente_lng ?? datos.customer?.addressLng ?? null,
      reference: datos.customer?.reference || '',
      comments: row.observaciones,
    },
    items: datos.items || [],
    total: Number(row.total) || 0,
    deliveryFee: datos.deliveryFee || 0,
    deliveryDistanceKm: datos.deliveryDistanceKm ?? null,
    estado: row.estado,
    deliveredAt: row.entregado_en,
    orderType: row.tipo_entrega || 'delivery',
    metodo_pago: row.metodo_pago,
    /** Control interno de caja — no va al ticket ni al cliente. Default N/A. */
    cajaPago: datos.caja_pago === 'pagado'
      ? 'pagado'
      : datos.caja_pago === 'por_pagar'
        ? 'por_pagar'
        : datos.caja_pago === 'na'
          ? 'na'
          : null,
    /** live_map = cliente ve mapa; status_line = solo barra de estados */
    trackingMode: datos.tracking_mode === 'live_map' || datos.tracking_mode === 'status_line'
      ? datos.tracking_mode
      : null,
    /** Fase 3: el cliente activó avisos WhatsApp (confirmación enviada). */
    waAvisos: datos.wa_avisos === true,
    waAvisosAt: datos.wa_avisos_at || null,
    branchId: row.branch_id || row.sucursal_id || datos.branchId,
    customerId: row.customer_id || datos.customerId,
    observaciones: row.observaciones,
  };
}

function orderToRow(order) {
  const cust = order.customer || {};
  const phoneE164 = normalizeChilePhone(cust.phone) || String(cust.phone || '').trim();
  const codigo = order.codigo_pedido || order.ticketNumber || String(order.id).slice(-6);
  const ref = String(cust.reference || '').trim();
  const address = String(cust.address || '').trim();
  const addressWithRef = ref
    ? (address ? `${address} | Ref: ${ref}` : `Ref: ${ref}`)
    : address;
  return sanitize({
    id: order.id,
    codigo_pedido: String(codigo).padStart(6, '0'),
    cliente_nombre: cust.name || '',
    cliente_telefono: phoneE164,
    cliente_direccion: addressWithRef,
    cliente_lat: cust.addressLat ?? null,
    cliente_lng: cust.addressLng ?? null,
    tipo_entrega: order.orderType || 'delivery',
    metodo_pago: order.metodo_pago || 'whatsapp',
    total: order.total || 0,
    estado: order.estado || 'pendiente',
    observaciones: cust.comments || order.observaciones || '',
    branch_id: order.branchId || null,
    customer_id: order.customerId || null,
    creado_en: order.createdAt || new Date().toISOString(),
    entregado_en: order.deliveredAt || null,
    datos_json: {
      customer: { ...cust, phone: phoneE164 },
      items: order.items || [],
      ticketNumber: order.ticketNumber,
      deliveryFee: order.deliveryFee || 0,
      deliveryDistanceKm: order.deliveryDistanceKm ?? null,
      subtotal: order.subtotal ?? null,
      branchId: order.branchId,
      productIds: (order.items || []).map((it) => it.id || it.producto_id).filter(Boolean),
      // Solo staff/caja — jamás se imprime en ticket. na | por_pagar | pagado
      caja_pago: order.cajaPago === 'pagado' || order.cajaPago === 'por_pagar' || order.cajaPago === 'na'
        ? order.cajaPago
        : null,
      tracking_mode: order.trackingMode === 'live_map' || order.trackingMode === 'status_line'
        ? order.trackingMode
        : null,
      driver_accepted_at: order.driverAcceptedAt || undefined,
      picked_up_at: order.pickedUpAt || undefined,
      comision_repartidor_pago: order.comisionRepartidorPago || undefined,
      ...(order.waAvisos ? { wa_avisos: true, wa_avisos_at: order.waAvisosAt || undefined } : {}),
    },
  });
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    orders = raw ? JSON.parse(raw) : [];
  } catch {
    orders = [];
  }
}

function saveLocal() {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

export function getOrders() {
  return orders;
}

export function setOrders(list) {
  orders = list;
}

export function isBackendReady() {
  return backendReady && isSupabaseConfigured();
}

/** Ventana operativa del panel: evita bajar todo el historial (causa principal de lentitud). */
const ADMIN_ORDERS_WINDOW_DAYS = 45;
const ADMIN_ORDERS_LIMIT = 500;
const OPEN_ORDER_STATES = [
  'pendiente',
  'aceptado',
  'confirmado',
  'preparando',
  'en_cocina',
  'listo',
  'en_delivery',
];

async function fetchAll(sb) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - ADMIN_ORDERS_WINDOW_DAYS);
  const cutoffIso = cutoff.toISOString();

  const [recentRes, openRes] = await Promise.all([
    sb
      .from('pedidos')
      .select('*')
      .gte('creado_en', cutoffIso)
      .order('creado_en', { ascending: false })
      .limit(ADMIN_ORDERS_LIMIT),
    sb
      .from('pedidos')
      .select('*')
      .in('estado', OPEN_ORDER_STATES)
      .lt('creado_en', cutoffIso)
      .order('creado_en', { ascending: false })
      .limit(100),
  ]);

  if (recentRes.error) throw recentRes.error;
  if (openRes.error) {
    console.warn('[Pollón] open orders fetch:', openRes.error.message);
  }

  const byId = new Map();
  for (const row of [...(openRes.data || []), ...(recentRes.data || [])]) {
    if (row?.id) byId.set(row.id, row);
  }
  return [...byId.values()].map(rowToOrder);
}

/** Comprueba conexión con Supabase (no depende de haber abierto el panel admin antes) */
async function ensureSupabaseReady() {
  const sb = getSupabase();
  if (!sb) return null;
  if (backendReady) return sb;
  try {
    const { error } = await sb.from('pedidos').select('id').limit(1);
    if (error) throw error;
    backendReady = true;
    return sb;
  } catch (e) {
    console.warn('[Pollón] Supabase pedidos no disponible:', e.message);
    return null;
  }
}

function sortOrders(list) {
  return [...list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

function mapRealtimeStatus(status = realtimeConnectionStatus) {
  if (!backendReady || !isSupabaseConfigured()) return 'local';
  if (status === 'SUBSCRIBED') return 'live';
  if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') return 'reconnecting';
  return 'connecting';
}

function notifyListeners(meta = {}) {
  const snapshot = sortOrders(orders);
  orders = snapshot;
  const payload = {
    realtimeStatus: mapRealtimeStatus(),
    ...meta,
  };
  listeners.forEach((fn) => {
    try {
      fn(snapshot, payload);
    } catch (e) {
      console.warn('[Pollón] orders listener:', e);
    }
  });
}

function applyRealtimePayload(payload) {
  if (payload.eventType === 'INSERT' && payload.new?.id) {
    const order = rowToOrder(payload.new);
    if (!orders.some((o) => o.id === order.id)) {
      orders = sortOrders([order, ...orders]);
      lastRealtimeAt = Date.now();
      notifyListeners({ source: 'realtime', event: 'INSERT' });
      return true;
    }
    return true;
  }

  if (payload.eventType === 'UPDATE' && payload.new?.id) {
    const order = rowToOrder(payload.new);
    const idx = orders.findIndex((o) => o.id === order.id);
    if (idx >= 0) orders[idx] = order;
    else orders.unshift(order);
    orders = sortOrders(orders);
    lastRealtimeAt = Date.now();
    notifyListeners({ source: 'realtime', event: 'UPDATE' });
    return true;
  }

  if (payload.eventType === 'DELETE' && payload.old?.id) {
    orders = orders.filter((o) => o.id !== payload.old.id);
    lastRealtimeAt = Date.now();
    notifyListeners({ source: 'realtime', event: 'DELETE' });
    return true;
  }

  return false;
}

async function refreshFromServer(sb) {
  orders = await fetchAll(sb);
  lastRealtimeAt = Date.now();
  notifyListeners({ source: 'fetch' });
}

function scheduleFullRefetch(sb) {
  if (refetchTimer) clearTimeout(refetchTimer);
  refetchTimer = setTimeout(() => {
    refetchTimer = null;
    refreshFromServer(sb).catch((e) => console.warn('[Pollón] RT refresh:', e));
  }, 120);
}

function startPollingFallback(sb) {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (!backendReady || !sb) return;
    // Solo poll completo si Realtime está caído o hace mucho sin eventos
    const disconnected = realtimeConnectionStatus !== 'SUBSCRIBED';
    const stale = Date.now() - lastRealtimeAt > 25000;
    if (disconnected || stale) {
      refreshFromServer(sb).catch((e) => console.warn('[Pollón] poll refresh:', e));
    }
  }, 15000);
}

function subscribeRealtime(sb) {
  if (channel) sb.removeChannel(channel);
  channel = sb
    .channel('pollon-pedidos-rt')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pedidos' },
      (payload) => {
        console.info('[Pollón] Pedido en tiempo real:', payload.eventType, payload.new?.id || payload.old?.id);
        if (!applyRealtimePayload(payload)) {
          scheduleFullRefetch(sb);
        }
      },
    )
    .subscribe((status) => {
      console.info('[Pollón] Realtime pedidos:', status);
      realtimeConnectionStatus = status;
      if (status === 'SUBSCRIBED') {
        lastRealtimeAt = Date.now();
        refreshFromServer(sb).catch((e) => console.warn('[Pollón] sync on subscribe:', e));
      } else {
        notifyListeners({ source: 'realtime-status' });
      }
    });
}

async function ensureInitialized() {
  const sb = getSupabase();
  if (!sb) {
    loadLocal();
    backendReady = false;
    realtimeConnectionStatus = 'local';
    notifyListeners({ source: 'local' });
    return;
  }

  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    try {
      orders = await fetchAll(sb);
      backendReady = true;
      lastRealtimeAt = Date.now();
      realtimeConnectionStatus = 'connecting';
      notifyListeners({ source: 'init' });
      subscribeRealtime(sb);
      startPollingFallback(sb);
    } catch (e) {
      console.warn('[Pollón] initOrders:', e);
      loadLocal();
      backendReady = false;
      realtimeConnectionStatus = 'local';
      notifyListeners({ source: 'local-fallback' });
    }
  })();

  await initPromise;
}

/** Suscripción a pedidos con tiempo real. Devuelve función para cancelar. */
export function subscribeOrders(onSync) {
  listeners.add(onSync);
  ensureInitialized().then(() => {
    onSync(sortOrders(orders), { realtimeStatus: mapRealtimeStatus() });
  });
  return () => {
    listeners.delete(onSync);
  };
}

export async function initOrders(onSync) {
  const unsub = subscribeOrders(onSync);
  return unsub;
}

async function insertDetalle(sb, pedidoId, items) {
  if (!items?.length) return;
  const rows = items.map((it) => {
    const drinks = Array.isArray(it.drinks)
      ? it.drinks.filter(Boolean)
      : (it.drink
        ? String(it.drink).split(' · ').map((s) => s.replace(/^#\d+:\s*/, '').trim()).filter(Boolean)
        : []);
    return {
      pedido_id: pedidoId,
      producto_id: null,
      nombre_producto: it.name || 'Producto',
      cantidad: it.qty || 1,
      precio_unitario: Math.round((it.total || 0) / (it.qty || 1)),
      subtotal: it.total || 0,
      extras: {
        drink: it.drink || drinks.join(' · ') || null,
        drinks,
        bagQty: it.bagQty || 0,
        notes: it.notes || '',
        productId: it.id || it.producto_id || null,
      },
    };
  });
  const { error } = await sb.from('detalle_pedidos').insert(rows);
  if (error) console.warn('[Pollón] detalle_pedidos:', error.message);
}

function isDuplicateCodigoError(error) {
  const msg = error?.message || '';
  return msg.includes('pedidos_codigo_pedido_key') || msg.includes('duplicate key');
}

function mapPedidoInsertError(error) {
  const msg = error?.message || '';
  if (msg.includes('branch_id')) {
    return new Error('Falta columna branch_id. En Supabase ejecuta fix-pedidos-checkout.sql');
  }
  if (msg.includes('row-level security') || msg.includes('order_status_history')) {
    return new Error('Permisos de pedido. En Supabase ejecuta fix-pedidos-checkout.sql (script completo).');
  }
  if (msg.includes('sucursal_id')) {
    return new Error('Error de columna legacy. Redeploy en Vercel con el código actualizado.');
  }
  return error;
}

export async function allocateTicketNumber(sb) {
  if (sb) {
    try {
      const { data, error } = await sb
        .from('pedidos')
        .select('codigo_pedido')
        .order('codigo_pedido', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data?.codigo_pedido) {
        const last = parseInt(String(data.codigo_pedido), 10);
        if (!Number.isNaN(last)) {
          return String(last + 1).padStart(6, '0');
        }
      }
    } catch (e) {
      console.warn('[Pollón] allocateTicketNumber:', e);
    }
  }
  return generateTicketNumber(getOrders());
}

function commitOrderLocally(order) {
  orders.push(order);
  orders.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  saveLocal();
}

export async function saveOrder(order) {
  if (!order?.id) throw new Error('Pedido inválido');

  const sb = await ensureSupabaseReady();
  if (!sb) {
    if (!order.codigo_pedido) {
      order.codigo_pedido = generateTicketNumber(getOrders());
      order.ticketNumber = order.codigo_pedido;
    }
    commitOrderLocally(order);
    if (isSupabaseConfigured()) {
      throw new Error('No se pudo guardar en Supabase. Revisa la conexión o ejecuta fix-realtime-pedidos.sql');
    }
    return order;
  }

  if (!order.codigo_pedido) {
    order.codigo_pedido = await allocateTicketNumber(sb);
    order.ticketNumber = order.codigo_pedido;
  }

  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      order.codigo_pedido = await allocateTicketNumber(sb);
      order.ticketNumber = order.codigo_pedido;
    }

    const row = orderToRow(order);
    const { error } = await sb.from('pedidos').insert(row);
    if (!error) {
      await insertDetalle(sb, order.id, order.items);
      commitOrderLocally(order);
      pingWaOrderNotify({
        event: 'insert',
        orderId: order.id,
        codigo_pedido: order.codigo_pedido,
        phone: order.customer?.phone,
        estado: order.estado || 'pendiente',
      });
      return order;
    }

    if (isDuplicateCodigoError(error) && attempt < maxAttempts - 1) {
      continue;
    }

    throw mapPedidoInsertError(error);
  }

  throw new Error('No se pudo generar un código de pedido único. Intenta de nuevo.');
}

function pingWaOrderNotify(payload) {
  try {
    const client = getSupabase();
    const run = async () => {
      const headers = { 'Content-Type': 'application/json' };
      try {
        const { data } = await client?.auth.getSession();
        if (data?.session?.access_token) {
          headers.Authorization = `Bearer ${data.session.access_token}`;
        }
      } catch {
        /* checkout anónimo */
      }
      await fetch('/api/bot-order-hook', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
    };
    run().catch(() => {});
  } catch {
    /* no bloquear pedidos si el bot falla */
  }
}

export async function updateOrder(order) {
  const idx = orders.findIndex((o) => o.id === order.id);
  const prev = idx >= 0 ? orders[idx] : null;
  if (idx >= 0) orders[idx] = order;
  else orders.push(order);

  const sb = await ensureSupabaseReady();
  if (!sb) {
    saveLocal();
    return order;
  }
  const row = orderToRow({ ...order, waAvisos: order.waAvisos || prev?.waAvisos, waAvisosAt: order.waAvisosAt || prev?.waAvisosAt });
  try {
    const { data: existing } = await sb.from('pedidos').select('datos_json').eq('id', String(order.id)).maybeSingle();
    if (existing?.datos_json?.wa_avisos) {
      row.datos_json = {
        ...row.datos_json,
        wa_avisos: true,
        wa_avisos_at: existing.datos_json.wa_avisos_at || row.datos_json.wa_avisos_at,
      };
    }
  } catch { /* no bloquear update */ }
  const { error } = await sb.from('pedidos').upsert(row, { onConflict: 'id' });
  if (error) throw error;
  if (order.estado && order.estado !== prev?.estado) {
    pingWaOrderNotify({
      event: 'update',
      orderId: order.id,
      estado: order.estado,
      prevEstado: prev?.estado || null,
      codigo_pedido: order.codigo_pedido || order.ticketNumber,
      phone: order.customer?.phone,
    });
  }

  // Si sale de "pendiente" (Nuevo), cancelar ofertas abiertas al repartidor
  if (
    order.orderType === 'delivery'
    && order.estado
    && order.estado !== 'pendiente'
  ) {
    try {
      await sb.rpc('ep_cancel_open_driver_offers_for_order', {
        p_order_id: String(order.id),
      });
    } catch (e) {
      console.warn('[Pollón] cancel offers:', e?.message || e);
    }
  }

  saveLocal();
  return order;
}

export async function fetchOrdersAdmin() {
  const sb = getSupabase();
  if (!sb) return getOrders();
  const list = await fetchAll(sb);
  orders = list;
  lastRealtimeAt = Date.now();
  return list;
}

/** Pedidos de una sucursal para analytics públicos (ej. más vendidos en inicio). */
export async function fetchBranchOrdersForPeriod(branchId, periodId = 'month') {
  const sb = getSupabase();
  if (!sb || !branchId) return [];

  const { start, end } = getPeriodRange(periodId);

  const { data, error } = await sb
    .from('pedidos')
    .select('*')
    .eq('branch_id', branchId)
    .gte('creado_en', start.toISOString())
    .order('creado_en', { ascending: false })
    .limit(2000);

  if (error) {
    console.warn('[Pollón] fetchBranchOrdersForPeriod:', error.message);
    return [];
  }

  const orders = (data || []).map(rowToOrder).filter((o) => o.estado !== 'cancelado');
  return filterOrdersInRange(orders, start, end);
}

export function generateOrderId() {
  const suffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `P${Date.now()}-${suffix}`;
}

export function generateTicketNumber(existingOrders) {
  const nums = existingOrders
    .map((o) => parseInt(String(o.ticketNumber || o.codigo_pedido || '0'), 10))
    .filter((n) => !Number.isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return String(next).padStart(6, '0');
}
