import assert from 'node:assert/strict';
import test from 'node:test';
import { extractKeywords, splitVariants } from './keywords.js';
import { chunkText } from './chunkText.js';

test('extractKeywords ignora stopwords y toma palabras útiles', () => {
  const kws = extractKeywords('¿Tienen servicio para cumpleaños en la sucursal de Iquique?');
  assert.ok(kws.includes('cumpleanos') || kws.includes('cumpleaños') || kws.some((k) => k.includes('cumpl')));
  assert.ok(!kws.includes('para'));
  assert.ok(!kws.includes('tienen'));
});

test('splitVariants separa por coma o salto de línea', () => {
  assert.deepEqual(splitVariants('hacen eventos\nrealizan cumpleaños, fiestas'), [
    'hacen eventos',
    'realizan cumpleaños',
    'fiestas',
  ]);
});

test('chunkText parte textos largos', () => {
  const long = Array.from({ length: 40 }, (_, i) => `Párrafo número ${i} con contenido de política.`).join('\n\n');
  const chunks = chunkText(long, 200, 20);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 220));
});
