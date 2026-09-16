/**
 * Reaviso de ofertas sin aceptar + push (FCM / Web Push).
 */
import { ensureNotifyEligibleOffers, listOpenNotifyJobIds } from './ensureNotifyOffers.js';
import { sendPushesForJob } from './sendJobPushes.js';

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
  const openIds = await listOpenNotifyJobIds(admin).catch(() => []);
  // Los pedidos nuevos primero: si hay muchos abiertos, el pollito no se quedaba sin el aviso de hoy.
  jobIds = [...new Set([...openIds, ...jobIds])];

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

  let fcmSent = 0;
  let webSent = 0;
  for (const jobId of jobIds.slice(0, 16)) {
    await ensureNotifyEligibleOffers(admin, jobId).catch(() => null);
    const sent = await sendPushesForJob(admin, jobId);
    fcmSent += Number(sent?.fcmSent) || 0;
    webSent += Number(sent?.webSent) || 0;
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
