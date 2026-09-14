import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { ADMIN_NAV, ROLE_PERMISSIONS, ROLES, STAFF_ROLES, CUSTOMER_SESSION_KEY } from '../utils/constants';

const LEGACY_SESSION_KEY = 'pollon_admin_legacy_v1';
export const LEGACY_ADMIN_PASSWORD = import.meta.env.VITE_LEGACY_ADMIN_PASSWORD || 'HUILLCA123';

function mapProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    fullName: row.full_name || row.nombre || '',
    nombre: row.full_name || row.nombre || '',
    email: row.email || '',
    phone: row.phone || row.telefono || '',
    rol: normalizeRole(row.role || row.rol),
    role: normalizeRole(row.role || row.rol),
    branchId: row.branch_id || row.sucursal_id || null,
    branch_id: row.branch_id || row.sucursal_id || null,
    isActive: row.is_active !== false,
    activo: row.is_active !== false,
  };
}

/** Compatibilidad roles legacy */
export function normalizeRole(role) {
  if (!role) return ROLES.CLIENTE;
  if (role === 'administrador') return ROLES.ADMIN_SUCURSAL;
  if (role === 'cajero') return ROLES.CAJERA;
  if (role === 'cocinero') return ROLES.COCINA;
  if (role === 'repartidor') return ROLES.DELIVERY;
  return role;
}

export function isStaffRole(role) {
  const r = normalizeRole(role);
  return STAFF_ROLES.includes(r);
}

export function isDriverRole(role) {
  const r = normalizeRole(role);
  return r === ROLES.DELIVERY || r === 'repartidor';
}

export function isCustomerRole(role) {
  return normalizeRole(role) === ROLES.CLIENTE;
}

/** Ruta home post-login según rol */
export function getHomePathForRole(role) {
  const r = normalizeRole(role);
  if (isDriverRole(r)) return '/repartidor';
  if (isStaffRole(r)) return getDefaultAdminPath(r);
  return '/cuenta';
}

export function getLegacySession() {
  try {
    const raw = sessionStorage.getItem(LEGACY_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getCustomerLocalSession() {
  try {
    const raw = localStorage.getItem(CUSTOMER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function legacySignIn(password, asStaff = true) {
  if ((password || '').trim() !== LEGACY_ADMIN_PASSWORD) {
    throw new Error('Contraseña incorrecta');
  }
  const profile = {
    id: 'legacy',
    email: 'admin@local',
    nombre: 'Admin Local',
    fullName: 'Admin Local',
    rol: ROLES.SUPER_ADMIN,
    role: ROLES.SUPER_ADMIN,
    activo: true,
    isActive: true,
  };
  const session = { legacy: true, user: { id: 'legacy', email: profile.email } };
  if (asStaff) {
    sessionStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify({ session, profile }));
  }
  return { session, profile };
}

/** Perfil mínimo desde JWT (fallback si la consulta a BD tarda o falla) */
export function profileFromAuthUser(user) {
  if (!user) return null;
  const meta = user.user_metadata || {};
  const role = normalizeRole(meta.role);
  return {
    id: user.id,
    authUserId: user.id,
    email: user.email || '',
    fullName: meta.full_name || meta.nombre || user.email || '',
    nombre: meta.full_name || meta.nombre || user.email || '',
    rol: role,
    role,
    isActive: true,
    activo: true,
  };
}

/** Combina profiles + administradores; prioriza rol de personal si hay conflicto */
export async function getProfileByAuthId(authUserId) {
  const sb = getSupabase();
  if (!sb || !authUserId) return null;

  const [profileRes, legacyRes] = await Promise.all([
    sb.from('profiles').select('*').eq('auth_user_id', authUserId).maybeSingle(),
    sb.from('administradores').select('*').eq('id', authUserId).maybeSingle(),
  ]);

  if (profileRes.error) console.warn('[Pollón] profiles:', profileRes.error.message);
  if (legacyRes.error) console.warn('[Pollón] administradores:', legacyRes.error.message);

  const profile = profileRes.data;
  const legacy = legacyRes.data;

  const fromProfile = profile ? mapProfile(profile) : null;
  const fromAdmin = legacy
    ? mapProfile({
        id: fromProfile?.id || legacy.id,
        auth_user_id: authUserId,
        full_name: legacy.nombre,
        email: legacy.email,
        role: legacy.rol || ROLES.ADMIN_SUCURSAL,
        branch_id: legacy.branch_id || legacy.sucursal_id,
        is_active: legacy.activo,
      })
    : null;

  // Priorizar rol staff en profiles (no degradar super_admin por fila en administradores)
  if (fromProfile && isStaffRole(fromProfile.role)) {
    return fromProfile;
  }

  if (fromAdmin && isStaffRole(fromAdmin.role)) {
    if (fromProfile) {
      return {
        ...fromProfile,
        ...fromAdmin,
        id: fromProfile.id,
        authUserId: fromProfile.authUserId || authUserId,
        email: fromProfile.email || fromAdmin.email,
        fullName: fromAdmin.fullName || fromProfile.fullName,
        nombre: fromAdmin.nombre || fromProfile.nombre,
        role: fromAdmin.role,
        rol: fromAdmin.role,
      };
    }
    return fromAdmin;
  }

  return fromProfile || fromAdmin;
}

/** Evita cuelgue infinito al cargar perfil tras login */
export async function getProfileByAuthIdSafe(authUserId, userFallback, timeoutMs = 12000) {
  try {
    const p = await Promise.race([
      getProfileByAuthId(authUserId),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), timeoutMs);
      }),
    ]);
    if (p) return p;
  } catch (e) {
    console.warn('[Pollón] getProfileByAuthIdSafe:', e.message);
  }
  const fallback = profileFromAuthUser(userFallback);
  return fallback;
}

export async function signIn(email, password) {
  if (!isSupabaseConfigured()) {
    return legacySignIn(password, true);
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase no configurado. Revisa el archivo .env');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  sessionStorage.removeItem(LEGACY_SESSION_KEY);
  return data;
}

export async function signUpCustomer({ email, password, fullName, phone, acceptsEmailPromotions, acceptsWhatsappPromotions }) {
  const sb = getSupabase();
  if (!sb) {
    const profile = {
      id: `local-${Date.now()}`,
      email,
      fullName,
      nombre: fullName,
      phone,
      rol: ROLES.CLIENTE,
      role: ROLES.CLIENTE,
      isActive: true,
    };
    const session = { legacy: true, customer: true, user: { id: profile.id, email } };
    localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify({ session, profile, marketing: { acceptsEmailPromotions, acceptsWhatsappPromotions } }));
    return { session, profile };
  }

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
        role: ROLES.CLIENTE,
        accepts_email_promotions: !!acceptsEmailPromotions,
        accepts_whatsapp_promotions: !!acceptsWhatsappPromotions,
      },
    },
  });
  if (error) throw error;

  if (data.user) {
    await sb.from('profiles').upsert({
      auth_user_id: data.user.id,
      full_name: fullName,
      email,
      phone,
      role: ROLES.CLIENTE,
    }, { onConflict: 'auth_user_id' });

    const prof = await getProfileByAuthId(data.user.id);
    if (prof?.id) {
      await sb.from('customer_marketing_preferences').upsert({
        customer_id: prof.id,
        accepts_email_promotions: !!acceptsEmailPromotions,
        accepts_whatsapp_promotions: !!acceptsWhatsappPromotions,
      }, { onConflict: 'customer_id' });
    }
  }
  return data;
}

