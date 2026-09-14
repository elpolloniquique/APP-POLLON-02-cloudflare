/** Confirmación y avisos de estado (idempotentes vía ep_wa_outbox) */

import { interpolate, moneyCLP, ORDER_STATUS_HUMAN } from './text.js';
import { normalizeWhatsappPhone } from './phone.js';
import {
  ensureSettingsRow,
  loadBranch,
  mapPedidoRow,
  getOrCreateSession,
  updateSession,
  logMessage,
  countPurchases,
  loyaltyText,
  buildTemplateVars,
  createAlert,
  countOutboundLastMinute,
  markOrderWaAvisos,
} from './knowledge.js';
import { sendText, evolutionConfigured } from './evolution.js';

function eventForEstado(estado) {
  const s = String(estado || '').toLowerCase();
  if (s === 'preparando') return 'estado:preparando';
  if (s === 'listo' || s === 'en_delivery') return 'estado:en_delivery';
  if (s === 'entregado') return 'estado:entregado';
  if (s === 'cancelado') return 'estado:cancelado';
  if (s === 'pendiente' || s === 'aceptado' || s === 'confirmado') return 'confirmacion';
  return null;
}

function templateKeyForEvent(event) {
  if (event === 'confirmacion') return 'confirmacion_pedido';
  if (event === 'estado:preparando') return 'estado_cocina';
  if (event === 'estado:en_delivery') return 'estado_reparto';
  if (event === 'estado:entregado') return 'estado_entregado';
  if (event === 'estado:cancelado') return 'estado_cancelado';
  return null;
}

async function outboxGet(admin, orderId, event) {
  const { data } = await admin.from('ep_wa_outbox')
    .select('*')
    .eq('order_id', String(orderId))
    .eq('event', event)
    .maybeSingle();
  return data;
}

async function outboxUpsert(admin, { orderId, event, status, errorText }) {
  const row = {
    order_id: String(orderId),
    event,
    status,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
    error_text: errorText || null,
  };
  const { data } = await admin.from('ep_wa_outbox')
    .upsert(row, { onConflict: 'order_id,event' })
    .select('*')
    .maybeSingle();
  return data;
}

export async function loadOrder(admin, orderId) {
  const { data } = await admin.from('pedidos').select('*').eq('id', String(orderId)).maybeSingle();
  return mapPedidoRow(data);
}

/**
 * Procesa INSERT/UPDATE de pedidos.
 * forceConfirm = true cuando el cliente escribió AVISOS o modo_proactivo.
 */
