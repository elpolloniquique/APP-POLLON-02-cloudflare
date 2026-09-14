/** Lectura de datos reales del aplicativo (sucursal, menú, pedidos, KB, sesión) */

import {
  DEFAULT_COMPLAINT_KEYWORDS,
  DEFAULT_LOYALTY_TIERS,
  DEFAULT_TEMPLATES,
  DEFAULT_LINK_WEB,
} from './defaults.js';
import { mapBranchRow, isOpenNow } from './branch.js';
import { evolutionInstanceName, normalizeWhatsappPhone, phonesMatch } from './phone.js';
import { foldAccents, moneyCLP, paymentLabel, orderTypeLabel, ORDER_STATUS_HUMAN } from './text.js';

export function mergeSettings(row, branchId) {
  const templates = { ...DEFAULT_TEMPLATES, ...(row?.templates || {}) };
  const keywords = Array.isArray(row?.complaint_keywords) && row.complaint_keywords.length
    ? row.complaint_keywords
    : DEFAULT_COMPLAINT_KEYWORDS;
  const tiers = Array.isArray(row?.loyalty_tiers) && row.loyalty_tiers.length
    ? row.loyalty_tiers
    : DEFAULT_LOYALTY_TIERS;

  return {
    branch_id: row?.branch_id || branchId,
    enabled: row?.enabled === true,
    modo_proactivo: row?.modo_proactivo === true,
    avisos_en_modo_humano: row?.avisos_en_modo_humano !== false,
    enviar_foto_plato: row?.enviar_foto_plato === true,
    ab_welcome_enabled: row?.ab_welcome_enabled === true,
    avisos_si_opt_out: row?.avisos_si_opt_out !== false,
    ollama_enabled: row?.ollama_enabled === true,
    ollama_model: row?.ollama_model || 'llama3.2',
    usar_horario_sucursal: row?.usar_horario_sucursal !== false,
    bot_24_7: row?.bot_24_7 === true,
    bot_from: row?.bot_from || null,
    bot_to: row?.bot_to || null,
    human_timeout_min: Number(row?.human_timeout_min) || 120,
    contar_compras_solo_sucursal: row?.contar_compras_solo_sucursal !== false,
    lookback_hours: Number(row?.lookback_hours) || 48,
    rate_limit_per_min: Number(row?.rate_limit_per_min) || 4,
    link_web: row?.link_web || DEFAULT_LINK_WEB,
    evolution_instance: row?.evolution_instance || (branchId ? evolutionInstanceName(branchId) : null),
    connected: row?.connected === true,
    connected_phone: row?.connected_phone || null,
    templates,
    complaint_keywords: keywords,
    loyalty_tiers: tiers,
    updated_at: row?.updated_at || null,
  };
}

export async function ensureSettingsRow(admin, branchId) {
  const instance = evolutionInstanceName(branchId);
  const { data: existing } = await admin
    .from('ep_wa_settings')
    .select('*')
    .eq('branch_id', branchId)
    .maybeSingle();
  if (existing) return mergeSettings(existing, branchId);

  const insert = {
    branch_id: branchId,
    enabled: false,
    modo_proactivo: false,
    avisos_en_modo_humano: true,
    enviar_foto_plato: false,
    ab_welcome_enabled: false,
    avisos_si_opt_out: true,
    ollama_enabled: false,
    ollama_model: 'llama3.2',
    usar_horario_sucursal: true,
    bot_24_7: false,
    human_timeout_min: 120,
    contar_compras_solo_sucursal: true,
    lookback_hours: 48,
    rate_limit_per_min: 4,
    link_web: DEFAULT_LINK_WEB,
    evolution_instance: instance,
    templates: DEFAULT_TEMPLATES,
    complaint_keywords: DEFAULT_COMPLAINT_KEYWORDS,
    loyalty_tiers: DEFAULT_LOYALTY_TIERS,
  };
  const { data, error } = await admin
    .from('ep_wa_settings')
    .upsert(insert, { onConflict: 'branch_id' })
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return mergeSettings(data || insert, branchId);
}

export async function loadSettingsByInstance(admin, instanceName) {
  const { data } = await admin
    .from('ep_wa_settings')
    .select('*')
    .eq('evolution_instance', instanceName)
    .maybeSingle();
  if (data) return mergeSettings(data, data.branch_id);
  return null;
}

export async function loadBranch(admin, branchId) {
  const { data, error } = await admin.from('branches').select('*').eq('id', branchId).maybeSingle();
  if (error) throw error;
  return mapBranchRow(data);
}

