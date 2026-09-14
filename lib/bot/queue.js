/** FASE 13–15: drenar bot_notification_queue → WhatsAppProvider */

import { writeLog } from './context.js';
import { buildQueueMessage } from './orderNotify.js';
import { getWhatsAppProvider } from './provider.js';

function backoffMs(attempts) {
  const n = Math.min(Math.max(Number(attempts) || 1, 1), 8);
  return Math.min(30 * 60 * 1000, (2 ** n) * 30 * 1000);
}

export async function dispatchQueue(admin, { orderId = null, limit = 15 } = {}) {
  let q = admin
    .from('bot_notification_queue')
    .select('*')
    .in('status', ['pending', 'processing'])
    .lte('next_attempt_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(limit);
  if (orderId) q = q.eq('order_id', String(orderId));
  const { data: rows, error } = await q;
  if (error) throw error;
  const results = [];
  for (const row of rows || []) {
    results.push(await dispatchOne(admin, row));
  }
  return { ok: true, processed: results.length, results };
}

export async function dispatchOne(admin, row) {
  const attempts = Number(row.attempts) || 0;
  await admin.from('bot_notification_queue').update({
    status: 'processing',
    attempts: attempts + 1,
    next_attempt_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
  }).eq('id', row.id);

  const built = await buildQueueMessage(admin, row);
  if (!built.ok) {
    const failed = built.error === 'order_not_found' || attempts + 1 >= (row.max_attempts || 5);
    await finishRow(admin, row, {
      status: failed ? 'failed' : 'pending',
      last_error: built.error || built.skipped || 'build_failed',
      attempts: attempts + 1,
    });
    return { id: row.id, ok: false, error: built.error || built.skipped };
  }

  const provider = await getWhatsAppProvider({ admin, branchId: built.order?.branchId || row.branch_id });
  if (!provider.configured) {
    await admin.from('bot_notification_queue').update({
      status: 'pending',
      attempts, // no quemar reintentos si Evolution aún no está
      last_error: 'provider_not_configured',
      next_attempt_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }).eq('id', row.id);
    await writeLog(admin, {
      level: 'warning',
      eventType: 'notify_no_provider',
      message: row.event_key || row.order_id,
      orderId: row.order_id,
      branchId: row.branch_id,
    });
    return { id: row.id, ok: false, skipped: 'provider_not_configured' };
  }

  try {
    const sent = await provider.sendText(built.phone, built.text);
    if (!sent?.ok) throw new Error(sent?.error || sent?.skipped || 'send_failed');
    await finishRow(admin, row, { status: 'sent', last_error: null, attempts: attempts + 1 });
    if (row.event_key) {
      await admin.from('bot_events').update({
        status: 'sent',
        processed: true,
        processed_at: new Date().toISOString(),
      }).eq('event_key', row.event_key);
    }
    await writeLog(admin, {
      level: 'info',
      eventType: row.type || 'order_notify',
      message: `${row.event_key || row.order_id} sent`,
      orderId: row.order_id,
      branchId: row.branch_id,
      metadata: { provider: provider.name, instance: provider.instance },
    });
    return { id: row.id, ok: true, provider: provider.name };
  } catch (err) {
    const msg = String(err?.message || err).slice(0, 400);
    const max = Number(row.max_attempts) || 5;
    const nextAttempts = attempts + 1;
    const failed = nextAttempts >= max;
    await finishRow(admin, row, {
      status: failed ? 'failed' : 'pending',
      last_error: msg,
      attempts: nextAttempts,
      next_attempt_at: new Date(Date.now() + backoffMs(nextAttempts)).toISOString(),
    });
    if (row.event_key && failed) {
      await admin.from('bot_events').update({
        status: 'failed',
        last_error: msg,
        attempts: nextAttempts,
      }).eq('event_key', row.event_key);
    }
    await writeLog(admin, {
      level: 'error',
      eventType: 'notify_send_error',
      message: msg,
      orderId: row.order_id,
      branchId: row.branch_id,
    });
    return { id: row.id, ok: false, error: msg };
  }
}

async function finishRow(admin, row, { status, last_error, attempts, next_attempt_at }) {
  const patch = {
    status,
    last_error: last_error || null,
    attempts,
  };
  if (status === 'sent') patch.sent_at = new Date().toISOString();
  if (next_attempt_at) patch.next_attempt_at = next_attempt_at;
  await admin.from('bot_notification_queue').update(patch).eq('id', row.id);
}
