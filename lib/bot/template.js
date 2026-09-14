/** Plantillas controladas: {nombre} {pedido} {website} … */

export function interpolate(template, vars = {}) {
  let out = String(template || '');
  out = out.replace(/\{(\w+)\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function pickVariant(list, seed = '') {
  const arr = Array.isArray(list) ? list.filter(Boolean) : [];
  if (!arr.length) return '';
  if (!seed) return arr[Math.floor(Math.random() * arr.length)];
  let h = 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i += 1) h = (h + s.charCodeAt(i) * (i + 1)) % 997;
  return arr[h % arr.length];
}

export function templateVars({
  name = '',
  order = null,
  branch = null,
  settings = {},
  extra = {},
} = {}) {
  const first = name || '';
  const website = settings.website_url || 'https://www.el-pollon.cl/';
  return {
    nombre: first,
    nombre_coma: first ? `, ${first}` : '',
    pedido: order?.codigo || '',
    tracking: order?.codigo ? `#${order.codigo}` : '',
    sucursal: branch?.name || '',
    estado: extra.estado || '',
    total: extra.total || '',
    subtotal: extra.subtotal || '',
    delivery: extra.delivery || '',
    detalle: extra.detalle || '',
    website,
    support_phone: settings.support_phone || '',
    fecha: extra.fecha || '',
    hora: extra.hora || '',
    bot_name: settings.bot_name || 'Pollito',
    ...extra,
  };
}
