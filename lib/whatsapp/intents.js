import {
  HUMAN_KEYWORDS,
  GREETING_KEYWORDS,
  HOW_TO_BUY_KEYWORDS,
  HOURS_KEYWORDS,
  BRANCH_KEYWORDS,
  DELIVERY_KEYWORDS,
  MENU_KEYWORDS,
  BESTSELLER_KEYWORDS,
  ORDER_STATUS_KEYWORDS,
  AVISOS_KEYWORDS,
  OPT_OUT_KEYWORDS,
} from './defaults.js';
import { foldAccents, includesAny, extractOrderCode } from './text.js';
import { matchKb, searchProducts } from './knowledge.js';

/**
 * Prioridad: queja > humano > opt_out > activar_avisos > estado_pedido > KB >
 * plato > horario > sucursal > delivery > menu > bestsellers > como_comprar > saludo > fallback
 */
export function classifyIntent({ text, settings, kb = [], products = [] }) {
  const original = String(text || '').trim();
  const folded = foldAccents(original);
  const complaintKw = settings?.complaint_keywords || [];

  if (!folded) {
    return { intent: 'saludo', reason: 'empty', kb: null, products: [], code: null };
  }

  if (includesAny(folded, complaintKw)) {
    return { intent: 'queja', reason: 'keyword', kb: null, products: [], code: extractOrderCode(original) };
  }
  if (includesAny(folded, HUMAN_KEYWORDS)) {
    return { intent: 'humano', reason: 'keyword', kb: null, products: [], code: extractOrderCode(original) };
  }
  if (includesAny(folded, OPT_OUT_KEYWORDS)) {
    return { intent: 'opt_out', reason: 'keyword', kb: null, products: [], code: extractOrderCode(original) };
  }

  const code = extractOrderCode(original);
  if (includesAny(folded, AVISOS_KEYWORDS) || /^avisos\b/i.test(original)) {
    return { intent: 'activar_avisos', reason: 'keyword', kb: null, products: [], code };
  }
  if (code && (includesAny(folded, ORDER_STATUS_KEYWORDS) || /#\d{4,}/.test(original))) {
    return { intent: 'estado_pedido', reason: 'code', kb: null, products: [], code };
  }
  if (includesAny(folded, ORDER_STATUS_KEYWORDS)) {
    return { intent: 'estado_pedido', reason: 'keyword', kb: null, products: [], code };
  }

  const kbHit = matchKb(kb, folded);
  if (kbHit) {
    return { intent: kbHit.intent_hint || 'kb', reason: 'kb', kb: kbHit, products: [], code };
  }

  const matchedProducts = searchProducts(products, original, 5);
  if (matchedProducts.length && (includesAny(folded, ['precio', 'cuanto', 'cuánto', 'vale', 'cuesta', 'tienen', 'hay']) || matchedProducts[0] && foldAccents(matchedProducts[0].name).split(' ').filter((t) => t.length > 3).some((t) => folded.includes(t)))) {
    return { intent: 'plato_especifico', reason: 'product', kb: null, products: matchedProducts, code };
  }
  if (matchedProducts.length && folded.length >= 4) {
    const strong = matchedProducts.filter((p) => {
      const nameFold = foldAccents(p.name);
      return nameFold.split(' ').filter((t) => t.length >= 4).some((t) => folded.includes(t));
    });
    if (strong.length) {
      return { intent: 'plato_especifico', reason: 'product', kb: null, products: strong, code };
    }
  }

  if (includesAny(folded, HOURS_KEYWORDS)) {
    return { intent: 'atiende_horario', reason: 'keyword', kb: null, products: [], code };
  }
  if (includesAny(folded, BRANCH_KEYWORDS)) {
    return { intent: 'sucursal_info', reason: 'keyword', kb: null, products: [], code };
  }
  if (includesAny(folded, DELIVERY_KEYWORDS)) {
    return { intent: 'delivery_info', reason: 'keyword', kb: null, products: [], code };
  }
  if (includesAny(folded, BESTSELLER_KEYWORDS)) {
    return { intent: 'bestsellers', reason: 'keyword', kb: null, products: [], code };
  }
  if (includesAny(folded, MENU_KEYWORDS)) {
    return { intent: 'menu_listado', reason: 'keyword', kb: null, products: [], code };
  }
  if (includesAny(folded, HOW_TO_BUY_KEYWORDS)) {
    return { intent: 'como_comprar', reason: 'keyword', kb: null, products: [], code };
  }
  if (includesAny(folded, GREETING_KEYWORDS) || folded.length <= 8) {
    return { intent: 'saludo', reason: 'keyword', kb: null, products: matchedProducts, code };
  }

  if (matchedProducts.length) {
    return { intent: 'plato_especifico', reason: 'product-fallback', kb: null, products: matchedProducts, code };
  }

  return { intent: 'otro', reason: 'fallback', kb: null, products: [], code };
}
