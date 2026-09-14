import assert from 'node:assert/strict';
import test from 'node:test';
import { detectIntent, expandWithSynonyms } from './intents.js';
import { normalizeMessage } from './text.js';

function run(text, extra = {}) {
  const parsed = normalizeMessage(text);
  const folded = expandWithSynonyms(parsed.folded, extra.synonyms || []);
  return detectIntent({
    folded,
    original: parsed.original,
    tokens: parsed.tokens,
    products: extra.products || [],
  });
}

test('FASE 7: saludo corto', () => {
  assert.equal(run('Hola').code, 'GREETING');
  assert.equal(run('Buenas tardes').code, 'GREETING');
});

test('FASE 7: no saluda si pregunta en el mismo mensaje', () => {
  assert.notEqual(run('hola cuanto sale el cuarto').code, 'GREETING');
});

test('FASE 7: delivery + precio', () => {
  const r = run('cuanto sale delivery');
  assert.equal(r.code, 'DELIVERY_PRICE');
  assert.ok(r.confidence >= 0.8);
});

test('FASE 7: valor despacho / cuanto cobran por traer', () => {
  assert.equal(run('valor despacho').code, 'DELIVERY_PRICE');
  assert.equal(run('cuanto cobran por traer').code, 'DELIVERY_PRICE');
});

test('FASE 7: precio de producto por keyword', () => {
  assert.equal(run('cuanto cuesta el cuarto').code, 'PRODUCT_PRICE');
});

test('FASE 7: producto por nombre del menú', () => {
  const r = run('tienen chaufa', {
    products: [{ id: '1', name: 'Chaufa de pollo', description: '' }],
  });
  assert.ok(['PRODUCT_SEARCH', 'PRODUCT_PRICE', 'MENU'].includes(r.code));
});

test('FASE 7: humano y queja', () => {
  assert.equal(run('quiero hablar con alguien').code, 'HUMAN_SUPPORT');
  assert.equal(run('mi pedido llego mal').code, 'COMPLAINT');
});

test('FASE 7: cómo comprar y horario', () => {
  assert.equal(run('como hago un pedido').code, 'HOW_TO_BUY');
  assert.equal(run('a que hora cierran').code, 'OPENING_HOURS');
});

test('FASE 7: sinónimos delivery', () => {
  const r = run('cuanto vale el despacho a domicilio', {
    synonyms: [{ canonical: 'delivery', aliases: ['despacho a domicilio', 'domicilio'], active: true }],
  });
  assert.equal(r.code, 'DELIVERY_PRICE');
});
