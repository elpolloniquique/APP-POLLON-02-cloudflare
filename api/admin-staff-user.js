/**
 * Vercel Serverless — crear / actualizar usuarios staff del panel Admin.
 * POST /api/admin-staff-user
 * Body actions:
 *   { action: 'create', email, password, fullName, phone, username, role, branchId, isActive, avatarUrl }
 *   { action: 'update', profileId, authUserId, fullName, phone, username, role, branchId, isActive, avatarUrl, password? }
 *   { action: 'setPassword', authUserId, password }
 * Auth: Bearer <supabase access token> (super_admin | admin_sucursal)
 *
 * Env: SUPABASE_URL / VITE_SUPABASE_URL, SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';

const STAFF_ROLES = new Set([
  'super_admin', 'admin_sucursal', 'administrador',
  'cajera', 'cajero', 'despachador',
  'cocina', 'cocinero', 'delivery', 'repartidor',
]);

const BRANCH_ROLES = new Set([
  'cajera', 'cajero', 'despachador', 'cocina', 'cocinero', 'delivery', 'repartidor',
]);

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
    return res.status(500).json({ error: 'Faltan vars Supabase (URL, ANON, SERVICE_ROLE)' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Sin autorización' });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !authData?.user) {
    return res.status(401).json({ error: 'Sesión inválida' });
  }

  const { data: caller, error: callerErr } = await admin
    .from('profiles')
    .select('id, role, branch_id, is_active')
    .eq('auth_user_id', authData.user.id)
    .maybeSingle();

  if (callerErr || !caller || caller.is_active === false) {
    return res.status(403).json({ error: 'Perfil no autorizado' });
  }

  const callerRole = normalizeRole(caller.role);
  const isSuper = callerRole === 'super_admin';
  const isBranchAdmin = callerRole === 'admin_sucursal';
  if (!isSuper && !isBranchAdmin) {
    return res.status(403).json({ error: 'Solo super admin o admin de sucursal' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const action = body.action || 'create';

  function assertCanAssign(role, branchId) {
    const r = normalizeRole(role);
    if (!STAFF_ROLES.has(r) && !STAFF_ROLES.has(role)) {
      throw new Error('Rol no permitido');
    }
    if (r === 'super_admin' && !isSuper) {
      throw new Error('No puedes crear super admin');
    }
    if (r === 'admin_sucursal' && !isSuper) {
      throw new Error('Solo el super admin puede crear admin de sucursal');
    }
    if (!isSuper) {
      if (!BRANCH_ROLES.has(r) && !BRANCH_ROLES.has(role)) {
        throw new Error('Rol no permitido para admin de sucursal');
      }
      if (branchId && caller.branch_id && branchId !== caller.branch_id) {
        throw new Error('Solo puedes gestionar usuarios de tu sucursal');
      }
    }
  }

  try {
    if (action === 'create') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const fullName = String(body.fullName || '').trim();
      const phone = String(body.phone || '').trim();
      const username = String(body.username || '').trim();
      const role = normalizeRole(String(body.role || '').trim());
      const branchId = body.branchId || (isBranchAdmin ? caller.branch_id : null);
      const isActive = body.isActive !== false;
      const avatarUrl = body.avatarUrl || null;

      if (!email || !password || password.length < 6) {
        return res.status(400).json({ error: 'Email y contraseña (mín. 6) requeridos' });
      }
      if (!fullName) return res.status(400).json({ error: 'Nombre completo requerido' });
      if (!role) return res.status(400).json({ error: 'Rol requerido' });
      if (role !== 'super_admin' && !branchId) {
        return res.status(400).json({ error: 'Sucursal requerida' });
      }

      assertCanAssign(role, branchId);

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          phone,
          role,
          branch_id: branchId,
          username,
          avatar_url: avatarUrl,
          is_active: isActive,
        },
      });

      if (createErr) {
        return res.status(400).json({ error: createErr.message || 'No se pudo crear el usuario' });
      }

      const authUserId = created.user.id;

      // Asegurar perfil con todos los campos (por si el trigger no alcanzó branch)
      const { data: profile, error: upErr } = await admin
        .from('profiles')
        .upsert({
          auth_user_id: authUserId,
          full_name: fullName,
          email,
          phone,
          role,
          branch_id: branchId,
          username: username || null,
          avatar_url: avatarUrl,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'auth_user_id' })
        .select('*, branches:branch_id(id, name)')
        .single();

      if (upErr) {
        return res.status(400).json({ error: upErr.message || 'Usuario Auth creado pero falló el perfil' });
      }

      // Repartidor: fila operativa opcional
      if (role === 'delivery' || role === 'repartidor') {
        await admin.from('ep_driver_profiles').upsert({
          profile_id: profile.id,
          admin_status: 'approved',
          preferred_branch_id: branchId,
        }, { onConflict: 'profile_id' }).then(() => null).catch(() => null);
      }

      return res.status(200).json({ ok: true, profile });
    }

    if (action === 'update' || action === 'setPassword') {
      const authUserId = body.authUserId;
      const profileId = body.profileId;
      if (!authUserId && !profileId) {
        return res.status(400).json({ error: 'profileId o authUserId requerido' });
      }

      let q = admin.from('profiles').select('*');
      if (profileId) q = q.eq('id', profileId);
      else q = q.eq('auth_user_id', authUserId);
      const { data: target, error: tErr } = await q.maybeSingle();
      if (tErr || !target) return res.status(404).json({ error: 'Usuario no encontrado' });

      if (!isSuper) {
        if (normalizeRole(target.role) === 'super_admin') {
          return res.status(403).json({ error: 'No puedes editar super admin' });
        }
        if (caller.branch_id && target.branch_id && target.branch_id !== caller.branch_id) {
          return res.status(403).json({ error: 'Usuario de otra sucursal' });
        }
      }

      if (action === 'setPassword' || body.password) {
        const password = String(body.password || '');
        if (password.length < 6) return res.status(400).json({ error: 'Contraseña mín. 6 caracteres' });
        const { error: pwErr } = await admin.auth.admin.updateUserById(target.auth_user_id, { password });
        if (pwErr) return res.status(400).json({ error: pwErr.message });
        if (action === 'setPassword') return res.status(200).json({ ok: true });
      }

      if (action === 'update') {
        const role = body.role != null ? normalizeRole(String(body.role)) : normalizeRole(target.role);
        const branchId = body.branchId !== undefined
          ? (body.branchId || null)
          : target.branch_id;
        assertCanAssign(role, branchId);

        const patch = {
          full_name: body.fullName != null ? String(body.fullName).trim() : target.full_name,
          phone: body.phone != null ? String(body.phone).trim() : target.phone,
          username: body.username != null ? String(body.username).trim() || null : target.username,
          role,
          branch_id: role === 'super_admin' ? null : branchId,
          is_active: body.isActive != null ? !!body.isActive : target.is_active,
          avatar_url: body.avatarUrl !== undefined ? body.avatarUrl : target.avatar_url,
          updated_at: new Date().toISOString(),
        };

        const { data: updated, error: uErr } = await admin
          .from('profiles')
          .update(patch)
          .eq('id', target.id)
          .select('*, branches:branch_id(id, name)')
          .single();
        if (uErr) return res.status(400).json({ error: uErr.message });

        await admin.auth.admin.updateUserById(target.auth_user_id, {
          user_metadata: {
            full_name: patch.full_name,
            phone: patch.phone,
            role: patch.role,
            branch_id: patch.branch_id,
            username: patch.username,
            avatar_url: patch.avatar_url,
            is_active: patch.is_active,
          },
        }).catch(() => null);

        return res.status(200).json({ ok: true, profile: updated });
      }
    }

    return res.status(400).json({ error: 'Acción no válida' });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Error al procesar' });
  }
}
