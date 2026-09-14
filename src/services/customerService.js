import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { ROLES } from '../utils/constants';

function sb() {
  const client = getSupabase();
  if (!client) throw new Error('Supabase no configurado');
  return client;
}

export async function updateProfile(profileId, updates) {
  const row = {
    full_name: updates.fullName,
    phone: updates.phone,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb().from('profiles').update(row).eq('id', profileId).select().single();
  if (error) throw error;
  return data;
}

export async function getMarketingPreferences(customerId) {
  if (!isSupabaseConfigured()) return { acceptsEmailPromotions: false, acceptsWhatsappPromotions: false };
  const { data } = await sb().from('customer_marketing_preferences').select('*').eq('customer_id', customerId).maybeSingle();
  return {
    acceptsEmailPromotions: !!data?.accepts_email_promotions,
    acceptsWhatsappPromotions: !!data?.accepts_whatsapp_promotions,
  };
}

export async function updateMarketingPreferences(customerId, prefs) {
  const { data, error } = await sb().from('customer_marketing_preferences').upsert({
    customer_id: customerId,
    accepts_email_promotions: !!prefs.acceptsEmailPromotions,
    accepts_whatsapp_promotions: !!prefs.acceptsWhatsappPromotions,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'customer_id' }).select().single();
  if (error) throw error;
  return data;
}

export async function listAddresses(customerId) {
  const { data, error } = await sb().from('customer_addresses').select('*').eq('customer_id', customerId).order('is_default', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapAddress);
}

export async function saveAddress(customerId, address) {
  if (address.isDefault) {
    await sb().from('customer_addresses').update({ is_default: false }).eq('customer_id', customerId);
  }
  const row = {
    customer_id: customerId,
    label: address.label || 'Casa',
    address: address.address,
    reference: address.reference || '',
    city: address.city || '',
    branch_id: address.branchId || null,
    is_default: !!address.isDefault,
  };
  if (address.id) {
    const { data, error } = await sb().from('customer_addresses').update(row).eq('id', address.id).select().single();
    if (error) throw error;
    return mapAddress(data);
  }
  const { data, error } = await sb().from('customer_addresses').insert(row).select().single();
  if (error) throw error;
  return mapAddress(data);
}

export async function deleteAddress(addressId) {
  const { error } = await sb().from('customer_addresses').delete().eq('id', addressId);
  if (error) throw error;
}

function mapAddress(row) {
  return {
    id: row.id,
    label: row.label,
    address: row.address,
    reference: row.reference,
    city: row.city,
    branchId: row.branch_id,
    isDefault: row.is_default,
  };
}

function mapOrder(row) {
  const datos = row.datos_json || {};
  return {
    id: row.id,
    ticketNumber: row.codigo_pedido || datos.ticketNumber,
    createdAt: row.creado_en,
    estado: row.estado,
    total: Number(row.total) || 0,
    orderType: row.tipo_entrega,
    branchId: row.branch_id || row.sucursal_id,
    items: datos.items || [],
    customer: datos.customer || {
      name: row.cliente_nombre,
      phone: row.cliente_telefono,
      address: row.cliente_direccion,
      addressLat: row.cliente_lat ?? datos.customer?.addressLat ?? null,
      addressLng: row.cliente_lng ?? datos.customer?.addressLng ?? null,
    },
    trackingMode: datos.tracking_mode === 'live_map' || datos.tracking_mode === 'status_line'
      ? datos.tracking_mode
      : null,
    deliveryFee: datos.deliveryFee || 0,
  };
}

/** Tracking en vivo del pedido (mapa + coords) — solo dueño del pedido. */
export async function getCustomerOrderLiveTracking(orderId) {
  if (!isSupabaseConfigured() || !orderId) return null;
  const { data, error } = await sb().rpc('ep_customer_order_live_tracking', {
    p_order_id: String(orderId),
  });
  if (error) {
    const msg = error.message || '';
    // RPC no desplegado aún
    if (/does not exist|schema cache/i.test(msg)) {
      throw new Error('Falta ejecutar fix-order-tracking-modes.sql en Supabase para el mapa en vivo.');
    }
    if (/No autorizado|not authorized|permission/i.test(msg)) {
      throw new Error('No autorizado para ver el seguimiento de este pedido.');
    }
    console.warn('[Pollón] live tracking:', msg);
    throw new Error(msg || 'No se pudo cargar el seguimiento en vivo');
  }
  return data;
}

export async function getCustomerOrders(customerId) {
  const { data, error } = await sb()
    .from('pedidos')
    .select('*')
    .eq('customer_id', customerId)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapOrder);
}