export async function loadMenu(admin, branchId) {
  const [catsRes, prodsRes] = await Promise.all([
    admin.from('categories').select('id, name, display_order, is_active, branch_id')
      .eq('branch_id', branchId).eq('is_active', true).order('display_order', { ascending: true }),
    admin.from('products').select('id, name, description, price, old_price, is_available, is_featured, is_promotion, category_id, image_url, preparation_time, drink_enabled, bag_enabled, bag_price, branch_id')
      .eq('branch_id', branchId).eq('is_available', true)
      .order('display_order', { ascending: true }).order('name', { ascending: true }),
  ]);
  const categories = catsRes.data || [];
  const products = (prodsRes.data || []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description || '',
    price: Number(p.price) || 0,
    oldPrice: p.old_price != null ? Number(p.old_price) : null,
    featured: !!p.is_featured,
    promotion: !!p.is_promotion,
    categoryId: p.category_id,
    imageUrl: p.image_url || '',
    prep: p.preparation_time ?? 15,
    drinkEnabled: p.drink_enabled === true,
    bagEnabled: p.bag_enabled === true,
    bagPrice: Number(p.bag_price ?? 200) || 200,
  }));
  return { categories, products };
}

export function searchProducts(products, query, limit = 5) {
  const q = foldAccents(query);
  if (!q || q.length < 2) return [];
  const tokens = q.split(' ').filter((t) => t.length >= 2);
  const scored = [];
  for (const p of products || []) {
    const hay = foldAccents(`${p.name} ${p.description || ''}`);
    if (!hay) continue;
    let score = 0;
    if (hay.includes(q)) score += 10;
    for (const t of tokens) {
      if (hay.includes(t)) score += 3;
    }
    if (score > 0) scored.push({ score, product: p });
  }
  scored.sort((a, b) => b.score - a.score || a.product.price - b.product.price);
  return scored.slice(0, limit).map((s) => s.product);
}

export function mapPedidoRow(row) {
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
    branchId: row.branch_id,
    createdAt: row.creado_en,
    items: datos.items || [],
    deliveryFee: Number(datos.deliveryFee) || 0,
    deliveryDistanceKm: datos.deliveryDistanceKm ?? null,
    observaciones: row.observaciones || '',
  };
}

export async function findOrderByCode(admin, { code, phone, branchId }) {
  const padded = String(code || '').replace(/\D/g, '').padStart(6, '0');
  if (!padded || padded === '000000') return null;
  let q = admin.from('pedidos').select('*').eq('codigo_pedido', padded);
  if (branchId) q = q.eq('branch_id', branchId);
  const { data } = await q.order('creado_en', { ascending: false }).limit(5);
  const rows = data || [];
  if (!rows.length) return null;
  if (!phone) return mapPedidoRow(rows[0]);
  const match = rows.find((r) => phonesMatch(r.cliente_telefono, phone));
  return mapPedidoRow(match || rows[0]);
}

export async function findOpenOrderByPhone(admin, { phone, branchId, lookbackHours = 48 }) {
  const normalized = normalizeWhatsappPhone(phone);
  if (!normalized) return null;
  const since = new Date(Date.now() - lookbackHours * 3600 * 1000).toISOString();
  let q = admin.from('pedidos').select('*')
    .gte('creado_en', since)
    .not('estado', 'in', '(entregado,cancelado)')
    .order('creado_en', { ascending: false })
    .limit(30);
  if (branchId) q = q.eq('branch_id', branchId);
  const { data } = await q;
  const row = (data || []).find((r) => phonesMatch(r.cliente_telefono, normalized));
  return mapPedidoRow(row);
}

export async function countPurchases(admin, { phone, branchId, onlyBranch = true }) {
  const normalized = normalizeWhatsappPhone(phone);
  if (!normalized) return 0;
  let q = admin.from('pedidos').select('id, cliente_telefono, branch_id, estado')
    .neq('estado', 'cancelado')
    .limit(500);
  if (onlyBranch && branchId) q = q.eq('branch_id', branchId);
  const { data } = await q;
  return (data || []).filter((r) => phonesMatch(r.cliente_telefono, normalized)).length;
}

