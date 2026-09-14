import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { notifyDriversForJob } from './pushService';
import { syncAfterDriverPickup } from './orderStatusSyncService';

const DEMO_JOBS = [
  {
    id: 'demo-job-1',
    source_order_id: 'ord-1',
    ticket_code: '0042',
    status: 'ready_for_dispatch',
    customer_name: 'María González',
    customer_phone: '+56912345678',
    customer_address: 'Av. Arturo Prat 1234, Iquique',
    customer_lat: -20.235,
    customer_lng: -70.145,
    order_total: 24990,
    delivery_fee: 2500,
    payment_method: 'efectivo',
    branch_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-job-2',
    source_order_id: 'ord-2',
    ticket_code: '0043',
    status: 'assigned',
    customer_name: 'Pedro Soto',
    customer_phone: '+56987654321',
    customer_address: 'Calle Baquedano 500, Iquique',
    customer_lat: -20.228,
    customer_lng: -70.148,
    order_total: 18990,
    delivery_fee: 2000,
    payment_method: 'transferencia',
    assigned_driver_id: 'demo-drv-1',
    branch_id: null,
    created_at: new Date().toISOString(),
  },
];

function dayBoundsIso(dateFrom, dateTo) {
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
  return {
    fromIso: from && !Number.isNaN(from.getTime()) ? from.toISOString() : null,
    toIso: to && !Number.isNaN(to.getTime()) ? to.toISOString() : null,
  };
}

