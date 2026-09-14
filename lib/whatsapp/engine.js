/** Motor inbound WhatsApp Inteligente — sin LLM de pago */

import { interpolate, moneyCLP } from './text.js';
import { isOpenNow } from './branch.js';
import { classifyIntent } from './intents.js';
import {
  ensureSettingsRow,
  loadSettingsByInstance,
  loadBranch,
  loadMenu,
  loadKb,
  loadBestsellers,
  getOrCreateSession,
  updateSession,
  logMessage,
  countOutboundLastMinute,
  countPurchases,
  findOrderByCode,
  findOpenOrderByPhone,
  loyaltyText,
  buildTemplateVars,
  storeUrl,
  createAlert,
  markOrderWaAvisos,
  pickAbVariant,
} from './knowledge.js';
import { sendText, sendImage, evolutionConfigured, publicMediaUrl } from './evolution.js';
import { normalizeWhatsappPhone } from './phone.js';
import { ollamaConfigured, ollamaChat, buildOllamaUserPrompt } from './ollama.js';

function botAllowedNow(branch, settings) {
  if (settings.bot_24_7) return true;
  if (settings.usar_horario_sucursal !== false) {
    return isOpenNow(branch.schedule, { isActive: branch.isActive, isOpen: branch.isOpen });
  }
  if (settings.bot_from && settings.bot_to) {
    const fake = `${settings.bot_from} - ${settings.bot_to}`;
    return isOpenNow(fake, { isActive: true, isOpen: true });
  }
  return true;
}

function formatPlato(p) {
  const old = p.oldPrice ? ` ~~${moneyCLP(p.oldPrice)}~~` : '';
  const promo = p.promotion || p.featured ? ' 🔥' : '';
  const extras = [];
  if (p.drinkEnabled) extras.push('bebida opcional');
  if (p.bagEnabled) extras.push(`bolsa ${moneyCLP(p.bagPrice || 200)}`);
  const extraTxt = extras.length ? `\n${extras.join(' · ')}` : '';
  const desc = p.description ? `\n${p.description}` : '';
  return `*${p.name}*${promo}\n${moneyCLP(p.price)}${old}${desc}${extraTxt}\nPrep. ~${p.prep || 15} min`;
}

const PHOTO_DEDUPE_MS = 45 * 60 * 1000;

function pickPlatoPhoto(products, session) {
  const candidate = (products || []).find((p) => publicMediaUrl(p.imageUrl));
  if (!candidate) return null;
  const url = publicMediaUrl(candidate.imageUrl);
  const sameId = session?.last_photo_product_id && String(session.last_photo_product_id) === String(candidate.id);
  const recent = session?.last_photo_at && (Date.now() - new Date(session.last_photo_at).getTime()) < PHOTO_DEDUPE_MS;
  if (sameId && recent) return null;
  return {
    url,
    productId: candidate.id,
    caption: `${candidate.name} · ${moneyCLP(candidate.price)}`,
  };
}

function formatMenuResumen(categories, products, limit = 8) {
  const featured = products.filter((p) => p.featured || p.promotion).slice(0, 4);
  const rest = products.filter((p) => !featured.includes(p)).slice(0, Math.max(0, limit - featured.length));
  const list = [...featured, ...rest];
  const catNames = (categories || []).slice(0, 6).map((c) => c.name).join(' · ');
  const lines = list.map((p) => `• ${p.name} — ${moneyCLP(p.price)}${p.promotion ? ' 🔥' : ''}`);
  return `${catNames ? `Categorías: ${catNames}\n\n` : ''}${lines.join('\n')}`;
}

async function resolveLoyalty(admin, { phone, branchId, settings, sucursal }) {
  const count = await countPurchases(admin, {
    phone,
    branchId,
    onlyBranch: settings.contar_compras_solo_sucursal !== false,
  });
  return { count, text: loyaltyText(settings.loyalty_tiers, count, sucursal) };
}

