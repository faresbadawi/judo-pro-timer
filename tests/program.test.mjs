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

test('"Open" ohne Zeitlimit gibt es nicht mehr: alte offene Schritte bekommen eine feste Dauer', () => {
  const m = mergeProgram({ steps: [step('Randori', 0, 30, true)] });
  assert.equal(m.blocks[0].open, undefined); assert.equal(m.blocks[0].dur, 240);
});

test('Countdown am Anfang und Cooldown am Ende', () => {
  const ph = programPhases({ warmup: 120, cooldown: 60, steps: [step('Randori', 240)] });
  assert.deepEqual(ph.map((x) => x.type), ['start', 'work', 'cooldown']);
});

test('Validierung', () => {
  assert.deepEqual(validateProgram(mergeProgram({ steps: [step('x', 0)] })), ['dur']);
    assert.deepEqual(validateProgram(mergeProgram({ repeat: 0 })), ['repeat']);
});

const blk = (kind, dur, extra = {}) => ({ kind, name: kind === 'randori' ? 'Randori' : '', dur, ...extra });

test('Blöcke: Randori, Pause, Randori, Pause, Randori, Belastung, Pause', () => {
  const p = { start: 10, cooldown: 30, blocks: [blk('randori', 240), blk('pause', 30), blk('randori', 240), blk('pause', 30), blk('randori', 240), blk('exercise', 60, { name: 'Belastung' }), blk('pause', 20)] };
  const ph = programPhases(p);
  // Pause ganz am Ende entfällt, danach kommt der Cooldown
  assert.deepEqual(ph.map((x) => x.type + x.dur), ['start10', 'work240', 'rest30', 'work240', 'rest30', 'work240', 'work60', 'cooldown30']);
  assert.equal(ph[6].label, 'Belastung');
  assert.equal(ph[2].label, 'Randori');
  assert.equal(programTotals(p).seconds, 10 + 240 * 3 + 60 + 60 + 30);
});

test('Alte Programme (Schritte mit Pause danach) werden zu Blöcken', () => {
  const m = mergeProgram({ warmup: 15, steps: [step('Randori', 300, 30), step('Uchi-komi', 60, 0)] });
  assert.deepEqual(m.blocks.map((b) => b.kind + b.dur), ['randori300', 'pause30', 'exercise60']);
  assert.equal(m.start, 15); assert.equal(m.steps, undefined);
});

test('Validierung: nur Pausen ist ungültig', () => {
  assert.deepEqual(validateProgram(mergeProgram({ blocks: [blk('pause', 30)] })), ['blocks']);
});

test('Standarddauern kommen aus den vorhandenen Blöcken', () => {
  const m = mergeProgram({ blocks: [blk('randori', 210), blk('pause', 15)] });
  assert.deepEqual(m.defaults, { randori: 210, exercise: 60, pause: 15 });
  assert.deepEqual(mergeProgram({ blocks: [blk('randori', 210)], defaults: { randori: 180, exercise: 60, pause: 20 } }).defaults, { randori: 180, exercise: 60, pause: 20 });
});

test('Nur das letzte Randori des Programms ist finalWork', () => {
  const ph = programPhases({ repeat: 2, blocks: [blk('randori', 60), blk('pause', 10), blk('randori', 60)] });
  assert.deepEqual(ph.filter((x) => x.finalWork).map((x) => ph.indexOf(x)), [ph.length - 1]);
});
