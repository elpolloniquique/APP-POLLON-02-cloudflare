/**
 * Avisos Web Push a cajeras de LA sucursal del pedido (estado Nuevo).
 */
import { createClient } from '@supabase/supabase-js';
import { env } from './_lib/fcmSend.js';
import {
  cashierNoticeText,
  findCashierProfileForAuthUser,
  notifyCashiersForOrder,
  notifyCashiersForPendingOrders,
  vapidPair,
} from './_lib/sendCashierPushes.js';
import { sendWebPushNotification, setWebPushVapid } from './_lib/webPushSend.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });

  const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ ok: false, error: 'supabase' });
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const cronSecret = env('CRON_SECRET');
  const cronOk = Boolean(cronSecret) && (
    token === cronSecret
    || req.headers['x-cron-secret'] === cronSecret
    || req.query?.secret === cronSecret
  );

  let cashier = null;
  if (token && !cronOk) {
    const anon = env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
    if (anon) {
      const userClient = createClient(supabaseUrl, anon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data } = await userClient.auth.getUser(token);
      const uid = data?.user?.id;
      if (uid) cashier = await findCashierProfileForAuthUser(admin, uid);
    }
  }

  if (!cronOk && !cashier && !body.orderId) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  if (body.selfTest) {
    if (!cashier) return res.status(401).json({ ok: false, error: 'unauthorized' });
    const { data: subs } = await admin
      .from('ep_cashier_push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('profile_id', cashier.id)
      .limit(3);
    const { vapidPublic, vapidPrivate, vapidSubject } = vapidPair();
    if (!vapidPublic || !vapidPrivate) {
      return res.status(200).json({ ok: true, webSent: 0, reason: 'vapid' });
    }
    setWebPushVapid(vapidSubject, vapidPublic, vapidPrivate);
    let webSent = 0;
    const notice = cashierNoticeText({
      codigo_pedido: '000000',
      cliente_direccion: 'Prueba de avisos de caja',
      tipo_entrega: 'delivery',
      id: 'self-test',
    });
    await Promise.all((subs || []).map(async (sub) => {
      try {
        await sendWebPushNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: notice.title,
            body: notice.body,
            url: '/admin/pedidos',
            type: 'cashier_new_order',
            tag: 'pollon-cashier-test',
          }),
        );
        webSent += 1;
      } catch {
        /* ignore */
      }
    }));
    return res.status(200).json({ ok: true, selfTest: true, webSent });
  }

  if (body.remindMe) {
    if (!cashier?.branch_id) return res.status(401).json({ ok: false, error: 'unauthorized' });
    const reminded = await notifyCashiersForPendingOrders(admin, { branchId: cashier.branch_id });
    return res.status(200).json({ ...reminded, remindMe: true });
  }

  if (!body.orderId) {
    return res.status(400).json({ ok: false, error: 'orderId' });
  }
  const result = await notifyCashiersForOrder(admin, body.orderId);
  return res.status(200).json(result);
}
