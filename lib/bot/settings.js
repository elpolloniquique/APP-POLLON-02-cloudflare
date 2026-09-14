/** bot_settings key/value (global + override por sucursal) */

const DEFAULTS = {
  bot_enabled: true,
  bot_name: 'Pollito',
  website_url: 'https://www.el-pollon.cl/',
  support_phone: '+56986925310',
  support_message: 'Si necesitas atención directa, llama o escribe al {support_phone}.',
  minimum_confidence: 0.8,
  order_created_enabled: true,
  order_status_enabled: true,
  human_support_enabled: true,
  rate_limit_per_min: 4,
  unknown_response:
    'Gracias por escribirnos 😊. No tengo una respuesta confirmada para esa consulta en este momento.\n\nHe registrado tu pregunta para que nuestro equipo pueda incorporarla a mi información.\n\nSi necesitas atención directa, puedes comunicarte al {support_phone}.',
  how_to_buy:
    'Así puedes pedir en El Pollón:\n\n1. Entra a {website}\n2. Elige tu sucursal\n3. Arma tu carrito en la tienda\n4. Completa nombre, teléfono y dirección (si es delivery)\n5. Elige delivery, retiro o reserva\n6. Paga al recibir, con el método que acepte tu sucursal (efectivo, transferencia y/o tarjeta)\n7. Confirma. Te daremos un código de seguimiento (ej. #001548).',
  templates: {},
};

function unwrap(value) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return value;
}

export async function loadBotSettings(admin, branchId = null) {
  const out = { ...DEFAULTS, templates: { ...(DEFAULTS.templates || {}) } };
  const { data, error } = await admin.from('bot_settings').select('key, value, branch_id');
  if (error) return out;
  if (!data?.length) return out;

  const global = data.filter((r) => !r.branch_id);
  const local = branchId ? data.filter((r) => r.branch_id === branchId) : [];
  for (const row of [...global, ...local]) {
    const v = unwrap(row.value);
    if (row.key === 'templates' && v && typeof v === 'object') {
      out.templates = { ...out.templates, ...v };
    } else if (v !== null && v !== undefined) {
      out[row.key] = v;
    }
  }
  out.minimum_confidence = Number(out.minimum_confidence) || 0.8;
  out.rate_limit_per_min = Number(out.rate_limit_per_min) || 4;
  out.bot_enabled = out.bot_enabled !== false;
  return out;
}

export async function loadSynonyms(admin) {
  const { data } = await admin.from('bot_synonyms').select('canonical, aliases, active').eq('active', true);
  return data || [];
}

export async function loadIntentRows(admin) {
  const { data } = await admin
    .from('bot_intents')
    .select('code, label, keywords, patterns, examples, priority, handler, active, templates')
    .eq('active', true)
    .order('priority', { ascending: true });
  return data || [];
}
