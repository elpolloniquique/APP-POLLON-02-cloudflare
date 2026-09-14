import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { extractKeywords, splitVariants } from '../../lib/bot/keywords.js';

const BUCKET = 'bot-documents';

function sb() {
  const client = getSupabase();
  if (!client) throw new Error('Supabase no configurado');
  return client;
}

async function authHeaders() {
  const client = getSupabase();
  const { data } = await client.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Sesión expirada');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export function isBotBackendReady() {
  return isSupabaseConfigured();
}

export async function listKnowledge({ q = '', category = '', activeOnly = false, branchId = null } = {}) {
  const client = sb();
  let query = client
    .from('bot_knowledge')
    .select('id, title, category, question, answer, content, keywords, variants, synonyms, source_type, priority, active, times_used, times_matched, last_used_at, branch_id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);
  if (activeOnly) query = query.eq('active', true);
  if (category) query = query.eq('category', category);
  if (branchId) query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
  const { data, error } = await query;
  if (error) throw error;
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return data || [];
  return (data || []).filter((row) => {
    const hay = `${row.title} ${row.question} ${row.answer} ${(row.keywords || []).join(' ')}`.toLowerCase();
    return hay.includes(needle);
  });
}

export async function saveKnowledge(row, profileId = null) {
  const client = sb();
  const keywords = Array.isArray(row.keywords) ? row.keywords : splitVariants(row.keywords);
  const variants = Array.isArray(row.variants) ? row.variants : splitVariants(row.variants);
  const synonyms = Array.isArray(row.synonyms) ? row.synonyms : splitVariants(row.synonyms);
  const payload = {
    title: String(row.title || row.question || 'Memoria').slice(0, 180),
    category: row.category || 'general',
    question: String(row.question || '').trim(),
    answer: String(row.answer || '').trim(),
    content: String(row.content || row.answer || '').trim(),
    keywords: keywords.length ? keywords : extractKeywords(`${row.question || ''} ${row.answer || ''}`),
    variants,
    synonyms,
    source_type: row.source_type || 'manual',
    priority: Number(row.priority) || 100,
    active: row.active !== false,
    branch_id: row.branch_id || null,
    updated_by: profileId || null,
  };
  if (!payload.question || !payload.answer) throw new Error('Pregunta y respuesta son obligatorias');

  if (row.id) {
    const { data, error } = await client.from('bot_knowledge').update(payload).eq('id', row.id).select('*').maybeSingle();
    if (error) throw error;
    return data;
  }
  const { data, error } = await client.from('bot_knowledge').insert({
    ...payload,
    created_by: profileId || null,
  }).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function setKnowledgeActive(id, active) {
  const { error } = await sb().from('bot_knowledge').update({ active }).eq('id', id);
  if (error) throw error;
}

export async function deleteKnowledge(id) {
  const { error } = await sb().from('bot_knowledge').delete().eq('id', id);
  if (error) throw error;
}

export async function listUnanswered({ status = 'pending', branchId = null } = {}) {
  const client = sb();
  let q = client
    .from('bot_unanswered_questions')
    .select('*')
    .order('occurrences', { ascending: false })
    .order('last_asked_at', { ascending: false })
    .limit(200);
  if (status && status !== 'all') q = q.eq('status', status);
  if (branchId) q = q.or(`branch_id.is.null,branch_id.eq.${branchId}`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function ignoreUnanswered(id) {
  const { error } = await sb().from('bot_unanswered_questions').update({ status: 'ignored' }).eq('id', id);
  if (error) throw error;
}

export async function trainFromUnanswered({ unanswered, answer, variantsText = '', profileId, branchId }) {
  const question = String(unanswered.original_question || unanswered.normalized_question || '').trim();
  const reply = String(answer || '').trim();
  if (!reply) throw new Error('Escribe la respuesta del bot');
  const variants = [
    question,
    unanswered.normalized_question,
    ...splitVariants(variantsText),
  ].filter((v, i, arr) => v && arr.indexOf(v) === i);

  const knowledge = await saveKnowledge({
    title: question.slice(0, 120) || 'Pregunta entrenada',
    category: 'faq',
    question,
    answer: reply,
    content: reply,
    variants,
    keywords: extractKeywords(`${question} ${reply}`),
    source_type: 'unanswered_training',
    priority: 60,
    active: true,
    branch_id: branchId || unanswered.branch_id || null,
  }, profileId);

  const { error } = await sb().from('bot_unanswered_questions').update({
    status: 'answered',
    answer: reply,
    answered_by: profileId || null,
    answered_at: new Date().toISOString(),
    knowledge_id: knowledge.id,
  }).eq('id', unanswered.id);
  if (error) throw error;
  return knowledge;
}

export async function listDocuments(branchId = null) {
  const client = sb();
  let q = client.from('bot_documents').select('*').order('created_at', { ascending: false }).limit(100);
  if (branchId) q = q.or(`branch_id.is.null,branch_id.eq.${branchId}`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function uploadBotDocument({ file, category = 'documento', branchId = null, profileId = null }) {
  if (!file) throw new Error('Selecciona un archivo');
  const name = String(file.name || 'documento').replace(/[^\w.\-áéíóúñÁÉÍÓÚÑ ]+/g, '_');
  const path = `${branchId || 'global'}/${Date.now()}-${name}`;
  const client = sb();
  const { error: upErr } = await client.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (upErr) throw upErr;

  const { data, error } = await client.from('bot_documents').insert({
    branch_id: branchId || null,
    file_name: name,
    mime_type: file.type || '',
    category,
    storage_path: path,
    status: 'pending',
    active: true,
    created_by: profileId || null,
  }).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function processBotDocument(documentId) {
  const res = await fetch('/api/bot-process-document', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ documentId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'No se pudo procesar el documento');
  return json;
}

export async function setDocumentActive(id, active, currentStatus = 'processed') {
  const payload = { active };
  if (!active) payload.status = 'inactive';
  else if (currentStatus === 'inactive') payload.status = 'processed';
  const { error } = await sb().from('bot_documents').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteDocument(id, storagePath) {
  const client = sb();
  if (storagePath) {
    await client.storage.from(BUCKET).remove([storagePath]).catch(() => {});
  }
  await client.from('bot_knowledge_chunks').delete().eq('document_id', id);
  const { error } = await client.from('bot_documents').delete().eq('id', id);
  if (error) throw error;
}

export async function simulateBot({ phone, message, branchId }) {
  const res = await fetch('/api/bot-simulate', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ phone, message, branchId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'No se pudo simular');
  return json;
}

export function subscribeUnanswered(onChange) {
  const client = getSupabase();
  if (!client) return () => {};
  const ch = client
    .channel('bot-unanswered-admin')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bot_unanswered_questions' }, () => onChange?.())
    .subscribe();
  return () => {
    try { client.removeChannel(ch); } catch { /* ignore */ }
  };
}

export const KNOWLEDGE_CATEGORIES = [
  'general', 'faq', 'compra', 'pago', 'delivery', 'sucursal', 'reclamos', 'promocion', 'documento',
];

export const BOT_HANDLERS = [
  'handleGreeting', 'handleGoodbye', 'handleThanks', 'handleHowToBuy', 'handlePayment',
  'handleHours', 'handleBranch', 'handleContact', 'handleDelivery', 'handleProductPrice',
  'handleProductSearch', 'handlePromotion', 'handleOrderStatus', 'handleComplaint',
  'handleHumanSupport', 'handleKnowledgeSearch', 'handleUnknown',
];

export const SETTING_TEMPLATE_KEYS = [
  'order_created', 'pendiente', 'aceptado', 'confirmado', 'preparando',
  'listo', 'en_delivery', 'entregado', 'cancelado', 'complaint', 'human',
];

function branchOr(q, branchId) {
  if (!branchId) return q;
  return q.or(`branch_id.is.null,branch_id.eq.${branchId}`);
}

export async function loadBotDashboard(branchId = null) {
  const client = sb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let convQ = client.from('bot_conversations').select('id', { count: 'exact', head: true }).gte('last_message_at', since);
  let humanQ = client.from('bot_conversations').select('id', { count: 'exact', head: true }).in('mode', ['human', 'human_required']);
  let unQ = client.from('bot_unanswered_questions').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  let kbQ = client.from('bot_knowledge').select('id', { count: 'exact', head: true }).eq('active', true);
  let queueQ = client.from('bot_notification_queue').select('id, status').in('status', ['pending', 'failed', 'processing']).limit(80);
  if (branchId) {
    convQ = convQ.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    humanQ = humanQ.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    unQ = unQ.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    kbQ = kbQ.or(`branch_id.is.null,branch_id.eq.${branchId}`);
    queueQ = queueQ.or(`branch_id.is.null,branch_id.eq.${branchId}`);
  }
  const [conv, human, unanswered, kb, queue, logs] = await Promise.all([
    convQ, humanQ, unQ, kbQ, queueQ,
    client.from('bot_logs').select('id, level, event_type, message, created_at').order('created_at', { ascending: false }).limit(10),
  ]);
  const queueRows = queue.data || [];
  return {
    conversations24h: conv.count || 0,
    humanOpen: human.count || 0,
    unansweredPending: unanswered.count || 0,
    knowledgeActive: kb.count || 0,
    queuePending: queueRows.filter((r) => r.status === 'pending' || r.status === 'processing').length,
    queueFailed: queueRows.filter((r) => r.status === 'failed').length,
    logs: logs.data || [],
  };
}

export async function listConversations({ branchId = null, q = '', mode = '' } = {}) {
  let query = sb()
    .from('bot_conversations')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(150);
  query = branchOr(query, branchId);
  if (mode) query = query.eq('mode', mode);
  const { data, error } = await query;
  if (error) throw error;
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return data || [];
  return (data || []).filter((c) => `${c.phone} ${c.last_message_preview || ''} ${c.current_intent || ''}`.toLowerCase().includes(needle));
}

export async function listMessages(conversationId, limit = 80) {
  const { data, error } = await sb()
    .from('bot_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function markConversationRead(id) {
  const { error } = await sb().from('bot_conversations').update({ unread_count: 0 }).eq('id', id);
  if (error) throw error;
}

export async function setConversationMode(id, mode, assignedUserId = null) {
  const patch = { mode, assigned_user_id: mode === 'bot' ? null : assignedUserId };
  const { error } = await sb().from('bot_conversations').update(patch).eq('id', id);
  if (error) throw error;
}

export async function sendHumanReply({ conversationId, text }) {
  const res = await fetch('/api/bot-human-reply', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ conversationId, text }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'No se pudo enviar');
  return json;
}

export function subscribeInbox(onChange) {
  const client = getSupabase();
  if (!client) return () => {};
  const ch = client
    .channel('bot-inbox-admin')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bot_conversations' }, () => onChange?.('conversations'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bot_messages' }, () => onChange?.('messages'))
    .subscribe();
  return () => {
    try { client.removeChannel(ch); } catch { /* ignore */ }
  };
}

export async function listSynonyms() {
  const { data, error } = await sb().from('bot_synonyms').select('*').order('canonical', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveSynonym(row) {
  const payload = {
    canonical: String(row.canonical || '').trim().toLowerCase(),
    aliases: Array.isArray(row.aliases) ? row.aliases : splitVariants(row.aliases),
    category: row.category || 'general',
    active: row.active !== false,
  };
  if (!payload.canonical) throw new Error('Falta la palabra canónica');
  if (row.id) {
    const { data, error } = await sb().from('bot_synonyms').update(payload).eq('id', row.id).select('*').maybeSingle();
    if (error) throw error;
    return data;
  }
  const { data, error } = await sb().from('bot_synonyms').insert(payload).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteSynonym(id) {
  const { error } = await sb().from('bot_synonyms').delete().eq('id', id);
  if (error) throw error;
}

export async function listIntents() {
  const { data, error } = await sb().from('bot_intents').select('*').order('priority', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveIntent(row) {
  const payload = {
    code: String(row.code || '').trim().toUpperCase().replace(/\s+/g, '_'),
    label: String(row.label || row.code || '').trim(),
    keywords: Array.isArray(row.keywords) ? row.keywords : splitVariants(row.keywords),
    patterns: Array.isArray(row.patterns) ? row.patterns : splitVariants(row.patterns),
    examples: Array.isArray(row.examples) ? row.examples : splitVariants(row.examples),
    priority: Number(row.priority) || 100,
    handler: row.handler || 'handleKnowledgeSearch',
    active: row.active !== false,
  };
  if (!payload.code) throw new Error('Falta el código de intención');
  if (row.id) {
    const { data, error } = await sb().from('bot_intents').update(payload).eq('id', row.id).select('*').maybeSingle();
    if (error) throw error;
    return data;
  }
  const { data, error } = await sb().from('bot_intents').insert(payload).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function setIntentActive(id, active) {
  const { error } = await sb().from('bot_intents').update({ active }).eq('id', id);
  if (error) throw error;
}

export async function listSettings(branchId = null) {
  let q = sb().from('bot_settings').select('*').order('key', { ascending: true });
  if (branchId) q = q.or(`branch_id.is.null,branch_id.eq.${branchId}`);
  else q = q.is('branch_id', null);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function upsertSetting({ key, value, branchId = null, profileId = null }) {
  const client = sb();
  let upd = client.from('bot_settings').update({
    value,
    updated_by: profileId || null,
  }).eq('key', key);
  upd = branchId ? upd.eq('branch_id', branchId) : upd.is('branch_id', null);
  const { data, error } = await upd.select('*');
  if (error) throw error;
  if (data?.length) return data[0];
  const { data: inserted, error: insErr } = await client.from('bot_settings').insert({
    key,
    value,
    branch_id: branchId || null,
    updated_by: profileId || null,
  }).select('*').maybeSingle();
  if (insErr) throw insErr;
  return inserted;
}

export function settingsToMap(rows, branchId = null) {
  const map = {};
  const global = (rows || []).filter((r) => !r.branch_id);
  const local = branchId ? (rows || []).filter((r) => r.branch_id === branchId) : [];
  for (const row of [...global, ...local]) map[row.key] = row.value;
  return map;
}

export async function listEvents({ status = '', type = '', limit = 80 } = {}) {
  let q = sb().from('bot_events').select('*').order('created_at', { ascending: false }).limit(limit);
  if (status) q = q.eq('status', status);
  if (type) q = q.eq('event_type', type);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function listLogs({ level = '', limit = 100 } = {}) {
  let q = sb().from('bot_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (level) q = q.eq('level', level);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function listNotifyQueue({ status = '', branchId = null } = {}) {
  let q = sb().from('bot_notification_queue').select('*').order('created_at', { ascending: false }).limit(80);
  if (status) q = q.eq('status', status);
  if (branchId) q = q.or(`branch_id.is.null,branch_id.eq.${branchId}`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
