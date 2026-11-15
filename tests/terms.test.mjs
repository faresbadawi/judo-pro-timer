import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findTerms, clipOf, kindOf, tidyName, suggest } from '../js/judo-terms.js';

test('erkennt Schreibweisen', () => {
  for (const x of ['uchikomi', 'Uchi komi', 'UCHI-KOMI', 'Uchi-Komi links']) assert.equal(findTerms(x)[0]?.name, 'Uchi-komi', x);
  assert.equal(findTerms('Sprints').length, 0);
  assert.equal(findTerms('').length, 0);
});
test('mehrere Begriffe in Reihenfolge, längster gewinnt', () => {
  assert.deepEqual(findTerms('Randori Newaza').map((t) => t.name), ['Randori', 'Ne-waza']);
  assert.deepEqual(findTerms('Kumi-kata').map((t) => t.name), ['Kumi-kata']);
  assert.deepEqual(findTerms('Nage no Kata').map((t) => t.name), ['Kata']);
  assert.equal(findTerms('Katastrophe').length, 0);
});
test('Art, Ansage, Schreibweise, Vorschläge', () => {
  assert.equal(kindOf('randori tachiwaza'), 'randori');
  assert.equal(kindOf('uchikomi'), 'exercise');
  assert.equal(kindOf('Sprints'), null);
  assert.equal(clipOf('uchikomi links'), 'uchikomi');
  assert.equal(clipOf('Belastung'), 'belastung');
  assert.equal(clipOf('Randori'), null);
  assert.equal(tidyName('uchikomi'), 'Uchi-komi');
  assert.equal(tidyName(' Uchikomi links '), 'Uchikomi links');
  assert.ok(suggest('uch').includes('Uchi-komi'));
  assert.equal(suggest('uchikomi').includes('Uchi-komi'), false);
  assert.equal(suggest('').length, 6);
});
