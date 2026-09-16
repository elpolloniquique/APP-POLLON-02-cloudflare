/**
 * Reaviso de pedidos en estado Nuevo sin repartidor.
 * Cada ~1 min: Web Push a todos los pollitos hasta que alguien acepte.
 */
import { ensureNotifyEligibleOffers, ensureJobsFromPendingPedidos, unwrapJobId } from './ensureNotifyOffers.js';
import { sendPushesForJob } from './sendJobPushes.js';
import { notifyCashiersForPendingOrders } from './sendCashierPushes.js';

let lastRunAt = 0;
const MIN_INTERVAL_MS = 55_000;

async function markNotifyRun(admin, extra = {}) {
  try {
    await admin.from('ep_internal_secrets').upsert({
      key: 'last_driver_notify_at',
      value: JSON.stringify({ at: new Date().toISOString(), ...extra }),
      updated_at: new Date().toISOString(),
    });
  } catch {
    /* la tabla puede no existir */
  }
}

export async function retryAndNotifyOffers(admin, { force = false } = {}) {
  const now = Date.now();
  if (!force && now - lastRunAt < MIN_INTERVAL_MS) {
    return { ok: true, skipped: true, reason: 'throttle' };
  }
  lastRunAt = now;

  try {
    await admin.rpc('ep_retry_stale_driver_searches');
  } catch {
    /* no bloquear el aviso del pollito */
  }

  const fromPedidos = await ensureJobsFromPendingPedidos(admin, { hours: 18, limit: 8 }).catch(() => []);
  const jobIds = [...new Set((fromPedidos || []).map((id) => unwrapJobId(id)).filter(Boolean))];

  if (!jobIds.length) {
    const cashierRes = await notifyCashiersForPendingOrders(admin).catch(() => null);
    await markNotifyRun(admin, { jobs: 0, webSent: 0, fcmSent: 0, cashierWeb: Number(cashierRes?.webSent) || 0 });
    return {
      ok: true,
      retried: 0,
      job_ids: [],
      pushed: 0,
      webSent: 0,
      fcmSent: 0,
      cashierWeb: Number(cashierRes?.webSent) || 0,
    };
  }

  const [results, cashierRes] = await Promise.all([
    Promise.all(jobIds.map(async (jobId) => {
      await ensureNotifyEligibleOffers(admin, jobId).catch(() => null);
      return sendPushesForJob(admin, jobId);
    })),
    notifyCashiersForPendingOrders(admin).catch(() => null),
  ]);

  let fcmSent = 0;
  let webSent = 0;
  let lastWebError = '';
  for (const sent of results) {
    fcmSent += Number(sent?.fcmSent) || 0;
    webSent += Number(sent?.webSent) || 0;
    if (sent?.lastWebError) lastWebError = sent.lastWebError;
  }

  await markNotifyRun(admin, {
    jobs: jobIds.length,
    webSent,
    fcmSent,
    cashierWeb: Number(cashierRes?.webSent) || 0,
    lastWebError: lastWebError || undefined,
  });

  return {
    ok: true,
    retried: jobIds.length,
    job_ids: jobIds,
    fcmSent,
    webSent,
    cashierWeb: Number(cashierRes?.webSent) || 0,
    lastWebError: lastWebError || undefined,
    pushed: fcmSent + webSent,
  };
}
