import test from 'node:test';
import assert from 'node:assert/strict';
import { programPhases, programTotals, mergeProgram, validateProgram } from '../js/engine/program.js';

const step = (name, dur, pause = 0, open = false) => ({ name, dur, pause, open });

test('Beispiel: 5 min Randori, 1 min Uchi-komi, 30 s Pause', () => {
  const ph = programPhases({ steps: [step('Randori', 300, 0), step('Uchi-komi', 60, 30)] });
  assert.deepEqual(ph.map((p) => [p.type, p.dur, p.label]), [['work', 300, 'Randori'], ['work', 60, 'Uchi-komi']]);
  // Pause nach dem letzten Schritt entfällt
});

test('Pausen zwischen Schritten, 3 min A5 / 3 min A6 / 2 min A5', () => {
  const ph = programPhases({ steps: [step('A5', 180, 20), step('A6', 180, 20), step('A5', 120, 20)] });
  assert.deepEqual(ph.map((p) => p.type + p.dur), ['work180', 'rest20', 'work180', 'rest20', 'work120']);
  assert.equal(ph[1].label, 'A6'); // Pause nennt den nächsten Schritt
  assert.equal(programTotals({ steps: [step('A5', 180, 20), step('A6', 180, 20), step('A5', 120, 20)] }).seconds, 520);
});

test('Wiederholungen und Wiederholungs-Pause', () => {
  const p = { steps: [step('Randori', 240, 30)], repeat: 3, repeatPause: 60 };
  const ph = programPhases(p);
  // work, rest30, extra60, work, rest30, extra60, work
  assert.deepEqual(ph.map((x) => x.type), ['work', 'rest', 'extra', 'work', 'rest', 'extra', 'work']);
  assert.equal(programTotals(p).seconds, 240 * 3 + 30 * 2 + 60 * 2);
  assert.equal(ph[0].round, 1); assert.equal(ph[6].round, 3);
});

test('Offener Schritt ("Open") hat keine Dauer und wird markiert', () => {
  const p = { steps: [step('Open Randori', 0, 30, true), step('Uchi-komi', 60, 0)] };
  const ph = programPhases(p);
  assert.equal(ph[0].open, true); assert.equal(ph[0].dur, 0);
  const t = programTotals(p);
  assert.equal(t.hasOpen, true); assert.equal(t.seconds, 90);
});

test('Aufwärmen und Abwärmen', () => {
  const ph = programPhases({ warmup: 120, cooldown: 60, steps: [step('Randori', 240)] });
  assert.deepEqual(ph.map((x) => x.type), ['warmup', 'work', 'cooldown']);
});

test('Validierung', () => {
  assert.deepEqual(validateProgram(mergeProgram({ steps: [step('x', 0)] })), ['dur']);
  assert.deepEqual(validateProgram(mergeProgram({ steps: [step('x', 0, 0, true)] })), []);
  assert.deepEqual(validateProgram(mergeProgram({ repeat: 0 })), ['repeat']);
});

test('Ruhiger Schritt (Ippon Change): Phase ist markiert', () => {
  const ph = programPhases({ steps: [{ name: 'Ippon Change', dur: 1200, pause: 0, quiet: true }] });
  assert.equal(ph[0].quiet, true); assert.equal(ph[0].dur, 1200);
  assert.equal(programPhases({ steps: [{ name: 'x', dur: 60 }] })[0].quiet, false);
});
