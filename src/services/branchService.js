import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { DEFAULT_BRANCHES } from '../data/branches';
import { logAudit } from './auditService';
import { normalizeDeliveryCost } from '../utils/format';
import { normalizePaymentMethods } from '../utils/paymentMethods';

function mapBranch(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    city: row.city || '',
    address: row.address || '',
    schedule: row.opening_hours || row.horario || 'Lun-Dom: 11:30 - 23:00',
    phone: row.phone || '',
    whatsapp: row.whatsapp || '',
    isOpen: row.is_active !== false && row.abierta !== false,
    isActive: row.is_active !== false,
    deliveryEnabled: row.delivery_enabled !== false,
    pickupEnabled: row.pickup_enabled !== false,
    reservationsEnabled: row.reservations_enabled !== false,
    pickupMinOrder: Number(row.pickup_min_order) || 0,
    reservationMinOrder: Number(row.reservation_min_order) || 0,
    reservationSchedule: row.reservation_schedule || { slots: [] },
    deliveryZones: row.zona_delivery || 'Zona principal',
    deliveryCost: normalizeDeliveryCost(row.delivery_cost ?? row.costo_delivery),
    deliveryEta: row.delivery_eta || row.tiempo_entrega || '30-45 min',
    comingSoon: false,
    displayOrder: row.display_order ?? row.orden ?? 0,
    facebookUrl: row.facebook_url || '',
    instagramUrl: row.instagram_url || '',
    tiktokUrl: row.tiktok_url || '',
    thermalPrinterIp: row.thermal_printer_ip || '',
    thermalPrinterPort: Number(row.thermal_printer_port) || 9100,
    thermalPrintBridgeUrl: row.thermal_print_bridge_url || '',
    thermalNetworkPrintEnabled: row.thermal_network_print_enabled === true,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    paymentMethods: normalizePaymentMethods(row.payment_methods),
    alertEnabled: row.alert_enabled === true,
    alertTitle: row.alert_title || 'Aviso importante',
    alertMessage: row.alert_message || '',
    heroImageUrl: row.hero_image_url || '',
    logoUrl: row.logo_url || '',
  };
}

async function loadFromBranchesTable(includeInactive = false) {
  const sb = getSupabase();
  const { data, error } = await sb.from('branches').select('*').order('display_order', { ascending: true });
  if (error) throw error;
  const mapped = (data || []).map(mapBranch);
  return includeInactive ? mapped : mapped.filter((b) => b.isActive);
}

async function loadFromLegacySucursales() {
  const sb = getSupabase();
  const { data, error } = await sb.from('sucursales').select('*').order('orden', { ascending: true });
  if (error) throw error;
  return (data || [])
    .filter((r) => !r.proximamente)
    .map((r) => mapBranch({
      id: r.id,
      slug: r.slug,
      name: r.nombre,
      city: r.ciudad,
      address: r.direccion,
      opening_hours: r.horario,
      phone: r.telefono,
      whatsapp: r.whatsapp,
      is_active: r.abierta !== false,
      delivery_cost: r.costo_delivery,
      delivery_eta: r.tiempo_entrega,
      zona_delivery: r.zona_delivery,
      display_order: r.orden,
    }));
}

export async function loadBranches(includeInactive = false) {
  if (!isSupabaseConfigured()) return DEFAULT_BRANCHES.filter((b) => includeInactive || !b.comingSoon);

  try {
    const list = await loadFromBranchesTable(includeInactive);
    if (list.length) return list;
  } catch (e) {
    console.warn('[Pollón] branches:', e.message);
  }

  try {
    const legacy = await loadFromLegacySucursales();
    if (legacy.length) return legacy;
  } catch (e2) {
    console.warn('[Pollón] sucursales legacy:', e2.message);
  }

  return DEFAULT_BRANCHES.filter((b) => includeInactive || !b.comingSoon);
}

let adminBranchesCache = null;
let adminBranchesCacheAt = 0;
let adminBranchesInflight = null;
const ADMIN_BRANCHES_TTL_MS = 60_000;

/** Invalida caché tras crear/editar/borrar sucursales. */
export function invalidateAdminBranchesCache() {
  adminBranchesCache = null;
  adminBranchesCacheAt = 0;
  adminBranchesInflight = null;
}

