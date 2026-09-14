import { getSupabase, isSupabaseConfigured, getStorageBucket } from './supabaseClient';
import { normalizeRole } from './authService';
import { STAFF_ROLES } from '../utils/constants';

const MANAGEABLE = [
  {
    id: 'admin_sucursal',
    label: 'Admin Sucursal',
    description: 'Acceso completo a la sucursal',
    tone: 'purple',
  },
  {
    id: 'cajera',
    label: 'Cajera',
    description: 'Ventas, pedidos y caja',
    tone: 'blue',
  },
  {
    id: 'despachador',
    label: 'Despacho',
    description: 'Gestiona pedidos para despacho',
    tone: 'orange',
  },
  {
    id: 'delivery',
    label: 'Repartidor',
    description: 'Entrega a clientes',
    tone: 'green',
  },
  {
    id: 'cocina',
    label: 'Cocina',
    description: 'Pantalla de cocina',
    tone: 'amber',
  },
];

export const MANAGEABLE_STAFF_ROLES = MANAGEABLE;

export function staffRoleMeta(role) {
  const r = normalizeRole(role);
  if (r === 'super_admin') {
    return { id: r, label: 'Super Admin', description: 'Acceso total', tone: 'super' };
  }
  return MANAGEABLE.find((x) => x.id === r)
    || { id: r, label: r, description: '', tone: 'gray' };
}

function mapStaff(row) {
  if (!row) return null;
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    fullName: row.full_name || '',
    email: row.email || '',
    phone: row.phone || '',
    username: row.username || '',
    role: normalizeRole(row.role),
    roleRaw: row.role,
    branchId: row.branch_id || null,
    branchName: row.branches?.name || row.branch_name || '—',
    isActive: row.is_active !== false,
    avatarUrl: row.avatar_url || null,
    createdAt: row.created_at,
  };
}

async function authHeader() {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase no configurado');
  const { data } = await sb.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function callStaffApi(body) {
  const headers = await authHeader();
  const res = await fetch('/api/admin-staff-user', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
  return json;
}

/** Lista usuarios staff (no clientes). */
export async function listStaffUsers({ branchId, search, role } = {}) {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  let q = sb
    .from('profiles')
    .select('*, branches:branch_id(id, name)')
    .in('role', STAFF_ROLES)
    .order('full_name', { ascending: true });

  if (branchId) q = q.eq('branch_id', branchId);
  if (role) q = q.eq('role', role);

  const { data, error } = await q;
  if (error) throw new Error(error.message || 'No se pudieron cargar usuarios');

  let list = (data || []).map(mapStaff);
  const s = (search || '').trim().toLowerCase();
  if (s) {
    list = list.filter((u) =>
      u.fullName.toLowerCase().includes(s)
      || u.email.toLowerCase().includes(s)
      || (u.username || '').toLowerCase().includes(s)
      || (u.phone || '').includes(s));
  }
  return list;
}

export async function createStaffUser(payload) {
  const json = await callStaffApi({ action: 'create', ...payload });
  return mapStaff(json.profile);
}

export async function updateStaffUser(payload) {
  const json = await callStaffApi({ action: 'update', ...payload });
  return mapStaff(json.profile);
}

export async function setStaffPassword(authUserId, password) {
  return callStaffApi({ action: 'setPassword', authUserId, password });
}

/** Sube avatar (máx ~2MB) al bucket de imágenes. */
export async function uploadStaffAvatar(file, authUserId) {
  if (!file) return null;
  if (file.size > 2 * 1024 * 1024) throw new Error('La foto debe pesar máximo 2MB');
  if (!/^image\/(jpeg|png|webp|jpg)/i.test(file.type)) {
    throw new Error('Solo JPG o PNG');
  }
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase no configurado');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `avatars/${authUserId || 'new'}-${Date.now()}.${ext}`;
  const bucket = getStorageBucket();
  const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message || 'No se pudo subir la foto');
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}

export function staffKpis(users) {
  const roles = new Set(users.map((u) => u.role));
  return {
    total: users.length,
    active: users.filter((u) => u.isActive).length,
    inactive: users.filter((u) => !u.isActive).length,
    roles: roles.size,
  };
}