export async function loadBestsellers(admin, { branchId, products, days = 7, limit = 5 }) {
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const { data } = await admin.from('pedidos').select('datos_json, estado')
    .eq('branch_id', branchId)
    .gte('creado_en', since)
    .neq('estado', 'cancelado')
    .limit(800);
  const stats = new Map();
  for (const row of data || []) {
    const items = row.datos_json?.items || [];
    for (const it of items) {
      const name = (it.name || '').trim();
      if (!name) continue;
      const key = (it.id || it.producto_id || name).toString().toLowerCase();
      const prev = stats.get(key) || { name, id: it.id || it.producto_id || null, qty: 0 };
      prev.qty += Number(it.qty) || 1;
      stats.set(key, prev);
    }
  }
  const ranked = [...stats.values()].sort((a, b) => b.qty - a.qty);
  const byId = new Map((products || []).map((p) => [p.id, p]));
  const byName = new Map((products || []).map((p) => [foldAccents(p.name), p]));
  const out = [];
  for (const r of ranked) {
    const p = (r.id && byId.get(r.id)) || byName.get(foldAccents(r.name));
    if (!p) continue;
    out.push({ ...p, soldQty: r.qty });
    if (out.length >= limit) break;
  }
  if (!out.length) return (products || []).slice(0, limit);
  return out;
}

export async function loadKb(admin, branchId) {
  const { data } = await admin.from('ep_wa_kb')
    .select('*')
    .eq('activa', true)
    .or(`branch_id.is.null,branch_id.eq.${branchId}`)
    .order('prioridad', { ascending: false });
  return data || [];
}

export function matchKb(entries, foldedText) {
  let best = null;
  for (const kb of entries || []) {
    const keys = kb.keywords || [];
    const pregunta = foldAccents(kb.pregunta || kb.title || '');
    let hit = pregunta && foldedText.includes(pregunta);
    if (!hit) {
      hit = keys.some((k) => {
        const f = foldAccents(k);
        return f && foldedText.includes(f);
      });
    }
    if (!hit) continue;
    if (!best || (kb.prioridad || 0) > (best.prioridad || 0)) best = kb;
  }
  return best;
}