/**
 * Vincula un pedido hecho como invitado a la cuenta del cliente
 * (código de seguimiento + teléfono del checkout).
 */
export async function claimOrderByTicket(ticketCode, phone) {
  const { data, error } = await sb().rpc('claim_order_by_ticket', {
    p_ticket: String(ticketCode || '').trim(),
    p_phone: String(phone || '').trim() || null,
  });
  if (error) {
    let msg = error.message || error.details || 'No se pudo vincular el pedido';
    msg = msg
      .replace(/^.*error:\s*/i, '')
      .replace(/^.*exception:\s*/i, '')
      .replace(/\s+CONTEXT:[\s\S]*$/i, '')
      .trim();
    if (/claim_order_by_ticket|function .* does not exist/i.test(msg)) {
      throw new Error(
        'Falta activar la función en Supabase. Ejecuta el SQL migration-claim-order-by-ticket.sql',
      );
    }
    throw new Error(msg || 'No se pudo vincular el pedido');
  }
  if (!data?.ok || !data?.order_id) {
    throw new Error('No se pudo vincular el pedido');
  }

  const order = await getOrderById(data.order_id);
  return {
    order,
    alreadyLinked: !!data.already_linked,
    orderId: data.order_id,
    ticketNumber: data.codigo_pedido,
  };
}

export async function getOrderById(orderId, customerId) {
  let q = sb().from('pedidos').select('*').eq('id', orderId);
  if (customerId) q = q.eq('customer_id', customerId);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data ? mapOrder(data) : null;
}

export async function getOrderStatusHistory(orderId) {
  const { data, error } = await sb()
    .from('order_status_history')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export function subscribeOrderUpdates(orderId, onUpdate) {
  const client = sb();
  const channel = client
    .channel(`order-${orderId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'pedidos',
      filter: `id=eq.${orderId}`,
    }, (payload) => {
      onUpdate(mapOrder(payload.new));
    })
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'order_status_history',
      filter: `order_id=eq.${orderId}`,
    }, async () => {
      const o = await getOrderById(orderId);
      if (o) onUpdate(o);
    })
    .subscribe();
  return () => client.removeChannel(channel);
}

/** Admin: listar clientes */
export async function adminListCustomers({ branchId, search, acceptsPromotions, limit = 120 } = {}) {
  let q = sb().from('profiles').select(`
    id, full_name, email, phone, is_active, created_at,
    customer_marketing_preferences(accepts_email_promotions, accepts_whatsapp_promotions)
  `).eq('role', ROLES.CLIENTE).order('created_at', { ascending: false }).limit(limit);

  if (search) {
    q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, error } = await q;
  if (error) throw error;

  let list = (data || []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    email: p.email,
    phone: p.phone,
    isActive: p.is_active,
    createdAt: p.created_at,
    acceptsEmail: p.customer_marketing_preferences?.[0]?.accepts_email_promotions,
    acceptsWhatsapp: p.customer_marketing_preferences?.[0]?.accepts_whatsapp_promotions,
  }));

  if (branchId) {
    const orderCounts = await adminCustomerOrderCountsByBranch(branchId);
    list = list.map((c) => ({
      ...c,
      orderCount: orderCounts[c.id] || 0,
      branchId,
    }));
  }

  if (acceptsPromotions === true) {
    list = list.filter((c) => c.acceptsEmail);
  }

  return list;
}

async function adminCustomerOrderCountsByBranch(branchId) {
  const { data } = await sb()
    .from('pedidos')
    .select('customer_id')
    .eq('branch_id', branchId)
    .not('customer_id', 'is', null)
    .limit(2000);
  const counts = {};
  (data || []).forEach((r) => {
    if (r.customer_id) counts[r.customer_id] = (counts[r.customer_id] || 0) + 1;
  });
  return counts;
}

export async function adminGetCustomerOrders(customerId) {
  const { data, error } = await sb().from('pedidos').select('*').eq('customer_id', customerId).order('creado_en', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapOrder);
}
