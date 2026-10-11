/**
 * Panel del jefe de repartidores (pollito).
 * POST /api/fleet-admin
 *   { action: 'me' }
 *   { action: 'pending' }
 *   { action: 'team' }
 *   { action: 'createDriver', fullName, email, password, phone?, plate?, vehicleType?, color? }
 *   { action: 'assign', jobId, driverId }
 * Auth: jefe (admin_repartidores) o super_admin.
 */
import { createClient } from '@supabase/supabase-js';

function env(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v) return v;
  }
  return '';
}

function normalizeRole(role) {
  if (role === 'administrador') return 'admin_sucursal';
  if (role === 'cajero') return 'cajera';
  if (role === 'cocinero') return 'cocina';
  if (role === 'repartidor') return 'delivery';
  return role;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = env('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return res.status(500).json({ error: 'Faltan vars Supabase' });
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sin autorización' });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData?.user) return res.status(401).json({ error: 'Sesión inválida' });

  const { data: caller } = await admin
    .from('profiles')
    .select('id, role, branch_id, is_active, full_name')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();
  if (!caller || caller.is_active === false) return res.status(403).json({ error: 'Perfil no autorizado' });

  const role = normalizeRole(caller.role);
  const isSuper = role === 'super_admin';
  const isBoss = role === 'admin_repartidores';
  if (!isSuper && !isBoss) return res.status(403).json({ error: 'Solo jefe de repartidores' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const action = body.action || 'me';

  try {
    const ctx = await loadFleetContext(admin, caller, isSuper, body.fleetId);
    if (!ctx.fleet && !isSuper) {
      return res.status(400).json({
        error: 'Esta cuenta no tiene flota. El super admin debe crear el jefe de nuevo o ejecutar fix-admin-repartidores-fleets.sql',
      });
    }

    if (action === 'me') {
      return res.status(200).json({ ok: true, fleet: ctx.fleet, driver: ctx.bossDriver, branchId: ctx.branchId });
    }

    if (action === 'team') {
      const team = await listTeam(admin, ctx);
      return res.status(200).json({ ok: true, fleet: ctx.fleet, drivers: team });
    }

    if (action === 'pending') {
      const jobs = await listPending(admin, ctx.branchId);
      return res.status(200).json({ ok: true, jobs, fleet: ctx.fleet });
    }

    if (action === 'createDriver') {
      if (!ctx.fleet) return res.status(400).json({ error: 'Sin flota' });
      const created = await createFleetDriver(admin, ctx, body);
      return res.status(200).json({ ok: true, profile: created });
    }

    if (action === 'assign') {
      const result = await assignJob(admin, ctx, body.jobId, body.driverId);
      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Acción no válida' });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Error al procesar' });
  }
}

async function loadFleetContext(admin, caller, isSuper, fleetId) {
  let fleet = null;
  if (isSuper && fleetId) {
    const { data } = await admin.from('ep_driver_fleets').select('*').eq('id', fleetId).maybeSingle();
    fleet = data;
  } else {
    const { data } = await admin
      .from('ep_driver_fleets')
      .select('*')
      .eq('owner_profile_id', caller.id)
      .maybeSingle();
    fleet = data;
  }
  const { data: bossDriver } = await admin
    .from('ep_driver_profiles')
    .select('*')
    .eq('profile_id', caller.id)
    .maybeSingle();
  return {
    fleet,
    bossDriver,
    branchId: fleet?.branch_id || caller.branch_id || null,
    caller,
  };
}

async function listTeam(admin, ctx) {
  if (!ctx.fleet) return [];
  const { data: rows } = await admin
    .from('ep_driver_profiles')
    .select('*')
    .eq('fleet_id', ctx.fleet.id)
    .order('created_at', { ascending: false });
  const list = rows || [];
  const ids = [...new Set(list.map((r) => r.profile_id).filter(Boolean))];
  let byId = {};
  if (ids.length) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name, email, phone, role, is_active')
      .in('id', ids);
    byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  }
  return list.map((r) => ({ ...r, profiles: byId[r.profile_id] || null }));
}

async function listPending(admin, branchId) {
  if (!branchId) return [];
  const since = new Date(Date.now() - 18 * 3600 * 1000).toISOString();
  const { data: peds } = await admin
    .from('pedidos')
    .select('id, estado, branch_id, creado_en')
    .eq('tipo_entrega', 'delivery')
    .eq('branch_id', branchId)
    .in('estado', ['pendiente', 'nuevo'])
    .gte('creado_en', since)
    .order('creado_en', { ascending: false })
    .limit(40);
  const orderIds = (peds || []).map((p) => p.id).filter(Boolean);
  if (!orderIds.length) return [];
  const { data: jobs } = await admin
    .from('ep_delivery_jobs')
    .select('*')
    .in('source_order_id', orderIds)
    .is('assigned_driver_id', null);
  return (jobs || []).filter((j) => !['delivered', 'cancelled', 'picked_up', 'delivering'].includes(j.status));
}

async function createFleetDriver(admin, ctx, body) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const fullName = String(body.fullName || '').trim();
  const phone = String(body.phone || '').trim();
  if (!email || !password || password.length < 6) throw new Error('Correo y contraseña (mín. 6) requeridos');
  if (!fullName) throw new Error('Nombre de la moto requerido');

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone,
      role: 'delivery',
      branch_id: ctx.branchId,
      is_active: true,
    },
  });
  if (createErr) throw new Error(createErr.message || 'No se pudo crear el usuario de la moto');

  const { data: profile, error: upErr } = await admin
    .from('profiles')
    .upsert({
      auth_user_id: created.user.id,
      full_name: fullName,
      email,
      phone,
      role: 'delivery',
      branch_id: ctx.branchId,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'auth_user_id' })
    .select('*')
    .single();
  if (upErr) throw new Error(upErr.message || 'Usuario creado, falló el perfil');

  const { error: drvErr } = await admin.from('ep_driver_profiles').upsert({
    profile_id: profile.id,
    admin_status: 'approved',
    preferred_branch_id: ctx.branchId,
    fleet_id: ctx.fleet.id,
    is_fleet_boss: false,
    vehicle_plate: String(body.plate || body.vehicle_plate || '').trim() || null,
    vehicle_type: String(body.vehicleType || body.vehicle_type || 'motocicleta'),
    vehicle_color: String(body.color || body.vehicle_color || '').trim() || null,
    phone: phone || null,
    operational_status: 'offline',
  }, { onConflict: 'profile_id' });
  if (drvErr) throw new Error(drvErr.message || 'No se pudo crear el perfil de moto');

  return profile;
}

