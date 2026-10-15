export const MAX_ORDER_OPTIONS = [2, 3, 4];
export const EMPTY_MOTO = { fullName: '', email: '', password: '', phone: '', plate: '' };

export const STATUS_LABELS = {
  pending: { label: 'Pendiente', cls: 'fleet-chip--amber' },
  approved: { label: 'Aprobado', cls: 'fleet-chip--green' },
  rejected: { label: 'Rechazado', cls: 'fleet-chip--red' },
  suspended: { label: 'Suspendido', cls: 'fleet-chip--orange' },
  blocked: { label: 'Bloqueado', cls: 'fleet-chip--red' },
};

export const JOB_PRIORITY = {
  urgente: { key: 'urgente', label: 'Urgente', cta: 'Asignar Moto' },
  estandar: { key: 'estandar', label: 'Estándar', cta: 'Asignar Moto' },
  nuevo: { key: 'nuevo', label: 'Nuevo', cta: 'Asignar Moto' },
};

export function driverPhone(d) {
  return d?.profiles?.phone || d?.phone || d?.profiles?.telefono || '';
}

export function driverFirstName(d) {
  const full = String(d?.profiles?.full_name || d?.profiles?.email || 'repartidor').trim();
  return full.split(/\s+/)[0] || 'repartidor';
}

export function ticketLabel(job) {
  const raw = String(job?.ticket_code || job?.codigo_pedido || '').replace(/^#/, '').trim();
  if (!raw) return 'el pedido';
  const padded = /^\d+$/.test(raw) ? raw.padStart(6, '0') : raw;
  return `#${padded}`;
}

export function fleetAssignWhatsappMessage(driver, job) {
  return `Hola ${driverFirstName(driver)}, por favor acepte el pedido ${ticketLabel(job)} desde su app Pollón.`;
}

export function normalizeMaxOrders(value) {
  const n = Number(value);
  return MAX_ORDER_OPTIONS.includes(n) ? n : 2;
}

export function motoAssignStatus(d) {
  const max = Math.max(1, Number(d?.live_max ?? d?.max_orders) || 2);
  const active = Number(d?.live_active) || 0;
  const delivering = Boolean(d?.live_delivering)
    || String(d?.operational_status || '').toLowerCase() === 'delivering';
  return { max, active, delivering, available: !delivering && active < max };
}

export function motoAvailHint(st) {
  if (st.available) {
    return st.active > 0
      ? `${st.active} de ${st.max} · aún no recoge`
      : 'Sin pedido en curso';
  }
  if (st.delivering) return 'Va hacia el cliente';
  return `Cupo lleno ${st.active}/${st.max}`;
}

export function jobAddressLine(job) {
  const addr = String(job?.customer_address || '').trim();
  const notes = String(job?.notes || '').trim();
  if (addr && notes && !addr.toLowerCase().includes('ref')) {
    return `${addr} | Ref: ${notes}`;
  }
  return addr || notes || 'Sin dirección';
}

export function jobPriority(job) {
  const ts = new Date(job?.created_at || job?.updated_at || 0).getTime();
  const ageMin = (Date.now() - ts) / 60000;
  if (!Number.isFinite(ageMin) || ageMin < 4) return JOB_PRIORITY.nuevo;
  if (ageMin >= 12) return JOB_PRIORITY.urgente;
  return JOB_PRIORITY.estandar;
}

export function bossDisplayName(profile, fallback) {
  const raw = String(
    profile?.fullName || profile?.nombre || profile?.full_name || fallback || '',
  ).trim();
  const first = raw.split(/\s+/)[0] || 'Jefe';
  return first.toUpperCase();
}
