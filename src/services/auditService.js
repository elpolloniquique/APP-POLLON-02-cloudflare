import { getSupabase, isSupabaseConfigured } from './supabaseClient';

export async function logAudit({ user, branchId, entityType, entityId, action, oldData, newData }) {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from('audit_logs').insert({
      user_id: user?.id || null,
      user_email: user?.email || null,
      branch_id: branchId || null,
      entity_type: entityType,
      entity_id: entityId || null,
      action,
      old_data: oldData || null,
      new_data: newData || null,
    });
  } catch (e) {
    console.warn('[Pollón] audit:', e.message);
  }
}

export async function getAuditLogs(branchId, limit = 50) {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabase();
  let q = sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (branchId) q = q.eq('branch_id', branchId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
