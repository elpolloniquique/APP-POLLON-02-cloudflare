/** FASE 13–14: avisos de pedido (ítems reales + codigo_pedido) e idempotencia */

import { mapPedido, loadBranch } from './data.js';
import { moneyCLP, ORDER_STATUS_HUMAN, displayName } from './text.js';
import { interpolate, templateVars } from './template.js';
import { loadBotSettings } from './settings.js';
import { normalizeChilePhone } from './phone.js';

export const STATUS_TEMPLATE_KEYS = {
  pendiente: 'pendiente',
  aceptado: 'aceptado',
  confirmado: 'confirmado',
  preparando: 'preparando',
  listo: 'listo',
  en_delivery: 'en_delivery',
  entregado: 'entregado',
  cancelado: 'cancelado',
};

export function eventKeyCreated(orderId) {
  return `order:${orderId}:created`;
}

export function eventKeyStatus(orderId, estado) {
  return `order:${orderId}:status:${String(estado || '').toLowerCase()}`;
}

export function formatOrderItems(items) {
  if (!Array.isArray(items) || !items.length) return '';
  return items.map((it) => {
    const qty = Number(it.qty ?? it.quantity ?? it.cantidad ?? 1) || 1;
    const name = it.name || it.nombre || it.productName || it.nombre_producto || 'Ítem';
    const unit = Number(it.price ?? it.precio ?? it.unitPrice ?? it.precio_unitario);
    const extrasRaw = it.extras || it.agregados || [];
    const extras = Array.isArray(extrasRaw)
      ? extrasRaw.map((e) => (typeof e === 'string' ? e : e?.name || e?.nombre || '')).filter(Boolean)
      : [];
    const note = it.note || it.notas || it.observacion || '';
    const priceTxt = Number.isFinite(unit) && unit > 0 ? ` — ${moneyCLP(unit * qty)}` : '';
    let line = `• ${qty}× ${name}${priceTxt}`;
    if (extras.length) line += `\n  (${extras.join(', ')})`;
    if (note) line += `\n  nota: ${note}`;
    return line;
  }).join('\n');
}

export async function loadOrderWithItems(admin, orderId) {
  const { data } = await admin.from('pedidos').select('*').eq('id', String(orderId)).maybeSingle();
  if (!data) return null;
  const order = mapPedido(data);
  if (!order.items?.length) {
    const { data: det } = await admin
      .from('detalle_pedidos')
      .select('nombre_producto, cantidad, precio_unitario, extras')
      .eq('pedido_id', String(orderId));
    order.items = (det || []).map((d) => ({
      name: d.nombre_producto,
      qty: d.cantidad,
      price: d.precio_unitario,
      extras: d.extras,
    }));
  }
  return order;
}

function tipoLabel(tipo) {
  const t = String(tipo || '').toLowerCase();
  if (t === 'pickup' || t === 'retiro') return 'Retiro en local';
  if (t === 'reserva') return 'Reserva';
  return 'Delivery';
}

export function buildOrderVars(order, branch, settings) {
  const itemsTxt = formatOrderItems(order.items);
  const deliveryFee = Number(order.deliveryFee) || 0;
  const total = Number(order.total) || 0;
  const subtotal = total > deliveryFee ? total - deliveryFee : total;
  const pago = String(order.pago || '').toLowerCase();
  const pagoTxt = /tarjeta/.test(pago)
    ? 'Tarjeta (al recibir)'
    : /transfer/.test(pago)
      ? 'Transferencia (al recibir)'
      : /efectivo/.test(pago)
        ? 'Efectivo (al recibir)'
        : (pago || 'al recibir');
  const detalle = [
    itemsTxt || '(detalle en sucursal)',
    `Tipo: ${tipoLabel(order.tipo)}`,
    `Pago: ${pagoTxt}`,
    order.address ? `Dirección: ${order.address}` : '',
    order.observaciones ? `Notas: ${order.observaciones}` : '',
  ].filter(Boolean).join('\n');

  return templateVars({
    name: displayName(order.name),
    order,
    branch,
    settings,
    extra: {
      estado: ORDER_STATUS_HUMAN[order.estado] || order.estado,
      total: moneyCLP(total),
      subtotal: moneyCLP(subtotal),
      delivery: deliveryFee > 0 ? moneyCLP(deliveryFee) : 'sin cargo extra',
      detalle,
      tipo: tipoLabel(order.tipo),
      pago: pagoTxt,
    },
  });
}

