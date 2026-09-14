/** FASE 7 — intenciones por reglas + bot_intents (sin IA) */

import { foldAccents, includesAny, extractOrderCode } from './text.js';

export const FALLBACK_INTENTS = [
  { code: 'GREETING', keywords: ['hola', 'buenas', 'buenos dias', 'buenos días', 'buenas tardes', 'buenas noches', 'hey'], patterns: [], examples: ['hola'], priority: 10, handler: 'handleGreeting' },
  { code: 'GOODBYE', keywords: ['chao', 'adios', 'adiós', 'hasta luego', 'nos vemos'], patterns: [], examples: ['chao'], priority: 15, handler: 'handleGoodbye' },
  { code: 'THANKS', keywords: ['gracias', 'muchas gracias', 'se agradece'], patterns: [], examples: ['gracias'], priority: 20, handler: 'handleThanks' },
  { code: 'HUMAN_SUPPORT', keywords: ['persona', 'alguien', 'encargado', 'administrador', 'ejecutivo', 'hablar con alguien'], patterns: ['quiero hablar con alguien', 'necesito una persona'], examples: ['quiero hablar con alguien'], priority: 25, handler: 'handleHumanSupport' },
  { code: 'COMPLAINT', keywords: ['reclamo', 'queja', 'pedido malo', 'llegó mal', 'llego mal', 'faltante', 'cobro incorrecto'], patterns: ['llego mal', 'producto faltante'], examples: ['mi pedido llegó mal'], priority: 30, handler: 'handleComplaint' },
  { code: 'ORDER_STATUS', keywords: ['mi pedido', 'estado', 'seguimiento', 'donde va', 'dónde va', 'como va', 'cómo va', 'ya salio', 'ya salió'], patterns: ['como va mi pedido', 'donde esta mi pedido'], examples: ['cómo va mi pedido'], priority: 40, handler: 'handleOrderStatus' },
  { code: 'HOW_TO_BUY', keywords: ['como compro', 'cómo compro', 'como pido', 'cómo pido', 'quiero pedir', 'deseo comprar', 'hacer pedido'], patterns: ['hacer un pedido'], examples: ['cómo hago un pedido'], priority: 50, handler: 'handleHowToBuy' },
  { code: 'PAYMENT_METHOD', keywords: ['pago', 'pagar', 'efectivo', 'transferencia', 'webpay', 'tarjeta'], patterns: ['como se paga'], examples: ['cómo se paga'], priority: 55, handler: 'handlePayment' },
  { code: 'PRODUCT_PRICE', keywords: ['precio', 'cuanto', 'cuánto', 'vale', 'cuesta', 'sale', 'presio'], patterns: ['cuanto sale', 'cuanto vale', 'cuanto cuesta', 'cual es el precio'], examples: ['cuánto cuesta el cuarto'], priority: 60, handler: 'handleProductPrice' },
  { code: 'MENU', keywords: ['menu', 'menú', 'carta', 'que venden', 'qué venden'], patterns: [], examples: ['qué tienen'], priority: 75, handler: 'handleProductSearch' },
  { code: 'PROMOTION', keywords: ['promo', 'promocion', 'promoción', 'oferta'], patterns: [], examples: ['tienen promos'], priority: 80, handler: 'handlePromotion' },
  { code: 'DELIVERY_PRICE', keywords: ['cuanto delivery', 'cuánto delivery', 'valor despacho', 'cuesta el envio', 'cuesta el envío'], patterns: ['cuanto cobran envio', 'cuanto vale llevarlo', 'cuanto cobran por traer'], examples: ['cuánto sale delivery'], priority: 85, handler: 'handleDelivery' },
  { code: 'DELIVERY', keywords: ['delivery', 'despacho', 'envio', 'envío', 'reparto', 'delibery', 'llegan'], patterns: ['hacen delivery', 'llegan a'], examples: ['hacen delivery'], priority: 90, handler: 'handleDelivery' },
  { code: 'OPENING_HOURS', keywords: ['horario', 'abierto', 'cierran', 'atienden', 'hora'], patterns: ['a que hora', 'estan abiertos', 'estan atendiendo'], examples: ['a qué hora cierran'], priority: 95, handler: 'handleHours' },
  { code: 'BRANCH', keywords: ['sucursal', 'local', 'direccion', 'dirección', 'donde estan', 'dónde están'], patterns: ['donde queda', 'direccion del local'], examples: ['dónde están'], priority: 100, handler: 'handleBranch' },
  { code: 'CONTACT', keywords: ['telefono', 'teléfono', 'contacto', 'llamar'], patterns: [], examples: ['cuál es el teléfono'], priority: 110, handler: 'handleContact' },
];

export function handlerFor(code) {
  const map = {
    GREETING: 'handleGreeting',
    GOODBYE: 'handleGoodbye',
    THANKS: 'handleThanks',
    HUMAN_SUPPORT: 'handleHumanSupport',
    COMPLAINT: 'handleComplaint',
    ORDER_STATUS: 'handleOrderStatus',
    ORDER_DETAILS: 'handleOrderStatus',
    ORDER_TRACKING: 'handleOrderStatus',
    HOW_TO_BUY: 'handleHowToBuy',
    PAYMENT_METHOD: 'handlePayment',
    PRODUCT_PRICE: 'handleProductPrice',
    PRODUCT_SEARCH: 'handleProductSearch',
    MENU: 'handleProductSearch',
    PROMOTION: 'handlePromotion',
    DELIVERY: 'handleDelivery',
    DELIVERY_PRICE: 'handleDelivery',
    DELIVERY_ZONE: 'handleDelivery',
    OPENING_HOURS: 'handleHours',
    BRANCH: 'handleBranch',
    BRANCH_ADDRESS: 'handleBranch',
    CONTACT: 'handleContact',
    FAQ: 'handleKnowledgeSearch',
    UNKNOWN: 'handleUnknown',
  };
  return map[code] || 'handleUnknown';
}

