/** Handlers deterministas — solo datos Supabase + plantillas */

import { interpolate, pickVariant, templateVars } from './template.js';
import { moneyCLP, displayName, ORDER_STATUS_HUMAN } from './text.js';
import {
  searchProducts,
  formatProduct,
  findOpenOrdersByPhone,
  findOrderByCodeForPhone,
  formatOrderItems,
  loadAllBranches,
  branchOpenLabel,
} from './data.js';
import { searchKnowledge, searchChunks, bumpKnowledgeUse, saveUnanswered } from './memory.js';
import { formatBranchPaymentSummary } from '../payments.js';

function vars(ctx, extra = {}) {
  return templateVars({
    name: displayName(ctx.name),
    order: ctx.order,
    branch: ctx.branch,
    settings: ctx.settings,
    extra,
  });
}

export async function handleGreeting(ctx) {
  const list = ctx.settings.templates?.greeting;
  const tpl = pickVariant(list, ctx.phone) || (
    `👋 ¡Hola${displayName(ctx.name) ? `, ${displayName(ctx.name)}` : ''}! Bienvenido a Pollería El Pollón 🍗\n\n`
    + `Puedo ayudarte con menú, precios, horarios, delivery, sucursales o tu pedido.\n\n`
    + `También puedes comprar en: ${ctx.settings.website_url}`
  );
  return { text: interpolate(tpl, vars(ctx)), confidence: 0.95, intent: 'GREETING' };
}

export async function handleGoodbye(ctx) {
  const tpl = pickVariant(ctx.settings.templates?.goodbye, ctx.phone)
    || '¡Hasta luego! Gracias por preferir El Pollón 🍗';
  return { text: interpolate(tpl, vars(ctx)), confidence: 0.9, intent: 'GOODBYE' };
}

export async function handleThanks(ctx) {
  const tpl = pickVariant(ctx.settings.templates?.thanks, ctx.phone)
    || '¡Con gusto! Si necesitas algo más, aquí estoy 😊';
  return { text: interpolate(tpl, vars(ctx)), confidence: 0.9, intent: 'THANKS' };
}

export async function handleHowToBuy(ctx) {
  const tpl = ctx.settings.how_to_buy || ctx.settings.templates?.how_to_buy || '';
  return { text: interpolate(tpl, vars(ctx)), confidence: 0.93, intent: 'HOW_TO_BUY' };
}

export async function handlePayment(ctx) {
  const hits = await searchKnowledge(ctx.admin, {
    folded: ctx.folded,
    tokens: ctx.tokens,
    original: ctx.original,
    branchId: ctx.branch?.id,
  });
  const pay = hits.find((h) => {
    const blob = `${h.title} ${h.question} ${h.answer}`;
    if (!/pago|transfer|efectivo|tarjeta/i.test(blob)) return false;
    if (/no cobramos con tarjeta/i.test(h.answer || '')) return false;
    return true;
  });
  if (pay?.answer) {
    await bumpKnowledgeUse(ctx.admin, pay.id);
    return { text: pay.answer, confidence: Math.max(0.85, pay.confidence), intent: 'PAYMENT_METHOD', knowledgeId: pay.id };
  }
  const methods = formatBranchPaymentSummary(ctx.branch);
  const scope = ctx.branch?.name
    ? `En *${ctx.branch.name}* aceptamos ${methods}`
    : 'Cada sucursal define si acepta efectivo, transferencia y/o tarjeta';
  return {
    text: `En El Pollón el pago es *al momento de recibir el pedido*. ${scope}. No cobramos en línea ni por Webpay. Si pagas por transferencia, el local o el repartidor te entrega los datos al recibir.`,
    confidence: 0.9,
    intent: 'PAYMENT_METHOD',
  };
}

export async function handleHours(ctx) {
  const b = ctx.branch;
  if (!b) {
    return { text: 'Indícame la sucursal y te digo el horario.', confidence: 0.6, intent: 'OPENING_HOURS' };
  }
  const estado = branchOpenLabel(b);
  return {
    text: `🕐 *${b.name}*\nHorario: ${b.schedule}\n${estado}`,
    confidence: 0.94,
    intent: 'OPENING_HOURS',
  };
}

export async function handleBranch(ctx) {
  const all = await loadAllBranches(ctx.admin);
  if (!all.length) {
    return { text: 'No tengo sucursales confirmadas en este momento.', confidence: 0.5, intent: 'BRANCH' };
  }
  if (all.length === 1 || ctx.branch) {
    const b = ctx.branch || all[0];
    return {
      text: `📍 *${b.name}*\n${b.address}${b.city ? ` · ${b.city}` : ''}\n📞 ${b.phone || b.whatsapp || ctx.settings.support_phone}\n🕐 ${b.schedule}\n${branchOpenLabel(b)}`,
      confidence: 0.93,
      intent: 'BRANCH',
    };
  }
  const lines = all.map((b) => `• *${b.name}* — ${b.address || b.city || ''}`).join('\n');
  return {
    text: `Tenemos estas sucursales:\n\n${lines}\n\n¿Para cuál necesitas horario, delivery o menú?`,
    confidence: 0.9,
    intent: 'BRANCH',
  };
}

