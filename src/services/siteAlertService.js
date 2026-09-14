import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { getSetting, setSetting } from './settingsService';

export const SITE_ALERT_KEY = 'site_alert';

export function emptySiteAlert() {
  return {
    enabled: false,
    title: 'Aviso importante',
    message: '',
    updatedAt: null,
    branchId: null,
  };
}

export function normalizeSiteAlert(raw, branchId = null) {
  if (!raw || typeof raw !== 'object') return { ...emptySiteAlert(), branchId };
  const title = String(raw.title || raw.aviso_titulo || raw.alert_title || 'Aviso importante').trim();
  return {
    enabled: raw.enabled === true || raw.aviso_activo === true || raw.alert_enabled === true,
    title: title || 'Aviso importante',
    message: String(raw.message || raw.aviso_mensaje || raw.alert_message || '').trim(),
    updatedAt: raw.updatedAt || raw.updated_at || null,
    branchId: branchId || raw.branchId || null,
  };
}

export function alertFromBranch(branch) {
  if (!branch?.id) return emptySiteAlert();
  return normalizeSiteAlert({
    enabled: branch.alertEnabled,
    title: branch.alertTitle,
    message: branch.alertMessage,
    updatedAt: branch.alertUpdatedAt,
  }, branch.id);
}

export async function fetchSiteAlert(branchId) {
  if (!isSupabaseConfigured() || !branchId) return emptySiteAlert();
  const sb = getSupabase();

  try {
    const value = await getSetting(SITE_ALERT_KEY, branchId);
    const fromSettings = normalizeSiteAlert(value, branchId);
    if (value) return fromSettings;
  } catch {
    /* settings puede no existir */
  }

  try {
    const { data, error } = await sb
      .from('branches')
      .select('alert_enabled, alert_title, alert_message')
      .eq('id', branchId)
      .maybeSingle();
    if (!error && data) return normalizeSiteAlert(data, branchId);
  } catch {
    /* columnas aún no migradas */
  }

  return { ...emptySiteAlert(), branchId };
}

export async function saveSiteAlert(alert, branchId) {
  if (!isSupabaseConfigured()) throw new Error('Supabase no configurado');
  if (!branchId) {
    throw new Error('Elige la sucursal a la que aplica este aviso.');
  }
  const payload = {
    enabled: !!alert.enabled,
    title: String(alert.title || 'Aviso importante').trim() || 'Aviso importante',
    message: String(alert.message || '').trim(),
    updatedAt: new Date().toISOString(),
    branchId,
  };
  if (payload.enabled && !payload.message) {
    throw new Error('Escribe el texto del aviso antes de activarlo.');
  }

  const sb = getSupabase();
  const errors = [];

  try {
    await setSetting(SITE_ALERT_KEY, payload, branchId);
  } catch (e) {
    errors.push(e.message || String(e));
  }

  const { error: colError } = await sb
    .from('branches')
    .update({
      alert_enabled: payload.enabled,
      alert_title: payload.title,
      alert_message: payload.message,
    })
    .eq('id', branchId);
  if (colError) errors.push(colError.message);
  else return payload;

  if (errors.length < 2) return payload;

  const hint = errors.some((m) => /alert_|column|schema cache|does not exist|settings/i.test(m || ''))
    ? ' Ejecuta en Supabase el archivo supabase/add-branch-site-alert.sql y vuelve a guardar.'
    : '';
  throw new Error(`No se pudo guardar el aviso de esta sucursal.${hint}`);
}