export async function getOrCreateSession(admin, { phone, branchId, name }) {
  const normalized = normalizeWhatsappPhone(phone);
  if (!normalized || !branchId) return null;
  const { data: existing } = await admin.from('ep_wa_sessions')
    .select('*')
    .eq('phone', normalized)
    .eq('branch_id', branchId)
    .maybeSingle();
  if (existing) {
    if (name && name !== existing.last_name) {
      await admin.from('ep_wa_sessions').update({
        last_name: name,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
      return { ...existing, last_name: name };
    }
    return existing;
  }
  const insert = {
    phone: normalized,
    branch_id: branchId,
    mode: 'bot',
    last_name: name || '',
    order_count_cache: 0,
  };
  const { data, error } = await admin.from('ep_wa_sessions').insert(insert).select('*').maybeSingle();
  if (error) {
    const { data: again } = await admin.from('ep_wa_sessions')
      .select('*').eq('phone', normalized).eq('branch_id', branchId).maybeSingle();
    return again;
  }
  return data;
}

export async function updateSession(admin, sessionId, patch) {
  const { data } = await admin.from('ep_wa_sessions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select('*')
    .maybeSingle();
  return data;
}

export async function logMessage(admin, { sessionId, branchId, phone, direction, body, intent, extra }) {
  await admin.from('ep_wa_messages').insert({
    session_id: sessionId || null,
    branch_id: branchId || null,
    phone: normalizeWhatsappPhone(phone) || phone || null,
    direction,
    body: String(body || '').slice(0, 4000),
    intent: intent || null,
    extra: extra || null,
  });
}

export async function countOutboundLastMinute(admin, phone) {
  const normalized = normalizeWhatsappPhone(phone);
  if (!normalized) return 0;
  const since = new Date(Date.now() - 60 * 1000).toISOString();
  const { count } = await admin.from('ep_wa_messages')
    .select('id', { count: 'exact', head: true })
    .eq('phone', normalized)
    .eq('direction', 'out')
    .gte('created_at', since);
  return count || 0;
}

export async function createAlert(admin, row) {
  await admin.from('ep_wa_alerts').insert(row);
}

/** Fase 3: marca el pedido para métricas del Dashboard (origen avisos WA). */
export async function markOrderWaAvisos(admin, orderId) {
  if (!orderId) return;
  const { data } = await admin.from('pedidos').select('datos_json').eq('id', String(orderId)).maybeSingle();
  const datos = { ...(data?.datos_json || {}), wa_avisos: true, wa_avisos_at: new Date().toISOString() };
  await admin.from('pedidos').update({ datos_json: datos }).eq('id', String(orderId));
}

export function pickAbVariant(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  let h = 0;
  for (let i = 0; i < d.length; i += 1) h = (h + d.charCodeAt(i) * (i + 1)) % 2;
  return h === 0 ? 'a' : 'b';
}

export function loyaltyText(tiers, count, sucursal) {
  if (!count || !tiers?.length) return '';
  const sorted = [...tiers].filter((t) => Number(t.n) > 0).sort((a, b) => Number(a.n) - Number(b.n));
  let hit = null;
  for (const t of sorted) {
    if (count >= Number(t.n)) hit = t;
  }
  if (!hit?.text) return '';
  return String(hit.text).replaceAll('{sucursal}', sucursal || '');
}

export function buildOrderDetalle(order) {
  const items = order?.items || [];
  const lines = items.map((it) => {
    const qty = it.qty || it.cantidad || 1;
    const name = it.name || it.nombre_producto || 'Producto';
    let line = `• ${qty}× ${name}`;
    const extras = [];
    if (Array.isArray(it.drinks) && it.drinks.length) extras.push(it.drinks.filter(Boolean).join(', '));
    else if (it.drink) extras.push(String(it.drink));
    if (it.bagQty > 0) extras.push(`Bolsa x${it.bagQty}`);
    if (it.notes) extras.push(String(it.notes).trim());
    if (extras.length) line += `\n  ${extras.join(' · ')}`;
    return line;
  });
  if (Number(order?.deliveryFee) > 0) {
    const km = order.deliveryDistanceKm != null ? ` (${order.deliveryDistanceKm} km)` : '';
    lines.push(`• Delivery: ${moneyCLP(order.deliveryFee)}${km}`);
  }
  return lines.join('\n') || '—';
}

export function storeUrl(linkWeb, { branchId, q, cat } = {}) {
  const base = String(linkWeb || DEFAULT_LINK_WEB).replace(/\/+$/, '');
  const params = new URLSearchParams();
  if (branchId) params.set('branch', branchId);
  if (q) params.set('q', q);
  if (cat) params.set('cat', cat);
  const qs = params.toString();
  return qs ? `${base}/tienda?${qs}` : `${base}/tienda`;
}

export function trackingUrl(linkWeb, orderId) {
  const base = String(linkWeb || DEFAULT_LINK_WEB).replace(/\/+$/, '');
  return `${base}/cuenta/seguimiento/${orderId}`;
}

export function estadoAtencion(branch) {
  const open = isOpenNow(branch?.schedule, { isActive: branch?.isActive, isOpen: branch?.isOpen });
  if (open) return 'Ahora mismo estamos *abiertos* ✅';
  return `Ahora mismo estamos *cerrados*. Horario: ${branch?.schedule || 'consultar'}.`;
}

export function buildTemplateVars({
  branch, settings, name, order, loyalty, menuResumen, platoDetalle,
  bestsellersTxt, deliveryCostTxt, linkPlato,
}) {
  const sucursal = branch?.name || 'El Pollón';
  const linkWeb = settings?.link_web || DEFAULT_LINK_WEB;
  return {
    nombre: name || order?.name || '',
    sucursal,
    ciudad: branch?.city || '',
    codigo: order?.codigo ? String(order.codigo).replace(/^0+/, '') || order.codigo : '',
    detalle: order ? buildOrderDetalle(order) : '',
    detalle_corto: order?.items?.length
      ? `${order.items.length} ítem(s) · ${moneyCLP(order.total)}`
      : '',
    total: order ? moneyCLP(order.total) : '',
    pago: order ? paymentLabel(order.pago) : '',
    tipo: order ? orderTypeLabel(order.tipo) : '',
    direccion: order?.address || '',
    link_web: linkWeb,
    link_tienda: storeUrl(linkWeb, { branchId: branch?.id }),
    link_plato: linkPlato || storeUrl(linkWeb, { branchId: branch?.id }),
    link_seguimiento: order?.id ? trackingUrl(linkWeb, order.id) : linkWeb,
    horario: branch?.schedule || '',
    estado_atencion: estadoAtencion(branch),
    eta: branch?.deliveryEta || '30-45 min',
    n_compras: loyalty?.count != null ? String(loyalty.count) : '',
    agradecimiento_fidelidad: loyalty?.text || '',
    telefono_local: branch?.phone || branch?.whatsapp || '',
    direccion_local: branch?.address || '',
    delivery_flag: branch?.deliveryEnabled ? 'sí' : 'no',
    retiro_flag: branch?.pickupEnabled ? 'sí' : 'no',
    reserva_flag: branch?.reservationsEnabled ? 'sí' : 'no',
    menu_resumen: menuResumen || '',
    plato_detalle: platoDetalle || '',
    bestsellers_txt: bestsellersTxt || '',
    delivery_cost_txt: deliveryCostTxt || '',
    estado_humano: order ? (ORDER_STATUS_HUMAN[order.estado] || order.estado) : '',
  };
}
