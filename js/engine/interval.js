// Intervall-Training (HITTA-Stil): Phasen aufbauen, Gesamtzeiten berechnen, Ablauf steuern.
import { Stopwatch, defaultNow } from './clock.js';

export const DEFAULT_INTERVAL = {
  name: '',
  start: 0,           // Countdown am Anfang (piept jede Sekunde)
  cooldown: 0,
  sets: 1,            // so oft wird die ganze Übungsfolge durchlaufen
  setRest: 60,        // Pause zwischen den Sets
  rounds: 1,          // nur noch 1: die Anzahl der Übungen bestimmt die Länge eines Sets
  reps: 1,
  roundRest: 0,
  exercises: [{ name: '', work: 30, rest: 15 }],
  defaults: { work: 30, rest: 15 },   // Standardzeiten für neue Übungen
  countdown: [10, 5, 3, 2, 1]
};

// Ältere Timer (Runden, Wiederholungen je Übung, Rundenpause, "Aufwärmen") werden in eine einfache Übungsliste umgewandelt.
export function mergeIntervalConfig(c = {}) {
  let exercises = (c.exercises && c.exercises.length ? c.exercises : DEFAULT_INTERVAL.exercises)
    .map((e) => ({ name: e.name ?? '', work: Number(e.work) || 0, rest: Number(e.rest) || 0 }));
  const rounds = c.rounds ?? 1; const reps = c.reps ?? 1; const roundRest = c.roundRest ?? 0;
  if (rounds > 1 || reps > 1) {
    const out = [];
    for (let r = 1; r <= rounds; r++) {
      exercises.forEach((e, i) => {
        for (let k = 1; k <= reps; k++) out.push({ ...e, rest: e.rest + (i === exercises.length - 1 && k === reps ? roundRest : 0) });
      });
    }
    exercises = out;
  }
  const { warmup, ...rest } = c;
  return {
    ...DEFAULT_INTERVAL, ...rest, exercises, rounds: 1, reps: 1, roundRest: 0,
    start: c.start ?? warmup ?? 0,
    defaults: { work: exercises[0].work || 30, rest: exercises[0].rest || 15, ...(c.defaults || {}) },
    countdown: c.countdown ? [...c.countdown] : [...DEFAULT_INTERVAL.countdown]
  };
}

export function validateIntervalConfig(c) {
  const errors = [];
  if (!(c.sets >= 1 && c.sets <= 99)) errors.push('sets');
  if (!c.exercises.length || c.exercises.length > 99) errors.push('exercises');
  if (c.exercises.some((e) => !(e.work >= 1))) errors.push('work');
  if (c.start < 0 || c.cooldown < 0 || c.setRest < 0) errors.push('negative');
  return errors;
}

// Baut die vollständige Phasenliste. Reihenfolge je Set:
// Runde → Übung → Wiederholung: Arbeit, danach Pause der Übung (nicht nach der allerletzten Arbeit der Sitzung;
// am Ende eines Sets ersetzt die Set-Pause die Übungspause; am Ende einer Runde kommt optional die Rundenpause dazu).
export function buildPhases(input) {
  const c = mergeIntervalConfig(input);
  const phases = [];
  const sets = c.sets; const rounds = c.rounds; const exCount = c.exercises.length;
  if (c.start > 0) phases.push({ type: 'start', dur: c.start, label: '', set: 0, sets, round: 0, rounds, rep: 0, reps: c.reps, exIdx: -1, exCount });
  for (let s = 1; s <= sets; s++) {
    for (let r = 1; r <= rounds; r++) {
      for (let e = 0; e < exCount; e++) {
        const ex = c.exercises[e];
        for (let k = 1; k <= c.reps; k++) {
          const base = { label: ex.name, set: s, sets, round: r, rounds, rep: k, reps: c.reps, exIdx: e, exCount };
          phases.push({ type: 'work', dur: ex.work, ...base });
          const nextName = c.exercises[(e + 1) % exCount].name;
          const lastUnitOfRound = e === exCount - 1 && k === c.reps;
          const lastRound = r === rounds;
          const lastSet = s === sets;
          if (lastUnitOfRound && lastRound) {
            if (!lastSet && c.setRest > 0) phases.push({ type: 'setrest', dur: c.setRest, ...base, label: c.exercises[0].name });
          } else {
            if (ex.rest > 0) phases.push({ type: 'rest', dur: ex.rest, ...base, label: nextName });
            
          }
        }
      }
    }
  }
  const lastWork = phases.findLastIndex((x) => x.type === 'work');
  if (lastWork >= 0) phases[lastWork].finalWork = true; // dort kommt "Sore-made"
  if (c.cooldown > 0) phases.push({ type: 'cooldown', dur: c.cooldown, label: '', set: sets, sets, round: rounds, rounds, rep: c.reps, reps: c.reps, exIdx: -1, exCount });
  return phases;
}

