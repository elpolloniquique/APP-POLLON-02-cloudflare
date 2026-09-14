import assert from 'node:assert/strict';
import test from 'node:test';
import { detectIntent, expandWithSynonyms } from './intents.js';
import { normalizeMessage, foldAccents } from './text.js';
import { scoreKnowledge } from './memory.js';
import { eventKeyCreated, eventKeyStatus, renderOrderStatus } from './orderNotify.js';
import { sanitizeLogText, sanitizeLogMeta, webhookSecretOk, isProdRuntime } from './auth.js';
import { rateLimitHit } from './rateLimit.js';
import { processInbound } from './engine.js';

function intent(text, extra = {}) {
  const parsed = normalizeMessage(text);
  const folded = expandWithSynonyms(parsed.folded, extra.synonyms || []);
  return detectIntent({
    folded,
    original: parsed.original,
    tokens: parsed.tokens,
    products: extra.products || [],
  });
}

function mockAdmin(opts = {}) {
  const store = {
    waIds: new Map((opts.existingMessageIds || []).map((id) => [id, { conversation_id: 'c1' }])),
    outboundCount: opts.outboundCount ?? 0,
    settings: opts.settings || [
      { key: 'bot_enabled', value: true, branch_id: null },
      { key: 'rate_limit_per_min', value: 4, branch_id: null },
      { key: 'minimum_confidence', value: 0.8, branch_id: null },
      { key: 'unknown_response', value: 'No tengo una respuesta confirmada.', branch_id: null },
      { key: 'website_url', value: 'https://www.el-pollon.cl/', branch_id: null },
      { key: 'support_phone', value: '+56986925310', branch_id: null },
    ],
    conversation: opts.conversation || null,
    messages: [],
    unanswered: [],
    knowledge: opts.knowledge || [],
    products: opts.products || [{ id: 'p1', name: 'Cuarto pollo', description: 'cuarto', price: 4500, is_available: true, branch_id: 'b1' }],
    branches: opts.branches || [{
      id: 'b1', name: 'Iquique', is_active: true, address: 'Centro',
      phone: '+56911111111', whatsapp: '+56911111111', opening_hours: '11:30 - 23:00',
      delivery_enabled: true, delivery_cost: 2000,
    }],
    logs: [],
  };

  function tableApi(table) {
    const eqs = [];
    let op = 'select';
    let payload = null;
    let wantCount = false;
    let single = false;

    const run = async () => {
      if (table === 'bot_messages' && op === 'select' && wantCount) {
        return { count: store.outboundCount, data: null, error: null };
      }
      if (table === 'bot_messages' && op === 'select') {
        const wa = eqs.find((e) => e[0] === 'whatsapp_message_id');
        if (wa) {
          const hit = store.waIds.get(wa[1]) || null;
          return { data: hit, error: null };
        }
        return { data: store.messages, error: null };
      }
      if (table === 'bot_messages' && op === 'insert') {
        store.messages.push(payload);
        return { data: { id: `m${store.messages.length}` }, error: null };
      }
      if (table === 'bot_settings') return { data: store.settings, error: null };
      if (table === 'bot_synonyms') return { data: [], error: null };
      if (table === 'bot_intents') return { data: [], error: null };
      if (table === 'branches') {
        const idEq = eqs.find((e) => e[0] === 'id');
        const rows = idEq ? store.branches.filter((b) => b.id === idEq[1]) : store.branches;
        return single ? { data: rows[0] || null, error: null } : { data: rows, error: null };
      }
      if (table === 'products') return { data: store.products, error: null };
      if (table === 'profiles') return single ? { data: null, error: null } : { data: [], error: null };
      if (table === 'pedidos') return single ? { data: null, error: null } : { data: [], error: null };
      if (table === 'detalle_pedidos') return { data: [], error: null };
      if (table === 'bot_conversations') {
        if (op === 'insert') {
          const row = { id: 'c-new', mode: 'bot', unread_count: 0, phone: payload?.phone, ...payload };
          store.conversation = row;
          return { data: row, error: null };
        }
        if (op === 'update') {
          store.conversation = { ...(store.conversation || {}), ...payload };
          return { data: store.conversation, error: null };
        }
        return single ? { data: store.conversation, error: null } : { data: store.conversation ? [store.conversation] : [], error: null };
      }
      if (table === 'bot_knowledge') {
        if (op === 'update') return { data: payload, error: null };
        const idEq = eqs.find((e) => e[0] === 'id');
        if (idEq) {
          const row = store.knowledge.find((k) => k.id === idEq[1]) || null;
          return single ? { data: row, error: null } : { data: row ? [row] : [], error: null };
        }
        return { data: store.knowledge.filter((k) => k.active !== false), error: null };
      }
      if (table === 'bot_unanswered_questions') {
        if (op === 'insert') {
          const row = { id: `u${store.unanswered.length + 1}`, occurrences: 1, status: 'pending', ...payload };
          store.unanswered.push(row);
          return { data: row, error: null };
        }
        if (op === 'update') {
          if (store.unanswered[0]) Object.assign(store.unanswered[0], payload);
          return { data: store.unanswered[0] || null, error: null };
        }
        return single ? { data: store.unanswered[0] || null, error: null } : { data: store.unanswered, error: null };
      }
      if (table === 'bot_logs' && op === 'insert') {
        store.logs.push(payload);
        return { data: payload, error: null };
      }
      if (table === 'bot_knowledge_chunks') return { data: [], error: null };
      return { data: single ? null : [], error: null, count: 0 };
    };

    const api = {
      select(_c, opts) {
        if (op === 'insert' || op === 'update') return api;
        if (opts?.count === 'exact') wantCount = true;
        op = 'select';
        return api;
      },
      insert(row) { op = 'insert'; payload = Array.isArray(row) ? row[0] : row; return api; },
      update(row) { op = 'update'; payload = row; return api; },
      upsert(row) { op = 'insert'; payload = row; return api; },
      delete() { op = 'delete'; return api; },
      eq(k, v) { eqs.push([k, v]); return api; },
      in() { return api; },
      is() { return api; },
      neq() { return api; },
      not() { return api; },
      gte() { return api; },
      lte() { return api; },
      or() { return api; },
      ilike() { return api; },
      order() { return api; },
      limit() { return api; },
      maybeSingle() { single = true; return run(); },
      single() { single = true; return run(); },
      then(resolve, reject) { return run().then(resolve, reject); },
    };
    return api;
  }

  return {
    store,
    from: tableApi,
    rpc: async () => ({ data: null, error: { message: 'no rpc in mock' } }),
  };
}