export async function handleContact(ctx) {
  const b = ctx.branch;
  const phone = b?.whatsapp || b?.phone || ctx.settings.support_phone;
  return {
    text: interpolate(
      `Puedes contactarnos al {support_phone}.${b ? `\nSucursal: *${b.name}*` : ''}`,
      vars(ctx, { support_phone: phone }),
    ),
    confidence: 0.9,
    intent: 'CONTACT',
  };
}

export async function handleDelivery(ctx) {
  const b = ctx.branch;
  if (!b) {
    return { text: '¿Para qué sucursal necesitas el delivery?', confidence: 0.55, intent: 'DELIVERY' };
  }
  if (!b.deliveryEnabled) {
    return {
      text: `En *${b.name}* ahora no tenemos delivery activo. Puedes retirar en local o pedir en ${ctx.settings.website_url}`,
      confidence: 0.9,
      intent: 'DELIVERY',
    };
  }
  const cost = b.deliveryCost === '' || b.deliveryCost == null
    ? 'según distancia / zona'
    : (Number(b.deliveryCost) > 0 ? moneyCLP(b.deliveryCost) : String(b.deliveryCost));
  return {
    text: `🛵 Delivery en *${b.name}*: ${cost}.\nTiempo estimado: ${b.deliveryEta || '30-45 min'}.\n\nLa tarifa exacta se calcula en ${ctx.settings.website_url} según tu dirección.`,
    confidence: 0.88,
    intent: 'DELIVERY',
  };
}

export async function handleProductPrice(ctx) {
  const hits = ctx.intent.products?.length
    ? ctx.intent.products
    : searchProducts(ctx.products, ctx.folded, 4);
  if (!hits.length) {
    return handleKnowledgeOrUnknown(ctx, { preferUnknown: false });
  }
  if (ctx.conversationId) {
    await ctx.patchConversation?.({ current_product_id: hits[0].id, current_intent: 'PRODUCT_PRICE' });
  }
  const lines = hits.slice(0, 3).map(formatProduct).join('\n\n');
  return {
    text: `${lines}\n\nPrecios de la sucursal *${ctx.branch?.name || ''}*. Pide en ${ctx.settings.website_url}`,
    confidence: 0.9,
    intent: 'PRODUCT_PRICE',
    extra: { productId: hits[0].id },
  };
}

export async function handleProductSearch(ctx) {
  const list = (ctx.products || []).filter((p) => p.featured || p.promotion).slice(0, 4);
  const rest = (ctx.products || []).filter((p) => !list.includes(p)).slice(0, 4);
  const show = [...list, ...rest];
  if (!show.length) {
    return { text: `No tengo el menú de esa sucursal ahora. Puedes verlo en ${ctx.settings.website_url}`, confidence: 0.55, intent: 'MENU' };
  }
  const lines = show.map((p) => `• ${p.name} — ${moneyCLP(p.price)}${p.promotion ? ' 🔥' : ''}`).join('\n');
  return {
    text: `Algunos platos de *${ctx.branch?.name || 'El Pollón'}*:\n\n${lines}\n\nMenú completo: ${ctx.settings.website_url}`,
    confidence: 0.86,
    intent: 'MENU',
  };
}

export async function handlePromotion(ctx) {
  const promos = (ctx.products || []).filter((p) => p.promotion || p.featured);
  if (!promos.length) {
    return handleProductSearch(ctx);
  }
  const lines = promos.slice(0, 5).map((p) => `• ${p.name} — ${moneyCLP(p.price)} 🔥`).join('\n');
  return { text: `Ofertas actuales:\n\n${lines}\n\n${ctx.settings.website_url}`, confidence: 0.87, intent: 'PROMOTION' };
}

