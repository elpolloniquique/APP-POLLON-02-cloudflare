/**
 * Crea ofertas pending para repartidores con avisos (PWA / FCM)
 * aunque no tengan GPS fresco. La búsqueda SQL sigue exigiendo GPS
 * para la app nativa; sin esto el pollito nunca recibe el pedido real.
 */

const CLOSED_JOB = new Set([
  'delivered',
  'cancelled',
  'assigned',
  'heading_to_branch',
  'picked_up',
  'delivering',
]);

const BLOCKED_STATUS = new Set(['blocked', 'paused']);

export async function ensureNotifyEligibleOffers(admin, jobId) {
  if (!admin || !jobId) return { added: 0, reason: 'missing' };

  const { data: job, error: jobErr } = await admin
    .from('ep_delivery_jobs')
    .select('id, status, branch_id, delivery_fee, assigned_driver_id')
    .eq('id', jobId)
    .maybeSingle();
  if (jobErr) return { added: 0, reason: jobErr.message };
  if (!job) return { added: 0, reason: 'job_missing' };
  if (job.assigned_driver_id || CLOSED_JOB.has(job.status)) {
    return { added: 0, reason: 'job_not_open', status: job.status };
  }

  const [{ data: subs }, { data: fcmRows }] = await Promise.all([
    admin.from('ep_driver_push_subscriptions').select('driver_id'),
    admin.from('ep_driver_fcm_tokens').select('driver_id'),
  ]);

  const driverIds = [...new Set([
    ...(subs || []).map((s) => s.driver_id),
    ...(fcmRows || []).map((s) => s.driver_id),
  ].filter(Boolean))];

  if (!driverIds.length) return { added: 0, reason: 'sin_suscripciones' };

  const { data: drivers, error: drvErr } = await admin
    .from('ep_driver_profiles')
    .select('id, admin_status, operational_status, preferred_branch_id')
    .in('id', driverIds)
    .eq('admin_status', 'approved');
  if (drvErr) return { added: 0, reason: drvErr.message };

  const eligible = (drivers || []).filter((d) => {
    if (BLOCKED_STATUS.has(d.operational_status)) return false;
    return true;
  });
  if (!eligible.length) {
    return { added: 0, reason: 'ningun_repartidor_avisos', scanned: driverIds.length };
  }

  const { data: existing } = await admin
    .from('ep_delivery_offers')
    .select('driver_id, status')
    .eq('job_id', jobId);
  const accepted = new Set(
    (existing || []).filter((o) => o.status === 'accepted').map((o) => o.driver_id),
  );

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const rows = eligible
    .filter((d) => !accepted.has(d.id))
    .map((d) => ({
      job_id: jobId,
      driver_id: d.id,
      status: 'pending',
      offered_fee: job.delivery_fee || 0,
      expires_at: expiresAt,
      responded_at: null,
    }));

  if (!rows.length) return { added: 0, reason: 'ya_aceptado' };

  const { error: upErr } = await admin
    .from('ep_delivery_offers')
    .upsert(rows, { onConflict: 'job_id,driver_id' });
  if (upErr) return { added: 0, reason: upErr.message };

  await admin
    .from('ep_delivery_jobs')
    .update({
      status: 'offered',
      offered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  return { added: rows.length, reason: 'ok' };
}

const OPEN_JOB_STATUS = ['pending_prep', 'searching_driver', 'offered', 'ready_for_dispatch'];

export async function listOpenNotifyJobIds(admin, { hours = 18, limit = 40 } = {}) {
  if (!admin) return [];
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const { data } = await admin
    .from('ep_delivery_jobs')
    .select('id')
    .is('assigned_driver_id', null)
    .in('status', OPEN_JOB_STATUS)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);
  return [...new Set((data || []).map((row) => row.id).filter(Boolean))];
}

export function unwrapJobId(value) {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    return String(value.id || value.job_id || value.jobId || '');
  }
  return '';
}

/** profiles.id ≠ auth.users.id. El pollito debe resolverse por auth_user_id. */
export async function findDriverIdForAuthUser(admin, authUserId) {
  if (!admin || !authUserId) return null;
  const { data: byAuth } = await admin
    .from('ep_driver_profiles')
    .select('id')
    .eq('profile_id', authUserId)
    .maybeSingle();
  if (byAuth?.id) return byAuth.id;
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (!profile?.id) return null;
  const { data: byProfile } = await admin
    .from('ep_driver_profiles')
    .select('id')
    .eq('profile_id', profile.id)
    .maybeSingle();
  return byProfile?.id || null;
}
