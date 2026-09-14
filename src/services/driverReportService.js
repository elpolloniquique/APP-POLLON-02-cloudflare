import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { resolveCajaPagoStatus, CAJA_PAGO } from '../utils/cajaPago';

/**
 * Comisión del repartidor sobre el delivery.
 * Default 5% si no se indica otro porcentaje por repartidor.
 */
export const DRIVER_DELIVERY_COMMISSION_RATE = 0.05;

export function calcDeliveryCommission(deliveryFee, percent = null) {
  const fee = Number(deliveryFee) || 0;
  const rate = percent == null || percent === ''
    ? DRIVER_DELIVERY_COMMISSION_RATE
    : (Number(percent) || 0) / 100;
  return Math.round(fee * rate);
}

function parseComisionCobro(datos) {
  const v = datos?.comision_repartidor_pago;
  if (v === 'pagado' || v === 'por_pagar' || v === 'na') return v;
  return null;
}

function dayStartISO(dateStr, timeStr = '00:00') {
  const [h, m] = String(timeStr || '00:00').split(':');
  const d = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m || '0').padStart(2, '0')}:00`);
  return d.toISOString();
}

function dayEndISO(dateStr, timeStr = '23:59') {
  const [h, m] = String(timeStr || '23:59').split(':');
  const d = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m || '59').padStart(2, '0')}:59`);
  return d.toISOString();
}

/**
 * Filas del reporte de repartidores (una por pedido/delivery asignado).
 */
