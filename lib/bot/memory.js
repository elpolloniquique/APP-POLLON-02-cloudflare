/** Cerebro 2: memoria — FASE 8 PostgreSQL (FTS + pg_trgm), fallback JS */

import { foldAccents } from './text.js';

export function scoreKnowledge(row, folded, tokens) {
  const hay = foldAccents([
    row.title,
    row.question,
    row.answer,
    row.content,
    (row.keywords || []).join(' '),
    (row.variants || []).join(' '),
    (row.synonyms || []).join(' '),
  ].join(' '));
  let score = 0;
  if (folded.length >= 4 && hay.includes(folded)) score += 0.45;
  for (const t of tokens) {
    if (t.length < 3) continue;
    if (hay.includes(t)) score += t.length >= 5 ? 0.12 : 0.07;
  }
  for (const kw of row.keywords || []) {
    const f = foldAccents(kw);
    if (f && folded.includes(f)) score += 0.18;
  }
  for (const v of row.variants || []) {
    const f = foldAccents(v);
    if (f && (folded.includes(f) || f.includes(folded))) score += 0.2;
  }
  const qf = foldAccents(row.question || '');
  if (qf && (folded.includes(qf) || qf.includes(folded))) score += 0.25;
  score += Math.min(0.08, (Number(row.priority) || 0) / 2000);
  return Math.min(0.99, score);
}

function mapHit(row, confidence) {
  return {
    id: row.id,
    title: row.title,
    question: row.question,
    answer: row.answer || row.content || '',
    content: row.content || '',
    confidence: Number(Number(confidence).toFixed(2)),
    sourceType: row.source_type || row.sourceType,
    ftsRank: row.fts_rank ?? null,
    sim: row.sim ?? null,
  };
}

async function searchKnowledgeJs(admin, { folded, tokens, branchId, limit = 5 }) {
  let q = admin
    .from('bot_knowledge')
    .select('id, title, category, question, answer, content, keywords, variants, synonyms, priority, source_type, times_used, branch_id')
    .eq('active', true)
    .limit(80);
  if (branchId) q = q.or(`branch_id.is.null,branch_id.eq.${branchId}`);
  else q = q.is('branch_id', null);

  const { data, error } = await q;
  if (error || !data?.length) return [];

  return data
    .map((row) => ({ row, score: scoreKnowledge(row, folded, tokens) }))
    .filter((x) => x.score >= 0.35)
    .sort((a, b) => b.score - a.score || (b.row.priority || 0) - (a.row.priority || 0))
    .slice(0, limit)
    .map((x) => mapHit(x.row, x.score));
}

export async function searchKnowledge(admin, {
  folded = '',
  tokens = [],
  original = '',
  branchId = null,
  limit = 5,
  minScore = 0.15,
} = {}) {
  const query = String(original || folded || tokens.join(' ')).trim();
  if (query.length >= 2) {
    const { data, error } = await admin.rpc('bot_search_knowledge', {
      p_query: query,
      p_branch_id: branchId || null,
      p_limit: limit,
      p_min_score: minScore,
    });
    if (!error && Array.isArray(data) && data.length) {
      return data.map((row) => mapHit(row, row.score));
    }
  }
  return searchKnowledgeJs(admin, { folded, tokens, branchId, limit });
}

export async function searchChunks(admin, { query, branchId = null, limit = 4 } = {}) {
  const q = String(query || '').trim();
  if (q.length < 3) return [];
  const { data, error } = await admin.rpc('bot_search_chunks', {
    p_query: q,
    p_branch_id: branchId || null,
    p_limit: limit,
  });
  if (error || !data?.length) return [];
  return data;
}

export async function bumpKnowledgeUse(admin, knowledgeId) {
  if (!knowledgeId) return;
  const { data } = await admin.from('bot_knowledge').select('times_used, times_matched').eq('id', knowledgeId).maybeSingle();
  await admin.from('bot_knowledge').update({
    times_used: (Number(data?.times_used) || 0) + 1,
    times_matched: (Number(data?.times_matched) || 0) + 1,
    last_used_at: new Date().toISOString(),
  }).eq('id', knowledgeId);
}

export async function saveUnanswered(admin, payload) {
  const normalized = String(payload.normalized_question || '').trim();
  if (!normalized || normalized.length < 3) return null;

  const { data: similar } = await admin.rpc('bot_find_similar_unanswered', {
    p_normalized: normalized,
    p_branch_id: payload.branch_id || null,
    p_min_sim: 0.45,
  });
  const close = Array.isArray(similar) ? similar[0] : null;
  if (close?.id) {
    await admin.from('bot_unanswered_questions').update({
      occurrences: (Number(close.occurrences) || 1) + 1,
      last_asked_at: new Date().toISOString(),
      phone: payload.phone || null,
      conversation_id: payload.conversation_id || null,
    }).eq('id', close.id);
    return close.id;
  }

  const { data: existing } = await admin
    .from('bot_unanswered_questions')
    .select('id, occurrences')
    .eq('status', 'pending')
    .eq('normalized_question', normalized)
    .maybeSingle();

  if (existing?.id) {
    await admin.from('bot_unanswered_questions').update({
      occurrences: (Number(existing.occurrences) || 1) + 1,
      last_asked_at: new Date().toISOString(),
      phone: payload.phone || null,
      conversation_id: payload.conversation_id || null,
    }).eq('id', existing.id);
    return existing.id;
  }

  const { data, error } = await admin.from('bot_unanswered_questions').insert({
    conversation_id: payload.conversation_id || null,
    customer_id: payload.customer_id || null,
    phone: payload.phone || null,
    original_question: payload.original_question || '',
    normalized_question: normalized,
    detected_intent: payload.detected_intent || 'UNKNOWN',
    possible_matches: payload.possible_matches || [],
    similarity_score: payload.similarity_score ?? null,
    occurrences: 1,
    status: 'pending',
    branch_id: payload.branch_id || null,
  }).select('id').maybeSingle();
  if (error) return null;
  return data?.id || null;
}
