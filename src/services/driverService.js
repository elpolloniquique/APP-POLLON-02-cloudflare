import { getSupabase, isSupabaseConfigured } from './supabaseClient';

function rpcError(error, fallback) {
  const msg = error?.message || error?.details || error?.hint || fallback;
  if (String(msg).includes('telefono')) {
    return 'SQL desactualizado: ejecuta supabase/fix-delivery-production-ready.sql';
  }
  if (String(msg).includes('more than one relationship')) {
    return 'Relación profiles ambigua. Actualiza la app o ejecuta fix-ep-profiles-relationship.sql';
  }
  return msg;
}

const DEMO_DRIVERS = [
  {
    id: 'demo-drv-1',
    profile_id: 'demo-p1',
    admin_status: 'approved',
    operational_status: 'available',
    preferred_branch_id: null,
    max_orders: 2,
    commission_percent: 5,
    vehicle_type: 'motocicleta',
    vehicle_plate: 'AB-12-34',
    phone: '+56911111111',
    profiles: { full_name: 'Carlos Repartidor', email: 'repartidor@demo.cl', phone: '+56911111111' },
  },
];

/** Adjunta profiles sin embed (evita ambigüedad profile_id vs approved_by) */
async function attachProfiles(rows) {
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  if (!list.length) return Array.isArray(rows) ? [] : null;

  const ids = [...new Set(list.map((r) => r.profile_id).filter(Boolean))];
  if (!ids.length) {
    return Array.isArray(rows) ? list.map((r) => ({ ...r, profiles: null })) : { ...rows, profiles: null };
  }

  const sb = getSupabase();
  const { data: profiles, error } = await sb
    .from('profiles')
    .select('id, full_name, email, phone, role, branch_id')
    .in('id', ids);
  if (error) throw new Error(rpcError(error, 'Error leyendo profiles'));

  const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  const merged = list.map((r) => ({ ...r, profiles: byId[r.profile_id] || null }));
  return Array.isArray(rows) ? merged : merged[0];
}

export async function listDrivers({ branchId } = {}) {
  if (!isSupabaseConfigured()) {
    return DEMO_DRIVERS.filter((d) => !branchId || !d.preferred_branch_id || d.preferred_branch_id === branchId);
  }
  const sb = getSupabase();
  let q = sb
    .from('ep_driver_profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (branchId) q = q.eq('preferred_branch_id', branchId);
  const { data, error } = await q;
  if (error) throw new Error(rpcError(error, 'Error al listar repartidores'));
  return attachProfiles(data || []);
}

export async function updateDriverAdminStatus(driverId, adminStatus, notes = '') {
  if (!isSupabaseConfigured()) return { id: driverId, admin_status: adminStatus };
  const sb = getSupabase();
  const patch = {
    admin_status: adminStatus,
    notes,
    updated_at: new Date().toISOString(),
  };
  if (adminStatus === 'approved') patch.approved_at = new Date().toISOString();
  const { data, error } = await sb.from('ep_driver_profiles').update(patch).eq('id', driverId).select('*').single();
  if (error) throw new Error(rpcError(error, 'No se pudo actualizar estado'));
  return data;
}

export async function updateDriverProfile(driverId, updates) {
  if (!isSupabaseConfigured()) return { id: driverId, ...updates };
  const sb = getSupabase();
  const { data, error } = await sb
    .from('ep_driver_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', driverId)
    .select('*')
    .single();
  if (error) throw new Error(rpcError(error, 'No se pudo guardar el perfil'));
  return attachProfiles(data);
}

/** Cupo operativo de ESA cuenta de repartidor (solo admin). 2 | 3 | 4 */
export async function updateDriverMaxOrders(driverId, maxOrders) {
  const n = Number(maxOrders);
  if (![2, 3, 4].includes(n)) {
    throw new Error('El máximo de pedidos debe ser 2, 3 o 4');
  }
  if (!isSupabaseConfigured()) return { id: driverId, max_orders: n };

  const sb = getSupabase();
  const { data, error } = await sb.rpc('ep_admin_set_driver_max_orders', {
    p_driver_id: driverId,
    p_max: n,
  });
  if (!error && data) {
    const saved = Number(data.max_orders);
    if (saved !== n) {
      throw new Error(
        `El cupo no quedó en ${n} para esa cuenta (quedó ${saved}). Ejecuta supabase/fix-driver-max-orders-per-account.sql`,
      );
    }
    return { id: driverId, max_orders: saved, email: data.email, name: data.name };
  }

  const msg = String(error?.message || '');
  if (/ep_admin_set_driver_max_orders|schema cache|does not exist/i.test(msg)) {
    const row = await updateDriverProfile(driverId, { max_orders: n });
    const saved = Number(row?.max_orders);
    if (saved !== n) {
      throw new Error(
        'El cupo no se guardó en esa cuenta. Ejecuta supabase/fix-driver-max-orders-per-account.sql',
      );
    }
    return row;
  }
  throw new Error(rpcError(error, 'No se pudo guardar el cupo de este repartidor'));
}

/** Comisión % sobre delivery (solo admin). 0–100 */
export function normalizeCommissionPercent(value, fallback = 5) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const rounded = Math.round(n * 100) / 100;
  return Math.min(100, Math.max(0, rounded));
}