export async function adminListAllBranches({ force = false } = {}) {
  if (!isSupabaseConfigured()) return DEFAULT_BRANCHES;

  const now = Date.now();
  if (!force && adminBranchesCache && now - adminBranchesCacheAt < ADMIN_BRANCHES_TTL_MS) {
    return adminBranchesCache;
  }
  if (!force && adminBranchesInflight) return adminBranchesInflight;

  adminBranchesInflight = (async () => {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from('branches').select('*').order('display_order', { ascending: true });
      if (error) throw error;
      if (data?.length) {
        const mapped = data.map(mapBranch);
        const list = [
          ...mapped.filter((b) => b.isActive),
          ...mapped.filter((b) => !b.isActive),
        ];
        adminBranchesCache = list;
        adminBranchesCacheAt = Date.now();
        return list;
      }
    } catch (e) {
      console.warn(e);
    }
    const fallback = await loadBranches(true);
    adminBranchesCache = fallback;
    adminBranchesCacheAt = Date.now();
    return fallback;
  })();

  try {
    return await adminBranchesInflight;
  } finally {
    adminBranchesInflight = null;
  }
}

async function nextBranchDisplayOrder(sb) {
  const { data: maxRow } = await sb
    .from('branches')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (maxRow?.display_order ?? 0) + 1;
}

/** Activa o desactiva sucursal sin borrar menú ni productos. Al activar, va al final de la lista pública. */
export async function adminSetBranchActive(branchId, isActive, user) {
  const sb = getSupabase();
  if (!sb) throw new Error('Sin conexión Supabase');

  const { data: existing, error: fetchErr } = await sb
    .from('branches')
    .select('id, name, is_active, display_order')
    .eq('id', branchId)
    .single();
  if (fetchErr) throw fetchErr;

  const patch = { is_active: !!isActive };
  if (isActive && existing.is_active === false) {
    patch.display_order = await nextBranchDisplayOrder(sb);
  }

  const { data, error } = await sb
    .from('branches')
    .update(patch)
    .eq('id', branchId)
    .select()
    .single();
  if (error) throw error;

  await logAudit({
    user,
    branchId,
    entityType: 'branch',
    entityId: branchId,
    action: isActive ? 'activate' : 'deactivate',
    oldData: { is_active: existing.is_active, display_order: existing.display_order },
    newData: patch,
  });
  invalidateAdminBranchesCache();
  return mapBranch(data);
}

export async function adminSaveBranch(branch, user) {
  const sb = getSupabase();
  if (!sb) throw new Error('Sin conexión Supabase');

  let displayOrder = branch.displayOrder ?? 0;
  let wasInactive = false;

  if (branch.id) {
    const { data: existing } = await sb
      .from('branches')
      .select('is_active, display_order')
      .eq('id', branch.id)
      .maybeSingle();
    wasInactive = existing?.is_active === false;
    displayOrder = branch.displayOrder ?? existing?.display_order ?? 0;
    if (wasInactive && branch.isActive !== false) {
      displayOrder = await nextBranchDisplayOrder(sb);
    }
  } else {
    displayOrder = await nextBranchDisplayOrder(sb);
  }

  const row = {
    id: branch.id || undefined,
    slug: branch.slug || branch.name.toLowerCase().replace(/\s+/g, '-'),
    name: branch.name,
    city: branch.city,
    address: branch.address,
    phone: branch.phone,
    whatsapp: branch.whatsapp,
    opening_hours: branch.schedule,
    delivery_enabled: branch.deliveryEnabled !== false,
    pickup_enabled: branch.pickupEnabled !== false,
    reservations_enabled: branch.reservationsEnabled !== false,
    pickup_min_order: Math.max(0, Number(branch.pickupMinOrder) || 0),
    reservation_min_order: Math.max(0, Number(branch.reservationMinOrder) || 0),
    reservation_schedule: branch.reservationSchedule || { slots: [] },
    delivery_cost: normalizeDeliveryCost(branch.deliveryCost) || '0',
    delivery_eta: branch.deliveryEta || '30-45 min',
    is_active: branch.isActive !== false,
    display_order: displayOrder,
    facebook_url: branch.facebookUrl?.trim() || '',
    instagram_url: branch.instagramUrl?.trim() || '',
    tiktok_url: branch.tiktokUrl?.trim() || '',
    thermal_printer_ip: branch.thermalPrinterIp?.trim() || '',
    thermal_printer_port: Number(branch.thermalPrinterPort) || 9100,
    thermal_print_bridge_url: branch.thermalPrintBridgeUrl?.trim() || '',
    thermal_network_print_enabled: branch.thermalNetworkPrintEnabled === true,
    payment_methods: normalizePaymentMethods(branch.paymentMethods),
    hero_image_url: (branch.heroImageUrl || '').trim(),
    logo_url: (branch.logoUrl || '').trim(),
    ...(branch.lat != null && Number.isFinite(Number(branch.lat)) ? { lat: Number(branch.lat) } : {}),
    ...(branch.lng != null && Number.isFinite(Number(branch.lng)) ? { lng: Number(branch.lng) } : {}),
  };

  const { data, error } = await sb.from('branches').upsert(row).select().single();
  if (error) throw error;
  await logAudit({ user, branchId: data.id, entityType: 'branch', entityId: data.id, action: branch.id ? 'update' : 'create', newData: data });
  invalidateAdminBranchesCache();
  return mapBranch(data);
}

