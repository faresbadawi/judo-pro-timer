// Laufende Sitzung: verbindet Läufer (Zeitlogik), Ton und Bildschirm. Bleibt beim Seitenwechsel erhalten.
import { IntervalRunner, buildPhases } from './engine/interval.js';
import { programPhases } from './engine/program.js';
import * as audio from './audio.js';
import * as store from './store.js';

const SCHEDULE_HORIZON = 90000;  // so weit voraus werden Töne eingeplant (ms)
const RESCHEDULE_EVERY = 20000;

export const session = {
  runner: null,
  item: null,          // Kopie des gestarteten Programms (wird nicht durch spätere Änderungen verändert)
  completed: false,
  listeners: new Set()
};
let timer = null;
let wakeLock = null;
let lastSchedule = 0;

const emit = (type, data) => session.listeners.forEach((fn) => fn(type, data));
export const onSession = (fn) => { session.listeners.add(fn); return () => session.listeners.delete(fn); };
export const hasSession = () => !!session.runner;
export const isLive = () => !!session.runner && session.runner.state !== 'finished';

export function phasesFor(item) {
  return item.kind === 'hiit' ? buildPhases(item) : programPhases(item);
}

async function requestWakeLock() {
  if (!store.settings().keepAwake) return;
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch { wakeLock = null; }
}
function releaseWakeLock() {
  try { wakeLock?.release(); } catch { /* ignorieren */ }
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (!session.runner || session.runner.state === 'finished') return;
  if (!document.hidden) { requestWakeLock(); tick(); if (session.runner.state === 'running') reschedule(); }
});
window.addEventListener('beforeunload', (e) => {
  if (session.runner && session.runner.state === 'running') { e.preventDefault(); e.returnValue = ''; }
});

export function reschedule() {
  audio.cancelScheduled();
  lastSchedule = performance.now();
  if (session.runner && session.runner.state === 'running') audio.schedule(session.runner.upcomingCues(SCHEDULE_HORIZON));
}

export async function start(item) {
  stopSession(false);
  const phases = phasesFor(item);
  if (!phases.length) return false;
  audio.unlock();
  await audio.prepare();
  session.item = structuredClone(item);
  session.completed = false;
  session.runner = new IntervalRunner(phases, () => performance.now(), () => Date.now(), store.settings().countdownList);
  session.runner.start();
  audio.playNow('none', session.runner.phase.type);
  reschedule();
  timer = setInterval(tick, 100);
  requestWakeLock();
  emit('start');
  return true;
}

export function tick() {
  const r = session.runner;
  if (!r) return;
  const events = r.tick();
  for (const e of events) {
    if (e.type === 'phaseStart') { audio.vibrate(e.phase.type === 'work' ? [120, 60, 120] : 220); emit('phase', e); }
    if (e.type === 'finished') finish();
  }
  if (r.state === 'running' && performance.now() - lastSchedule > RESCHEDULE_EVERY) reschedule();
  emit('tick');
}

function finish() {
  const r = session.runner;
  session.completed = true;
  clearInterval(timer); timer = null;
  releaseWakeLock();
  audio.vibrate([200, 100, 200, 100, 400]);
  record(true);
  emit('finished');
}

function record(completed) {
  const r = session.runner;
  if (!r || r.activeMs() < 5000) return;
  store.addHistory({
    name: store.itemName(session.item), kind: session.item.kind,
    plannedSec: Math.round(r.totalMs() / 1000), activeSec: Math.round(r.activeMs() / 1000),
    pausedSec: Math.round(r.pausedMs() / 1000), wallSec: Math.round(r.wallMs() / 1000), completed
  });
}

export function pause() {
  const r = session.runner;
  if (!r || r.state !== 'running') return;
  r.pause(); audio.cancelScheduled(); releaseWakeLock(); emit('tick');
}
export function resume() {
  const r = session.runner;
  if (!r || r.state !== 'paused') return;
  audio.unlock(); r.resume(); reschedule(); requestWakeLock(); emit('tick');
}
export const toggle = () => (session.runner?.state === 'running' ? pause() : resume());

function afterJump(prevType, events) {
  const e = events.find((x) => x.type === 'phaseStart');
  const fin = events.find((x) => x.type === 'finished');
  if (fin) { audio.playNow(prevType, 'finish'); finish(); return; }
  if (e) { audio.cancelScheduled(); audio.playNow(prevType, e.phase.type); }
  reschedule(); emit('phase', e); emit('tick');
}
export function skip() {
  const r = session.runner; if (!r) return;
  const from = r.phase.type;
  afterJump(from, r.skip());
}
export function previous() {
  const r = session.runner; if (!r) return;
  afterJump('none', r.previous());
}
export function adjust(deltaSec) { const r = session.runner; if (!r) return; r.adjustCurrent(deltaSec); reschedule(); emit('tick'); }
export function addRest(sec) { const r = session.runner; if (!r) return; r.insertRest(sec); reschedule(); emit('tick'); }
export function restart() {
  const r = session.runner; if (!r) return;
  audio.cancelScheduled(); r.restart(); session.completed = false;
  r.start(); audio.playNow('none', r.phase.type); reschedule();
  if (!timer) timer = setInterval(tick, 100);
  requestWakeLock(); emit('start');
}

export function stopSession(saveHistory = true) {
  if (session.runner && saveHistory && !session.completed) record(false);
  audio.cancelScheduled();
  clearInterval(timer); timer = null;
  releaseWakeLock();
  session.runner = null; session.item = null; session.completed = false;
  emit('stop');
}