export async function handleOrderStatus(ctx) {
  const code = ctx.intent.orderCode;
  let order = null;
  if (code) {
    order = await findOrderByCodeForPhone(ctx.admin, {
      code,
      phone: ctx.phone,
      branchId: ctx.branch?.id,
    });
    if (!order) {
      return {
        text: `No encuentro el pedido #${code} asociado a tu número. Si el código es correcto, escribe a ${ctx.settings.support_phone}.`,
        confidence: 0.85,
        intent: 'ORDER_STATUS',
      };
    }
  } else {
    const open = await findOpenOrdersByPhone(ctx.admin, { phone: ctx.phone, branchId: ctx.branch?.id });
    if (open.length > 1) {
      const opts = open.map((o) => `• #${o.codigo} — ${o.estadoLabel}`).join('\n');
      return {
        text: `Tienes más de un pedido activo:\n${opts}\n\n¿Cuál quieres consultar? (ej. #${open[0].codigo})`,
        confidence: 0.88,
        intent: 'ORDER_STATUS',
      };
    }
    order = open[0] || null;
  }
  if (!order) {
    return {
      text: `No veo un pedido activo con tu número. Si acabas de comprar, dame el código (ej. #001548) o pide en ${ctx.settings.website_url}`,
      confidence: 0.8,
      intent: 'ORDER_STATUS',
    };
  }
  if (ctx.patchConversation) {
    await ctx.patchConversation({ current_order_id: order.id, current_intent: 'ORDER_STATUS' });
  }
  const estado = ORDER_STATUS_HUMAN[order.estado] || order.estado;
  const detalle = formatOrderItems(order);
  return {
    text: `🛵 ${displayName(order.name || ctx.name) || 'Hola'}, tu pedido N.º ${order.codigo} está *${estado}*.\n🔎 Seguimiento: #${order.codigo}${detalle ? `\n\n${detalle}` : ''}\nTotal: ${moneyCLP(order.total)}`,
    confidence: 0.95,
    intent: 'ORDER_STATUS',
    extra: { orderId: order.id },
  };
}

export async function handleComplaint(ctx) {
  if (ctx.patchConversation) {
    await ctx.patchConversation({ mode: 'human_required', current_intent: 'COMPLAINT' });
  }
  const tpl = ctx.settings.templates?.complaint
    || `Lamentamos mucho lo ocurrido{nombre_coma}. Queremos revisar tu caso.\n\nComunícate al {support_phone}\nSi tienes número de pedido, indícalo (ej. #001548).`;
  return { text: interpolate(tpl, vars(ctx)), confidence: 0.9, intent: 'COMPLAINT', extra: { human: true } };
}

export async function handleHumanSupport(ctx) {
  if (ctx.patchConversation) {
    await ctx.patchConversation({ mode: 'human_required', current_intent: 'HUMAN_SUPPORT' });
  }
  const tpl = ctx.settings.templates?.human
    || 'Claro 😊. Dejo tu conversación disponible para nuestro equipo. También puedes llamar al {support_phone}.';
  return { text: interpolate(tpl, vars(ctx)), confidence: 0.92, intent: 'HUMAN_SUPPORT', extra: { human: true } };
}

export async function handleKnowledgeSearch(ctx) {
  return handleKnowledgeOrUnknown(ctx, { preferUnknown: false });
}

export async function handleUnknown(ctx) {
  return handleKnowledgeOrUnknown(ctx, { preferUnknown: true });
}

async function handleKnowledgeOrUnknown(ctx, { preferUnknown }) {
  const hits = await searchKnowledge(ctx.admin, {
    folded: ctx.folded,
    tokens: ctx.tokens,
    original: ctx.original,
    branchId: ctx.branch?.id,
  });
  const best = hits[0];
  const min = Number(ctx.settings.minimum_confidence) || 0.8;
  if (best && best.confidence >= min) {
    await bumpKnowledgeUse(ctx.admin, best.id);
    return { text: best.answer, confidence: best.confidence, intent: 'FAQ', knowledgeId: best.id };
  }
  if (best && best.confidence >= 0.6 && !preferUnknown) {
    await bumpKnowledgeUse(ctx.admin, best.id);
    return { text: best.answer, confidence: best.confidence, intent: 'FAQ', knowledgeId: best.id };
  }

  const chunks = await searchChunks(ctx.admin, {
    query: ctx.original || ctx.folded,
    branchId: ctx.branch?.id,
  });
  if (chunks[0]?.content && Number(chunks[0].score) >= 0.25) {
    return {
      text: String(chunks[0].content).slice(0, 700).trim(),
      confidence: Math.min(0.74, Number(chunks[0].score) + 0.25),
      intent: 'FAQ',
      extra: { chunkId: chunks[0].id },
    };
  }

  await saveUnanswered(ctx.admin, {
    conversation_id: ctx.conversationId,
    customer_id: ctx.customerId,
    phone: ctx.phone,
    original_question: ctx.original,
    normalized_question: ctx.folded,
    detected_intent: ctx.intent?.code || 'UNKNOWN',
    possible_matches: hits.slice(0, 3).map((h) => ({ id: h.id, title: h.title, score: h.confidence })),
    similarity_score: best?.confidence ?? null,
    branch_id: ctx.branch?.id || null,
  });

  const tpl = ctx.settings.unknown_response || '';
  return {
    text: interpolate(tpl, vars(ctx)),
    confidence: best?.confidence || 0.2,
    intent: 'UNKNOWN',
    extra: { unanswered: true },
  };
}

export const HANDLERS = {
  handleGreeting,
  handleGoodbye,
  handleThanks,
  handleHowToBuy,
  handlePayment,
  handleHours,
  handleBranch,
  handleContact,
  handleDelivery,
  handleProductPrice,
  handleProductSearch,
  handlePromotion,
  handleOrderStatus,
  handleComplaint,
  handleHumanSupport,
  handleKnowledgeSearch,
  handleUnknown,
};
