import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { logAudit } from './auditService';

function sb() {
  const client = getSupabase();
  if (!client) throw new Error('Supabase no configurado');
  return client;
}

export function computeNextPrice(current, mode, amount) {
  const cur = Math.max(0, Math.round(Number(current) || 0));
  const n = Math.round(Number(amount) || 0);
  if (mode === 'add') return Math.max(0, cur + n);
  if (mode === 'subtract') return Math.max(0, cur - n);
  if (mode === 'percent') return Math.max(0, Math.round(cur * (1 + n / 100)));
  if (mode === 'set') return Math.max(0, n);
  return cur;
}

export function describePriceChange(mode, amount) {
  const n = Math.round(Number(amount) || 0);
  const abs = Math.abs(n).toLocaleString('es-CL');
  if (mode === 'add') return `+$${abs}`;
  if (mode === 'subtract') return `−$${abs}`;
  if (mode === 'percent') return n >= 0 ? `+${n}%` : `${n}%`;
  if (mode === 'set') return `precio fijo $${abs}`;
  return '';
}

export async function applyDueMenuPriceJobs(limit = 20) {
  if (!isSupabaseConfigured()) return { applied: 0 };
  try {
    const { data, error } = await sb().rpc('ep_apply_due_menu_price_jobs', { p_limit: limit });
    if (error) return { applied: 0, skipped: true };
    const applied = Number(data?.applied) || 0;
    return { applied };
  } catch {
    return { applied: 0, skipped: true };
  }
}

export async function adminApplyProductPriceDelta({
  branchId, productIds, mode, amount, user, categoryName = '',
}) {
  const ids = [...new Set((productIds || []).filter(Boolean))];
  if (!branchId || !ids.length) throw new Error('Elige al menos un plato');
  const n = Math.round(Number(amount) || 0);
  if (!Number.isFinite(n) || n === 0) throw new Error('Indica el monto del cambio');

  const { data: rows, error } = await sb()
    .from('products')
    .select('id, price, name')
    .eq('branch_id', branchId)
    .in('id', ids);
  if (error) throw error;
  if (!rows?.length) throw new Error('No se encontraron los platos seleccionados');

  const result = [];
  for (const p of rows) {
    const oldPrice = Math.round(Number(p.price) || 0);
    const next = computeNextPrice(oldPrice, mode, n);
    const { error: upErr } = await sb()
      .from('products')
      .update({
        price: next,
        old_price: oldPrice,
        updated_at: new Date().toISOString(),
      })
      .eq('id', p.id)
      .eq('branch_id', branchId);
    if (upErr) throw upErr;
    result.push({ id: p.id, name: p.name, old: oldPrice, next });
    await logAudit({
      user,
      branchId,
      entityType: 'product',
      entityId: p.id,
      action: 'price_category',
      oldData: { price: oldPrice, name: p.name },
      newData: { price: next, mode, amount: n, category: categoryName },
    });
  }
  return result;
}

export async function adminScheduleCategoryPrices({
  branchId, categoryId, categoryName, productIds, mode, amount, applyAt, user,
}) {
  const ids = [...new Set((productIds || []).filter(Boolean))];
  if (!branchId || !ids.length) throw new Error('Elige al menos un plato');
  const n = Math.round(Number(amount) || 0);
  if (!Number.isFinite(n) || n === 0) throw new Error('Indica el monto del cambio');
  const when = applyAt ? new Date(applyAt) : new Date();
  if (Number.isNaN(when.getTime())) throw new Error('La fecha programada no es válida');

  const { data, error } = await sb()
    .from('ep_menu_price_jobs')
    .insert({
      branch_id: branchId,
      category_id: categoryId || null,
      category_name: categoryName || '',
      product_ids: ids,
      mode,
      amount: n,
      apply_at: when.toISOString(),
      status: 'pending',
      created_by: user?.id || null,
      created_by_email: user?.email || null,
    })
    .select()
    .single();
  if (error) {
    if (error.code === '42P01' || /ep_menu_price_jobs/i.test(error.message || '')) {
      throw new Error('Falta crear la tabla de precios programados. Ejecuta add-menu-price-jobs.sql en Supabase.');
    }
    throw error;
  }
  await logAudit({
    user,
    branchId,
    entityType: 'menu_price_job',
    entityId: data.id,
    action: 'schedule',
    newData: {
      category: categoryName,
      mode,
      amount: n,
      apply_at: data.apply_at,
      count: ids.length,
    },
  });
  return data;
}

export async function adminListPriceJobs(branchId) {
  if (!branchId || !isSupabaseConfigured()) return [];
  const { data, error } = await sb()
    .from('ep_menu_price_jobs')
    .select('*')
    .eq('branch_id', branchId)
    .order('apply_at', { ascending: true })
    .limit(40);
  if (error) {
    if (error.code === '42P01' || /ep_menu_price_jobs/i.test(error.message || '')) return [];
    throw error;
  }
  return data || [];
}

export async function adminCancelPriceJob(jobId, user) {
  const { data, error } = await sb()
    .from('ep_menu_price_jobs')
    .update({ status: 'cancelled' })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select('branch_id, category_name')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Ese cambio ya no se puede cancelar');
  await logAudit({
    user,
    branchId: data.branch_id,
    entityType: 'menu_price_job',
    entityId: jobId,
    action: 'cancel',
    newData: { category: data.category_name },
  });
}
