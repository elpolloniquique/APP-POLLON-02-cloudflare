/** Cerebro 1: productos, sucursales, pedidos reales */

import { mapBranch, isOpenNow } from './hours.js';
import { foldAccents, moneyCLP, extractOrderCode, ORDER_STATUS_HUMAN } from './text.js';
import { phonesMatch, normalizeChilePhone, phoneDigits } from './phone.js';

export async function loadBranch(admin, branchId) {
  if (!branchId) {
    const { data } = await admin
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(1);
    return mapBranch(data?.[0] || null);
  }
  const { data } = await admin.from('branches').select('*').eq('id', branchId).maybeSingle();
  return mapBranch(data);
}

export async function loadAllBranches(admin) {
  const { data } = await admin
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  return (data || []).map(mapBranch).filter(Boolean);
}

export async function loadMenu(admin, branchId) {
  if (!branchId) return [];
  const { data, error } = await admin
    .from('products')
    .select('id, name, description, price, old_price, is_available, is_featured, is_promotion, category_id, image_url, preparation_time, branch_id')
    .eq('branch_id', branchId)
    .eq('is_available', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) return [];
  return (data || []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description || '',
    price: Number(p.price) || 0,
    oldPrice: p.old_price != null ? Number(p.old_price) : null,
    featured: p.is_featured === true,
    promotion: p.is_promotion === true,
    imageUrl: p.image_url || '',
    prep: Number(p.preparation_time) || 15,
    categoryId: p.category_id,
    branchId: p.branch_id,
  }));
}

export function searchProducts(products, foldedQuery, limit = 5) {
  const tokens = foldedQuery.split(/\s+/).filter((t) => t.length >= 3);
  if (!tokens.length && foldedQuery.length < 3) return [];
  const scored = [];
  for (const p of products || []) {
    const hay = foldAccents(`${p.name} ${p.description || ''}`);
    let score = 0;
    if (foldedQuery.length >= 4 && hay.includes(foldedQuery)) score += 12;
    for (const t of tokens) {
      if (hay.includes(t)) score += t.length >= 5 ? 4 : 2;
    }
    if (score > 0) scored.push({ score, product: p });
  }
  scored.sort((a, b) => b.score - a.score || a.product.price - b.product.price);
  return scored.slice(0, limit).map((s) => s.product);
}

export function formatProduct(p) {
  const old = p.oldPrice ? ` (antes ${moneyCLP(p.oldPrice)})` : '';
  const promo = p.promotion || p.featured ? ' 🔥' : '';
  const desc = p.description ? `\n${p.description}` : '';
  return `*${p.name}*${promo}\n${moneyCLP(p.price)}${old}${desc}`;
}

export function mapPedido(row) {
  if (!row) return null;
  const datos = row.datos_json || {};
  return {
    id: row.id,
    codigo: String(row.codigo_pedido || datos.ticketNumber || '').padStart(6, '0'),
    name: row.cliente_nombre || datos.customer?.name || '',
    phone: row.cliente_telefono || datos.customer?.phone || '',
    address: row.cliente_direccion || datos.customer?.address || '',
    tipo: row.tipo_entrega || 'delivery',
    pago: row.metodo_pago || '',
    total: Number(row.total) || 0,
    estado: row.estado || 'pendiente',
    estadoLabel: ORDER_STATUS_HUMAN[row.estado] || row.estado,
    branchId: row.branch_id,
    createdAt: row.creado_en,
    items: datos.items || [],
    deliveryFee: Number(datos.deliveryFee) || 0,
    observaciones: row.observaciones || '',
  };
}

export async function findProfileByPhone(admin, phone) {
  const digits = phoneDigits(phone);
  const last8 = digits.slice(-8);
  const { data } = await admin
    .from('profiles')
    .select('id, full_name, phone, role, branch_id')
    .or(`phone.eq.${phone},phone.eq.${digits},phone.ilike.%${last8}%`)
    .limit(20);
  return (data || []).find((p) => phonesMatch(p.phone, phone)) || null;
}

export async function findOpenOrdersByPhone(admin, { phone, branchId, lookbackHours = 72 }) {
  const since = new Date(Date.now() - lookbackHours * 3600 * 1000).toISOString();
  let q = admin
    .from('pedidos')
    .select('*')
    .gte('creado_en', since)
    .not('estado', 'in', '(entregado,cancelado)')
    .order('creado_en', { ascending: false })
    .limit(40);
  if (branchId) q = q.eq('branch_id', branchId);
  const { data } = await q;
  return (data || []).filter((r) => phonesMatch(r.cliente_telefono, phone)).map(mapPedido);
}

export async function findOrderByCodeForPhone(admin, { code, phone, branchId }) {
  const padded = extractOrderCode(code) || String(code || '').replace(/\D/g, '').padStart(6, '0');
  if (!padded || padded === '000000') return null;
  let q = admin.from('pedidos').select('*').eq('codigo_pedido', padded);
  if (branchId) q = q.eq('branch_id', branchId);
  const { data } = await q.order('creado_en', { ascending: false }).limit(8);
  const match = (data || []).find((r) => phonesMatch(r.cliente_telefono, phone));
  return mapPedido(match || null);
}

export async function latestOrderName(admin, phone) {
  const digits = phoneDigits(phone);
  const last8 = digits.slice(-8);
  const { data } = await admin
    .from('pedidos')
    .select('cliente_nombre, cliente_telefono, creado_en')
    .or(`cliente_telefono.eq.${phone},cliente_telefono.eq.${digits},cliente_telefono.ilike.%${last8}%`)
    .order('creado_en', { ascending: false })
    .limit(20);
  const row = (data || []).find((r) => phonesMatch(r.cliente_telefono, phone));
  return row?.cliente_nombre || '';
}

export function formatOrderItems(order) {
  const items = order?.items || [];
  if (!items.length) return '';
  return items
    .map((it) => {
      const qty = Number(it.qty || it.cantidad || 1);
      const name = it.name || it.nombre || 'Producto';
      const price = it.price ?? it.precio ?? it.subtotal;
      const priceTxt = price != null ? ` — ${moneyCLP(price)}` : '';
      return `${qty} × ${name}${priceTxt}`;
    })
    .join('\n');
}

export function branchOpenLabel(branch) {
  if (!branch) return '';
  const open = isOpenNow(branch.schedule, { isActive: branch.isActive, isOpen: branch.isOpen });
  return open ? 'Ahora estamos atendiendo.' : 'Ahora estamos fuera de horario (puedes pedir en la web y te avisamos).';
}

export { isOpenNow, normalizeChilePhone };