async function handoffHuman(admin, { session, branch, phone, preview, orderId }) {
  const until = new Date(Date.now() + (Number(session?.human_timeout_min) || 120) * 60 * 1000);
  if (session?.id) {
    await updateSession(admin, session.id, {
      mode: 'human',
      human_until: until.toISOString(),
      last_intent: 'queja',
    });
  }
  await createAlert(admin, {
    type: 'complaint',
    branch_id: branch.id,
    order_id: orderId || null,
    phone: normalizeWhatsappPhone(phone),
    preview: String(preview || '').slice(0, 280),
  });
}

/**
 * @param {object} opts
 * @param {import('@supabase/supabase-js').SupabaseClient} opts.admin
 * @param {string} opts.instance
 * @param {string} opts.phone
 * @param {string} opts.text
 * @param {string} [opts.pushName]
 * @param {boolean} [opts.simulate]
 */
export async function handleInbound({
  admin,
  instance,
  phone,
  text,
  pushName = '',
  simulate = false,
  branchId: forcedBranchId = null,
}) {
  const normalized = normalizeWhatsappPhone(phone);
  if (!normalized) {
    return { ok: false, error: 'Teléfono inválido', intent: null, reply: null };
  }

  let settings = null;
  if (forcedBranchId) {
    settings = await ensureSettingsRow(admin, forcedBranchId);
  } else if (instance) {
    settings = await loadSettingsByInstance(admin, instance);
  }
  if (!settings?.branch_id) {
    return { ok: false, error: 'Sucursal no configurada para esta instancia', intent: null, reply: null };
  }
  if (!settings.enabled && !simulate) {
    return { ok: true, skipped: 'disabled', intent: null, reply: null };
  }

  const branch = await loadBranch(admin, settings.branch_id);
  if (!branch) {
    return { ok: false, error: 'Sucursal no encontrada', intent: null, reply: null };
  }

  const session = await getOrCreateSession(admin, {
    phone: normalized,
    branchId: branch.id,
    name: pushName,
  });

  const now = new Date();
  const humanUntil = session?.human_until ? new Date(session.human_until) : null;
  const inHuman = session?.mode === 'human' && humanUntil && now < humanUntil;

  if (!simulate) {
    await logMessage(admin, {
      sessionId: session?.id,
      branchId: branch.id,
      phone: normalized,
      direction: 'in',
      body: text,
      intent: inHuman ? 'human_mode' : null,
    });
  }

  if (inHuman && !simulate) {
    return { ok: true, skipped: 'human', intent: 'human_mode', reply: null, mode: 'human' };
  }

  if (!botAllowedNow(branch, settings) && !simulate) {
    const closed = interpolate(settings.templates.horario || settings.templates.fallback, buildTemplateVars({
      branch, settings, name: session?.last_name || pushName,
    }));
    return sendReply({
      admin, settings, branch, session, phone: normalized, intent: 'atiende_horario',
      reply: closed, simulate,
    });
  }

  const [{ categories, products }, kb] = await Promise.all([
    loadMenu(admin, branch.id),
    loadKb(admin, branch.id),
  ]);

  const classified = classifyIntent({ text, settings, kb, products });
  const loyalty = await resolveLoyalty(admin, {
    phone: normalized,
    branchId: branch.id,
    settings,
    sucursal: branch.name,
  });

  let order = null;
  if (classified.code) {
    order = await findOrderByCode(admin, {
      code: classified.code,
      phone: normalized,
      branchId: branch.id,
    });
  }
  if (!order && ['estado_pedido', 'activar_avisos', 'queja'].includes(classified.intent)) {
    order = await findOpenOrderByPhone(admin, {
      phone: normalized,
      branchId: branch.id,
      lookbackHours: settings.lookback_hours,
    });
  }

  const name = order?.name || session?.last_name || pushName || '';
  let intent = classified.intent;
  let reply = '';
  let photo = null;
  let ollamaMeta = null;

  if (intent === 'queja' || intent === 'humano') {
    await handoffHuman(admin, {
      session: { ...session, human_timeout_min: settings.human_timeout_min },
      branch,
      phone: normalized,
      preview: text,
      orderId: order?.id,
    });
    reply = interpolate(settings.templates.queja_cliente, buildTemplateVars({
      branch, settings, name, order, loyalty,
    }));
    intent = intent === 'humano' ? 'humano' : 'queja';
  } else if (intent === 'opt_out') {
    if (session?.id) {
      await updateSession(admin, session.id, { opt_out: true, last_intent: 'opt_out' });
    }
    try {
      const { data: profs } = await admin.from('profiles')
        .select('id')
        .eq('phone', normalized)
        .limit(3);
      for (const p of profs || []) {
        await admin.from('customer_marketing_preferences').upsert({
          customer_id: p.id,
          accepts_whatsapp_promotions: false,
        }, { onConflict: 'customer_id' });
      }
    } catch { /* opt-out de sesión basta */ }
    reply = interpolate(settings.templates.opt_out || settings.templates.fallback, buildTemplateVars({
      branch, settings, name, order, loyalty,
    }));
  } else if (intent === 'activar_avisos') {
    if (!order) {
      reply = `No encontré ese pedido en *${branch.name}*.\nSi me pasas el código (#000123) lo reviso al tiro.`;
    } else {
      reply = interpolate(settings.templates.confirmacion_pedido, buildTemplateVars({
        branch, settings, name: order.name || name, order, loyalty,
      }));
      if (session?.id) {
        await updateSession(admin, session.id, {
          last_order_id: order.id,
          last_name: order.name || name,
          order_count_cache: loyalty.count,
          last_intent: 'activar_avisos',
          mode: 'bot',
        });
      }
      if (!simulate) {
        await upsertOutboxSent(admin, order.id, 'confirmacion');
        await markOrderWaAvisos(admin, order.id);
      }
    }
  } else if (intent === 'estado_pedido') {
    if (!order) {
      reply = `No veo un pedido abierto con ese teléfono en *${branch.name}*.\nSi me escribes el código (#000123) lo busco.`;
    } else {
      reply = interpolate(settings.templates.estado_pedido, buildTemplateVars({
        branch, settings, name: order.name || name, order, loyalty,
      }));
    }
  } else if (intent === 'kb' && classified.kb) {
    reply = interpolate(classified.kb.respuesta, buildTemplateVars({
      branch, settings, name, order, loyalty,
    }));
  } else if (intent === 'plato_especifico' && classified.products?.length) {
    const top = classified.products.slice(0, 3);
    const platoDetalle = top.map((p) => formatPlato(p)).join('\n\n');
    const linkPlato = storeUrl(settings.link_web, { branchId: branch.id, q: top[0].name });
    reply = interpolate(settings.templates.plato, buildTemplateVars({
      branch, settings, name, loyalty, platoDetalle, linkPlato,
    }));
    if (settings.enviar_foto_plato) {
      photo = pickPlatoPhoto(top, session);
    }
  } else if (intent === 'atiende_horario') {
    reply = interpolate(settings.templates.horario, buildTemplateVars({
      branch, settings, name, loyalty,
    }));
  } else if (intent === 'sucursal_info') {
    reply = interpolate(settings.templates.sucursal_info, buildTemplateVars({
      branch, settings, name, loyalty,
    }));
  } else if (intent === 'delivery_info') {
    const cost = branch.deliveryCost
      ? `Costo referencial: ${String(branch.deliveryCost)}`
      : 'El costo se calcula en la web según tu dirección.';
    const min = branch.pickupMinOrder
      ? `\nMínimo retiro: ${moneyCLP(branch.pickupMinOrder)}`
      : '';
    reply = interpolate(settings.templates.delivery_info, buildTemplateVars({
      branch, settings, name, loyalty, deliveryCostTxt: `${cost}${min}`,
    }));
  } else if (intent === 'menu_listado') {
    reply = interpolate(settings.templates.menu_listado, buildTemplateVars({
      branch, settings, name, loyalty,
      menuResumen: formatMenuResumen(categories, products),
    }));
  } else if (intent === 'bestsellers') {
    const best = await loadBestsellers(admin, { branchId: branch.id, products });
    const bestsellersTxt = best.map((p, i) => `${i + 1}. ${p.name} — ${moneyCLP(p.price)}`).join('\n');
    reply = interpolate(settings.templates.bestsellers, buildTemplateVars({
      branch, settings, name, loyalty, bestsellersTxt,
    }));
  } else if (intent === 'como_comprar') {
    reply = interpolate(settings.templates.como_comprar, buildTemplateVars({
      branch, settings, name, loyalty,
    }));
  } else if (intent === 'saludo') {
    let variant = session?.ab_variant || null;
    if (settings.ab_welcome_enabled) {
      variant = variant || pickAbVariant(normalized);
      if (session?.id && variant !== session.ab_variant) {
        await updateSession(admin, session.id, { ab_variant: variant });
      }
    }
    const welcomeTpl = (variant === 'b' && settings.templates.bienvenida_b)
      ? settings.templates.bienvenida_b
      : settings.templates.bienvenida;
    reply = interpolate(welcomeTpl, buildTemplateVars({
      branch, settings, name, loyalty,
    }));
  } else {
    const fallback = interpolate(settings.templates.fallback, buildTemplateVars({
      branch, settings, name, loyalty,
    }));
    reply = fallback;
    intent = 'otro';
    if (settings.ollama_enabled && ollamaConfigured()) {
      const r = await ollamaChat({
        model: settings.ollama_model,
        prompt: buildOllamaUserPrompt({
          text, branch, settings, products, fallback, loyalty,
        }),
      });
      ollamaMeta = { used: r.ok, model: r.model, error: r.error || null };
      if (r.ok) reply = r.text;
    } else if (settings.ollama_enabled) {
      ollamaMeta = { used: false, error: 'OLLAMA_URL no configurado' };
    }
  }

  if (session?.id && intent !== 'queja' && intent !== 'humano') {
    await updateSession(admin, session.id, {
      last_intent: intent,
      last_name: name || session.last_name,
      order_count_cache: loyalty.count,
      ...(order ? { last_order_id: order.id } : {}),
    });
  }

  return sendReply({
    admin, settings, branch, session, phone: normalized, intent, reply, simulate, loyalty, photo, ollama: ollamaMeta,
  });
}