export const totalSeconds = (phases) => phases.reduce((n, p) => n + p.dur, 0);
export const workSeconds = (phases) => phases.filter((p) => p.type === 'work').reduce((n, p) => n + p.dur, 0);

export class IntervalRunner {
  constructor(phases, now = defaultNow, wall = () => Date.now(), countdown = [10, 5, 3, 2, 1]) {
    this.phases = phases.map((p) => ({ ...p }));
    this.now = now; this.wall = wall; this.countdown = countdown;
    this.i = 0;
    this.sw = new Stopwatch(now);
    this.state = 'ready';     // ready | running | paused | finished
    this.doneMs = 0;          // Dauer abgeschlossener Phasen
    this.startedWall = null; this.endedWall = null;
    this.skippedMs = 0;       // übersprungene Zeit (zählt nicht als aktive Zeit)
  }

  get phase() { return this.phases[this.i]; }
  totalMs() { return totalSeconds(this.phases) * 1000; }
  phaseElapsed() { return this.sw.elapsed(); }
  phaseRemaining() { return Math.max(0, this.phase.dur * 1000 - this.phaseElapsed()); }
  // Zeit bis zum Ende der Sitzung (geplant), berücksichtigt Änderungen der Phasendauern
  totalRemaining() {
    let ms = this.phaseRemaining();
    for (let k = this.i + 1; k < this.phases.length; k++) ms += this.phases[k].dur * 1000;
    return this.state === 'finished' ? 0 : ms;
  }
  // Aktive Trainingszeit (Pausen des Timers zählen nicht)
  activeMs() { return this.state === 'finished' ? this.doneMs : this.doneMs + Math.min(this.phaseElapsed(), this.phase.dur * 1000); }
  wallMs() { return this.startedWall === null ? 0 : (this.endedWall ?? this.wall()) - this.startedWall; }
  pausedMs() { return Math.max(0, this.wallMs() - this.activeMs() + this.skippedMs); }
  progress() { return Math.min(1, (this.activeMs() + this.skippedMs) / Math.max(1, this.totalMs())); }

  start() {
    if (this.state === 'finished') return [];
    if (this.startedWall === null) this.startedWall = this.wall();
    this.sw.start(); this.state = 'running';
    return [{ type: 'phaseStart', phase: this.phase, index: this.i, resume: this.sw.elapsed() > 0 }];
  }
  pause() { if (this.state !== 'running') return []; this.sw.pause(); this.state = 'paused'; return [{ type: 'pause' }]; }
  resume() { return this.state === 'paused' ? this.start() : []; }

  advance() {
    const dur = this.phase.dur * 1000;
    this.doneMs += dur;
    if (this.i >= this.phases.length - 1) {
      this.state = 'finished'; this.sw.pause(); this.endedWall = this.wall();
      return { type: 'finished' };
    }
    this.i += 1;
    return { type: 'phaseStart', phase: this.phase, index: this.i };
  }

  tick() {
    const out = [];
    if (this.state !== 'running') return out;
    let guard = 0;
    while (this.state === 'running' && this.phaseElapsed() >= this.phase.dur * 1000 && guard++ < 10000) {
      const carry = this.phaseElapsed() - this.phase.dur * 1000; // Übertrag nach verspätetem Tick
      const ev = this.advance();
      out.push(ev);
      if (ev.type === 'finished') break;
      this.sw.set(carry);
    }
    return out;
  }

