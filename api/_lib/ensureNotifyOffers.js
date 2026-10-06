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

/** En el panel, "Nuevo" es pedidos.estado = pendiente. */
export const NUEVO_PEDIDO_ESTADOS = new Set(['pendiente', 'nuevo']);

export function sameBranchId(a, b) {
  if (a == null || b == null || a === '' || b === '') return false;
  return String(a) === String(b);
}

export async function resolveJobBranchId(admin, job) {
  if (job?.branch_id) return job.branch_id;
  const oid = job?.source_order_id;
  if (!admin || !oid) return null;
  const { data } = await admin
    .from('pedidos')
    .select('branch_id')
    .eq('id', String(oid))
    .maybeSingle();
  return data?.branch_id || null;
}

export async function mapDriverBranchIds(admin, drivers) {
  const list = drivers || [];
  const missing = [...new Set(list.filter((d) => !d.preferred_branch_id && d.profile_id).map((d) => d.profile_id))];
  let byProfile = {};
  if (missing.length) {
    const { data } = await admin.from('profiles').select('id, branch_id').in('id', missing);
    byProfile = Object.fromEntries((data || []).map((p) => [p.id, p.branch_id || null]));
  }
  return new Map(list.map((d) => [d.id, d.preferred_branch_id || byProfile[d.profile_id] || null]));
}

export async function expireCrossBranchPendingOffers(admin, { jobId } = {}) {
  if (!admin) return 0;
  let q = admin
    .from('ep_delivery_offers')
    .select('id, driver_id, ep_delivery_jobs(branch_id, source_order_id)')
    .eq('status', 'pending')
    .limit(500);
  if (jobId) q = q.eq('job_id', jobId);
  const { data: offers } = await q;
  if (!offers?.length) return 0;

  const driverIds = [...new Set(offers.map((o) => o.driver_id).filter(Boolean))];
  const { data: drivers } = await admin
    .from('ep_driver_profiles')
    .select('id, preferred_branch_id, profile_id')
    .in('id', driverIds);
  const branchByDriver = await mapDriverBranchIds(admin, drivers || []);

  const needPedido = [...new Set(
    offers
      .filter((o) => !o.ep_delivery_jobs?.branch_id)
      .map((o) => o.ep_delivery_jobs?.source_order_id)
      .filter(Boolean)
      .map(String),
  )];
  let pedidoBranch = {};
  if (needPedido.length) {
    const { data } = await admin.from('pedidos').select('id, branch_id').in('id', needPedido);
    pedidoBranch = Object.fromEntries((data || []).map((p) => [String(p.id), p.branch_id || null]));
  }

  const wrong = [];
  for (const o of offers) {
    const jobBranch = o.ep_delivery_jobs?.branch_id
      || pedidoBranch[String(o.ep_delivery_jobs?.source_order_id || '')]
      || null;
    const drvBranch = branchByDriver.get(o.driver_id) || null;
    if (!sameBranchId(jobBranch, drvBranch)) wrong.push(o.id);
  }
  if (!wrong.length) return 0;
  const { error } = await admin
    .from('ep_delivery_offers')
    .update({ status: 'expired', responded_at: new Date().toISOString() })
    .in('id', wrong);
  return error ? 0 : wrong.length;
}

export async function jobIsNuevoUnassigned(admin, jobId) {
  if (!admin || !jobId) return { ok: false, reason: 'missing' };
  const { data: job } = await admin
    .from('ep_delivery_jobs')
    .select('id, status, assigned_driver_id, source_order_id, ticket_code, customer_address, delivery_fee, branch_id')
    .eq('id', jobId)
    .maybeSingle();
  if (!job) return { ok: false, reason: 'job_missing' };
  if (job.assigned_driver_id) return { ok: false, reason: 'assigned', job };
  if (CLOSED_JOB.has(job.status)) return { ok: false, reason: 'job_closed', job, status: job.status };
  if (!job.source_order_id) return { ok: false, reason: 'no_order', job };
  const { data: pedido } = await admin
    .from('pedidos')
    .select('id, estado, tipo_entrega')
    .eq('id', String(job.source_order_id))
    .maybeSingle();
  if (!pedido) return { ok: false, reason: 'pedido_missing', job };
  if (String(pedido.tipo_entrega || 'delivery') !== 'delivery') {
    return { ok: false, reason: 'not_delivery', job, pedido };
  }
  const estado = String(pedido.estado || '').toLowerCase();
  if (!NUEVO_PEDIDO_ESTADOS.has(estado)) {
    return { ok: false, reason: 'not_nuevo', job, pedido, estado };
  }
  return { ok: true, job, pedido };
}

