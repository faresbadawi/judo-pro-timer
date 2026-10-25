import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPhases, totalSeconds, workSeconds, IntervalRunner, mergeIntervalConfig, validateIntervalConfig } from '../js/engine/interval.js';
import { programPhases } from '../js/engine/program.js';
import { fakeClock } from './helpers.mjs';

const ex = (name, work, rest) => ({ name, work, rest });

test('HIIT: einfache Sitzung 4 x (20 s Arbeit, 10 s Pause)', () => {
  const ph = buildPhases({ rounds: 4, exercises: [ex('Burpees', 20, 10)] });
  assert.equal(ph.filter((p) => p.type === 'work').length, 4);
  assert.equal(ph.filter((p) => p.type === 'rest').length, 3); // keine Pause nach der letzten Arbeit
  assert.equal(totalSeconds(ph), 4 * 20 + 3 * 10);
  assert.equal(workSeconds(ph), 80);
});

test('HIIT: Sets, Set-Pause, Aufwärmen, Abwärmen, mehrere Übungen', () => {
  const cfg = { warmup: 60, cooldown: 30, sets: 2, setRest: 45, rounds: 2, exercises: [ex('A', 20, 10), ex('B', 30, 5)] };
  const ph = buildPhases(cfg);
  // Set: R1: A20,r10,B30,r5 | R2: A20,r10,B30 -> Set-Pause 45 ersetzt die letzte Übungspause
  const perSet = 20 + 10 + 30 + 5 + 20 + 10 + 30;
  assert.equal(totalSeconds(ph), 60 + perSet + 45 + perSet + 30);
  assert.equal(ph[0].type, 'start'); assert.equal(ph.at(-1).type, 'cooldown');
  assert.equal(ph.filter((p) => p.type === 'setrest').length, 1);
});

test('HIIT: ältere Timer (Runden, Wiederholungen, Rundenpause) werden zur einfachen Übungsliste', () => {
  const c = mergeIntervalConfig({ rounds: 2, reps: 3, roundRest: 15, exercises: [ex('A', 10, 5)] });
  assert.equal(c.exercises.length, 6); assert.equal(c.rounds, 1); assert.equal(c.reps, 1);
  const ph = buildPhases(c);
  assert.equal(ph.filter((p) => p.type === 'work').length, 6);
  assert.equal(totalSeconds(ph), 6 * 10 + 5 * 5 + 15);
});

test('HIIT: Übungsnamen, Countdown am Anfang und letzte Übung mit Sore-made', () => {
  const ph = buildPhases({ start: 10, cooldown: 20, sets: 2, setRest: 30, exercises: [ex('Liegestütz', 30, 10), ex('Kniebeugen', 30, 10)] });
  assert.deepEqual(ph.map((p) => p.type), ['start', 'work', 'rest', 'work', 'setrest', 'work', 'rest', 'work', 'cooldown']);
  assert.equal(ph[1].label, 'Liegestütz'); assert.equal(ph[2].label, 'Kniebeugen'); assert.equal(ph[4].label, 'Liegestütz');
  assert.deepEqual(ph.filter((p) => p.finalWork).map((p) => ph.indexOf(p)), [7]);
});

test('Validierung', () => {
  assert.deepEqual(validateIntervalConfig(mergeIntervalConfig({ sets: 0 })), ['sets']);
  assert.deepEqual(validateIntervalConfig(mergeIntervalConfig({ exercises: [ex('x', 0, 0)] })), ['work']);
});

function runner(phases, c) { return new IntervalRunner(phases, c.now, c.wall); }

test('Läufer: Phasen laufen exakt durch, Pause hält die Zeit an', () => {
  const c = fakeClock();
  const r = runner(programPhases({ steps: [{ name: 'A', dur: 10, pause: 5 }, { name: 'B', dur: 10, pause: 0 }] }), c);
  r.start();
  c.advance(4000); r.tick();
  assert.equal(Math.round(r.phaseRemaining() / 1000), 6);
  r.pause(); c.advance(60000); r.tick();
  assert.equal(Math.round(r.phaseRemaining() / 1000), 6);   // Pause zählt nicht
  r.resume(); c.advance(6000);
  const ev = r.tick();
  assert.equal(ev[0].type, 'phaseStart'); assert.equal(r.phase.type, 'rest');
});

test('Läufer: verspäteter Tick (Hintergrund) springt korrekt über mehrere Phasen', () => {
  const c = fakeClock();
  const r = runner(programPhases({ steps: [{ name: 'A', dur: 10, pause: 5 }, { name: 'B', dur: 10, pause: 0 }] }), c);
  r.start();
  c.advance(27000);                      // 10 + 5 + 10 = 25 s sind vorbei, 2 s zu spät
  const ev = r.tick();
  assert.equal(ev.at(-1).type, 'finished'); assert.equal(r.state, 'finished');
  const c2 = fakeClock();
  const r2 = runner(programPhases({ steps: [{ name: 'A', dur: 10, pause: 5 }, { name: 'B', dur: 10 }] }), c2);
  r2.start(); c2.advance(12500); r2.tick();
  assert.equal(r2.phase.type, 'rest');
  assert.equal(Math.round(r2.phaseElapsed()), 2500);   // Übertrag bleibt erhalten
});

