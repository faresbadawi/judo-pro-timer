import test from 'node:test';
import assert from 'node:assert/strict';
import { Stopwatch, formatClock, formatElapsed } from '../js/engine/clock.js';
import { fakeClock } from './helpers.mjs';

test('Stoppuhr zählt nur im laufenden Zustand', () => {
  const c = fakeClock(); const sw = new Stopwatch(c.now);
  c.advance(500); assert.equal(sw.elapsed(), 0);
  sw.start(); c.advance(1500); assert.equal(sw.elapsed(), 1500);
  sw.pause(); c.advance(9000); assert.equal(sw.elapsed(), 1500);
  sw.start(); c.advance(500); assert.equal(sw.elapsed(), 2000);
});

test('set/add korrigieren die Zeit, auch während des Laufs', () => {
  const c = fakeClock(); const sw = new Stopwatch(c.now);
  sw.start(); c.advance(1000); sw.set(250); c.advance(100);
  assert.equal(sw.elapsed(), 350);
  sw.add(-1000); assert.equal(sw.elapsed(), 0);
});

test('Zeitformate', () => {
  assert.equal(formatClock(240000), '04:00');
  assert.equal(formatClock(239001), '04:00'); // aufgerundet wie bei Sportuhren
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(3725000), '1:02:05');
  assert.equal(formatElapsed(59999), '00:59');
  assert.equal(formatElapsed(61000), '01:01');
});
