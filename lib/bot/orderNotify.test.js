import assert from 'node:assert/strict';
import test from 'node:test';
import {
  eventKeyCreated,
  eventKeyStatus,
  formatOrderItems,
  renderOrderCreated,
  renderOrderStatus,
  buildOrderVars,
} from './orderNotify.js';

test('event keys de pedido son estables', () => {
  assert.equal(eventKeyCreated('abc'), 'order:abc:created');
  assert.equal(eventKeyStatus('abc', 'en_delivery'), 'order:abc:status:en_delivery');
});

test('formatOrderItems usa qty × nombre y precio CLP', () => {
  const txt = formatOrderItems([
    { name: 'Cuarto pollo', qty: 2, price: 4500 },
    { nombre: 'Bebida', cantidad: 1, precio: 1500, extras: ['grande'] },
  ]);
  assert.match(txt, /2× Cuarto pollo/);
  assert.match(txt, /1× Bebida/);
  assert.match(txt, /grande/);
});

test('order_created incluye código e ítems', () => {
  const vars = buildOrderVars(
    {
      codigo: '001548',
      name: 'Ana',
      items: [{ name: 'Medio pollo', qty: 1, price: 8000 }],
      total: 9500,
      deliveryFee: 1500,
      tipo: 'delivery',
      pago: 'efectivo',
      address: 'Calle 1',
      estado: 'pendiente',
    },
    { name: 'Iquique' },
    { website_url: 'https://www.el-pollon.cl/', support_phone: '+56986925310' },
  );
  const msg = renderOrderCreated({
    templates: {
      order_created: 'Pedido N.º {pedido}\n{detalle}\nTotal: {total}',
    },
  }, vars);
  assert.match(msg, /001548/);
  assert.match(msg, /Medio pollo/);
  assert.match(msg, /al recibir/);
});

test('estados usan plantilla editable', () => {
  const vars = { nombre: 'Luis', pedido: '000012', estado: 'en camino', sucursal: 'Iquique', support_phone: '+569' };
  const msg = renderOrderStatus({
    templates: { en_delivery: '🛵 {nombre}, tu pedido N.º {pedido} ya va en camino.' },
  }, 'en_delivery', vars);
  assert.match(msg, /Luis/);
  assert.match(msg, /000012/);
  assert.match(msg, /en camino/);
});
