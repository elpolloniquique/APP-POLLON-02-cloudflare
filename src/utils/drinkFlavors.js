import { MODAL_DRINK_OPTIONS } from './productOptions';

/** Clave en `settings` (por sucursal). */
export const DRINK_FLAVORS_SETTING_KEY = 'drink_flavors';

export function defaultDrinkFlavors() {
  return MODAL_DRINK_OPTIONS.map((name, i) => ({
    id: `default-${i + 1}`,
    name,
    active: true,
    sort: (i + 1) * 10,
  }));
}

function slugId(name, idx) {
  const base = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${base || 'sabor'}-${idx + 1}`;
}

/**
 * Normaliza lista desde settings / editor.
 * Acepta array de strings o de objetos { id, name, active, sort }.
 * @param {unknown} raw
 * @param {{ keepEmpty?: boolean }} [opts] keepEmpty=true conserva filas nuevas sin nombre (editor).
 */
export function normalizeDrinkFlavors(raw, opts = {}) {
  const keepEmpty = opts.keepEmpty === true;
  let list = raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray(raw.flavors)) {
    list = raw.flavors;
  }
  if (!Array.isArray(list) || !list.length) {
    return defaultDrinkFlavors();
  }

  const out = [];
  const seen = new Set();
  list.forEach((item, idx) => {
    const name = String(typeof item === 'string' ? item : item?.name || '').trim();
    const id = String(
      (typeof item === 'object' && item?.id) || slugId(name || 'nuevo', idx),
    ).trim();
    const active = typeof item === 'object' && item && 'active' in item
      ? item.active !== false
      : true;
    const sort = Number.isFinite(Number(item?.sort))
      ? Number(item.sort)
      : (idx + 1) * 10;

    if (!name) {
      if (keepEmpty) {
        out.push({ id: id || `new-${idx}-${Date.now()}`, name: '', active, sort });
      }
      return;
    }

    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ id: id || slugId(name, idx), name, active, sort });
  });

  if (!out.length) return keepEmpty ? [emptyDrinkFlavor(10)] : defaultDrinkFlavors();
  // No reordenar por nombre en el editor: respeta el orden de la lista
  if (keepEmpty) return out;
  return out.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'es'));
}

/** Nombres activos para el modal de la tienda. */
export function activeDrinkFlavorNames(flavors) {
  const list = normalizeDrinkFlavors(flavors)
    .filter((f) => f.active)
    .map((f) => f.name);
  return list.length ? list : MODAL_DRINK_OPTIONS.slice();
}

export function emptyDrinkFlavor(sort = 10) {
  return {
    id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    active: true,
    sort,
  };
}
