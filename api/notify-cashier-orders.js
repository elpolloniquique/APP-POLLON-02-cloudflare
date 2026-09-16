/**
 * Web Push a cajeras: pedidos nuevos de SU sucursal.
 * POST /api/notify-cashier-orders
 *   { selfTest: true } | { remindMe: true } | { orderId }
 */
import { createClient } from '@supabase/supabase-js';
import { env } from './_lib/fcmSend.js';
import { setWebPushVapid, sendWebPushNotification } from './_lib/webPushSend.js';
import {
  notifyCashiersForOrder,
  notifyCashiersForPendingOrders,
  findCashierProfileForAuthUser,
  vapidPair,
} from './_lib/sendCashierPushes.js';

function adminClient(supabaseUrl, serviceKey) {
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const { vapidPublic, vapidPrivate, vapidSubject } = vapidPair();

  if (req.method === 'GET') {
    const q = req.query || {};
    if (q.check === 'vapid' || q.check === 'chain') {
      const report = {
        vapidPrivate: Boolean(vapidPrivate),
        vapidPublic: Boolean(vapidPublic),
        vapidPublicPrefix: vapidPublic.slice(0, 12),
        supabase: Boolean(supabaseUrl && anonKey && serviceKey),
      };
      if (q.check === 'chain' && supabaseUrl && serviceKey) {
        const admin = adminClient(supabaseUrl, serviceKey);
        const { count: pushSubs } = await admin
          .from('ep_cashier_push_subscriptions')
          .select('id', { count: 'exact', head: true });
        report.pushSubscriptions = Number(pushSubs) || 0;
        report.ready = Boolean(vapidPublic && vapidPrivate && (Number(pushSubs) || 0) > 0);
      }
      return res.status(200).json(report);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return res.status(500).json({ error: 'Faltan vars Supabase' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Sin autorización' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return res.status(401).json({ error: 'Token inválido' });

  const admin = adminClient(supabaseUrl, serviceKey);
  const cashier = await findCashierProfileForAuthUser(admin, userData.user.id);
  const { data: isStaff } = await userClient.rpc('ep_is_dispatch_staff');

  if (body.selfTest) {
    if (!cashier) return res.status(403).json({ error: 'No eres cajera' });
    if (!vapidPublic || !vapidPrivate) {
      return res.status(200).json({
        ok: false,
        webSent: 0,
        error: 'VAPID no configurado en el servidor.',
      });
    }
    const { data: subs } = await admin
      .from('ep_cashier_push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('profile_id', cashier.id);
    if (!subs?.length) {
      return res.status(200).json({
        ok: false,
        webSent: 0,
        error: 'Sin suscripción guardada. Activa avisos en el panel.',
      });
    }
    const stamp = Date.now();
    setWebPushVapid(vapidSubject, vapidPublic, vapidPrivate);
    let webSent = 0;
    let lastError = '';
    const stale = [];
    await Promise.all(subs.map(async (sub) => {
      try {
        await sendWebPushNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: 'El Pollón · Nuevo pedido',
            body: 'Prueba de bandeja · Pedidos nuevos de tu sucursal llegarán igual',
            url: '/admin/pedidos',
            tag: `pollon-cashier-selftest-${stamp}`,
            badgeCount: 1,
            type: 'cashier_order_test',
          }),
          { urgency: 'high', TTL: 3600 },
        );
        webSent += 1;
      } catch (err) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) stale.push(sub.id);
        else lastError = err?.message || String(err);
      }
    }));
    if (stale.length) {
      await admin.from('ep_cashier_push_subscriptions').delete().in('id', stale);
    }
    return res.status(200).json({
      ok: webSent > 0,
      webSent,
      selfTest: true,
      lastError: lastError || undefined,
      error: webSent > 0 ? undefined : (lastError || 'No se pudo entregar el aviso'),
    });
  }

  if (body.remindMe) {
    if (!cashier?.branch_id) return res.status(403).json({ error: 'No eres cajera de una sucursal' });
    const reminded = await notifyCashiersForPendingOrders(admin, { branchId: cashier.branch_id });
    return res.status(200).json({ ...reminded, remindMe: true, notices: reminded.notices || [] });
  }

  const orderId = String(body.orderId || body.order_id || '').trim();
  if (!orderId) return res.status(400).json({ error: 'orderId requerido' });
  if (!cashier && !isStaff) {
    return res.status(403).json({ error: 'Sin permiso' });
  }
  const pushed = await notifyCashiersForOrder(admin, orderId);
  return res.status(200).json(pushed);
}