  // Weiter zur nächsten Phase (übersprungene Restzeit wird nicht als aktive Zeit gezählt)
  skip() {
    if (this.state === 'finished') return [];
    const rest = this.phaseRemaining();
    this.skippedMs += rest;
    this.doneMs += this.phaseElapsed();
    const wasRunning = this.state === 'running';
    if (this.i >= this.phases.length - 1) { this.state = 'finished'; this.sw.pause(); this.endedWall = this.wall(); return [{ type: 'finished' }]; }
    this.i += 1; this.sw.reset(); if (wasRunning) this.sw.start();
    return [{ type: 'phaseStart', phase: this.phase, index: this.i, skipped: true }];
  }

  // Zurück: zum Anfang der laufenden Phase, bei weniger als 2 s zur vorherigen
  previous() {
    if (this.state === 'finished') return [];
    const wasRunning = this.state === 'running';
    if (this.phaseElapsed() > 2000 || this.i === 0) { this.sw.reset(); if (wasRunning) this.sw.start(); }
    else {
      this.i -= 1; this.doneMs = Math.max(0, this.doneMs - this.phase.dur * 1000);
      this.sw.reset(); if (wasRunning) this.sw.start();
    }
    return [{ type: 'phaseStart', phase: this.phase, index: this.i, back: true }];
  }

  // Laufende Phase von vorn beginnen
  restartPhase() {
    if (this.state === 'finished') return [];
    const wasRunning = this.state === 'running';
    this.sw.reset(); if (wasRunning) this.sw.start();
    return [{ type: 'phaseStart', phase: this.phase, index: this.i, back: true }];
  }

  restart() {
    this.i = 0; this.sw.reset(); this.doneMs = 0; this.skippedMs = 0; this.startedWall = null; this.endedWall = null; this.state = 'ready';
  }

  // Dauer der laufenden Phase ändern (+/-); alle Gesamtzeiten passen sich automatisch an
  adjustCurrent(deltaSec) {
    const ph = this.phase;
    ph.dur = Math.max(1, ph.dur + deltaSec);
    return [{ type: 'adjust' }];
  }

  // Zusätzliche Pause direkt nach der laufenden Phase einfügen
  insertRest(sec) {
    const ph = this.phase;
    this.phases.splice(this.i + 1, 0, { ...ph, type: 'extra', dur: sec });
    return [{ type: 'adjust' }];
  }

  removeUpcoming(index) {
    if (index <= this.i || index >= this.phases.length) return [];
    this.phases.splice(index, 1);
    return [{ type: 'adjust' }];
  }

  // Ereignisse für den Ton-Planer (Zeit ab jetzt in ms). Gilt nur, solange der Zustand unverändert bleibt.
  upcomingCues(horizonMs = 60000) {
    const cues = [];
    if (this.state !== 'running') return cues;
    let t = 0; let k = this.i;
    let rem = this.phaseRemaining();
    while (k < this.phases.length && t <= horizonMs) {
      const ph = this.phases[k];
      const phaseMs = ph.dur * 1000;
      // Countdown am Anfang eines Programms: jede Sekunde ein Piepton; sonst nur die gewählten Sekunden
      const secs = ph.type === 'start' ? Array.from({ length: Math.ceil(ph.dur) - 1 }, (_, n) => n + 1) : this.countdown;
      for (const s of secs) {
        if (phaseMs > s * 1000 && rem > s * 1000) cues.push({ in: t + rem - s * 1000, kind: 'countdown', sec: s, every: ph.type === 'start', phase: ph.type });
      }
      const next = this.phases[k + 1];
      cues.push({ in: t + rem, kind: next ? 'phase' : 'finish', phaseType: next ? next.type : null, label: next ? next.label : '', phaseIndex: k + 1, from: ph.type, finalWork: !!ph.finalWork });
      t += rem;
      k += 1;
      rem = this.phases[k] ? this.phases[k].dur * 1000 : 0;
    }
    return cues.filter((c) => c.in <= horizonMs).sort((a, b) => a.in - b.in);
  }

  snapshot() {
    const ph = this.phase;
    return {
      state: this.state, index: this.i, count: this.phases.length, phase: ph,
      phaseRemainingMs: this.phaseRemaining(), phaseMs: ph.dur * 1000, phaseElapsedMs: this.phaseElapsed(),
      totalRemainingMs: this.totalRemaining(), plannedMs: this.totalMs(),
      activeMs: this.activeMs(), wallMs: this.wallMs(), pausedMs: this.pausedMs(), progress: this.progress()
    };
  }
}
