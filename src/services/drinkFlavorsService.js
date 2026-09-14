import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { getSetting, setSetting } from './settingsService';
import {
  DRINK_FLAVORS_SETTING_KEY,
  activeDrinkFlavorNames,
  defaultDrinkFlavors,
  normalizeDrinkFlavors,
} from '../utils/drinkFlavors';

function toPayload(flavors) {
  const normalized = normalizeDrinkFlavors(flavors, { keepEmpty: true });
  const withNames = normalized.filter((f) => String(f.name || '').trim());
  if (!withNames.length) {
    throw new Error('Agrega al menos un sabor de bebida.');
  }
  if (!withNames.some((f) => f.active !== false)) {
    throw new Error('Debe quedar al menos un sabor activo.');
  }
  return {
    flavors: withNames.map((f, i) => ({
      id: f.id || `flavor-${i + 1}`,
      name: String(f.name).trim(),
      active: f.active !== false,
      sort: (i + 1) * 10,
    })),
    updatedAt: new Date().toISOString(),
  };
}

async function readFromBranch(branchId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('branches')
    .select('drink_flavors')
    .eq('id', branchId)
    .maybeSingle();
  if (error) {
    // Columna aún no migrada
    if (/drink_flavors|column|schema cache|does not exist/i.test(error.message || '')) {
      return null;
    }
    throw error;
  }
  return data?.drink_flavors ?? null;
}

async function writeToBranch(branchId, payload) {
  const sb = getSupabase();
  const { error } = await sb
    .from('branches')
    .update({
      drink_flavors: payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', branchId);
  if (error) throw error;
}

export async function fetchDrinkFlavors(branchId) {
  if (!isSupabaseConfigured() || !branchId) {
    return defaultDrinkFlavors();
  }
  try {
    const fromBranch = await readFromBranch(branchId);
    if (fromBranch != null) {
      return normalizeDrinkFlavors(fromBranch, { keepEmpty: true });
    }
  } catch {
    /* seguir con settings */
  }
  try {
    const value = await getSetting(DRINK_FLAVORS_SETTING_KEY, branchId);
    if (value != null) return normalizeDrinkFlavors(value, { keepEmpty: true });
  } catch {
    /* defaults */
  }
  return defaultDrinkFlavors();
}

/** Solo nombres activos (modal tienda). */
export async function fetchActiveDrinkFlavorNames(branchId) {
  const flavors = await fetchDrinkFlavors(branchId);
  return activeDrinkFlavorNames(flavors);
}

export async function saveDrinkFlavors(flavors, branchId) {
  if (!isSupabaseConfigured()) throw new Error('Supabase no configurado');
  if (!branchId) throw new Error('Falta la sucursal para guardar los sabores de bebida.');

  const payload = toPayload(flavors);
  const errors = [];

  try {
    await writeToBranch(branchId, payload);
    return normalizeDrinkFlavors(payload, { keepEmpty: true });
  } catch (e) {
    errors.push(e?.message || String(e));
  }

  try {
    await setSetting(DRINK_FLAVORS_SETTING_KEY, payload, branchId);
    return normalizeDrinkFlavors(payload, { keepEmpty: true });
  } catch (e) {
    errors.push(e?.message || String(e));
  }

  const needsSql = errors.some((m) => /drink_flavors|column|schema cache|does not exist|settings|conflict/i.test(m || ''));
  throw new Error(
    needsSql
      ? 'No se pudieron guardar los sabores. Ejecuta en Supabase el archivo supabase/add-branch-drink-flavors.sql y vuelve a guardar.'
      : (errors[0] || 'No se pudieron guardar los sabores de bebida.'),
  );
}
