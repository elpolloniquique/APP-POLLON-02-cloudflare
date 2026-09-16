/**
 * Envía FCM + Web Push a las ofertas pending de un job.
 * Un solo camino para pedido nuevo, reasignar y cron.
 */
import { sendFcm, isFcmConfigured, env } from './fcmSend.js';
import { setWebPushVapid, sendWebPushNotification, cleanVapidKey } from './webPushSend.js';
import { ensureNotifyEligibleOffers, unwrapJobId, listOpenNotifyJobIds } from './ensureNotifyOffers.js';

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

function vapidPair() {
  const vapidPublic = cleanVapidKey(env('EP_WEB_PUSH_PUBLIC_KEY', 'VITE_VAPID_PUBLIC_KEY', 'VAPID_PUBLIC_KEY'));
  const vapidPrivate = cleanVapidKey(env('VAPID_PRIVATE_KEY'));
  const vapidSubject = String(env('VAPID_SUBJECT') || 'mailto:contacto@el-pollon.cl').trim();
  return { vapidPublic, vapidPrivate, vapidSubject };
}

export async function sendPushesForJob(admin, jobId) {
  if (!admin || !jobId) {
    return { ok: false, sent: 0, fcmSent: 0, webSent: 0, offers: 0, reason: 'missing' };
  }

  let ensured = { added: 0 };
  try {
    ensured = await ensureNotifyEligibleOffers(admin, jobId);
  } catch (err) {
    ensured = { added: 0, reason: err?.message || 'ensure_failed' };
  }

  const { data: offers, error: offersErr } = await admin
    .from('ep_delivery_offers')
    .select('id, driver_id, offered_fee, ep_delivery_jobs(ticket_code, customer_name, customer_address, order_total, delivery_fee)')
    .eq('job_id', jobId)
    .eq('status', 'pending');

  if (offersErr) {
    return {
      ok: false, sent: 0, fcmSent: 0, webSent: 0, offers: 0, ensured, reason: offersErr.message,
    };
  }
  if (!offers?.length) {
    return {
      ok: true, sent: 0, fcmSent: 0, webSent: 0, offers: 0, ensured,
      reason: ensured?.reason || 'sin ofertas pendientes',
    };
  }

  const driverIds = [...new Set(offers.map((o) => o.driver_id).filter(Boolean))];
  const byDriver = Object.fromEntries(offers.map((o) => [o.driver_id, o]));
  const pendingByDriver = {};
  for (const o of offers) {
    if (!o.driver_id) continue;
    pendingByDriver[o.driver_id] = (pendingByDriver[o.driver_id] || 0) + 1;
  }

  const hasFcm = isFcmConfigured();
  const { vapidPublic, vapidPrivate, vapidSubject } = vapidPair();
  let fcmSent = 0;
  let webSent = 0;
  let lastWebError = '';
  const staleWeb = [];
  const staleFcm = [];
  const stamp = Date.now();
  const sampleOffer = offers[0];
  const sampleJob = sampleOffer?.ep_delivery_jobs || {};

  // Web Push PRIMERO: la nativa ya llega por FCM; si el worker se queda corto, el pollito no avisaba.
  if (vapidPublic && vapidPrivate) {
    setWebPushVapid(vapidSubject, vapidPublic, vapidPrivate);
    const { data: subs } = await admin
      .from('ep_driver_push_subscriptions')
      .select('id, driver_id, endpoint, p256dh, auth');
    await Promise.all((subs || []).map(async (sub) => {
      const offer = byDriver[sub.driver_id] || sampleOffer;
      const job = offer?.ep_delivery_jobs || sampleJob;
      const fee = offer?.offered_fee ?? job.delivery_fee ?? 0;
      const ticket = ticketShort(job.ticket_code);
      const name = job.customer_name || 'Cliente';
      const addr = String(job.customer_address || '').slice(0, 120);
      const badgeCount = Math.max(1, Number(pendingByDriver[sub.driver_id]) || offers.length || 1);
      try {
        await sendWebPushNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: 'El Pollón · Nuevo pedido',
            body: [`Pedido Nº ${ticket}`, name, addr || null, `Delivery ${moneyCLP(fee)}`, 'Acepta en app nativa']
              .filter(Boolean).join(' · '),
            url: '/repartidor',
            offerId: offer?.id || null,
            jobId,
            tag: `pollon-job-${jobId}-${stamp}`,
            badgeCount,
            type: 'driver_offer',
            renotify: true,
          }),
          { urgency: 'high', TTL: 86400 },
        );
        webSent += 1;
      } catch (err) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) staleWeb.push(sub.id);
        else lastWebError = err?.message || String(err);
      }
    }));
    if (staleWeb.length) {
      await admin.from('ep_driver_push_subscriptions').delete().in('id', staleWeb);
    }
  }

  if (hasFcm) {
    const { data: fcmRows } = await admin
      .from('ep_driver_fcm_tokens')
      .select('id, driver_id, token')
      .in('driver_id', driverIds);
    await Promise.all((fcmRows || []).map(async (row) => {
      const offer = byDriver[row.driver_id];
      if (!offer) return;
      const job = offer.ep_delivery_jobs || {};
      const fee = offer.offered_fee ?? job.delivery_fee ?? 0;
      const ticket = ticketShort(job.ticket_code);
      const name = job.customer_name || 'Cliente';
      const addr = job.customer_address || '';
      const badgeCount = Math.max(1, Number(pendingByDriver[row.driver_id]) || 1);
      try {
        const result = await sendFcm(row.token, {
          title: 'El Pollón · Pedido nuevo',
          body: [`Nº ${ticket}`, name, addr || null, `Delivery ${moneyCLP(fee)}`, 'Acepta en app nativa']
            .filter(Boolean).join(' · '),
          data: {
            type: 'driver_offer',
            offerId: String(offer.id),
            jobId: String(jobId),
            deepLink: '/repartidor',
            url: '/repartidor',
            tag: `pollon-job-${jobId}-${stamp}`,
            badgeCount: String(badgeCount),
            ticket,
            customerName: name,
            address: addr,
            fee: String(fee),
          },
        });
        if (result.ok) fcmSent += 1;
        else if (result.notRegistered) staleFcm.push(row.id);
      } catch (err) {
        console.warn('[Pollón] FCM send:', err?.message || err);
      }
    }));
    if (staleFcm.length) {
      await admin.from('ep_driver_fcm_tokens').delete().in('id', staleFcm);
    }
  }

  return {
    ok: webSent + fcmSent > 0,
    sent: fcmSent + webSent,
    fcmSent,
    webSent,
    offers: offers.length,
    ensured,
    lastWebError: lastWebError || undefined,
    reason: webSent + fcmSent > 0 ? 'ok' : (lastWebError || 'push_zero'),
  };
}