export function renderOrderCreated(settings, vars) {
  const tpl = settings.templates?.order_created
    || '🍗 ¡Hola{nombre_coma}!\n\nTu pedido fue registrado en El Pollón.\n\n🧾 Pedido N.º {pedido}\n🔎 Seguimiento: #{pedido}\n\n{detalle}\n\nTotal: {total}\n🏪 {sucursal}';
  return interpolate(tpl, vars);
}

export function renderOrderStatus(settings, estado, vars) {
  const key = STATUS_TEMPLATE_KEYS[String(estado || '').toLowerCase()] || estado;
  const tpl = settings.templates?.[key]
    || '{nombre}, tu pedido N.º {pedido} está {estado}.';
  return interpolate(tpl, vars);
}

export async function claimAndEnqueue(admin, {
  order,
  type,
  prevEstado = null,
}) {
  const phone = normalizeChilePhone(order.phone) || String(order.phone || '').trim();
  if (!phone) return { ok: false, skipped: 'no_phone' };

  const eventKey = type === 'order_created'
    ? eventKeyCreated(order.id)
    : eventKeyStatus(order.id, order.estado);

  const { data: eventRow, error: evErr } = await admin.from('bot_events').insert({
    event_key: eventKey,
    event_type: type,
    entity_type: 'pedido',
    entity_id: String(order.id),
    phone,
    status: 'pending',
    payload: {
      codigo_pedido: order.codigo,
      estado: order.estado,
      prev_estado: prevEstado,
      branch_id: order.branchId,
    },
  }).select('id').maybeSingle();

  if (evErr) {
    if (evErr.code === '23505' || /duplicate|unique/i.test(evErr.message || '')) {
      return { ok: true, skipped: 'already_claimed', eventKey };
    }
    return { ok: false, error: evErr.message, eventKey };
  }
  if (!eventRow?.id) return { ok: true, skipped: 'already_claimed', eventKey };

  const { error: qErr } = await admin.from('bot_notification_queue').insert({
    type,
    phone,
    customer_id: order.customerId || null,
    order_id: String(order.id),
    branch_id: order.branchId || null,
    event_key: eventKey,
    status: 'pending',
    payload: {
      event_key: eventKey,
      codigo_pedido: order.codigo,
      estado: order.estado,
      prev_estado: prevEstado,
      nombre: order.name,
    },
  });
  if (qErr && qErr.code !== '23505' && !/duplicate|unique/i.test(qErr.message || '')) {
    return { ok: false, error: qErr.message, eventKey };
  }
  return { ok: true, enqueued: true, eventKey };
}

export async function enqueueFromPedidoChange(admin, { order, prevEstado = null, isInsert = false }) {
  const settings = await loadBotSettings(admin, order.branchId);
  const out = [];
  if (isInsert) {
    if (settings.order_created_enabled === false) {
      out.push({ ok: true, skipped: 'order_created_disabled' });
    } else {
      out.push(await claimAndEnqueue(admin, { order, type: 'order_created' }));
    }
  } else if (prevEstado && String(prevEstado) !== String(order.estado)) {
    if (settings.order_status_enabled === false) {
      out.push({ ok: true, skipped: 'order_status_disabled' });
    } else {
      out.push(await claimAndEnqueue(admin, { order, type: 'order_status', prevEstado }));
    }
  }
  return out;
}

export async function buildQueueMessage(admin, row) {
  const order = await loadOrderWithItems(admin, row.order_id);
  if (!order) return { ok: false, error: 'order_not_found' };
  const settings = await loadBotSettings(admin, order.branchId || row.branch_id);
  if (settings.bot_enabled === false) return { ok: false, skipped: 'bot_disabled' };
  const branch = await loadBranch(admin, order.branchId || row.branch_id);
  const vars = buildOrderVars(order, branch, settings);
  const isCreated = row.type === 'order_created'
    || String(row.event_key || row.payload?.event_key || '').includes(':created');
  const estado = String(row.payload?.estado || order.estado || '').toLowerCase();
  const text = isCreated
    ? renderOrderCreated(settings, vars)
    : renderOrderStatus(settings, estado, vars);
  return {
    ok: true,
    text,
    phone: normalizeChilePhone(row.phone || order.phone) || row.phone,
    order,
    branch,
    settings,
    eventKey: row.event_key || row.payload?.event_key,
  };
}