export async function resetPassword(email) {
  const sb = getSupabase();
  if (!sb) throw new Error('Recuperación de contraseña requiere Supabase configurado');
  const redirectTo = `${window.location.origin}/cuenta/perfil`;
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function signOut() {
  sessionStorage.removeItem(LEGACY_SESSION_KEY);
  localStorage.removeItem(CUSTOMER_SESSION_KEY);
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}

export async function getSession() {
  const customerLocal = getCustomerLocalSession();
  if (customerLocal?.session) return customerLocal.session;

  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function getAdminProfile(userId) {
  return getProfileByAuthId(userId);
}

export function hasPermission(role, perm) {
  const r = normalizeRole(role);
  const perms = ROLE_PERMISSIONS[r] || [];
  return perms.includes(perm);
}

/** Primera ruta del panel permitida para el rol (post-login y accesos denegados). */
export function getDefaultAdminPath(role) {
  const r = normalizeRole(role);
  const defaults = {
    [ROLES.SUPER_ADMIN]: '/admin',
    [ROLES.ADMIN_SUCURSAL]: '/admin',
    [ROLES.CAJERA]: '/admin',
    [ROLES.COCINA]: '/admin/cocina',
    [ROLES.DELIVERY]: '/repartidor',
    repartidor: '/repartidor',
  };
  if (defaults[r]) return defaults[r];

  const perms = ROLE_PERMISSIONS[r] || [];
  const nav = ADMIN_NAV.find((item) => perms.includes(item.perm));
  return nav?.path || '/admin/login';
}

/** Solo super admin puede crear, editar o eliminar sucursales. */
export function canManageAllBranches(role) {
  return normalizeRole(role) === ROLES.SUPER_ADMIN;
}

export function canAccessBranch(profile, branchId) {
  if (!profile) return false;
  const role = normalizeRole(profile.rol || profile.role);
  if (role === ROLES.SUPER_ADMIN) return true;
  if (!branchId) return true;
  return profile.branchId === branchId || profile.branch_id === branchId;
}

/** Roles que solo ven datos de su sucursal (branch_id en profiles) */
export function isBranchScopedStaff(role) {
  const r = normalizeRole(role);
  return [
    ROLES.ADMIN_SUCURSAL,
    ROLES.CAJERA,
    ROLES.COCINA,
    ROLES.DELIVERY,
    ROLES.ADMINISTRADOR,
    'cajero',
    'repartidor',
  ].includes(r);
}

export function getProfileBranchId(profile) {
  return profile?.branchId || profile?.branch_id || null;
}

/** Filtra pedidos (u otros recursos) por sucursal del personal */
export function filterByStaffBranch(items, profile, getBranchId = (item) => item.branchId || item.branch_id) {
  if (!profile || !Array.isArray(items)) return items || [];
  const role = normalizeRole(profile.rol || profile.role);
  if (role === ROLES.SUPER_ADMIN) return items;
  if (!isBranchScopedStaff(role)) return items;
  const bid = getProfileBranchId(profile);
  if (!bid) return items;
  return items.filter((item) => {
    const itemBranch = getBranchId(item);
    return itemBranch === bid;
  });
}

export { isSupabaseConfigured };
