import { Banknote, Landmark, CreditCard, Check } from 'lucide-react';
import {
  PAYMENT_METHODS,
  normalizePaymentMethods,
} from '../../utils/paymentMethods';

const ICONS = {
  efectivo: Banknote,
  transferencia: Landmark,
  tarjeta: CreditCard,
};

export function PaymentMethodsEditor({ value, onChange, disabled = false }) {
  const selected = normalizePaymentMethods(value);

  const toggle = (id) => {
    if (disabled) return;
    const on = selected.includes(id);
    const next = on ? selected.filter((x) => x !== id) : [...selected, id];
    if (!next.length) return;
    onChange(normalizePaymentMethods(next));
  };

  return (
    <div>
      <div className="admin-pay-grid">
        {PAYMENT_METHODS.map((m) => {
          const on = selected.includes(m.id);
          const Icon = ICONS[m.id] || Banknote;
          return (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(m.id)}
              aria-pressed={on}
              className={`admin-pay-card admin-pay-card--${m.tone} ${on ? 'is-on' : ''}`}
            >
              <span className={`admin-pay-card__icon admin-pay-card__icon--${m.tone}`} aria-hidden>
                <Icon size={18} strokeWidth={2.1} />
              </span>
              <span className="admin-pay-card__label">{m.label}</span>
              <span className="admin-pay-card__hint">{m.desc}</span>
              <span className={`admin-pay-card__badge ${on ? 'is-on' : ''}`} aria-hidden>
                {on ? <Check size={11} strokeWidth={3} /> : null}
              </span>
            </button>
          );
        })}
      </div>
      <p className="admin-pay-grid__note">
        El cliente solo verá los métodos activos. Debe quedar al menos uno.
        Todos se cobran al momento de recibir el pedido.
      </p>
    </div>
  );
}
