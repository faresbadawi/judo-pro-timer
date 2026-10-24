// Judo-Programme: frei zusammengestellte Abläufe aus Schritten (Name, Dauer, Pause danach).
// Beispiel: 5:00 Randori, 1:00 Uchi-komi, 0:30 Pause – oder 3:00 / 3:00 / 2:00 mit eigenen Namen.
// Ein Schritt kann "offen" sein (ohne Zeitlimit): die Uhr zählt aufwärts, der Trainer beendet ihn per Tipp.
export const DEFAULT_PROGRAM = {
  name: '',
  steps: [{ name: 'Randori', dur: 240, open: false, pause: 30 }],
  repeat: 1,          // Wiederholungen des ganzen Programms
  repeatPause: 0,     // zusätzliche Pause zwischen den Wiederholungen
  warmup: 0,
  cooldown: 0,
  countdown: [10, 5, 3, 2, 1]
};

export function mergeProgram(p = {}) {
  const steps = (p.steps && p.steps.length ? p.steps : DEFAULT_PROGRAM.steps)
    .map((s) => ({ name: s.name ?? '', dur: Math.max(0, Number(s.dur) || 0), open: !!s.open, pause: Math.max(0, Number(s.pause) || 0) }));
  return { ...DEFAULT_PROGRAM, ...p, steps, countdown: p.countdown ? [...p.countdown] : [...DEFAULT_PROGRAM.countdown] };
}

export function validateProgram(p) {
  const errors = [];
  if (!p.steps.length) errors.push('steps');
  if (p.steps.some((s) => !s.open && !(s.dur >= 1))) errors.push('dur');
  if (!(p.repeat >= 1 && p.repeat <= 99)) errors.push('repeat');
  return errors;
}

// Phasenliste für den Ablauf. Die Pause nach dem allerletzten Schritt entfällt;
// zwischen Wiederholungen kommt die Pause des letzten Schritts plus die Wiederholungs-Pause.
export function programPhases(input) {
  const p = mergeProgram(input);
  const phases = [];
  const n = p.steps.length;
  if (p.warmup > 0) phases.push({ type: 'warmup', dur: p.warmup, label: '', step: -1, steps: n, round: 0, rounds: p.repeat });
  for (let r = 1; r <= p.repeat; r++) {
    p.steps.forEach((s, i) => {
      phases.push({ type: 'work', dur: s.open ? 0 : s.dur, open: s.open, label: s.name, step: i, steps: n, round: r, rounds: p.repeat });
      const lastStep = i === n - 1; const lastRepeat = r === p.repeat;
      if (lastStep && lastRepeat) return;
      const next = lastStep ? p.steps[0] : p.steps[i + 1];
      if (s.pause > 0) phases.push({ type: 'rest', dur: s.pause, label: next.name, step: i, steps: n, round: r, rounds: p.repeat });
      if (lastStep && p.repeatPause > 0) phases.push({ type: 'extra', dur: p.repeatPause, label: next.name, step: i, steps: n, round: r, rounds: p.repeat });
    });
  }
  if (p.cooldown > 0) phases.push({ type: 'cooldown', dur: p.cooldown, label: '', step: n - 1, steps: n, round: p.repeat, rounds: p.repeat });
  return phases;
}

export function programTotals(input) {
  const ph = programPhases(input);
  return {
    seconds: ph.reduce((a, x) => a + x.dur, 0),
    workSeconds: ph.filter((x) => x.type === 'work').reduce((a, x) => a + x.dur, 0),
    hasOpen: ph.some((x) => x.open),
    phases: ph.length
  };
}
