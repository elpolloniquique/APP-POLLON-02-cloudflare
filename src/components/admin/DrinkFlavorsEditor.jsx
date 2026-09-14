import { useEffect, useRef } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { defaultDrinkFlavors, emptyDrinkFlavor } from '../../utils/drinkFlavors';

function asList(value) {
  if (Array.isArray(value) && value.length) return value;
  return defaultDrinkFlavors();
}

export function DrinkFlavorsEditor({ value, onChange, disabled = false }) {
  const flavors = asList(value);
  const focusNewRef = useRef(false);
  const lastInputRef = useRef(null);

  useEffect(() => {
    if (!focusNewRef.current) return;
    focusNewRef.current = false;
    window.requestAnimationFrame(() => lastInputRef.current?.focus());
  }, [flavors.length]);

  const commit = (next) => {
    if (typeof onChange === 'function') onChange(next);
  };

  const updateAt = (index, patch) => {
    if (disabled) return;
    commit(flavors.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const addFlavor = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (disabled) return;
    const sort = (flavors[flavors.length - 1]?.sort || flavors.length * 10) + 10;
    focusNewRef.current = true;
    commit([...flavors, emptyDrinkFlavor(sort)]);
  };

  const removeAt = (index) => {
    if (disabled) return;
    if (flavors.length <= 1) return;
    commit(flavors.filter((_, i) => i !== index));
  };

  const move = (index, dir) => {
    if (disabled) return;
    const j = index + dir;
    if (j < 0 || j >= flavors.length) return;
    const next = [...flavors];
    const tmp = next[index];
    next[index] = next[j];
    next[j] = tmp;
    commit(next.map((f, i) => ({ ...f, sort: (i + 1) * 10 })));
  };

  return (
    <div className="admin-drink-flavors">
      <ul className="admin-drink-flavors__list">
        {flavors.map((flavor, index) => (
          <li key={flavor.id || `row-${index}`} className="admin-drink-flavors__row">
            <div className="admin-drink-flavors__order" aria-hidden>
              <button
                type="button"
                className="admin-drink-flavors__move"
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
                title="Subir"
              >
                <GripVertical size={14} />
              </button>
              <span className="admin-drink-flavors__num">{index + 1}</span>
            </div>
            <input
              ref={index === flavors.length - 1 ? lastInputRef : undefined}
              type="text"
              className="admin-config-input"
              value={flavor.name ?? ''}
              disabled={disabled}
              placeholder="Ej: Pepsi, Bilz, Pap"
              maxLength={40}
              onChange={(e) => updateAt(index, { name: e.target.value })}
            />
            <label className="admin-drink-flavors__active">
              <input
                type="checkbox"
                checked={flavor.active !== false}
                disabled={disabled}
                onChange={(e) => updateAt(index, { active: e.target.checked })}
              />
              <span>Activo</span>
            </label>
            <button
              type="button"
              className="admin-drink-flavors__remove"
              disabled={disabled || flavors.length <= 1}
              onClick={() => removeAt(index)}
              title="Quitar sabor"
              aria-label={`Quitar ${flavor.name || 'sabor'}`}
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="admin-drink-flavors__add"
        disabled={disabled}
        onClick={addFlavor}
      >
        <Plus size={16} strokeWidth={2.5} />
        Agregar sabor
      </button>

      <p className="admin-drink-flavors__note">
        Estos sabores aparecen en el modal del menú cuando el producto tiene “Selección de bebida”
        activa (p. ej. Ofertas Familiares). Desactiva un sabor para ocultarlo sin borrarlo.
        Escribe el nombre y pulsa “Guardar sabores”.
      </p>
    </div>
  );
}
