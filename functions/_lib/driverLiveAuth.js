import { createClient } from '@supabase/supabase-js';

const LIVE_STAFF_ROLES = new Set([
  'super_admin',
  'admin_sucursal',
  'administrador',
  'cajera',
  'cajero',
  'despachador',
]);

const BRANCH_SCOPED = new Set(['cajera', 'cajero', 'despachador', 'cocina', 'cocinero']);

function envVal(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v) return String(v);
  }
  return '';
}

export function normalizeRole(role) {
  if (role === 'administrador') return 'admin_sucursal';
  if (role === 'cajero') return 'cajera';
  if (role === 'cocinero') return 'cocina';
  if (role === 'repartidor') return 'delivery';
  return role;
}

export function supabaseClients() {
  const url = envVal('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anon = envVal('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const service = envVal('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return { error: 'Faltan vars Supabase' };
  return { url, anon, service };
}

export function bearerToken(request) {
  const h = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return '';
}

export async function getAuthUser(token, url, anon) {
  if (!token) return null;
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export function adminClient(url, service) {
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function findDriverByPingToken(admin, token) {
  const tok = String(token || '').trim();
  if (!tok) return null;
  const { data } = await admin
    .from('ep_driver_profiles')
    .select('id, profile_id, preferred_branch_id')
    .eq('gps_ping_token', tok)
    .maybeSingle();
  return data || null;
}

export async function findDriverIdForAuthUser(admin, authUserId) {
  if (!admin || !authUserId) return null;
  const { data: byAuth } = await admin
    .from('ep_driver_profiles')
    .select('id, profile_id, preferred_branch_id')
    .eq('profile_id', authUserId)
    .maybeSingle();
  if (byAuth?.id) return byAuth;
  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, role, branch_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (!profile?.id) return null;
  const { data: byProfile } = await admin
    .from('ep_driver_profiles')
    .select('id, profile_id, preferred_branch_id')
    .eq('profile_id', profile.id)
    .maybeSingle();
  if (!byProfile?.id) return null;
  return { ...byProfile, profile };
}

export async function loadCallerProfile(admin, authUserId) {
  const { data } = await admin
    .from('profiles')
    .select('id, full_name, role, branch_id, is_active, auth_user_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  return data || null;
}

export function canViewLiveMap(profile) {
  if (!profile || profile.is_active === false) return false;
  const role = normalizeRole(profile.role);
  return LIVE_STAFF_ROLES.has(role) || LIVE_STAFF_ROLES.has(profile.role);
}

export function staffBranchFilter(profile) {
  const role = normalizeRole(profile?.role);
  if (!BRANCH_SCOPED.has(role)) return null;
  return profile.branch_id || null;
}

export async function loadActiveJobForDriver(admin, driverId) {
  const { data, error } = await admin
    .from('ep_delivery_assignments')
    .select('id, phase, status, job_id, accepted_at, ep_delivery_jobs(*)')
    .eq('driver_id', driverId)
    .eq('status', 'active')
    .order('accepted_at', { ascending: true });
  if (error) throw new Error(error.message || 'Error asignaciones');
  const rows = data || [];
  if (!rows.length) return null;

  const delivery = rows.find((r) => r.phase === 'to_customer' || r.phase === 'at_customer');
  const chosen = delivery || rows[0];
  const job = chosen.ep_delivery_jobs || {};
  const toCustomer = rows.some((r) => r.phase === 'to_customer' || r.phase === 'at_customer');

  let store = null;
  if (job.branch_id) {
    const { data: branch } = await admin
      .from('branches')
      .select('id, name, lat, lng, address, city')
      .eq('id', job.branch_id)
      .maybeSingle();
    if (branch) {
      store = {
        id: branch.id,
        name: branch.name,
        lat: branch.lat != null ? Number(branch.lat) : null,
        lng: branch.lng != null ? Number(branch.lng) : null,
        address: branch.address || null,
        city: branch.city || null,
      };
    }
  }

  return {
    assignment_id: chosen.id,
    job_id: job.id || chosen.job_id,
    order_id: job.source_order_id || null,
    ticket_code: job.ticket_code || null,
    branch_id: job.branch_id || null,
    phase: toCustomer ? 'to_customer' : (chosen.phase || 'to_store'),
    customer: {
      name: job.customer_name || null,
      address: job.customer_address || null,
      lat: job.customer_lat != null ? Number(job.customer_lat) : null,
      lng: job.customer_lng != null ? Number(job.customer_lng) : null,
    },
    store,
    jobs: rows.map((r) => ({
      assignment_id: r.id,
      job_id: r.job_id,
      phase: r.phase,
      order_id: r.ep_delivery_jobs?.source_order_id || null,
      ticket_code: r.ep_delivery_jobs?.ticket_code || null,
    })),
  };
}

export async function findLiveDriverForOrder(admin, orderId) {
  if (!orderId) return null;
  const { data: job } = await admin
    .from('ep_delivery_jobs')
    .select('id, assigned_driver_id, source_order_id')
    .eq('source_order_id', orderId)
    .maybeSingle();
  if (job?.assigned_driver_id) return job.assigned_driver_id;
  if (job?.id) {
    const { data: asg } = await admin
      .from('ep_delivery_assignments')
      .select('driver_id')
      .eq('job_id', job.id)
      .eq('status', 'active')
      .maybeSingle();
    return asg?.driver_id || null;
  }
  return null;
}

export async function customerOwnsOrder(admin, orderId, authUserId) {
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (!profile?.id) return false;
  const { data: pedido } = await admin
    .from('pedidos')
    .select('id, customer_id')
    .eq('id', orderId)
    .maybeSingle();
  return Boolean(pedido && pedido.customer_id === profile.id);
}
