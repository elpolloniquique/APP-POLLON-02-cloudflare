/**
 * Web Push a cajeras: mismo aviso de bandeja que el pollito,
 * solo pedidos en estado Nuevo de SU sucursal. Sin FCM nativo.
 */
import { env } from './fcmSend.js';
import { setWebPushVapid, sendWebPushNotification, cleanVapidKey } from './webPushSend.js';
import { NUEVO_PEDIDO_ESTADOS } from './ensureNotifyOffers.js';

const CASHIER_ROLES = new Set(['cajera', 'cajero']);

function ticketLabel(code) {
  const s = String(code || '').trim();
  if (!s) return '—';
  if (/^\d+$/.test(s)) return s.padStart(6, '0');
  return s;
}

function moneyCLP(n) {
  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(Number(n) || 0);
  } catch {
    return `$${Math.round(Number(n) || 0)}`;
  }
}

function orderBranchId(pedido) {
  const fromRow = pedido?.branch_id || null;
  const datos = pedido?.datos_json || {};
  return fromRow || datos.branchId || datos.branch_id || null;
}

function tipoLabel(pedido) {
  const tipo = String(pedido?.tipo_entrega || 'delivery').toLowerCase();
  if (tipo === 'delivery') {
    const fee = Number(pedido?.datos_json?.deliveryFee ?? pedido?.delivery_fee ?? 0) || 0;
    return `Delivery ${moneyCLP(fee)}`;
  }
  if (tipo === 'retiro' || tipo === 'pickup' || tipo === 'takeaway') return 'Retiro en sucursal';
  return tipo || 'Pedido';
}

export function cashierNoticeText(pedido) {
  const ticket = ticketLabel(pedido?.codigo_pedido);
  const addr = String(pedido?.cliente_direccion || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  const kind = tipoLabel(pedido);
  const id = String(pedido?.id || '');
  return {
    title: `NUEVO PEDIDO Nº ${ticket}`,
    body: [addr || null, kind].filter(Boolean).join(' · ') || kind,
    ticket,
    address: addr,
    fee: kind,
    tag: id ? `pollon-cashier-${id}` : 'pollon-cashier-order',
    orderId: id || null,
  };
}

function vapidPair() {
  const vapidPublic = cleanVapidKey(env('EP_WEB_PUSH_PUBLIC_KEY', 'VITE_VAPID_PUBLIC_KEY', 'VAPID_PUBLIC_KEY'));
  const vapidPrivate = cleanVapidKey(env('VAPID_PRIVATE_KEY'));
  const vapidSubject = String(env('VAPID_SUBJECT') || 'mailto:contacto@el-pollon.cl').trim();
  return { vapidPublic, vapidPrivate, vapidSubject };
}

async function loadPedido(admin, orderId) {
  const { data } = await admin
    .from('pedidos')
    .select('id, branch_id, estado, tipo_entrega, codigo_pedido, cliente_direccion, datos_json')
    .eq('id', String(orderId))
    .maybeSingle();
  return data || null;
}

async function cashierSubsForBranch(admin, branchId) {
  const { data: subs, error } = await admin
    .from('ep_cashier_push_subscriptions')
    .select('id, profile_id, branch_id, endpoint, p256dh, auth')
    .eq('branch_id', branchId);
  if (error) throw error;
  if (!subs?.length) return [];

  const profileIds = [...new Set(subs.map((s) => s.profile_id).filter(Boolean))];
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, role, is_active, branch_id')
    .in('id', profileIds);

  const ok = new Set(
    (profiles || [])
      .filter((p) => p.is_active !== false
        && CASHIER_ROLES.has(String(p.role || '').toLowerCase())
        && String(p.branch_id || '') === String(branchId))
      .map((p) => p.id),
  );
  return subs.filter((s) => ok.has(s.profile_id));
}

async function sendToSubs(admin, subs, notice, badgeCount) {
  const { vapidPublic, vapidPrivate, vapidSubject } = vapidPair();
  if (!vapidPublic || !vapidPrivate) {
    return { webSent: 0, lastWebError: 'vapid', stale: [] };
  }
  setWebPushVapid(vapidSubject, vapidPublic, vapidPrivate);
  let webSent = 0;
  let lastWebError = '';
  const stale = [];
  await Promise.all((subs || []).map(async (sub) => {
    try {
      await sendWebPushNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: notice.title,
          body: notice.body,
          url: '/admin/pedidos',
          orderId: notice.orderId,
          ticket: notice.ticket,
          address: notice.address,
          fee: notice.fee,
          tag: notice.tag,
          badgeCount,
          type: 'cashier_new_order',
          renotify: true,
        }),
        { urgency: 'high', TTL: 86400 },
      );
      webSent += 1;
    } catch (err) {
      const code = err?.statusCode;
      if (code === 404 || code === 410) stale.push(sub.id);
      else lastWebError = err?.message || String(err);
    }
  }));
  if (stale.length) {
    await admin.from('ep_cashier_push_subscriptions').delete().in('id', stale);
  }
  return { webSent, lastWebError, stale };
}

export async function notifyCashiersForOrder(_admin, _orderId) {
  return { ok: true, disabled: true, webSent: 0 };
}

export async function notifyCashiersForPendingOrders(_admin, _opts = {}) {
  return { ok: true, disabled: true, webSent: 0, orders: 0 };
}

export async function findCashierProfileForAuthUser(admin, authUserId) {
  if (!admin || !authUserId) return null;
  const { data } = await admin
    .from('profiles')
    .select('id, role, branch_id, is_active, auth_user_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (!data) return null;
  const role = String(data.role || '').toLowerCase();
  if (!CASHIER_ROLES.has(role)) return null;
  if (data.is_active === false) return null;
  return data;
}

export { vapidPair, CASHIER_ROLES };