/** Actualiza dirección + GPS de la sucursal (punto central / Zona 00 para delivery). */
export async function adminUpdateBranchLocation({ branchId, address, lat, lng, user }) {
  const sb = getSupabase();
  if (!sb) throw new Error('Sin conexión Supabase');
  if (!branchId) throw new Error('Sucursal requerida');

  const latN = Number(lat);
  const lngN = Number(lng);
  if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
    throw new Error('Coordenadas inválidas. Busca o selecciona una dirección en el mapa.');
  }
  const cleanAddress = String(address || '').trim();
  if (!cleanAddress) throw new Error('La dirección de la sucursal es obligatoria');

  const { data: existing, error: fetchErr } = await sb
    .from('branches')
    .select('id, address, lat, lng')
    .eq('id', branchId)
    .single();
  if (fetchErr) throw fetchErr;

  const patch = {
    address: cleanAddress,
    lat: latN,
    lng: lngN,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await sb
    .from('branches')
    .update(patch)
    .eq('id', branchId)
    .select()
    .single();
  if (error) throw error;

  await logAudit({
    user,
    branchId,
    entityType: 'branch',
    entityId: branchId,
    action: 'update_location',
    oldData: { address: existing.address, lat: existing.lat, lng: existing.lng },
    newData: patch,
  });
  invalidateAdminBranchesCache();
  return mapBranch(data);
}

export async function adminDeleteBranch(branchId, user) {
  const sb = getSupabase();
  if (!sb) throw new Error('Sin conexión Supabase');

  const { data: branch, error: fetchErr } = await sb
    .from('branches')
    .select('id, name')
    .eq('id', branchId)
    .single();
  if (fetchErr) throw fetchErr;

  const { error } = await sb.from('branches').delete().eq('id', branchId);
  if (error) throw error;

  await logAudit({
    user,
    branchId,
    entityType: 'branch',
    entityId: branchId,
    action: 'delete',
    oldData: branch,
  });
  invalidateAdminBranchesCache();
  return branch;
}

/** Parsea horario tipo "Lun-Dom: 11:30 - 23:00" o "11:30 - 23:00" */
function parseScheduleWindow(schedule) {
  if (!schedule || typeof schedule !== 'string') return null;
  const m = schedule.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const toMin = (h, min) => Number(h) * 60 + Number(min);
  return { start: toMin(m[1], m[2]), end: toMin(m[3], m[4]) };
}

export function isBranchOpenNow(branch) {
  if (!branch?.isActive && branch?.isActive !== undefined) return false;
  if (branch?.comingSoon) return false;
  if (branch?.isOpen === false) return false;

  const window = parseScheduleWindow(branch.schedule || branch.opening_hours);
  if (!window) return branch?.isOpen !== false;

  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (window.end < window.start) {
    return mins >= window.start || mins <= window.end;
  }
  return mins >= window.start && mins <= window.end;
}