export async function updateDriverCommission(driverId, percent) {
  const n = normalizeCommissionPercent(percent, NaN);
  if (!Number.isFinite(n)) {
    throw new Error('La comisión debe ser un número entre 0 y 100');
  }
  return updateDriverProfile(driverId, { commission_percent: n });
}

export async function ensureMyDriverProfile() {
  if (!isSupabaseConfigured()) return DEMO_DRIVERS[0];
  const sb = getSupabase();

  const { data: driverId, error } = await sb.rpc('ep_ensure_driver_profile');
  if (error) throw new Error(rpcError(error, 'No se pudo crear perfil de repartidor'));

  const { data: row, error: rowErr } = await sb
    .from('ep_driver_profiles')
    .select('*')
    .eq('id', driverId)
    .maybeSingle();

  if (rowErr) throw new Error(rpcError(rowErr, 'Perfil creado pero no se pudo leer (RLS)'));
  if (!row) {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error('Sesión no válida');
    const { data: profile } = await sb.from('profiles').select('id').eq('auth_user_id', user.id).maybeSingle();
    if (!profile) throw new Error('No hay fila en profiles para este usuario');
    const { data: byProfile, error: e2 } = await sb
      .from('ep_driver_profiles')
      .select('*')
      .eq('profile_id', profile.id)
      .maybeSingle();
    if (e2) throw new Error(rpcError(e2, 'Error leyendo perfil repartidor'));
    if (!byProfile) throw new Error('Perfil repartidor no visible. Ejecuta fix-delivery-production-ready.sql');
    return attachProfiles(byProfile);
  }
  return attachProfiles(row);
}

export async function setMyOperationalStatus(status) {
  if (!isSupabaseConfigured()) return { ok: true, status };
  const sb = getSupabase();
  const { data, error } = await sb.rpc('ep_set_my_operational_status', { p_status: status });
  if (error) throw new Error(rpcError(error, 'No se pudo cambiar estado'));
  return data;
}

export async function getMyDriverSummary() {
  if (!isSupabaseConfigured()) {
    return {
      driver: DEMO_DRIVERS[0],
      activeAssignments: [],
      pendingOffers: [],
      todayDeliveries: 3,
      todayFees: 7500,
    };
  }
  const sb = getSupabase();
  const driver = await ensureMyDriverProfile();
  const [offersRes, assignRes, doneRes] = await Promise.all([
    sb
      .from('ep_delivery_offers')
      .select('*, ep_delivery_jobs(*)')
      .eq('driver_id', driver.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20),
    sb
      .from('ep_delivery_assignments')
      .select('*, ep_delivery_jobs(*)')
      .eq('driver_id', driver.id)
      .eq('status', 'active'),
    sb
      .from('ep_delivery_assignments')
      .select('driver_fee, delivered_at')
      .eq('driver_id', driver.id)
      .eq('status', 'completed')
      .gte('delivered_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ]);

  if (offersRes.error) throw new Error(rpcError(offersRes.error, 'Error ofertas'));
  if (assignRes.error) throw new Error(rpcError(assignRes.error, 'Error asignaciones'));

  // Una oferta por job (evita duplicados al reintentar a los 3 min)
  const byJob = new Map();
  for (const o of (offersRes.data || [])) {
    const jid = o.job_id || o.ep_delivery_jobs?.id;
    if (!jid) continue;
    const prev = byJob.get(jid);
    if (!prev || new Date(o.expires_at || 0) > new Date(prev.expires_at || 0)) {
      byJob.set(jid, o);
    }
  }
  const pendingOffers = [...byJob.values()]
    .sort((a, b) => new Date(b.expires_at || 0) - new Date(a.expires_at || 0));

  const done = doneRes.data || [];
  return {
    driver,
    pendingOffers,
    activeAssignments: assignRes.data || [],
    todayDeliveries: done.length,
    todayFees: done.reduce((s, x) => s + (x.driver_fee || 0), 0),
  };
}

export async function verifyDeliveryModule() {
  if (!isSupabaseConfigured()) {
    return { ok: true, demo: true };
  }
  const sb = getSupabase();
  const { data, error } = await sb.rpc('ep_verify_delivery_module');
  if (error) {
    return { ok: false, error: error.message, hint: 'Ejecuta fix-delivery-production-ready.sql y fix-dispatch-config-v2.sql' };
  }
  const result = data || {};
  // Compat: RPCs viejos siempre devolvían ok:true — recalcular si hay tables
  if (result.tables && typeof result.tables === 'object') {
    const tablesOk = Object.values(result.tables).every(Boolean);
    const funcs = result.functions || {};
    const funcsOk = !Object.keys(funcs).length || Object.values(funcs).every(Boolean);
    const cols = result.columns || {};
    const colsOk = !Object.keys(cols).length || Object.values(cols).every(Boolean);
    result.ok = Boolean(tablesOk && funcsOk && (Object.keys(cols).length ? colsOk : true));
  }
  return result;
}
