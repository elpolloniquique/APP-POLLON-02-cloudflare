import { DEFAULT_RESERVATION_SLOT } from '../../utils/orderTypeConfig';

const DAY_OPTIONS = [
  { id: 1, label: 'Lun' },
  { id: 2, label: 'Mar' },
  { id: 3, label: 'Mié' },
  { id: 4, label: 'Jue' },
  { id: 5, label: 'Vie' },
  { id: 6, label: 'Sáb' },
  { id: 0, label: 'Dom' },
];

function toggleDay(days, dayId) {
  return days.includes(dayId) ? days.filter((d) => d !== dayId) : [...days, dayId];
}

export function ReservationScheduleEditor({ value, onChange }) {
  const slots = value?.slots?.length ? value.slots : [{ ...DEFAULT_RESERVATION_SLOT }];

  const updateSlots = (next) => onChange({ slots: next });

  const updateSlot = (index, patch) => {
    updateSlots(slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  };

  const addSlot = () => {
    updateSlots([...slots, { ...DEFAULT_RESERVATION_SLOT, days: [5, 6] }]);
  };

  const removeSlot = (index) => {
    if (slots.length <= 1) {
      updateSlots([{ ...DEFAULT_RESERVATION_SLOT }]);
      return;
    }
    updateSlots(slots.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {slots.map((slot, index) => (
        <div key={index} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-600">
              Franja {index + 1}
            </p>
            {slots.length > 1 && (
              <button
                type="button"
                onClick={() => removeSlot(index)}
                className="text-xs font-medium text-red-600 hover:text-red-700"
              >
                Quitar
              </button>
            )}
          </div>

          <p className="mb-2 text-xs text-gray-500">Días disponibles para reservar</p>
          <div className="flex flex-wrap gap-1.5">
            {DAY_OPTIONS.map(({ id, label }) => {
              const active = slot.days?.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => updateSlot(index, { days: toggleDay(slot.days || [], id) })}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                    active
                      ? 'bg-pollon-red text-white shadow-sm'
                      : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Desde</label>
              <input
                type="time"
                value={slot.start || '18:00'}
                onChange={(e) => updateSlot(index, { start: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Hasta</label>
              <input
                type="time"
                value={slot.end || '22:00'}
                onChange={(e) => updateSlot(index, { end: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addSlot}
        className="text-sm font-medium text-pollon-red hover:text-pollon-red-dark"
      >
        + Agregar otra franja horaria
      </button>
    </div>
  );
}
