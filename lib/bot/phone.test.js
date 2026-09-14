import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeChilePhone, toWhatsappDigits, phonesMatch } from './phone.js';

const CHILE_E164 = '+56925586256';
const CHILE_DIGITS = '56925586256';

test('normalizeChilePhone: formatos Chile del prompt', () => {
  const inputs = [
    '925586256',
    '09 2558 6256',
    '56925586256',
    '+56925586256',
    '+56 9 2558 6256',
    '56 9 2558 6256',
    '9 2558 6256',
  ];
  for (const raw of inputs) {
    assert.equal(normalizeChilePhone(raw), CHILE_E164, raw);
    assert.equal(toWhatsappDigits(raw), CHILE_DIGITS, raw);
  }
});

test('normalizeChilePhone: no chileaniza internacional', () => {
  assert.equal(normalizeChilePhone('+51987654321'), '+51987654321');
  assert.equal(normalizeChilePhone('+5491123456789'), '+5491123456789');
});

test('normalizeChilePhone: inválidos', () => {
  assert.equal(normalizeChilePhone(''), null);
  assert.equal(normalizeChilePhone('123'), null);
  assert.equal(normalizeChilePhone('abcdef'), null);
});

test('phonesMatch: 569 y +569 son el mismo número', () => {
  assert.equal(phonesMatch('+56925586256', '56925586256'), true);
  assert.equal(phonesMatch('925586256', '+56 9 2558 6256'), true);
  assert.equal(phonesMatch('+56925586256', '+51987654321'), false);
});
