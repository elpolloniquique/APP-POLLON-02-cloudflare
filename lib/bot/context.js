/** Conversación, mensajes, rate-limit, idempotencia */

import { normalizeChilePhone } from './phone.js';
import { sanitizeLogText, sanitizeLogMeta } from './auth.js';

export async function findDuplicateMessage(admin, whatsappMessageId) {
  if (!whatsappMessageId) return null;
  const { data } = await admin
    .from('bot_messages')
    .select('id, conversation_id')
    .eq('whatsapp_message_id', whatsappMessageId)
    .maybeSingle();
  return data || null;
}

async function findConversation(admin, phone, branchId) {
  let q = admin.from('bot_conversations').select('*').eq('phone', phone).limit(1);
  if (branchId) q = q.eq('branch_id', branchId);
  else q = q.is('branch_id', null);
  const { data } = await q;
  return data?.[0] || null;
}

export async function getOrCreateConversation(admin, { phone, branchId, customerId, profileName }) {
  const existing = await findConversation(admin, phone, branchId);
  if (existing) return existing;

  const insert = {
    phone,
    branch_id: branchId || null,
    customer_id: customerId || null,
    mode: 'bot',
    context_json: profileName ? { profile_name: profileName } : {},
    last_message_at: new Date().toISOString(),
  };
  const { data, error } = await admin.from('bot_conversations').insert(insert).select('*').maybeSingle();
  if (error) return findConversation(admin, phone, branchId);
  return data;
}

export async function updateConversation(admin, id, patch) {
  if (!id) return;
  await admin.from('bot_conversations').update({
    ...patch,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
}

export async function saveMessage(admin, row) {
  const { data, error } = await admin.from('bot_messages').insert({
    conversation_id: row.conversation_id || null,
    phone: row.phone || null,
    direction: row.direction,
    sender_type: row.sender_type,
    original_text: row.original_text || '',
    normalized_text: row.normalized_text || '',
    intent: row.intent || null,
    matched_knowledge_id: row.matched_knowledge_id || null,
    confidence: row.confidence ?? null,
    whatsapp_message_id: row.whatsapp_message_id || null,
    status: row.status || 'stored',
    metadata: row.metadata || {},
  }).select('id').maybeSingle();
  if (error) return null;
  return data?.id || null;
}

export async function loadRecentMessages(admin, conversationId, limit = 8) {
  if (!conversationId) return [];
  const { data } = await admin
    .from('bot_messages')
    .select('direction, sender_type, original_text, intent, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data || []).reverse();
}

export async function countOutboundLastMinute(admin, phone) {
  const since = new Date(Date.now() - 60 * 1000).toISOString();
  const { count } = await admin
    .from('bot_messages')
    .select('id', { count: 'exact', head: true })
    .eq('phone', phone)
    .eq('direction', 'outgoing')
    .gte('created_at', since);
  return Number(count) || 0;
}

export async function writeLog(admin, { level = 'info', eventType, message, conversationId, orderId, branchId, metadata }) {
  try {
    await admin.from('bot_logs').insert({
      level,
      event: eventType || 'bot',
      event_type: eventType || 'bot',
      message: sanitizeLogText(message),
      conversation_id: conversationId || null,
      order_id: orderId || null,
      branch_id: branchId || null,
      metadata: sanitizeLogMeta(metadata || {}),
    });
  } catch {
    /* no romper el flujo por logs */
  }
}

export async function writeAudit(admin, { actorId, action, message, branchId, metadata }) {
  return writeLog(admin, {
    level: 'info',
    eventType: 'audit',
    message: `${action}${message ? `: ${message}` : ''}`,
    branchId,
    metadata: { actor_id: actorId || null, action, ...(metadata || {}) },
  });
}

export { normalizeChilePhone };
