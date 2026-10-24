// Judo-Programme: eine frei zusammengestellte Folge aus Blöcken.
// Block-Arten: Randori, Übung (frei benennbar, z. B. "Belastung") und Pause. Jeder Block hat seine eigene Zeit.
// Allgemein: Countdown am Anfang, Cooldown am Ende, Wiederholungen des ganzen Ablaufs.
// Ein Block kann "offen" sein (ohne Zeitlimit, die Uhr zählt aufwärts) oder "ruhig" (nur Hajime und Ende, z. B. Ippon Change).
export const newBlockId = () => Math.random().toString(36).slice(2, 9);

export const DEFAULT_PROGRAM = {
  name: '',
  start: 10,          // Countdown am Anfang (Sekunden)
  cooldown: 0,        // Cooldown am Ende (Sekunden)
  blocks: [
    { kind: 'randori', name: 'Randori', dur: 240, open: false, quiet: false },
    { kind: 'pause', name: '', dur: 30, open: false, quiet: false }
  ],
  repeat: 1,          // Wiederholungen des ganzen Ablaufs
  repeatPause: 0,     // zusätzliche Pause zwischen den Wiederholungen
  countdown: [10, 5, 3, 2, 1]
};

// Alte Programme (Schritte mit "Pause danach") in Blöcke umwandeln
export function legacyToBlocks(steps) {
  const out = [];
  for (const s of steps) {
    out.push({ kind: /^randori/i.test(s.name || '') ? 'randori' : 'exercise', name: s.name || '', dur: Number(s.dur) || 0, open: !!s.open, quiet: !!s.quiet });
    if (Number(s.pause) > 0) out.push({ kind: 'pause', name: '', dur: Number(s.pause), open: false, quiet: false });
  }
  return out;
}

export function mergeProgram(p = {}) {
  let blocks = p.blocks;
  if (!blocks && p.steps) blocks = legacyToBlocks(p.steps);
  if (!blocks || !blocks.length) blocks = DEFAULT_PROGRAM.blocks;
  blocks = blocks.map((b) => ({
    id: b.id || newBlockId(),
    kind: ['randori', 'exercise', 'pause'].includes(b.kind) ? b.kind : 'exercise',
    name: b.name ?? '',
    dur: Math.max(0, Number(b.dur) || 0),
    open: b.kind === 'pause' ? false : !!b.open,
    quiet: b.kind === 'pause' ? false : !!b.quiet
  }));
  const { steps, warmup, ...rest } = p; // Altfelder entfernen
  return {
    ...DEFAULT_PROGRAM, ...rest, blocks,
    start: p.start ?? warmup ?? 0,
    cooldown: p.cooldown ?? 0,
    countdown: p.countdown ? [...p.countdown] : [...DEFAULT_PROGRAM.countdown]
  };
}

export function validateProgram(p) {
  const errors = [];
  if (!p.blocks.some((b) => b.kind !== 'pause')) errors.push('blocks');
  if (p.blocks.some((b) => !b.open && !(b.dur >= 1))) errors.push('dur');
  if (!(p.repeat >= 1 && p.repeat <= 99)) errors.push('repeat');
  return errors;
}

// Phasenliste für den Ablauf. Eine Pause ganz am Ende entfällt (danach kommt direkt der Cooldown).
export function programPhases(input) {
  const p = mergeProgram(input);
  const phases = [];
  const n = p.blocks.filter((b) => b.kind !== 'pause').length;
  const nextWork = (i) => {
    for (let k = i + 1; k < p.blocks.length; k++) if (p.blocks[k].kind !== 'pause') return p.blocks[k];
    return p.blocks.find((b) => b.kind !== 'pause');
  };
  if (p.start > 0) phases.push({ type: 'warmup', dur: p.start, label: '', step: -1, steps: n, round: 0, rounds: p.repeat });
  for (let r = 1; r <= p.repeat; r++) {
    let workIdx = -1;
    p.blocks.forEach((b, i) => {
      if (b.kind === 'pause') {
        phases.push({ type: 'rest', dur: b.dur, label: nextWork(i)?.name || '', step: Math.max(0, workIdx), steps: n, round: r, rounds: p.repeat });
      } else {
        workIdx += 1;
        phases.push({ type: 'work', dur: b.open ? 0 : b.dur, open: b.open, quiet: b.quiet, label: b.name, kind: b.kind, step: workIdx, steps: n, round: r, rounds: p.repeat });
      }
    });
    if (r < p.repeat && p.repeatPause > 0) phases.push({ type: 'extra', dur: p.repeatPause, label: p.blocks.find((b) => b.kind !== 'pause')?.name || '', step: n - 1, steps: n, round: r, rounds: p.repeat });
  }
  if (phases.length && phases.at(-1).type === 'rest') phases.pop();
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