export async function ensureNotifyEligibleOffers(admin, jobId) {
  if (!admin || !jobId) return { added: 0, reason: 'missing' };

  const gate = await jobIsNuevoUnassigned(admin, jobId);
  if (!gate.ok) return { added: 0, reason: gate.reason, status: gate.status, estado: gate.estado };
  const job = gate.job;
  const jobBranch = await resolveJobBranchId(admin, job);
  if (job.branch_id == null && jobBranch) {
    await admin.from('ep_delivery_jobs').update({ branch_id: jobBranch }).eq('id', jobId).is('branch_id', null);
    job.branch_id = jobBranch;
  }
  if (!jobBranch) {
    return { added: 0, reason: 'sin_sucursal' };
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
    .select('id, admin_status, operational_status, preferred_branch_id, profile_id')
    .in('id', driverIds)
    .eq('admin_status', 'approved');
  if (drvErr) return { added: 0, reason: drvErr.message };

  const branchByDriver = await mapDriverBranchIds(admin, drivers || []);
  const eligible = (drivers || []).filter((d) => {
    if (BLOCKED_STATUS.has(d.operational_status)) return false;
    return sameBranchId(branchByDriver.get(d.id), jobBranch);
  });
  await expireCrossBranchPendingOffers(admin, { jobId });
  if (!eligible.length) {
    return { added: 0, reason: 'otra_sucursal', scanned: driverIds.length, branch_id: jobBranch };
  }

  const { data: existing } = await admin
    .from('ep_delivery_offers')
    .select('id, driver_id, status')
    .eq('job_id', jobId);

  const skip = new Set();
  const toRevive = [];
  for (const row of existing || []) {
    if (!row?.driver_id) continue;
    if (row.status === 'rejected' || row.status === 'accepted' || row.status === 'pending') {
      skip.add(row.driver_id);
    } else if (row.status === 'expired' || row.status === 'taken_by_other') {
      toRevive.push(row);
    } else {
      skip.add(row.driver_id);
    }
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const eligibleIds = new Set(eligible.map((d) => d.id));
  const reviveRows = toRevive.filter((row) => eligibleIds.has(row.driver_id));
  let revived = 0;
  if (reviveRows.length) {
    const { error: upErr } = await admin
      .from('ep_delivery_offers')
      .update({
        status: 'pending',
        offered_fee: job.delivery_fee || 0,
        expires_at: expiresAt,
        responded_at: null,
      })
      .in('id', reviveRows.map((r) => r.id));
    if (!upErr) {
      revived = reviveRows.length;
      reviveRows.forEach((r) => skip.add(r.driver_id));
    }
  }

  const rows = eligible
    .filter((d) => !skip.has(d.id))
    .map((d) => ({
      job_id: jobId,
      driver_id: d.id,
      status: 'pending',
      offered_fee: job.delivery_fee || 0,
      expires_at: expiresAt,
      responded_at: null,
    }));

  if (!rows.length && !revived) {
    return { added: 0, revived: 0, reason: skip.size ? 'ya_existentes' : 'ya_aceptado', existing: skip.size };
  }

  if (rows.length) {
    const { error: insErr } = await admin.from('ep_delivery_offers').insert(rows);
    if (insErr && !String(insErr.message || '').toLowerCase().includes('duplicate')) {
      return { added: 0, revived, reason: insErr.message };
    }
  }

  if (job.status !== 'offered') {
    await admin
      .from('ep_delivery_jobs')
      .update({
        status: 'offered',
        offered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }

  return { added: rows.length, revived, reason: 'ok' };
}

export async function listOpenNotifyJobIds(admin, { hours = 18, limit = 40 } = {}) {
  if (!admin) return [];
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const { data: peds, error } = await admin
    .from('pedidos')
    .select('id')
    .eq('tipo_entrega', 'delivery')
    .in('estado', ['pendiente', 'nuevo'])
    .gte('creado_en', since)
    .order('creado_en', { ascending: false })
    .limit(limit);
  const orderIds = error ? [] : (peds || []).map((p) => p.id).filter(Boolean);
  if (!orderIds.length) return [];
  const { data: jobs } = await admin
    .from('ep_delivery_jobs')
    .select('id')
    .in('source_order_id', orderIds)
    .is('assigned_driver_id', null);
  return [...new Set((jobs || []).map((row) => row.id).filter(Boolean))];
}

/** Pedidos delivery en Nuevo/pendiente → crea job aunque el panel de cocina esté cerrado. */
export async function ensureJobsFromPendingPedidos(admin, { hours = 18, limit = 8 } = {}) {
  if (!admin) return [];
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  let rows = [];
  const first = await admin
    .from('pedidos')
    .select('id')
    .eq('tipo_entrega', 'delivery')
    .in('estado', ['pendiente', 'nuevo'])
    .gte('creado_en', since)
    .order('creado_en', { ascending: false })
    .limit(limit);
  if (first.error) {
    const fallback = await admin
      .from('pedidos')
      .select('id')
      .eq('tipo_entrega', 'delivery')
      .in('estado', ['pendiente', 'nuevo'])
      .order('id', { ascending: false })
      .limit(limit);
    rows = fallback.data || [];
  } else {
    rows = first.data || [];
  }
  const ids = [];
  for (const row of rows) {
    if (!row?.id) continue;
    const { data: upserted } = await admin.rpc('ep_upsert_job_from_pedido', { p_order_id: String(row.id) });
    const jobId = unwrapJobId(upserted);
    if (jobId) ids.push(jobId);
  }
  return ids;
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

/** Tras entregar: ofertas pending de este chofer para pedidos nuevos sin asignar. */
export async function refreshOffersForDriver(admin, driverId) {
  if (!admin || !driverId) return { ok: false, revived: 0, inserted: 0, reason: 'missing' };

  const rpc = await admin.rpc('ep_refresh_open_offers_for_driver', { p_driver_id: driverId });
  await expireCrossBranchPendingOffers(admin).catch(() => 0);
  if (!rpc.error && rpc.data) {
    return { ok: true, ...(typeof rpc.data === 'object' ? rpc.data : { revived: 0 }), via: 'rpc' };
  }

  const { data: driver } = await admin
    .from('ep_driver_profiles')
    .select('id, preferred_branch_id, operational_status, admin_status, profile_id')
    .eq('id', driverId)
    .maybeSingle();
  if (!driver || driver.admin_status !== 'approved') {
    return { ok: false, revived: 0, inserted: 0, reason: 'driver' };
  }
  if (['offline', 'blocked', 'paused', 'delivering'].includes(driver.operational_status)) {
    return { ok: true, revived: 0, inserted: 0, reason: 'not_eligible' };
  }
  const branchMap = await mapDriverBranchIds(admin, [driver]);
  const driverBranch = branchMap.get(driver.id);

  const { count: activeCount } = await admin
    .from('ep_delivery_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('driver_id', driverId)
    .eq('status', 'active');
  if ((Number(activeCount) || 0) > 0) {
    const { count: picked } = await admin
      .from('ep_delivery_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .eq('status', 'active')
      .in('phase', ['to_customer', 'done']);
    if ((Number(picked) || 0) > 0) {
      return { ok: true, revived: 0, inserted: 0, reason: 'carrying' };
    }
  }

  const fromPedidos = await ensureJobsFromPendingPedidos(admin, { hours: 18, limit: 12 }).catch(() => []);
  const listed = await listOpenNotifyJobIds(admin, { hours: 18, limit: 40 }).catch(() => []);
  const jobIds = [...new Set([
    ...(fromPedidos || []).map((id) => unwrapJobId(id)),
    ...(listed || []).map((id) => unwrapJobId(id)),
  ].filter(Boolean))];

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  let revived = 0;
  let inserted = 0;

  for (const jobId of jobIds) {
    const gate = await jobIsNuevoUnassigned(admin, jobId);
    if (!gate.ok) continue;
    const job = gate.job;
    const jobBranch = await resolveJobBranchId(admin, job);
    if (!sameBranchId(jobBranch, driverBranch)) {
      continue;
    }

    const { data: existing } = await admin
      .from('ep_delivery_offers')
      .select('id, status')
      .eq('job_id', jobId)
      .eq('driver_id', driverId)
      .maybeSingle();

    if (existing?.status === 'rejected' || existing?.status === 'accepted') continue;

    if (existing) {
      if (existing.status !== 'pending') {
        const { error } = await admin
          .from('ep_delivery_offers')
          .update({
            status: 'pending',
            offered_fee: job.delivery_fee || 0,
            expires_at: expiresAt,
            responded_at: null,
          })
          .eq('id', existing.id);
        if (!error) revived += 1;
      }
    } else {
      const { error } = await admin.from('ep_delivery_offers').insert({
        job_id: jobId,
        driver_id: driverId,
        status: 'pending',
        offered_fee: job.delivery_fee || 0,
        expires_at: expiresAt,
        responded_at: null,
      });
      if (!error) inserted += 1;
    }

    if (job.status !== 'offered') {
      await admin
        .from('ep_delivery_jobs')
        .update({
          status: 'offered',
          offered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .is('assigned_driver_id', null);
    }
  }

  return { ok: true, revived, inserted, jobs: jobIds.length, via: 'js' };
}
