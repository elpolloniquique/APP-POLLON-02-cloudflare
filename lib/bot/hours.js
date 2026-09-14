/** Horario sucursal (misma idea que branchService) */

function parseScheduleWindow(schedule) {
  if (!schedule || typeof schedule !== 'string') return null;
  const m = schedule.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const toMin = (h, min) => Number(h) * 60 + Number(min);
  return { start: toMin(m[1], m[2]), end: toMin(m[3], m[4]) };
}

export function isOpenNow(schedule, extra = {}) {
  if (extra.isActive === false) return false;
  if (extra.isOpen === false) return false;
  const window = parseScheduleWindow(schedule);
  if (!window) return extra.isOpen !== false;
  const now = extra.now instanceof Date ? extra.now : new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (window.end < window.start) return mins >= window.start || mins <= window.end;
  return mins >= window.start && mins <= window.end;
}

export function mapBranch(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug || '',
    name: row.name || 'Sucursal',
    city: row.city || '',
    address: row.address || '',
    schedule: row.opening_hours || row.horario || 'Lun-Dom: 11:30 - 23:00',
    phone: row.phone || '',
    whatsapp: row.whatsapp || '',
    isActive: row.is_active !== false,
    isOpen: row.is_active !== false && row.abierta !== false,
    deliveryEnabled: row.delivery_enabled !== false,
    pickupEnabled: row.pickup_enabled !== false,
    reservationsEnabled: row.reservations_enabled !== false,
    deliveryCost: row.delivery_cost ?? row.costo_delivery ?? '',
    deliveryEta: row.delivery_eta || row.tiempo_entrega || '30-45 min',
    paymentMethods: row.payment_methods || ['efectivo', 'transferencia'],
  };
}
