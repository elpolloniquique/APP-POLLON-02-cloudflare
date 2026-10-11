import { getSupabase, isSupabaseConfigured } from './supabaseClient';

function cajaKey(branchId) {
  return branchId ? `pollon_caja_v1_${branchId}` : 'pollon_caja_v1';
}

function stockKey(branchId) {
  return branchId ? `pollon_stock_v1_${branchId}` : 'pollon_stock_v1';
}

function readLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || '') ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function mapCaja(row) {
  if (!row) return {};
  return {
    id: row.id,
    abierta: row.abierta !== false,
    apertura: row.apertura_en,
    cierre: row.cierre_en || null,
    montoInicial: Number(row.monto_inicial) || 0,
    ventas: {
      efectivo: Number(row.ventas_efectivo) || 0,
      transferencia: Number(row.ventas_transferencia) || 0,
      tarjeta: Number(row.ventas_tarjeta) || 0,
      total: Number(row.ventas_total) || 0,
      count: Number(row.pedidos_count) || 0,
    },
    source: 'cloud',
  };
}

function mapStock(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    cantidad: Number(row.cantidad) || 0,
    minimo: Number(row.minimo) || 5,
    updated: row.actualizado_en,
    source: 'cloud',
  };
}

function isMissingTable(error) {
  const msg = String(error?.message || '');
  return /does not exist|schema cache|ep_caja_sesiones|ep_stock_items/i.test(msg);
}

export async function loadCajaSession(branchId) {
  const local = readLocal(cajaKey(branchId), {});
  if (!isSupabaseConfigured() || !branchId) return { ...local, source: 'local' };
  const sb = getSupabase();
  const { data, error } = await sb
    .from('ep_caja_sesiones')
    .select('*')
    .eq('branch_id', branchId)
    .eq('abierta', true)
    .order('apertura_en', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (!isMissingTable(error)) console.warn('[Pollón] caja:', error.message);
    return { ...local, source: 'local' };
  }
  if (data) {
    const mapped = mapCaja(data);
    writeLocal(cajaKey(branchId), mapped);
    return mapped;
  }
  if (local?.abierta) {
    const opened = await openCajaSession(branchId, local.montoInicial || 0).catch(() => null);
    if (opened?.id) return opened;
  }
  return { source: 'cloud' };
}

export async function openCajaSession(branchId, montoInicial = 0) {
  const local = {
    abierta: true,
    apertura: new Date().toISOString(),
    montoInicial: Number(montoInicial) || 0,
    source: 'local',
  };
  writeLocal(cajaKey(branchId), local);
  if (!isSupabaseConfigured() || !branchId) return local;
  const sb = getSupabase();
  const { data: userData } = await sb.auth.getUser();
  const { data, error } = await sb
    .from('ep_caja_sesiones')
    .insert({
      branch_id: branchId,
      abierta: true,
      monto_inicial: Number(montoInicial) || 0,
      opened_by: userData?.user?.id || null,
    })
    .select()
    .single();
  if (error) {
    if (!isMissingTable(error)) console.warn('[Pollón] abrir caja:', error.message);
    return local;
  }
  const mapped = mapCaja(data);
  writeLocal(cajaKey(branchId), mapped);
  return mapped;
}

export async function closeCajaSession(branchId, current, ventasHoy = {}) {
  const closed = {
    ...current,
    abierta: false,
    cierre: new Date().toISOString(),
    ventas: ventasHoy,
    source: current?.source || 'local',
  };
  writeLocal(cajaKey(branchId), closed);
  if (!isSupabaseConfigured() || !branchId || !current?.id) return closed;
  const sb = getSupabase();
  const { data: userData } = await sb.auth.getUser();
  const { error } = await sb
    .from('ep_caja_sesiones')
    .update({
      abierta: false,
      cierre_en: closed.cierre,
      monto_cierre: Number(ventasHoy.total) || 0,
      ventas_efectivo: Number(ventasHoy.efectivo) || 0,
      ventas_transferencia: Number(ventasHoy.transferencia) || 0,
      ventas_tarjeta: Number(ventasHoy.tarjeta) || 0,
      ventas_total: Number(ventasHoy.total) || 0,
      pedidos_count: Number(ventasHoy.count) || 0,
      closed_by: userData?.user?.id || null,
    })
    .eq('id', current.id);
  if (error && !isMissingTable(error)) console.warn('[Pollón] cerrar caja:', error.message);
  return closed;
}

export async function loadStockItems(branchId) {
  const local = readLocal(stockKey(branchId), []);
  if (!isSupabaseConfigured() || !branchId) return Array.isArray(local) ? local : [];
  const sb = getSupabase();
  const { data, error } = await sb
    .from('ep_stock_items')
    .select('*')
    .eq('branch_id', branchId)
    .order('nombre', { ascending: true });
  if (error) {
    if (!isMissingTable(error)) console.warn('[Pollón] stock:', error.message);
    return Array.isArray(local) ? local : [];
  }
  if ((data || []).length) {
    const mapped = data.map(mapStock);
    writeLocal(stockKey(branchId), mapped);
    return mapped;
  }
  if (Array.isArray(local) && local.length) {
    await Promise.all(local.map((item) => addStockItem(branchId, item).catch(() => null)));
    return local.map((item) => ({ ...item, source: 'local' }));
  }
  return [];
}

export async function addStockItem(branchId, item) {
  const localItem = {
    id: item.id || `local-${Date.now()}`,
    nombre: item.nombre,
    cantidad: Number(item.cantidad) || 0,
    minimo: Number(item.minimo) || 5,
    updated: new Date().toISOString(),
    source: 'local',
  };
  if (!isSupabaseConfigured() || !branchId) {
    const list = readLocal(stockKey(branchId), []);
    writeLocal(stockKey(branchId), [...list, localItem]);
    return localItem;
  }
  const sb = getSupabase();
  const { data: userData } = await sb.auth.getUser();
  const { data, error } = await sb
    .from('ep_stock_items')
    .insert({
      branch_id: branchId,
      nombre: item.nombre,
      cantidad: Number(item.cantidad) || 0,
      minimo: Number(item.minimo) || 5,
      actualizado_por: userData?.user?.id || null,
    })
    .select()
    .single();
  if (error) {
    if (!isMissingTable(error)) console.warn('[Pollón] agregar stock:', error.message);
    const list = readLocal(stockKey(branchId), []);
    writeLocal(stockKey(branchId), [...list, localItem]);
    return localItem;
  }
  return mapStock(data);
}

export async function adjustStockItem(branchId, item, delta) {
  const nextQty = Math.max(0, (Number(item.cantidad) || 0) + Number(delta || 0));
  const next = { ...item, cantidad: nextQty, updated: new Date().toISOString() };
  if (!isSupabaseConfigured() || !branchId || String(item.id).startsWith('local-')) {
    const list = readLocal(stockKey(branchId), []).map((row) => (row.id === item.id ? next : row));
    writeLocal(stockKey(branchId), list);
    return next;
  }
  const sb = getSupabase();
  const { data: userData } = await sb.auth.getUser();
  const { data, error } = await sb
    .from('ep_stock_items')
    .update({
      cantidad: nextQty,
      actualizado_en: next.updated,
      actualizado_por: userData?.user?.id || null,
    })
    .eq('id', item.id)
    .select()
    .single();
  if (error) {
    if (!isMissingTable(error)) console.warn('[Pollón] stock +/-:', error.message);
    const list = readLocal(stockKey(branchId), []).map((row) => (row.id === item.id ? next : row));
    writeLocal(stockKey(branchId), list);
    return next;
  }
  return mapStock(data);
}