test('FASE 20: hola / precio / delivery / pedido / humano', () => {
  assert.equal(intent('Hola').code, 'GREETING');
  assert.equal(intent('cuanto cuesta el cuarto').code, 'PRODUCT_PRICE');
  assert.equal(intent('cuanto sale delivery').code, 'DELIVERY_PRICE');
  assert.equal(intent('cómo va mi pedido #001548').code, 'ORDER_STATUS');
  assert.equal(intent('quiero hablar con alguien').code, 'HUMAN_SUPPORT');
});

test('FASE 20: webhook duplicado usa el mismo event_key', () => {
  assert.equal(eventKeyCreated('abc'), eventKeyCreated('abc'));
  assert.equal(eventKeyStatus('abc', 'en_delivery'), 'order:abc:status:en_delivery');
});

test('FASE 20: plantilla de estado en_delivery', () => {
  const msg = renderOrderStatus(
    { templates: { en_delivery: '🛵 {nombre}, tu pedido N.º {pedido} ya va en camino.' } },
    'en_delivery',
    { nombre: 'Ana', pedido: '001548' },
  );
  assert.match(msg, /001548/);
  assert.match(msg, /en camino/);
});

test('FASE 20: desconocido → entrenar → similar responde (score memoria)', () => {
  const trained = {
    title: 'Cumpleaños',
    question: 'hacen eventos de cumpleaños',
    answer: 'Sí, coordinamos fiestas. Escríbenos al local.',
    keywords: ['cumpleanos', 'eventos', 'fiestas'],
    variants: ['hacen cumpleaños', 'fiestas infantiles'],
    priority: 60,
  };
  const folded = foldAccents('hacen fiestas infantiles?');
  const tokens = folded.split(/\s+/);
  assert.ok(scoreKnowledge(trained, folded, tokens) >= 0.55);
});

test('FASE 20: engine duplicado / rate limit / modo humano', async () => {
  const dup = mockAdmin({ existingMessageIds: ['wa-dup'] });
  const rDup = await processInbound({ admin: dup, phone: '+56912345678', message: 'hola', messageId: 'wa-dup' });
  assert.equal(rDup.skipped, 'duplicate');

  const rl = mockAdmin({ outboundCount: 10 });
  const rRl = await processInbound({ admin: rl, phone: '+56912345678', message: 'hola' });
  assert.equal(rRl.skipped, 'rate_limit');

  const human = mockAdmin({
    conversation: { id: 'c1', mode: 'human_required', unread_count: 1, phone: '+56912345678' },
  });
  const rH = await processInbound({ admin: human, phone: '+56912345678', message: 'hola' });
  assert.equal(rH.skipped, 'human_mode');
});

test('FASE 20: unknown guarda unanswered en mock', async () => {
  const admin = mockAdmin();
  const r = await processInbound({
    admin,
    phone: '+56912345678',
    message: 'cual es la receta secreta del aliño del abuelo espacial?',
    branchId: 'b1',
  });
  assert.equal(r.intent, 'UNKNOWN');
  assert.ok(admin.store.unanswered.length >= 1);
  assert.match(String(r.reply || ''), /respuesta confirmada|No tengo/i);
});

test('FASE 19: sanitizeLog no filtra secretos', () => {
  const txt = sanitizeLogText('Authorization Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb y EVOLUTION_API_KEY=abc');
  assert.ok(!txt.includes('eyJ'));
  assert.match(txt, /\[redacted\]/);
  const meta = sanitizeLogMeta({ apikey: 'secret123', ok: 'hola' });
  assert.equal(meta.apikey, '[redacted]');
  assert.equal(meta.ok, 'hola');
});

test('FASE 19: rateLimitHit corta después del máximo', () => {
  const key = `t-${Date.now()}`;
  assert.equal(rateLimitHit(key, { max: 2, windowMs: 60_000 }), false);
  assert.equal(rateLimitHit(key, { max: 2, windowMs: 60_000 }), false);
  assert.equal(rateLimitHit(key, { max: 2, windowMs: 60_000 }), true);
});

test('FASE 19: webhookSecretOk deny en prod sin secret', () => {
  const req = { headers: {}, query: {} };
  if (isProdRuntime()) {
    assert.equal(webhookSecretOk(req), false);
  } else {
    assert.equal(typeof webhookSecretOk(req), 'boolean');
  }
});
