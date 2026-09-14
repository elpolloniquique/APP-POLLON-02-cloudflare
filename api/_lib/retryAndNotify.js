/**
 * Reaviso de ofertas sin aceptar + push (FCM / Web Push).
 * Tag estable pollon-job-{id} → actualiza, no duplica.
 * Usado por cron Vercel y por GPS ping nativo (Hobby no permite cron cada 1 min).
 */
import webpush from 'web-push';
import { env, sendFcm, isFcmConfigured } from './fcmSend.js';

function ticketShort(code) {
  const s = String(code || '').replace(/^0+/, '');
  return s || String(code || '—');
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

let lastRunAt = 0;
const MIN_INTERVAL_MS = 55_000;

export async function retryAndNotifyOffers(admin, { force = false } = {}) {
  const now = Date.now();
  if (!force && now - lastRunAt < MIN_INTERVAL_MS) {
    return { ok: true, skipped: true, reason: 'throttle' };
  }
  lastRunAt = now;

  const { data, error } = await admin.rpc('ep_retry_stale_driver_searches');
  if (error) {
    return { ok: false, error: error.message };
  }

  let jobIds = [...(data?.job_ids || [])].filter(Boolean);

  // Respaldo: si el RPC no listó jobs (TTL viejo / offered_at), igual avisar ofertas pending
  if (!jobIds.length) {
    const { data: pending } = await admin
      .from('ep_delivery_offers')
      .select('job_id, ep_delivery_jobs(status, assigned_driver_id)')
      .eq('status', 'pending')
      .limit(80);
    const extra = new Set();
    for (const row of pending || []) {
      const job = row.ep_delivery_jobs;
      if (!row.job_id || job?.assigned_driver_id) continue;
      extra.add(row.job_id);
    }
    jobIds = [...extra];
  }

  if (!jobIds.length) {
    return { ok: true, retried: data?.retried || 0, job_ids: [], pushed: 0 };
  }

  const vapidPublic = env('VITE_VAPID_PUBLIC_KEY', 'VAPID_PUBLIC_KEY');
  const vapidPrivate = env('VAPID_PRIVATE_KEY');
  const vapidSubject = env('VAPID_SUBJECT', 'mailto:contacto@el-pollon.cl');
  const hasFcm = isFcmConfigured();
  let fcmSent = 0;
  let webSent = 0;
  const staleFcm = [];
  const staleWeb = [];

  for (const jobId of jobIds) {
    const { data: offers } = await admin
      .from('ep_delivery_offers')
      .select('id, driver_id, offered_fee, ep_delivery_jobs(ticket_code, customer_name, customer_address, delivery_fee)')
      .eq('job_id', jobId)
      .eq('status', 'pending');
    if (!offers?.length) continue;

    const driverIds = [...new Set(offers.map((o) => o.driver_id).filter(Boolean))];
    const byDriver = Object.fromEntries(offers.map((o) => [o.driver_id, o]));

    if (hasFcm) {
      const { data: fcmRows } = await admin
        .from('ep_driver_fcm_tokens')
        .select('id, driver_id, token')
        .in('driver_id', driverIds);
      for (const row of fcmRows || []) {
        const offer = byDriver[row.driver_id];
        if (!offer) continue;
        const job = offer.ep_delivery_jobs || {};
        const fee = offer.offered_fee ?? job.delivery_fee ?? 0;
        const ticket = ticketShort(job.ticket_code);
        const name = job.customer_name || 'Cliente';
        const addr = job.customer_address || '';
        try {
          const result = await sendFcm(row.token, {
            title: 'El Pollón · Nuevo pedido',
            body: [
              `Nº ${ticket}`,
              name,
              addr || null,
              `Delivery ${moneyCLP(fee)}`,
              'Acepta en app nativa',
            ].filter(Boolean).join(' · '),
            data: {
              type: 'driver_offer',
              offerId: String(offer.id),
              jobId: String(jobId),
              deepLink: '/repartidor',
              url: '/repartidor',
              tag: `pollon-job-${jobId}`,
            },
          });
          if (result.ok) fcmSent += 1;
          else if (result.notRegistered) staleFcm.push(row.id);
        } catch (err) {
          console.warn('[Pollón] retry FCM:', err?.message || err);
        }
      }
    }

    if (vapidPublic && vapidPrivate) {
      webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
      const { data: subs } = await admin
        .from('ep_driver_push_subscriptions')
        .select('id, endpoint, p256dh, auth, driver_id')
        .in('driver_id', driverIds);
      for (const sub of subs || []) {
        const offer = byDriver[sub.driver_id];
        if (!offer) continue;
        const job = offer.ep_delivery_jobs || {};
        const fee = offer.offered_fee ?? job.delivery_fee ?? 0;
        const ticket = ticketShort(job.ticket_code);
        const name = job.customer_name || 'Cliente';
        const addr = job.customer_address || '';
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: 'El Pollón · Nuevo pedido',
              body: [
                `Pedido Nº ${ticket}`,
                name,
                addr || null,
                `Delivery ${moneyCLP(fee)}`,
                'Acepta en app nativa',
              ].filter(Boolean).join(' · '),
              address: addr,
              url: '/repartidor',
              offerId: offer.id,
              jobId,
              tag: `pollon-job-${jobId}`,
              badgeCount: 1,
              type: 'driver_offer',
              renotify: true,
            }),
            { urgency: 'high', TTL: 86400 },
          );
          webSent += 1;
        } catch (err) {
          const code = err?.statusCode;
          if (code === 404 || code === 410) staleWeb.push(sub.id);
        }
      }
    }
  }

  if (staleFcm.length) {
    await admin.from('ep_driver_fcm_tokens').delete().in('id', staleFcm);
  }
  if (staleWeb.length) {
    await admin.from('ep_driver_push_subscriptions').delete().in('id', staleWeb);
  }

  return {
    ok: true,
    retried: data?.retried || 0,
    job_ids: jobIds,
    fcmSent,
    webSent,
    pushed: fcmSent + webSent,
  };
}