export async function listDeliveryJobs({ branchId, status, dateFrom, dateTo, limit = 300 } = {}) {
  const { fromIso, toIso } = dayBoundsIso(dateFrom, dateTo);

  if (!isSupabaseConfigured()) {
    return DEMO_JOBS.filter((j) => {
      if (branchId && j.branch_id && j.branch_id !== branchId) return false;
      if (status && j.status !== status) return false;
      if (fromIso || toIso) {
        const t = new Date(j.created_at).getTime();
        if (fromIso && t < new Date(fromIso).getTime()) return false;
        if (toIso && t > new Date(toIso).getTime()) return false;
      }
      return true;
    });
  }
  const sb = getSupabase();
  let q = sb
    .from('ep_delivery_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 300, 50), 500));
  if (branchId) q = q.eq('branch_id', branchId);
  if (status) q = q.eq('status', status);
  if (fromIso) q = q.gte('created_at', fromIso);
  if (toIso) q = q.lte('created_at', toIso);
  const { data, error } = await q;
  if (error) throw error;

  const rows = data || [];
  const driverIds = [...new Set(rows.map((j) => j.assigned_driver_id).filter(Boolean))];
  if (!driverIds.length) return rows;

  const { data: drivers, error: dErr } = await sb
    .from('ep_driver_profiles')
    .select('id, vehicle_plate, profile_id')
    .in('id', driverIds);
  if (dErr) throw dErr;

  const profileIds = [...new Set((drivers || []).map((d) => d.profile_id).filter(Boolean))];
  let profilesById = {};
  if (profileIds.length) {
    const { data: profiles, error: pErr } = await sb
      .from('profiles')
      .select('id, full_name, phone')
      .in('id', profileIds);
    if (pErr) throw pErr;
    profilesById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  }

  const driversById = Object.fromEntries(
    (drivers || []).map((d) => [
      d.id,
      { id: d.id, vehicle_plate: d.vehicle_plate, profiles: profilesById[d.profile_id] || null },
    ])
  );

  return rows.map((j) => ({
    ...j,
    ep_driver_profiles: j.assigned_driver_id ? driversById[j.assigned_driver_id] || null : null,
  }));
}

export async function upsertJobFromOrder(orderId) {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  const { data, error } = await sb.rpc('ep_upsert_job_from_pedido', { p_order_id: orderId });
  if (error) throw error;
  return data;
}

export async function startDriverSearch(jobId) {
  if (!isSupabaseConfigured()) return { ok: true, offered: 1 };
  const sb = getSupabase();
  const { data, error } = await sb.rpc('ep_start_driver_search', { p_job_id: jobId });
  if (error) throw error;
  if (data?.reason === 'dispatch_disabled') {
    throw new Error(data.message || 'Despacho desactivado en esta sucursal');
  }
  if (data?.offered > 0) {
    await notifyDriversForJob(jobId).catch(() => {});
  } else {
    // Reavisar si ya hay ofertas pending (botón reasignar / buscar de nuevo)
    try {
      const { data: pending } = await sb
        .from('ep_delivery_offers')
        .select('id')
        .eq('job_id', jobId)
        .eq('status', 'pending')
        .limit(1);
      if (pending?.length) {
        await notifyDriversForJob(jobId).catch(() => {});
        return { ...data, offered: pending.length, renotified: true };
      }
    } catch {
      /* ignore */
    }
    throw new Error(
      data?.message
      || 'Ningún repartidor con GPS en vivo. Deben estar Disponible y el GPS no puede decir “Buscando…”.',
    );
  }
  return data;
}

export async function acceptOffer(offerId) {
  if (!isSupabaseConfigured()) return { ok: true };
  const sb = getSupabase();
  const { data, error } = await sb.rpc('ep_accept_delivery_offer', { p_offer_id: offerId });
  if (error) throw error;
  return data;
}

export async function rejectOffer(offerId) {
  if (!isSupabaseConfigured()) return { ok: true };
  const sb = getSupabase();
  const { data, error } = await sb.rpc('ep_reject_delivery_offer', { p_offer_id: offerId });
  if (error) throw error;
  return data;
}

export async function confirmPickup(assignmentId) {
  if (!isSupabaseConfigured()) return { ok: true };
  const sb = getSupabase();
  const { data, error } = await sb.rpc('ep_confirm_pickup', { p_assignment_id: assignmentId });
  if (error) throw error;

  // Refuerzo: asegurar pedido → en_delivery aunque el SQL viejo no lo haga
  let orderId = data?.order_id || null;
  if (!orderId) {
    const { data: asg } = await sb
      .from('ep_delivery_assignments')
      .select('job_id, ep_delivery_jobs(source_order_id)')
      .eq('id', assignmentId)
      .maybeSingle();
    orderId = asg?.ep_delivery_jobs?.source_order_id || null;
  }
  if (orderId) {
    try {
      await syncAfterDriverPickup(orderId);
    } catch (e) {
      console.warn('[Pollón] sync pickup:', e?.message || e);
    }
  }
  return { ...(data || { ok: true }), order_id: orderId };
}

export async function confirmDelivery(assignmentId) {
  if (!isSupabaseConfigured()) return { ok: true };
  const sb = getSupabase();
  const { data, error } = await sb.rpc('ep_confirm_delivery', { p_assignment_id: assignmentId });
  if (error) throw error;
  return data;
}

export async function createJobFromLocalOrder(order) {
  if (!isSupabaseConfigured()) {
    const ref = String(order.customer?.reference || '').trim();
    const address = String(order.customer?.address || '').trim();
    return {
      id: `demo-${order.id}`,
      source_order_id: order.id,
      ticket_code: order.ticketNumber || order.codigo_pedido,
      status: 'ready_for_dispatch',
      customer_name: order.customer?.name || '',
      customer_phone: order.customer?.phone || '',
      customer_address: ref
        ? (address ? `${address} | Ref: ${ref}` : `Ref: ${ref}`)
        : address,
      order_total: order.total || 0,
      delivery_fee: order.deliveryFee || 0,
      payment_method: order.metodo_pago || '',
      branch_id: order.branchId || null,
      created_at: new Date().toISOString(),
    };
  }
  return upsertJobFromOrder(order.id);
}

/** Un solo canal Realtime compartido (evita “Cannot add postgres_changes callbacks after subscribe”). */
let dispatchChannel = null;
const dispatchListeners = new Set();

function notifyDispatchListeners(payload) {
  dispatchListeners.forEach((cb) => {
    try {
      cb(payload);
    } catch (err) {
      console.warn('[Pollón] dispatch listener:', err);
    }
  });
}

function ensureDispatchChannel() {
  if (dispatchChannel) return dispatchChannel;
  const sb = getSupabase();
  if (!sb) return null;

  // Si quedó un canal huérfano con el mismo topic, quitarlo antes de recrear
  try {
    const existing = sb.getChannels?.() || [];
    existing.forEach((ch) => {
      if (ch?.topic === 'realtime:ep-dispatch-live' || ch?.topic === 'ep-dispatch-live') {
        sb.removeChannel(ch);
      }
    });
  } catch {
    /* ignore */
  }

  const fanOut = (payload) => notifyDispatchListeners(payload);

  dispatchChannel = sb
    .channel('ep-dispatch-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ep_delivery_jobs' }, fanOut)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ep_delivery_offers' }, fanOut)
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn('[Pollón] dispatch realtime:', status);
        try {
          if (dispatchChannel) sb.removeChannel(dispatchChannel);
        } catch {
          /* ignore */
        }
        dispatchChannel = null;
      }
    });

  return dispatchChannel;
}

/**
 * Suscripción multiplexada al despacho en vivo.
 * Varios componentes pueden llamar esto a la vez sin romper Realtime.
 */
export function subscribeDispatch(callback) {
  if (!callback) return () => {};
  if (!isSupabaseConfigured()) return () => {};

  dispatchListeners.add(callback);
  try {
    ensureDispatchChannel();
  } catch (err) {
    console.warn('[Pollón] subscribeDispatch:', err?.message || err);
  }

  return () => {
    dispatchListeners.delete(callback);
    if (dispatchListeners.size === 0 && dispatchChannel) {
      try {
        const sb = getSupabase();
        if (sb) sb.removeChannel(dispatchChannel);
      } catch {
        /* ignore */
      }
      dispatchChannel = null;
    }
  };
}