export async function handleOrderEvent(admin, {
  order,
  prevEstado = null,
  forceConfirm = false,
}) {
  if (!order?.branchId) {
    return { ok: false, error: 'Pedido sin sucursal' };
  }

  const settings = await ensureSettingsRow(admin, order.branchId);
  if (!settings.enabled) {
    return { ok: true, skipped: 'disabled' };
  }

  const branch = await loadBranch(admin, order.branchId);
  if (!branch) return { ok: false, error: 'Sucursal no encontrada' };

  const phone = normalizeWhatsappPhone(order.phone);
  if (!phone) {
    await createAlert(admin, {
      type: 'no_phone',
      branch_id: branch.id,
      order_id: order.id,
      phone: order.phone || null,
      preview: `Pedido #${order.codigo} sin WhatsApp válido`,
    });
    return { ok: true, skipped: 'no_phone' };
  }

  const session = await getOrCreateSession(admin, {
    phone,
    branchId: branch.id,
    name: order.name,
  });

  const inHuman = session?.mode === 'human'
    && session.human_until
    && new Date(session.human_until) > new Date();

  const estado = String(order.estado || 'pendiente').toLowerCase();
  const event = eventForEstado(estado);
  if (!event) return { ok: true, skipped: 'irrelevant_status' };

  const isConfirm = event === 'confirmacion';
  if (isConfirm) {
    const already = await outboxGet(admin, order.id, 'confirmacion');
    if (already?.status === 'sent') {
      return { ok: true, skipped: 'confirm_already_sent' };
    }
    if (!forceConfirm && !settings.modo_proactivo) {
      const { count } = await admin.from('ep_wa_messages')
        .select('id', { count: 'exact', head: true })
        .eq('phone', phone)
        .eq('branch_id', branch.id)
        .eq('direction', 'in');
      if (!count) {
        return { ok: true, skipped: 'wait_inbound_avisos' };
      }
    }
  } else if (inHuman && settings.avisos_en_modo_humano === false) {
    return { ok: true, skipped: 'human_no_status' };
  }

  if (session?.opt_out && settings.avisos_si_opt_out === false) {
    return { ok: true, skipped: 'opt_out' };
  }

  if (!isConfirm && prevEstado && String(prevEstado).toLowerCase() === estado) {
    return { ok: true, skipped: 'same_status' };
  }

  const existing = await outboxGet(admin, order.id, event);
  if (existing?.status === 'sent') {
    return { ok: true, skipped: 'already_sent', event };
  }

  const count = await countPurchases(admin, {
    phone,
    branchId: branch.id,
    onlyBranch: settings.contar_compras_solo_sucursal !== false,
  });
  const loyalty = { count, text: loyaltyText(settings.loyalty_tiers, count, branch.name) };
  const tplKey = templateKeyForEvent(event);
  const template = settings.templates[tplKey];
  if (!template) return { ok: true, skipped: 'no_template', event };

  const reply = interpolate(template, buildTemplateVars({
    branch, settings, name: order.name, order, loyalty,
  }));

  await outboxUpsert(admin, { orderId: order.id, event, status: 'pending' });

  const recent = await countOutboundLastMinute(admin, phone);
  if (recent >= (settings.rate_limit_per_min || 4)) {
    return { ok: true, skipped: 'rate_limit', event, queued: true };
  }

  if (!evolutionConfigured() || !settings.evolution_instance) {
    await outboxUpsert(admin, {
      orderId: order.id,
      event,
      status: 'error',
      errorText: 'Evolution no configurado o instancia vacía',
    });
    return { ok: false, error: 'Evolution no configurado', event };
  }

  try {
    await sendText(settings.evolution_instance, phone, reply);
    await outboxUpsert(admin, { orderId: order.id, event, status: 'sent' });
    if (event === 'confirmacion') {
      await markOrderWaAvisos(admin, order.id);
    }
    await logMessage(admin, {
      sessionId: session?.id,
      branchId: branch.id,
      phone,
      direction: 'out',
      body: reply,
      intent: event,
    });
    if (session?.id) {
      await updateSession(admin, session.id, {
        last_order_id: order.id,
        last_name: order.name || session.last_name,
        order_count_cache: count,
        last_intent: event,
      });
    }
    return { ok: true, event, reply, estado: ORDER_STATUS_HUMAN[estado] || estado };
  } catch (err) {
    await outboxUpsert(admin, {
      orderId: order.id,
      event,
      status: 'error',
      errorText: String(err.message || err).slice(0, 400),
    });
    await createAlert(admin, {
      type: 'disconnected',
      branch_id: branch.id,
      order_id: order.id,
      phone,
      preview: `Aviso ${event} falló: ${String(err.message || err).slice(0, 180)}`,
    });
    return { ok: false, error: err.message, event };
  }
}

export async function retryPendingOutbox(admin, { branchId, limit = 20 } = {}) {
  let q = admin.from('ep_wa_outbox')
    .select('*')
    .in('status', ['pending', 'error'])
    .order('created_at', { ascending: true })
    .limit(limit);
  const { data } = await q;
  const rows = data || [];
  const results = [];
  for (const row of rows) {
    const order = await loadOrder(admin, row.order_id);
    if (!order) continue;
    if (branchId && order.branchId !== branchId) continue;
    const r = await handleOrderEvent(admin, {
      order,
      forceConfirm: row.event === 'confirmacion',
    });
    results.push({ orderId: row.order_id, event: row.event, ...r });
  }
  return results;
}

export { moneyCLP };
