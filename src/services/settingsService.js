import { getSupabase, isSupabaseConfigured } from './supabaseClient';

export async function getSetting(key, branchId = null) {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  let q = sb.from('settings').select('value').eq('key', key);
  if (branchId) q = q.eq('branch_id', branchId);
  else q = q.is('branch_id', null);
  const { data } = await q.maybeSingle();
  return data?.value ?? null;
}

export async function setSetting(key, value, branchId = null) {
  if (!isSupabaseConfigured()) throw new Error('Supabase no configurado');
  const sb = getSupabase();
  if (!branchId) {
    await upsertGlobalSetting(key, value);
    return;
  }

  // Evitar onConflict (falla si el UNIQUE no coincide en PostgREST)
  const { data, error: readError } = await sb
    .from('settings')
    .select('id')
    .eq('key', key)
    .eq('branch_id', branchId)
    .maybeSingle();
  if (readError) throw readError;

  if (data?.id) {
    const { error } = await sb
      .from('settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('id', data.id);
    if (error) throw error;
    return;
  }

  const { error } = await sb.from('settings').insert({ key, value, branch_id: branchId });
  if (error) throw error;
}

/** Postgres trata cada NULL como distinto en UNIQUE(key, branch_id); upsert global va por id. */
export async function upsertGlobalSetting(key, value) {
  if (!isSupabaseConfigured()) throw new Error('Supabase no configurado');
  const sb = getSupabase();
  const { data, error: readError } = await sb
    .from('settings')
    .select('id')
    .eq('key', key)
    .is('branch_id', null)
    .maybeSingle();
  if (readError) throw readError;
  if (data?.id) {
    const { error } = await sb.from('settings').update({ value, updated_at: new Date().toISOString() }).eq('id', data.id);
    if (error) throw error;
    return;
  }
  const { error } = await sb.from('settings').insert({ key, value, branch_id: null });
  if (error) throw error;
}

export async function getBranchSettings(branchId) {
  if (!isSupabaseConfigured()) return {};
  const sb = getSupabase();
  const { data } = await sb.from('settings').select('key, value').eq('branch_id', branchId);
  const out = {};
  (data || []).forEach((r) => { out[r.key] = r.value; });
  return out;
}