async function upsertOutboxSent(admin, orderId, event) {
  await admin.from('ep_wa_outbox').upsert({
    order_id: String(orderId),
    event,
    status: 'sent',
    sent_at: new Date().toISOString(),
    error_text: null,
  }, { onConflict: 'order_id,event' });
}

async function sendReply({ admin, settings, branch, session, phone, intent, reply, simulate, loyalty, photo = null, ollama = null }) {
  if (!reply) {
    return { ok: true, intent, reply: null, simulate: !!simulate, loyalty, ollama, photo: photo?.url || null };
  }

  if (simulate) {
    return {
      ok: true,
      intent,
      reply,
      simulate: true,
      mode: session?.mode || 'bot',
      loyalty,
      ollama,
      photo: photo?.url || null,
      branch: { id: branch.id, name: branch.name },
    };
  }

  const recent = await countOutboundLastMinute(admin, phone);
  if (recent >= (settings.rate_limit_per_min || 4)) {
    return { ok: true, skipped: 'rate_limit', intent, reply, ollama };
  }

  if (evolutionConfigured() && settings.evolution_instance) {
    try {
      await sendText(settings.evolution_instance, phone, reply);
      if (photo?.url) {
        try {
          await sendImage(settings.evolution_instance, phone, photo.url, photo.caption || '');
          if (session?.id) {
            await updateSession(admin, session.id, {
              last_photo_product_id: String(photo.productId || ''),
              last_photo_at: new Date().toISOString(),
            });
          }
        } catch {
          /* texto ya salió; no fallar el aviso por la foto */
        }
      }
    } catch (err) {
      await createAlert(admin, {
        type: 'disconnected',
        branch_id: branch.id,
        phone,
        preview: `No se pudo enviar: ${String(err.message || err).slice(0, 200)}`,
      });
      await logMessage(admin, {
        sessionId: session?.id,
        branchId: branch.id,
        phone,
        direction: 'out',
        body: reply,
        intent,
        extra: { error: String(err.message || err).slice(0, 300), ollama },
      });
      return { ok: false, error: err.message, intent, reply, ollama };
    }
  }

  await logMessage(admin, {
    sessionId: session?.id,
    branchId: branch.id,
    phone,
    direction: 'out',
    body: reply,
    intent,
    extra: ollama || photo ? { ollama, photo: photo?.url || null } : null,
  });

  return { ok: true, intent, reply, mode: session?.mode || 'bot', loyalty, ollama, photo: photo?.url || null };
}
