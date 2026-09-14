/**
 * El Pollón Bot — BotEngine (determinista, SIN IA generativa)
 *
 * mensaje → normalizar → cliente → contexto → intención →
 * Supabase (productos/pedidos/sucursal) → memoria → plantilla → guardar
 */

import { getSupabaseAdmin } from '../whatsapp/supabaseAdmin.js';
import { normalizeChilePhone } from './phone.js';
import { normalizeMessage, displayName } from './text.js';
import { loadBotSettings, loadSynonyms, loadIntentRows } from './settings.js';
import { detectIntent, expandWithSynonyms } from './intents.js';
import {
  loadBranch,
  loadMenu,
  findProfileByPhone,
  latestOrderName,
} from './data.js';
import {
  findDuplicateMessage,
  getOrCreateConversation,
  updateConversation,
  saveMessage,
  loadRecentMessages,
  countOutboundLastMinute,
  writeLog,
} from './context.js';
import { HANDLERS } from './handlers.js';

export async function processInbound(input = {}) {
  const admin = input.admin || getSupabaseAdmin();
  if (!admin) {
    return { ok: false, error: 'missing_supabase_admin', reply: null };
  }

  const phone = normalizeChilePhone(input.phone);
  if (!phone) {
    return { ok: false, error: 'invalid_phone', reply: null };
  }

  const original = String(input.message || input.text || '').trim();
  const messageId = input.messageId || input.whatsapp_message_id || null;
  const profileName = displayName(input.profileName || input.pushName || '');
  const branchId = input.branchId || input.branch_id || null;

  if (!original) {
    return { ok: true, skipped: 'empty', reply: null, phone };
  }

  if (messageId) {
    const dup = await findDuplicateMessage(admin, messageId);
    if (dup) {
      return { ok: true, skipped: 'duplicate', reply: null, phone, conversationId: dup.conversation_id };
    }
  }

  const settings = await loadBotSettings(admin, branchId);
  if (!settings.bot_enabled) {
    return { ok: true, skipped: 'bot_disabled', reply: null, phone, settings };
  }

  const outbound = await countOutboundLastMinute(admin, phone);
  if (outbound >= (settings.rate_limit_per_min || 4)) {
    await writeLog(admin, { level: 'warning', eventType: 'rate_limit', message: phone, branchId });
    return { ok: true, skipped: 'rate_limit', reply: null, phone };
  }

  const branch = await loadBranch(admin, branchId);
  const products = branch?.id ? await loadMenu(admin, branch.id) : [];
  const profile = await findProfileByPhone(admin, phone);
  const orderName = await latestOrderName(admin, phone);
  const name = displayName(orderName) || displayName(profile?.full_name) || profileName;

  const conversation = await getOrCreateConversation(admin, {
    phone,
    branchId: branch?.id || branchId || null,
    customerId: profile?.id || null,
    profileName: name || profileName,
  });

  if (conversation && (conversation.mode === 'human' || conversation.mode === 'human_required')) {
    await saveMessage(admin, {
      conversation_id: conversation.id,
      phone,
      direction: 'incoming',
      sender_type: 'customer',
      original_text: original,
      normalized_text: normalizeMessage(original).folded,
      intent: 'HUMAN_HOLD',
      whatsapp_message_id: messageId,
      metadata: { mode: conversation.mode },
    });
    await updateConversation(admin, conversation.id, {
      last_message_at: new Date().toISOString(),
      last_message_preview: original.slice(0, 140),
      unread_count: (Number(conversation.unread_count) || 0) + 1,
    });
    return {
      ok: true,
      skipped: 'human_mode',
      reply: null,
      phone,
      conversationId: conversation.id,
      mode: conversation.mode,
    };
  }

  const synonyms = await loadSynonyms(admin);
  const intentRows = await loadIntentRows(admin);
  const parsed = normalizeMessage(original);
  const folded = expandWithSynonyms(parsed.folded, synonyms);
  const recent = await loadRecentMessages(admin, conversation?.id, 6);

  const intent = detectIntent({
    folded,
    original,
    tokens: parsed.tokens,
    intentRows,
    products,
  });

  if (intent.code === 'UNKNOWN' && conversation?.current_product_id && /bebida|con eso|y con|tambien|también|ese|esa/.test(folded)) {
    const current = products.find((p) => p.id === conversation.current_product_id);
    if (current) {
      intent.code = 'PRODUCT_PRICE';
      intent.handler = 'handleProductPrice';
      intent.products = [current];
      intent.confidence = 0.75;
      intent.reason = 'context_product';
    }
  }

  await saveMessage(admin, {
    conversation_id: conversation?.id,
    phone,
    direction: 'incoming',
    sender_type: 'customer',
    original_text: original,
    normalized_text: folded,
    intent: intent.code,
    confidence: intent.confidence,
    whatsapp_message_id: messageId,
    metadata: { reason: intent.reason },
  });
  if (conversation?.id) {
    await updateConversation(admin, conversation.id, {
      unread_count: (Number(conversation.unread_count) || 0) + 1,
      last_message_at: new Date().toISOString(),
      last_message_preview: original.slice(0, 140),
      current_intent: intent.code,
    });
  }

  const ctx = {
    admin,
    settings,
    branch,
    products,
    phone,
    name,
    original,
    folded,
    tokens: parsed.tokens,
    intent,
    conversationId: conversation?.id,
    customerId: profile?.id || null,
    recent,
    patchConversation: (patch) => updateConversation(admin, conversation?.id, patch),
  };

  const handler = HANDLERS[intent.handler] || HANDLERS.handleUnknown;
  let result;
  try {
    result = await handler(ctx);
  } catch (err) {
    await writeLog(admin, {
      level: 'error',
      eventType: 'handler_error',
      message: String(err?.message || err),
      conversationId: conversation?.id,
      branchId: branch?.id,
    });
    result = await HANDLERS.handleUnknown(ctx);
  }

  const replyText = String(result?.text || '').trim();
  if (replyText) {
    await saveMessage(admin, {
      conversation_id: conversation?.id,
      phone,
      direction: 'outgoing',
      sender_type: 'bot',
      original_text: replyText,
      normalized_text: normalizeMessage(replyText).folded,
      intent: result.intent || intent.code,
      matched_knowledge_id: result.knowledgeId || null,
      confidence: result.confidence ?? intent.confidence,
      metadata: result.extra || {},
    });
    await updateConversation(admin, conversation?.id, {
      current_intent: result.intent || intent.code,
      last_message_at: new Date().toISOString(),
      last_message_preview: replyText.slice(0, 140),
      ...(result.extra?.productId ? { current_product_id: result.extra.productId } : {}),
      ...(result.extra?.orderId ? { current_order_id: result.extra.orderId } : {}),
      ...(result.extra?.human ? { mode: 'human_required' } : {}),
    });
  }

  await writeLog(admin, {
    level: 'info',
    eventType: 'inbound',
    message: `${intent.code} c=${result?.confidence ?? intent.confidence}`,
    conversationId: conversation?.id,
    branchId: branch?.id,
    metadata: { handler: intent.handler, reason: intent.reason },
  });

  return {
    ok: true,
    phone,
    name,
    conversationId: conversation?.id,
    branchId: branch?.id || branchId || null,
    intent: result?.intent || intent.code,
    confidence: result?.confidence ?? intent.confidence,
    reason: intent.reason,
    knowledgeId: result?.knowledgeId || null,
    reply: replyText || null,
    human: Boolean(result?.extra?.human),
    simulate: Boolean(input.simulate),
  };
}

export { normalizeChilePhone };