export function expandWithSynonyms(folded, synonymRows) {
  let t = folded;
  for (const row of synonymRows || []) {
    if (row.active === false) continue;
    const canon = foldAccents(row.canonical);
    for (const alias of row.aliases || []) {
      const fa = foldAccents(alias);
      if (fa && t.includes(fa) && canon && !t.includes(canon)) t = `${t} ${canon}`;
    }
  }
  return t;
}

export function mergeIntentRows(dbRows) {
  const map = new Map(FALLBACK_INTENTS.map((r) => [r.code, { ...r }]));
  for (const row of dbRows || []) {
    if (!row?.code) continue;
    const prev = map.get(row.code) || {};
    map.set(row.code, {
      ...prev,
      ...row,
      keywords: row.keywords?.length ? row.keywords : (prev.keywords || []),
      patterns: row.patterns?.length ? row.patterns : (prev.patterns || []),
      examples: row.examples?.length ? row.examples : (prev.examples || []),
      handler: row.handler || prev.handler || handlerFor(row.code),
      priority: row.priority ?? prev.priority ?? 100,
    });
  }
  return [...map.values()];
}

function scoreIntent(row, folded) {
  let score = 0;
  for (const kw of row.keywords || []) {
    const f = foldAccents(kw);
    if (f && folded.includes(f)) score += f.includes(' ') ? 0.38 : 0.2;
  }
  for (const pat of row.patterns || []) {
    const f = foldAccents(pat);
    if (f && folded.includes(f)) score += 0.42;
  }
  for (const ex of row.examples || []) {
    const f = foldAccents(ex);
    if (!f) continue;
    if (folded === f) score += 0.55;
    else if (folded.includes(f) || f.includes(folded)) score += 0.28;
  }
  return Math.min(0.99, score);
}

const SHORT_ONLY = new Set(['GREETING', 'THANKS', 'GOODBYE']);

export function detectIntent({ folded, original, tokens = [], intentRows, products = [] }) {
  const codeInText = extractOrderCode(original);
  const tokenCount = (tokens.length ? tokens : folded.split(/\s+/).filter(Boolean)).length;
  const rows = mergeIntentRows(intentRows).sort((a, b) => (a.priority || 100) - (b.priority || 100));

  if (codeInText && includesAny(folded, ['pedido', 'estado', 'seguimiento', 'codigo', 'código', 'donde', 'va'])) {
    return { code: 'ORDER_STATUS', handler: 'handleOrderStatus', confidence: 0.92, reason: 'order_code', orderCode: codeInText };
  }

  if (includesAny(folded, ['reclamo', 'queja', 'pedido malo', 'llego mal', 'llegó mal', 'faltante', 'cobro incorrecto'])) {
    return { code: 'COMPLAINT', handler: 'handleComplaint', confidence: 0.9, reason: 'complaint', orderCode: codeInText };
  }

  if (includesAny(folded, ['hablar con alguien', 'una persona', 'encargado', 'administrador', 'ejecutivo'])) {
    return { code: 'HUMAN_SUPPORT', handler: 'handleHumanSupport', confidence: 0.9, reason: 'human', orderCode: codeInText };
  }

  const deliveryish = includesAny(folded, ['delivery', 'despacho', 'envio', 'envío', 'reparto', 'delibery', 'llevarlo', 'domicilio']);
  const priceish = includesAny(folded, ['precio', 'cuanto', 'cuánto', 'vale', 'cuesta', 'sale', 'cobran', 'presio']);
  if (deliveryish && priceish) {
    return { code: 'DELIVERY_PRICE', handler: 'handleDelivery', confidence: 0.91, reason: 'delivery_price', orderCode: codeInText };
  }

  let best = null;
  for (const row of rows) {
    if (SHORT_ONLY.has(row.code) && tokenCount > 4) continue;
    const score = scoreIntent(row, folded);
    if (score < 0.28) continue;
    const conf = Math.min(0.95, 0.55 + score * 0.4);
    if (!best || score > best.score || (score === best.score && (row.priority || 100) < (best.priority || 100))) {
      best = {
        code: row.code,
        handler: row.handler || handlerFor(row.code),
        confidence: Number(conf.toFixed(2)),
        reason: 'scored',
        score,
        priority: row.priority,
        orderCode: codeInText,
        templates: row.templates || [],
      };
    }
  }
  if (best) return best;

  const productHits = (products || []).filter((p) => {
    const nameFold = foldAccents(p.name);
    return nameFold.split(/\s+/).filter((t) => t.length >= 4).some((t) => folded.includes(t));
  });
  if (productHits.length) {
    return {
      code: priceish ? 'PRODUCT_PRICE' : 'PRODUCT_SEARCH',
      handler: priceish ? 'handleProductPrice' : 'handleProductSearch',
      confidence: 0.78,
      reason: 'product',
      products: productHits.slice(0, 5),
      orderCode: codeInText,
    };
  }

  if (tokenCount <= 3 && includesAny(folded, ['hola', 'buenas', 'hey'])) {
    return { code: 'GREETING', handler: 'handleGreeting', confidence: 0.88, reason: 'short_hello' };
  }

  return { code: 'UNKNOWN', handler: 'handleUnknown', confidence: 0.2, reason: 'none', orderCode: codeInText };
}