test('Läufer: drei Zeiten – Phase, Gesamt-Rest, aktive Zeit, Pausen getrennt', () => {
  const c = fakeClock();
  const r = runner(programPhases({ steps: [{ name: 'A', dur: 60, pause: 0 }, { name: 'B', dur: 60 }] }), c);
  r.start(); c.advance(20000); r.tick();
  r.pause(); c.advance(30000);
  r.resume(); c.advance(10000); r.tick();
  assert.equal(Math.round(r.activeMs() / 1000), 30);
  assert.equal(Math.round(r.wallMs() / 1000), 60);
  assert.equal(Math.round(r.pausedMs() / 1000), 30);
  assert.equal(Math.round(r.totalRemaining() / 1000), 90);
});

test('Läufer: Dauer ändern, Pause einfügen, überspringen – Summen passen sich an', () => {
  const c = fakeClock();
  const r = runner(programPhases({ steps: [{ name: 'A', dur: 60, pause: 0 }, { name: 'B', dur: 60 }] }), c);
  r.start(); c.advance(10000); r.tick();
  r.adjustCurrent(+30);
  assert.equal(Math.round(r.totalRemaining() / 1000), 80 + 60);
  r.insertRest(20);
  assert.equal(Math.round(r.totalRemaining() / 1000), 80 + 20 + 60);
  r.skip();
  assert.equal(r.phase.type, 'extra');
  assert.equal(Math.round(r.activeMs() / 1000), 10);    // übersprungene Zeit zählt nicht als aktiv
});

test('Ton-Plan: Countdown, Phasenwechsel und Ende zum richtigen Zeitpunkt', () => {
  const c = fakeClock();
  const r = runner(programPhases({ steps: [{ name: 'A', dur: 20, pause: 6 }, { name: 'B', dur: 20 }] }), c);
  r.start(); c.advance(5000);
  const cues = r.upcomingCues(60000);
  const at = (kind, sec) => cues.find((x) => x.kind === kind && (sec === undefined || x.sec === sec))?.in;
  assert.equal(at('countdown', 10), 5000);       // 20 s Phase, 5 s vergangen -> 10-s-Signal in 5 s
  assert.equal(at('countdown', 1), 14000);
  assert.equal(cues.find((x) => x.kind === 'phase')?.in, 15000);
  assert.equal(cues.at(-1).kind, 'finish');
  assert.equal(cues.at(-1).in, 15000 + 6000 + 20000);
  // Countdown nur, wenn die Phase länger als die Sekundenzahl ist (6-s-Pause: kein 10-s-Signal)
  const restCountdown = cues.filter((x) => x.kind === 'countdown' && x.phase === 'rest').map((x) => x.sec);
  assert.deepEqual(restCountdown, [5, 3, 2, 1]);
});

test('Zurück springt an den Phasenanfang bzw. in die vorherige Phase', () => {
  const c = fakeClock();
  const r = runner(programPhases({ steps: [{ name: 'A', dur: 30, pause: 10 }, { name: 'B', dur: 30 }] }), c);
  r.start(); c.advance(31000); r.tick();             // jetzt in der Pause, 1 s drin
  assert.equal(r.phase.type, 'rest');
  r.previous();
  assert.equal(r.phase.type, 'work'); assert.equal(r.i, 0);
});

test('Countdown am Anfang: Piepton jede Sekunde, Sore-made nur am letzten Randori', () => {
  const c = fakeClock();
  const r = runner(programPhases({ start: 5, blocks: [{ kind: 'randori', name: 'Randori', dur: 20 }, { kind: 'pause', dur: 5 }, { kind: 'randori', name: 'Randori', dur: 20 }], cooldown: 10 }), c);
  r.start();
  const cues = r.upcomingCues(10000);
  assert.deepEqual(cues.filter((x) => x.kind === 'countdown').map((x) => x.sec), [4, 3, 2, 1]);
  assert.ok(cues.filter((x) => x.kind === 'countdown').every((x) => x.every));
  r.skip();                                  // erstes Randori: Ende ohne finalWork
  assert.equal(r.upcomingCues(60000).find((x) => x.kind === 'phase' && x.from === 'work').finalWork, false);
  r.skip(); r.skip();                        // zweites Randori: Ende mit finalWork, danach Cooldown
  const last = r.upcomingCues(60000).find((x) => x.kind === 'phase' && x.from === 'work');
  assert.equal(last.finalWork, true); assert.equal(last.phaseType, 'cooldown');
});