async function assignJob(admin, ctx, jobId, driverId) {
  if (!jobId || !driverId) throw new Error('Falta pedido o moto');

  const { data: job } = await admin
    .from('ep_delivery_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();
  if (!job) throw new Error('Pedido no encontrado');
  if (job.assigned_driver_id) throw new Error('Este pedido ya tiene dueño');

  const { data: drv } = await admin
    .from('ep_driver_profiles')
    .select('*')
    .eq('id', driverId)
    .maybeSingle();
  if (!drv || drv.admin_status !== 'approved') throw new Error('Moto no disponible');
  if (ctx.fleet && drv.fleet_id !== ctx.fleet.id && !drv.is_fleet_boss) {
    throw new Error('Esa moto no es de tu flota');
  }
  if (ctx.fleet && drv.is_fleet_boss && drv.fleet_id && drv.fleet_id !== ctx.fleet.id) {
    throw new Error('No puedes asignarte un pedido de otra flota');
  }

  const assigningSelf = ctx.bossDriver && String(ctx.bossDriver.id) === String(driverId);
  if (!assigningSelf) {
    const { data: can } = await admin.rpc('ep_driver_can_receive_offers', { p_driver_id: driverId });
    if (can === false) throw new Error('Esa moto no está En línea o ya llenó su cupo');
  }

  const now = new Date().toISOString();
  const { data: held, error: holdErr } = await admin
    .from('ep_delivery_jobs')
    .update({ fleet_hold_driver_id: driverId, updated_at: now, status: job.status === 'searching_driver' ? 'offered' : job.status })
    .eq('id', jobId)
    .is('assigned_driver_id', null)
    .select('id, fleet_hold_driver_id')
    .maybeSingle();
  if (holdErr) throw new Error(holdErr.message);
  if (!held) throw new Error('Ya lo tomó otra flota');

  await admin
    .from('ep_delivery_offers')
    .update({ status: 'expired', responded_at: now })
    .eq('job_id', jobId)
    .eq('status', 'pending')
    .neq('driver_id', driverId);

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error: insErr } = await admin.from('ep_delivery_offers').upsert({
    job_id: jobId,
    driver_id: driverId,
    status: 'pending',
    offered_fee: job.delivery_fee || 0,
    expires_at: expiresAt,
    responded_at: null,
  }, { onConflict: 'job_id,driver_id' });
  if (insErr) {
    await admin.from('ep_delivery_offers').update({
      status: 'pending',
      offered_fee: job.delivery_fee || 0,
      expires_at: expiresAt,
      responded_at: null,
    }).eq('job_id', jobId).eq('driver_id', driverId);
  }

  try {
    const { sendPushesForJob } = await import('./_lib/sendJobPushes.js');
    await sendPushesForJob(admin, jobId);
  } catch {
    /* el push es extra: la moto ya tiene la oferta en bandeja */
  }

  return { ok: true, jobId, driverId };
}