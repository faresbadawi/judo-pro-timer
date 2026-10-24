// Intervall-Training (HITTA-Stil): Phasen aufbauen, Gesamtzeiten berechnen, Ablauf steuern.
import { Stopwatch, defaultNow } from './clock.js';

export const DEFAULT_INTERVAL = {
  name: '',
  warmup: 0,
  cooldown: 0,
  sets: 1,
  setRest: 60,        // Pause zwischen Sets
  rounds: 5,          // Runden pro Set
  roundRest: 0,       // zusätzliche Pause nach jeder Runde (ausser der letzten im Set), optional
  reps: 1,            // Wiederholungen je Übung innerhalb einer Runde
  exercises: [{ name: 'Randori', work: 180, rest: 30 }],
  countdown: [10, 5, 3, 2, 1]
};

export function mergeIntervalConfig(c = {}) {
  const exercises = (c.exercises && c.exercises.length ? c.exercises : DEFAULT_INTERVAL.exercises)
    .map((e) => ({ name: e.name ?? '', work: Number(e.work) || 0, rest: Number(e.rest) || 0 }));
  return { ...DEFAULT_INTERVAL, ...c, exercises, countdown: c.countdown ? [...c.countdown] : [...DEFAULT_INTERVAL.countdown] };
}

export function validateIntervalConfig(c) {
  const errors = [];
  if (!(c.sets >= 1 && c.sets <= 99)) errors.push('sets');
  if (!(c.rounds >= 1 && c.rounds <= 99)) errors.push('rounds');
  if (!(c.reps >= 1 && c.reps <= 99)) errors.push('reps');
  if (!c.exercises.length) errors.push('exercises');
  if (c.exercises.some((e) => !(e.work >= 1))) errors.push('work');
  if (c.warmup < 0 || c.cooldown < 0 || c.setRest < 0 || c.roundRest < 0) errors.push('negative');
  return errors;
}

// Baut die vollständige Phasenliste. Reihenfolge je Set:
// Runde → Übung → Wiederholung: Arbeit, danach Pause der Übung (nicht nach der allerletzten Arbeit der Sitzung;
// am Ende eines Sets ersetzt die Set-Pause die Übungspause; am Ende einer Runde kommt optional die Rundenpause dazu).
export function buildPhases(input) {
  const c = mergeIntervalConfig(input);
  const phases = [];
  const sets = c.sets; const rounds = c.rounds; const exCount = c.exercises.length;
  if (c.warmup > 0) phases.push({ type: 'warmup', dur: c.warmup, label: '', set: 0, sets, round: 0, rounds, rep: 0, reps: c.reps, exIdx: -1, exCount });
  for (let s = 1; s <= sets; s++) {
    for (let r = 1; r <= rounds; r++) {
      for (let e = 0; e < exCount; e++) {
        const ex = c.exercises[e];
        for (let k = 1; k <= c.reps; k++) {
          const base = { label: ex.name, set: s, sets, round: r, rounds, rep: k, reps: c.reps, exIdx: e, exCount };
          phases.push({ type: 'work', dur: ex.work, ...base });
          const lastUnitOfRound = e === exCount - 1 && k === c.reps;
          const lastRound = r === rounds;
          const lastSet = s === sets;
          if (lastUnitOfRound && lastRound) {
            if (!lastSet && c.setRest > 0) phases.push({ type: 'setrest', dur: c.setRest, ...base });
          } else {
            if (ex.rest > 0) phases.push({ type: 'rest', dur: ex.rest, ...base });
            if (lastUnitOfRound && c.roundRest > 0) phases.push({ type: 'extra', dur: c.roundRest, ...base });
          }
        }
      }
    }
  }
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
  isOpen() { return !!this.phase.open; }
  // Bei offenen Phasen (ohne Zeitlimit) gibt es keine Restzeit; die Anzeige zählt aufwärts.
  phaseRemaining() { return this.isOpen() ? Infinity : Math.max(0, this.phase.dur * 1000 - this.phaseElapsed()); }
  // Zeit bis zum Ende der Sitzung (geplant), berücksichtigt Änderungen der Phasendauern
  totalRemaining() {
    let ms = this.isOpen() ? 0 : this.phaseRemaining();
    for (let k = this.i + 1; k < this.phases.length; k++) ms += this.phases[k].dur * 1000;
    return this.state === 'finished' ? 0 : ms;
  }
  hasOpenAhead() { return this.phases.slice(this.i).some((p) => p.open); }
  // Aktive Trainingszeit (Pausen des Timers zählen nicht)
  activeMs() { return this.state === 'finished' ? this.doneMs : this.doneMs + (this.isOpen() ? this.phaseElapsed() : Math.min(this.phaseElapsed(), this.phase.dur * 1000)); }
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
    const dur = this.phase.open ? this.phaseElapsed() : this.phase.dur * 1000;
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
    while (this.state === 'running' && !this.isOpen() && this.phaseElapsed() >= this.phase.dur * 1000 && guard++ < 10000) {
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
    const rest = this.isOpen() ? 0 : this.phaseRemaining();
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
      this.i -= 1; this.doneMs = Math.max(0, this.doneMs - (this.phase.open ? 0 : this.phase.dur * 1000));
      this.sw.reset(); if (wasRunning) this.sw.start();
    }
    return [{ type: 'phaseStart', phase: this.phase, index: this.i, back: true }];
  }

  restart() {
    this.i = 0; this.sw.reset(); this.doneMs = 0; this.skippedMs = 0; this.startedWall = null; this.endedWall = null; this.state = 'ready';
  }

  // Dauer der laufenden Phase ändern (+/-); alle Gesamtzeiten passen sich automatisch an
  adjustCurrent(deltaSec) {
    const ph = this.phase;
    if (ph.open) return [];
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
    if (this.state !== 'running' || this.isOpen()) return cues;
    let t = 0; let k = this.i;
    let rem = this.phaseRemaining();
    while (k < this.phases.length && t <= horizonMs) {
      const ph = this.phases[k];
      if (ph.open) break; // ab hier entscheidet der Trainer
      const phaseMs = ph.dur * 1000;
      for (const s of this.countdown) {
        if (phaseMs > s * 1000 && rem > s * 1000) cues.push({ in: t + rem - s * 1000, kind: 'countdown', sec: s, phase: ph.type });
      }
      const next = this.phases[k + 1];
      cues.push({ in: t + rem, kind: next ? 'phase' : 'finish', phaseType: next ? next.type : null, label: next ? next.label : '', phaseIndex: k + 1, from: ph.type });
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
      phaseRemainingMs: this.phaseRemaining(), phaseMs: ph.dur * 1000, phaseElapsedMs: this.phaseElapsed(), open: !!ph.open, hasOpenAhead: this.hasOpenAhead(),
      totalRemainingMs: this.totalRemaining(), plannedMs: this.totalMs(),
      activeMs: this.activeMs(), wallMs: this.wallMs(), pausedMs: this.pausedMs(), progress: this.progress()
    };
  }
}
