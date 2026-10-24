// Monotone Stoppuhr. Rechnet mit Zeitdifferenzen einer monotonen Uhr (performance.now),
// nie mit "eine Sekunde abziehen pro Tick" – so gibt es keinen Drift, auch wenn Ticks ausfallen.
export const defaultNow = () => performance.now();

export class Stopwatch {
  constructor(now = defaultNow) {
    this.now = now;
    this.accum = 0;        // bereits gezählte Zeit (ms)
    this.startedAt = null; // Startzeitpunkt des laufenden Abschnitts
  }
  get running() { return this.startedAt !== null; }
  start() { if (!this.running) this.startedAt = this.now(); }
  pause() {
    if (!this.running) return;
    this.accum += this.now() - this.startedAt;
    this.startedAt = null;
  }
  reset() { this.accum = 0; this.startedAt = null; }
  elapsed() { return this.accum + (this.running ? this.now() - this.startedAt : 0); }
  // gezählte Zeit setzen (z. B. Übertrag nach Phasenwechsel oder manuelle Korrektur)
  set(ms) {
    this.accum = Math.max(0, ms);
    if (this.running) this.startedAt = this.now();
  }
  add(ms) { this.set(this.elapsed() + ms); }
}

export function formatClock(ms, { tenths = false } = {}) {
  const t = Math.max(0, Math.ceil(ms / 1000 - 1e-9));
  if (tenths && ms < 10000) return (Math.max(0, ms) / 1000).toFixed(1);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Zählt aufwärts: Sekunden werden abgerundet (0:00 bis 0:59 …)
export function formatElapsed(ms) {
  const t = Math.max(0, Math.floor(ms / 1000 + 1e-9));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
