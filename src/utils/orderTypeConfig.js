import { ORDER_TYPE_LABELS } from './constants';

export const ORDER_TYPE_IDS = ['delivery', 'retiro', 'reserva'];

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const DEFAULT_RESERVATION_SLOT = {
  days: [5, 6],
  start: '18:00',
  end: '22:00',
};

export function emptyReservationSchedule() {
  return { slots: [] };
}

export function normalizeReservationSchedule(raw) {
  if (!raw) return emptyReservationSchedule();
  if (typeof raw === 'string') {
    try {
      return normalizeReservationSchedule(JSON.parse(raw));
    } catch {
      return emptyReservationSchedule();
    }
  }
  const slots = Array.isArray(raw.slots)
    ? raw.slots
        .map((slot) => ({
          days: Array.isArray(slot.days) ? slot.days.filter((d) => d >= 0 && d <= 6) : [],
          start: String(slot.start || '11:30').slice(0, 5),
          end: String(slot.end || '22:00').slice(0, 5),
        }))
        .filter((slot) => slot.days.length > 0)
    : [];
  return { slots };
}

export function getAvailableOrderTypes(branch) {
  if (!branch) return [];
  const types = [];
  if (branch.deliveryEnabled !== false) types.push('delivery');
  if (branch.pickupEnabled !== false) types.push('retiro');
  if (branch.reservationsEnabled !== false) types.push('reserva');
  return types;
}

export function getDefaultOrderType(branch) {
  const types = getAvailableOrderTypes(branch);
  return types[0] || 'delivery';
}

export function getPickupMinOrder(branch) {
  return Math.max(0, Number(branch?.pickupMinOrder) || 0);
}

export function getReservationMinOrder(branch) {
  return Math.max(0, Number(branch?.reservationMinOrder) || 0);
}

function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map((n) => Number(n) || 0);
  return h * 60 + m;
}

function isTimeInSlot(mins, start, end) {
  if (end < start) return mins >= start || mins <= end;
  return mins >= start && mins <= end;
}

export function isReservationAvailableNow(branch, date = new Date()) {
  if (branch?.reservationsEnabled === false) return false;
  const { slots } = normalizeReservationSchedule(branch?.reservationSchedule);
  if (!slots.length) return true;

  const day = date.getDay();
  const mins = date.getHours() * 60 + date.getMinutes();

  return slots.some((slot) => {
    if (!slot.days.includes(day)) return false;
    return isTimeInSlot(mins, timeToMinutes(slot.start), timeToMinutes(slot.end));
  });
}

function formatDaysList(days) {
  const sorted = [...new Set(days)].sort((a, b) => {
    const order = (d) => (d === 0 ? 7 : d);
    return order(a) - order(b);
  });
  return sorted.map((d) => DAY_LABELS[d]).join(', ');
}

export function formatReservationScheduleSummary(branch) {
  const { slots } = normalizeReservationSchedule(branch?.reservationSchedule);
  if (!slots.length) return '';
  return slots
    .map((slot) => `${formatDaysList(slot.days)} ${slot.start}–${slot.end}`)
    .join(' · ');
}

export function formatReservationScheduleShort(branch) {
  const summary = formatReservationScheduleSummary(branch);
  return summary ? `Horario de reservas: ${summary}` : '';
}

export function validateOrderTypeChoice(branch, orderType, subtotal) {
  const available = getAvailableOrderTypes(branch);
  if (!available.length) {
    return 'Esta sucursal no tiene tipos de pedido disponibles en este momento';
  }
  if (!available.includes(orderType)) {
    const label = ORDER_TYPE_LABELS[orderType] || orderType;
    return `${label} no está disponible en esta sucursal`;
  }

  const total = Number(subtotal) || 0;

  if (orderType === 'retiro') {
    const min = getPickupMinOrder(branch);
    if (min > 0 && total < min) {
      return `Retiro en local requiere un pedido mínimo de $${min.toLocaleString('es-CL')}`;
    }
  }

  if (orderType === 'reserva') {
    const min = getReservationMinOrder(branch);
    if (min > 0 && total < min) {
      return `Las reservas aplican a pedidos desde $${min.toLocaleString('es-CL')} (pedidos grandes)`;
    }
    if (!isReservationAvailableNow(branch)) {
      const summary = formatReservationScheduleSummary(branch);
      return summary
        ? `Las reservas solo están disponibles: ${summary}`
        : 'Las reservas no están disponibles en este horario';
    }
  }

  return null;
}

export function getOrderTypeHint(branch, orderType, subtotal) {
  if (orderType === 'retiro') {
    const min = getPickupMinOrder(branch);
    if (min <= 0) return null;
    const total = Number(subtotal) || 0;
    if (total < min) {
      return {
        variant: 'warning',
        text: `Retiro en local: pedido mínimo $${min.toLocaleString('es-CL')}. Tu carrito: $${total.toLocaleString('es-CL')}.`,
      };
    }
    return {
      variant: 'info',
      text: `Retiro en local disponible desde $${min.toLocaleString('es-CL')}.`,
    };
  }

  if (orderType === 'reserva') {
    const parts = [];
    const min = getReservationMinOrder(branch);
    const total = Number(subtotal) || 0;
    if (min > 0) {
      parts.push(
        total < min
          ? `Reserva para pedidos grandes: mínimo $${min.toLocaleString('es-CL')}.`
          : `Pedido apto para reserva (mín. $${min.toLocaleString('es-CL')}).`,
      );
    }
    const schedule = formatReservationScheduleShort(branch);
    if (schedule) parts.push(schedule);
    if (!isReservationAvailableNow(branch)) {
      parts.push('Fuera del horario de reservas en este momento.');
    }
    if (!parts.length) return null;
    const isWarning = (min > 0 && total < min) || !isReservationAvailableNow(branch);
    return { variant: isWarning ? 'warning' : 'info', text: parts.join(' ') };
  }

  return null;
}
