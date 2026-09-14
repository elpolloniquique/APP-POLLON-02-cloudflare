/**
 * Avisos de pedido (confirmación + estados).
 * POST /api/wa-order-notify
 *
 * Auth (cualquiera):
 *  - X-EP-WA-SECRET (webhook DB Supabase)
 *  - Bearer JWT staff (panel admin)
 *  - sin auth: { orderId, codigo_pedido, phone } deben coincidir con el pedido
 *
 * Body:
 *  - Formato app: { event: 'insert'|'update', orderId, estado?, codigo_pedido?, phone? }
 *  - Formato Supabase DB webhook: { type, table, record, old_record }
 */
import { cors, parseBody, getSupabaseAdmin, getSupabaseUserClient, env } from '../lib/whatsapp/supabaseAdmin.js';
import { handleOrderEvent, loadOrder } from '../lib/whatsapp/notify.js';
import { mapPedidoRow } from '../lib/whatsapp/knowledge.js';
import { phonesMatch } from '../lib/whatsapp/phone.js';

function secretOk(req) {
  const expected = env('EP_WA_WEBHOOK_SECRET');
  if (!expected) return false;
  const header = req.headers['x-ep-wa-secret'] || req.headers['apikey'] || '';
  const q = typeof req.query?.secret === 'string' ? req.query.secret : '';
  return header === expected || q === expected;
}

async function staffOk(req, admin) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return false;
  const userClient = getSupabaseUserClient(token);
  if (!userClient) return false;
  const { data: authData } = await userClient.auth.getUser();
  if (!authData?.user) return false;
  const { data: caller } = await admin
    .from('profiles')
    .select('role, is_active')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();
  if (!caller || caller.is_active === false) return false;
  const role = caller.role === 'administrador' ? 'admin_sucursal' : caller.role;
  return ['super_admin', 'admin_sucursal', 'cajera', 'cajero', 'despachador', 'cocina', 'cocinero'].includes(role);
}

function fromDbWebhook(body) {
  const type = String(body?.type || '').toUpperCase();
  if (!['INSERT', 'UPDATE'].includes(type)) return null;
  if (body?.table && body.table !== 'pedidos') return null;
  const record = body.record || body.new || null;
  if (!record?.id) return null;
  return {
    event: type === 'INSERT' ? 'insert' : 'update',
    order: mapPedidoRow(record),
    prevEstado: body.old_record?.estado || null,
  };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const admin = getSupabaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY' });

  const body = parseBody(req);
  const db = fromDbWebhook(body);

  let order = db?.order || null;
  let prevEstado = db?.prevEstado || null;
  let forceConfirm = false;

  if (!order) {
    const orderId = body.orderId || body.order_id || body.id;
    if (!orderId) return res.status(400).json({ error: 'orderId requerido' });
    order = await loadOrder(admin, orderId);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    prevEstado = body.prevEstado || body.oldEstado || null;
    if (body.estado) order.estado = body.estado;
  }

  const hasSecret = secretOk(req);
  const hasStaff = await staffOk(req, admin);
  const phoneMatch = body.phone && body.codigo_pedido
    && phonesMatch(body.phone, order.phone)
    && String(body.codigo_pedido).padStart(6, '0') === String(order.codigo).padStart(6, '0');

  if (!hasSecret && !hasStaff && !phoneMatch) {
    return res.status(401).json({ error: 'Sin autorización' });
  }

  if (phoneMatch && !hasStaff && !hasSecret) {
    forceConfirm = body.event === 'insert' || body.forceConfirm === true;
  }
  if (hasStaff || hasSecret) {
    forceConfirm = body.forceConfirm === true || body.event === 'avisos';
  }

  try {
    const result = await handleOrderEvent(admin, { order, prevEstado, forceConfirm });
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[wa-order-notify]', err?.message || err);
    return res.status(500).json({ error: err.message || 'Error interno' });
  }
}