export async function fetchDriverReportRows({
  fromDate,
  toDate,
  fromTime = '00:00',
  toTime = '23:59',
  branchId = null,
  driverId = null,
} = {}) {
  if (!isSupabaseConfigured()) {
    return demoRows();
  }

  const sb = getSupabase();
  const fromIso = dayStartISO(fromDate, fromTime);
  const toIso = dayEndISO(toDate, toTime);

  let q = sb
    .from('ep_delivery_jobs')
    .select(
      'id, source_order_id, branch_id, ticket_code, status, customer_name, customer_phone, order_total, delivery_fee, assigned_driver_id, assigned_at, delivered_at, created_at'
    )
    .not('assigned_driver_id', 'is', null)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })
    .limit(800);

  if (branchId) q = q.eq('branch_id', branchId);
  if (driverId) q = q.eq('assigned_driver_id', driverId);

  const { data: jobs, error } = await q;
  if (error) throw new Error(error.message || 'No se pudo cargar el reporte');

  if (!jobs?.length) return [];

  const driverIds = [...new Set(jobs.map((j) => j.assigned_driver_id).filter(Boolean))];
  const orderIds = [...new Set(jobs.map((j) => j.source_order_id).filter(Boolean))];
  const branchIds = [...new Set(jobs.map((j) => j.branch_id).filter(Boolean))];

  const [{ data: drivers }, { data: branches }, { data: pedidos }] = await Promise.all([
    sb.from('ep_driver_profiles').select('id, profile_id, vehicle_plate, commission_percent').in('id', driverIds),
    branchIds.length
      ? sb.from('branches').select('id, name').in('id', branchIds)
      : Promise.resolve({ data: [] }),
    orderIds.length
      ? sb.from('pedidos').select('id, total, datos_json, cliente_nombre, cliente_telefono, codigo_pedido').in('id', orderIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileIds = [...new Set((drivers || []).map((d) => d.profile_id).filter(Boolean))];
  let profilesById = {};
  if (profileIds.length) {
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, full_name, phone, email')
      .in('id', profileIds);
    profilesById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  }

  const driverById = Object.fromEntries(
    (drivers || []).map((d) => {
      const p = profilesById[d.profile_id] || {};
      return [d.id, {
        id: d.id,
        name: p.full_name || p.email || 'Repartidor',
        phone: p.phone || '',
        plate: d.vehicle_plate || '',
        commissionPercent: d.commission_percent == null ? 5 : Number(d.commission_percent),
      }];
    })
  );

  const branchById = Object.fromEntries((branches || []).map((b) => [b.id, b.name]));
  const pedidoById = Object.fromEntries((pedidos || []).map((p) => [p.id, p]));

  return jobs.map((j) => {
    const pedido = pedidoById[j.source_order_id] || null;
    const datos = pedido?.datos_json || {};
    const deliveryFee = Number(j.delivery_fee) || Number(datos.deliveryFee) || 0;
    const pedidoTotal = Number(pedido?.total) || 0;
    const jobOrderTotal = Number(j.order_total) || 0;

    let subTotal;
    let total;
    if (pedidoTotal > 0) {
      total = pedidoTotal;
      subTotal = Math.max(0, pedidoTotal - deliveryFee);
    } else {
      subTotal = jobOrderTotal;
      total = subTotal + deliveryFee;
    }

    const comisionCobro = parseComisionCobro(datos);

    const driver = driverById[j.assigned_driver_id] || { id: j.assigned_driver_id, name: 'Repartidor' };

    return {
      id: j.id,
      jobId: j.id,
      orderId: j.source_order_id,
      ticket: j.ticket_code || pedido?.codigo_pedido || '',
      driverId: j.assigned_driver_id,
      driverName: driver.name,
      branchId: j.branch_id,
      branchName: branchById[j.branch_id] || 'El Pollón',
      customerName: j.customer_name || pedido?.cliente_nombre || '—',
      customerPhone: j.customer_phone || pedido?.cliente_telefono || '',
      subTotal,
      deliveryFee,
      total,
      commission: calcDeliveryCommission(deliveryFee, driver.commissionPercent),
      commissionPercent: driver.commissionPercent ?? 5,
      /** Cobro de la comisión del repartidor (NO el pago del cliente) */
      comisionCobro,
      cobro: resolveCajaPagoStatus({ cajaPago: comisionCobro }),
      jobStatus: j.status,
      createdAt: j.created_at,
      deliveredAt: j.delivered_at,
    };
  });
}

export async function fetchDriverOptionsForReport(branchId = null) {
  if (!isSupabaseConfigured()) {
    return [
      { id: 'd1', name: 'Akiles Tutacane Huillca' },
      { id: 'd2', name: 'Repartidor Demo' },
    ];
  }
  const sb = getSupabase();
  let q = sb
    .from('ep_driver_profiles')
    .select('id, profile_id, admin_status, preferred_branch_id')
    .eq('admin_status', 'approved')
    .order('created_at', { ascending: false })
    .limit(200);
  if (branchId) q = q.eq('preferred_branch_id', branchId);
  const { data: drivers, error } = await q;
  if (error) throw new Error(error.message);

  const profileIds = [...new Set((drivers || []).map((d) => d.profile_id).filter(Boolean))];
  let profilesById = {};
  if (profileIds.length) {
    const { data: profiles } = await sb.from('profiles').select('id, full_name, email').in('id', profileIds);
    profilesById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  }

  return (drivers || []).map((d) => ({
    id: d.id,
    name: profilesById[d.profile_id]?.full_name || profilesById[d.profile_id]?.email || 'Repartidor',
  }));
}

export async function updateDriverCommissionCobro(orderId, status) {
  if (!orderId || !['na', 'por_pagar', 'pagado'].includes(status)) {
    throw new Error('Estado de cobro de comisión inválido');
  }
  if (!isSupabaseConfigured()) return { ok: true, demo: true };

  const sb = getSupabase();
  const { data: row, error: readErr } = await sb
    .from('pedidos')
    .select('id, datos_json')
    .eq('id', orderId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!row) throw new Error('Pedido no encontrado');

  const datos = { ...(row.datos_json || {}), comision_repartidor_pago: status };
  const { error } = await sb.from('pedidos').update({ datos_json: datos }).eq('id', orderId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** @deprecated usar updateDriverCommissionCobro */
export async function updateOrderCajaPago(orderId, cajaPago) {
  return updateDriverCommissionCobro(orderId, cajaPago);
}

function demoRows() {
  const base = [
    { driver: 'Akiles Tutacane Huillca', customer: 'Yuvinzan Alday', phone: '986587951', sub: 25700, fee: 2500, cobro: CAJA_PAGO.POR_PAGAR },
    { driver: 'Akiles Tutacane Huillca', customer: 'Rita', phone: '987654321', sub: 25200, fee: 2500, cobro: CAJA_PAGO.POR_PAGAR },
    { driver: 'Akiles Tutacane Huillca', customer: 'Azrael', phone: '912345678', sub: 20250, fee: 4000, cobro: CAJA_PAGO.PAGADO },
    { driver: 'Akiles Tutacane Huillca', customer: 'Carlos', phone: '998877665', sub: 20250, fee: 4000, cobro: CAJA_PAGO.NA },
  ];
  return base.map((r, i) => ({
    id: `demo-${i}`,
    jobId: `demo-job-${i}`,
    orderId: `demo-ord-${i}`,
    ticket: String(1000 + i),
    driverId: 'd1',
    driverName: r.driver,
    branchId: null,
    branchName: 'El Pollón _ Iquique',
    customerName: r.customer,
    customerPhone: r.phone,
    subTotal: r.sub,
    deliveryFee: r.fee,
    total: r.sub + r.fee,
    commission: calcDeliveryCommission(r.fee),
    comisionCobro: r.cobro,
    cobro: r.cobro,
    jobStatus: 'delivered',
    createdAt: new Date().toISOString(),
  }));
}
