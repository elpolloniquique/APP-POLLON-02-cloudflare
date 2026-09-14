/**
 * FASE 13–14 + 19: webhook pedidos.
 * Auth: secret · JWT staff (incluye cocina/caja) · phone+codigo (checkout, rate-limited)
 */
import { cors, parseBody, getSupabaseAdmin } from '../lib/whatsapp/supabaseAdmin.js';
import { mapPedido } from '../lib/bot/data.js';
import { phonesMatch } from '../lib/bot/phone.js';
import { enqueueFromPedidoChange, loadOrderWithItems } from '../lib/bot/orderNotify.js';
import { dispatchQueue } from '../lib/bot/queue.js';
import { requireStaff, webhookSecretOk } from '../lib/bot/auth.js';
import { clientIp, rateLimitHit } from '../lib/bot/rateLimit.js';

const STAFF_ROLES = ['super_admin', 'admin_sucursal', 'cajera', 'cajero', 'despachador', 'cocina', 'cocinero'];

function fromDbWebhook(body) {
  const type = String(body?.type || '').toUpperCase();
  if (!['INSERT', 'UPDATE'].includes(type)) return null;
  if (body?.table && body.table !== 'pedidos') return null;
  const record = body.record || body.new || null;
  if (!record?.id) return null;
  return {
    isInsert: type === 'INSERT',
    order: mapPedido(record),
    prevEstado: body.old_record?.estado || null,
  };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });
  if (rateLimitHit(`order-hook:${clientIp(req)}`, { max: 40, windowMs: 60_000 })) {
    return res.status(429).json({ ok: false, error: 'rate_limit' });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ ok: false, error: 'supabase_admin' });

  const body = parseBody(req);
  const db = fromDbWebhook(body);

  let order = db?.order || null;
  let prevEstado = db?.prevEstado || null;
  let isInsert = Boolean(db?.isInsert);

  if (!order) {
    const orderId = body.orderId || body.order_id || body.id;
    if (!orderId) return res.status(400).json({ ok: false, error: 'orderId' });
    order = await loadOrderWithItems(admin, orderId);
    if (!order) return res.status(404).json({ ok: false, error: 'not_found' });
    prevEstado = body.prevEstado || body.oldEstado || null;
    if (body.estado) order.estado = body.estado;
    isInsert = body.event === 'insert' || body.event === 'INSERT';
  }

  const hasSecret = webhookSecretOk(req);
  const staff = await requireStaff(req, admin, { roles: STAFF_ROLES });
  const phoneMatch = Boolean(
    body.phone
    && phonesMatch(body.phone, order.phone)
    && String(body.codigo_pedido || '').padStart(6, '0') === String(order.codigo).padStart(6, '0')
    && String(body.codigo_pedido || '').replace(/\D/g, '').length >= 4,
  );

  if (!hasSecret && !staff && !phoneMatch) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  if (phoneMatch && !hasSecret && !staff) {
    if (rateLimitHit(`order-anon:${clientIp(req)}:${order.id}`, { max: 6, windowMs: 60_000 })) {
      return res.status(429).json({ ok: false, error: 'rate_limit' });
    }
  }

  try {
    const enqueued = await enqueueFromPedidoChange(admin, { order, prevEstado, isInsert });
    const dispatched = await dispatchQueue(admin, { orderId: order.id, limit: 8 });
    return res.status(200).json({ ok: true, orderId: order.id, codigo: order.codigo, enqueued, dispatched });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