export async function notifyDeliveryOrder(admin, orderId) {
  if (!admin || !orderId) return { skipped: true, reason: 'missing' };

  const { data: pedido } = await admin
    .from('pedidos')
    .select('id, tipo_entrega, estado')
    .eq('id', String(orderId))
    .maybeSingle();
  if (!pedido) return { ok: false, reason: 'pedido_missing' };
  if (String(pedido.tipo_entrega || 'delivery') !== 'delivery') {
    return { skipped: true, reason: 'not_delivery' };
  }
  if (['cancelado', 'entregado'].includes(pedido.estado)) {
    return { skipped: true, reason: 'closed' };
  }

  const { data: upserted, error } = await admin.rpc('ep_upsert_job_from_pedido', {
    p_order_id: String(orderId),
  });
  let jobId = unwrapJobId(upserted);
  if (!jobId) {
    const { data: job } = await admin
      .from('ep_delivery_jobs')
      .select('id')
      .eq('source_order_id', String(orderId))
      .maybeSingle();
    jobId = job?.id || '';
  }
  if (!jobId) {
    return { ok: false, reason: error?.message || 'no_job' };
  }

  const pushed = await sendPushesForJob(admin, jobId);
  return { ...pushed, jobId };
}

/** Reaviso solo al pollito de este repartidor (cada ~1 min hasta que alguien acepte). */
export async function remindDriverWebPush(admin, driverId) {
  if (!admin || !driverId) return { ok: false, webSent: 0, reason: 'missing' };
  const { vapidPublic, vapidPrivate, vapidSubject } = vapidPair();
  if (!vapidPublic || !vapidPrivate) {
    return { ok: false, webSent: 0, reason: 'vapid' };
  }
  const { data: subs } = await admin
    .from('ep_driver_push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('driver_id', driverId);
  if (!subs?.length) return { ok: false, webSent: 0, reason: 'sin_suscripcion' };

  const jobIds = await listOpenNotifyJobIds(admin, { hours: 18, limit: 8 });
  if (!jobIds.length) return { ok: true, webSent: 0, jobs: 0, reason: 'sin_pedidos_abiertos' };

  setWebPushVapid(vapidSubject, vapidPublic, vapidPrivate);
  let webSent = 0;
  let lastError = '';
  const stamp = Date.now();
  for (const jobId of jobIds) {
    await ensureNotifyEligibleOffers(admin, jobId).catch(() => null);
    const { data: job } = await admin
      .from('ep_delivery_jobs')
      .select('ticket_code, customer_name, customer_address, delivery_fee, assigned_driver_id')
      .eq('id', jobId)
      .maybeSingle();
    if (!job || job.assigned_driver_id) continue;
    const ticket = ticketShort(job.ticket_code);
    const name = job.customer_name || 'Cliente';
    const addr = String(job.customer_address || '').slice(0, 120);
    const body = [`Pedido Nº ${ticket}`, name, addr || null, 'Acepta en app nativa'].filter(Boolean).join(' · ');
    await Promise.all(subs.map(async (sub) => {
      try {
        await sendWebPushNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: 'El Pollón · Nuevo pedido',
            body,
            url: '/repartidor',
            jobId,
            tag: `pollon-job-${jobId}-${stamp}`,
            badgeCount: jobIds.length,
            type: 'driver_offer',
            renotify: true,
          }),
          { urgency: 'high', TTL: 120 },
        );
        webSent += 1;
      } catch (err) {
        lastError = err?.message || String(err);
      }
    }));
  }
  return {
    ok: webSent > 0,
    webSent,
    jobs: jobIds.length,
    lastError: lastError || undefined,
    reason: webSent > 0 ? 'ok' : (lastError || 'push_zero'),
  };
}
