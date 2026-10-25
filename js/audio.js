// Ton: Glocken, Pieptöne und Sprachclips. Alle zeitgesteuerten Töne werden VORAB auf der Audio-Zeitleiste
// eingeplant (Web Audio), nicht per setTimeout abgespielt. So bleiben sie auch dann pünktlich,
// wenn die Seite im Hintergrund gedrosselt wird oder der Bildschirm dunkel ist (soweit das System Audio erlaubt).
import { settings } from './store.js';
import { lang } from './i18n.js';

let ctx = null;
let master = null;
let reverbIn = null;
const scheduled = []; // { src, at, end }
const buffers = new Map();

export function unlock() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
      reverbIn = makeReverb();
    }
    if (ctx.state === 'suspended') ctx.resume();
    master.gain.value = settings().volume;
  } catch { ctx = null; }
}
export const audioReady = () => !!ctx;
export const audioTime = () => (ctx ? ctx.currentTime : 0);

function makeReverb() {
  const len = Math.floor(ctx.sampleRate * 1.8);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  conv.connect(wet).connect(master);
  return conv;
}

const enabled = () => settings().sound && !!ctx;

/* ---------- Klangerzeugung ---------- */

function partial(t, f, vol, dur, type = 'sine', wet = 0.25) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  if (wet > 0 && reverbIn) { const s = ctx.createGain(); s.gain.value = wet; g.connect(s).connect(reverbIn); }
  osc.start(t); osc.stop(t + dur + 0.05);
  return { src: osc, at: t, end: t + dur };
}

function noiseBurst(t, dur, vol, freq = 400) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  return { src, at: t, end: t + dur };
}

// Liefert die Länge in Sekunden und trägt die Knoten zum Abbrechen ein
const BELLS = {
  dong: (t) => { // Turnier-Gong: tiefer, voller "Dong" wie am Mattenrand bei internationalen Turnieren
    scheduled.push(noiseBurst(t, 0.12, 0.35, 900));
    [[1, 1, 3.4], [2.0, 0.7, 2.8], [2.76, 0.5, 2.2], [4.07, 0.35, 1.5], [5.4, 0.2, 1.0]].forEach(([r, a, d]) => scheduled.push(partial(t, 196 * r, 0.5 * a, d, 'sine', 0.2)));
    scheduled.push(partial(t, 98, 0.45, 2.4, 'sine', 0.1)); // tiefer Körper des Klangs
    return 3.4;
  },
  temple: (t) => { // japanische Tempelglocke (Rin): unharmonische Teiltöne, langer Ausklang
    [[1, 1, 3.6], [2.76, 0.5, 2.6], [5.4, 0.28, 1.8], [8.9, 0.14, 1.1]].forEach(([r, a, d]) => scheduled.push(partial(t, 520 * r, 0.34 * a, d)));
    return 3.6;
  },
  gong: (t) => { // tiefer Gong
    scheduled.push(noiseBurst(t, 0.25, 0.25, 600));
    [[1, 1, 5], [1.5, 0.6, 4], [2.02, 0.5, 3.2], [2.63, 0.3, 2.4], [3.4, 0.2, 1.6]].forEach(([r, a, d]) => scheduled.push(partial(t, 110 * r, 0.4 * a, d, 'sine', 0.35)));
    return 5;
  },
  whistle: (t) => { // Schiedsrichterpfeife: heller Triller
    const osc = ctx.createOscillator(); const lfo = ctx.createOscillator(); const depth = ctx.createGain(); const g = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = 2900;
    lfo.frequency.value = 32; depth.gain.value = 190; lfo.connect(depth).connect(osc.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.03);
    g.gain.setValueAtTime(0.5, t + 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    osc.connect(g).connect(master);
    osc.start(t); lfo.start(t); osc.stop(t + 0.9); lfo.stop(t + 0.9);
    scheduled.push({ src: osc, at: t, end: t + 0.9 }, noiseBurst(t, 0.8, 0.05, 6000));
    return 0.9;
  },
  horn: (t) => { // Hallenhupe: tiefer, kräftiger Ton
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; f.connect(master);
    [233, 311].forEach((hz) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.04);
      g.gain.setValueAtTime(0.28, t + 0.95); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
      o.connect(g).connect(f); o.start(t); o.stop(t + 1.2);
      scheduled.push({ src: o, at: t, end: t + 1.2 });
    });
    return 1.2;
  },
  boxing: (t) => { // Boxglocke: drei schnelle helle Schläge
    [0, 0.2, 0.4].forEach((d) => [[1, 1, 1.3], [2.4, 0.6, 0.9], [4.1, 0.4, 0.6], [6.3, 0.25, 0.4]].forEach(([r, a, dur]) => scheduled.push(partial(t + d, 1050 * r, 0.3 * a, dur, 'sine', 0.2))));
    return 1.7;
  },
  buzzer: (t) => { // lauter Summer wie in der Sporthalle
    scheduled.push(partial(t, 220, 0.3, 0.55, 'square', 0));
    scheduled.push(partial(t + 0.7, 220, 0.3, 0.55, 'square', 0));
    return 1.3;
  }
};

function beep(t, f = 880, dur = 0.12, vol = 0.32) {
  scheduled.push(partial(t, f, vol, dur, 'sine', 0.08));
  return dur;
}

// Auswahl an Tönen: einfache Pieptöne und Glocken. v = Lautstärkefaktor (wirkt bei den einfachen Tönen).
const SFX = {
  none: () => 0,
  start: (t, v = 1) => beep(t, 1320, 0.55, 0.36 * v),                                   // langer, heller Startton
  beep: (t, v = 1) => beep(t, 880, 0.14, 0.34 * v),                                      // kurzer Piepton
  beep2: (t, v = 1) => { beep(t, 880, 0.1, 0.32 * v); beep(t + 0.17, 880, 0.1, 0.32 * v); return 0.3; }, // Doppel-Piep
  tick: (t, v = 1) => { scheduled.push(partial(t, 2300, 0.3 * v, 0.05, 'square', 0)); return 0.05; },       // kurzes Klacken
  chime: (t, v = 1) => { [[1, 1, 1.2], [2.76, 0.5, 0.8], [5.4, 0.25, 0.5]].forEach(([r, a, d]) => scheduled.push(partial(t, 1175 * r, 0.3 * a * v, d, 'sine', 0.25))); return 1.2; }, // helles Glöckchen
  // Applaus: viele kurze Klatscher, die zu einem Rauschen anschwellen und ausklingen
  applause: (t, v = 1) => {
    const dur = 3.6;
    scheduled.push(noiseBurst(t, dur, 0.05 * v, 2600)); // Grundrauschen der Menge
    for (let i = 0; i < 70; i++) {
      const at = t + Math.random() * (dur - 0.6);
      const swell = Math.sin(Math.min(1, (at - t) / (dur - 0.6)) * Math.PI) ** 0.7; // leise, laut, leise
      scheduled.push(noiseBurst(at, 0.04 + Math.random() * 0.04, (0.1 + Math.random() * 0.22) * swell * v, 1800 + Math.random() * 2600));
    }
    return dur;
  },
  ...BELLS
};
export const SOUND_IDS = ['start', 'beep', 'beep2', 'tick', 'chime', 'dong', 'temple', 'gong', 'whistle', 'horn', 'boxing', 'buzzer', 'none'];
export const COUNT_IDS = ['beep', 'beep2', 'tick', 'chime'];
let mode = 'judo'; // 'judo' = mit Judo-Ansagen, 'hiit' = nur Töne
export const setMode = (m) => { mode = m === 'hiit' ? 'hiit' : 'judo'; };
const play = (id, t, v = 1) => (SFX[id] || SFX.none)(t, v);

/* ---------- Sprachclips ---------- */

// Stil: 'jp' = japanische Judo-Kommandos, 'app' = Sprache der App, 'off' = keine Sprache
const KEYS = ['start', 'stop', 'rest', 'ready', 'switch', 'finish'];
const decoded = new Map(); // "ordner/name" -> AudioBuffer | null

function voiceDir(force = false) {
  const v = settings().voiceStyle;
  if (v === 'off' || (mode === 'hiit' && !force)) return null;
  return v === 'jp' ? 'jp' : lang();
}
async function fetchClip(dir, key) {
  const id = `${dir}/${key}`;
  if (decoded.has(id)) return decoded.get(id);
  let buf = null;
  try {
    const r = await fetch(`audio/voice/${id}.mp3`);
    if (r.ok) buf = await ctx.decodeAudioData(await r.arrayBuffer());
  } catch { buf = null; }
  decoded.set(id, buf);
  return buf;
}
// Vor dem Start einer Sitzung aufrufen: lädt und dekodiert alle Clips des gewählten Stils
export async function prepare() {
  const dir = voiceDir();
  if (!dir || !ctx) return;
  await Promise.all(KEYS.map((k) => fetchClip(dir, k)));
}
function voice(t, key, force = false) {
  const dir = voiceDir(force);
  if (!dir) return 0;
  const buf = decoded.get(`${dir}/${key}`) || (key === 'switch' ? decoded.get(`${dir}/start`) : null);
  if (!buf) return 0;
  const g = ctx.createGain(); g.gain.value = 1.3; // Ansagen deutlich vor Glocke und Piepton
  const src = ctx.createBufferSource(); src.buffer = buf;
  src.connect(g).connect(master);
  src.start(t);
  scheduled.push({ src, at: t, end: t + buf.duration });
  return buf.duration;
}

/* ---------- Ereignisse -> Töne ---------- */

// Töne für einen Phasenwechsel. from/to = Phasentypen (start, warmup, work, rest, extra, setrest, cooldown, finish)
function playTransition(t, from, to, finalWork = false) {
  const S = settings();
  const isEnd = to === 'finish';
  if (mode === 'hiit') { // Allgemeiner Timer: nur Töne, keine Ansagen
    if (to === 'work') { play(S.hiitStart, t); return; }
    if (from === 'work' || isEnd || to === 'cooldown') {
      play(isEnd || finalWork ? S.hiitFinish : S.hiitEnd, t);
      if (isEnd && S.applause) play('applause', t + 0.9);
      return;
    }
    if (to === 'warmup' || to === 'start') { play('beep', t, 0.8); return; }
    play('beep', t, 0.8); // Ende einer Pause o. ä.
    return;
  }
  const order = S.endOrder;
  // Ende einer Belastung / Ende der Sitzung: Ansage (Mate, am letzten Randori Sore-made) und Glocke in wählbarer Reihenfolge.
  // Liefert die Dauer in Sekunden, damit ein direkt folgendes Hajime danach kommen kann.
  const endSound = (at) => {
    const key = isEnd || finalWork ? 'finish' : 'stop';
    const bellFirst = order === 'bell-voice' || order === 'bell';
    const useBell = order !== 'voice' && S.bell !== 'none';
    const useVoice = order !== 'bell';
    if (useBell && bellFirst) { const bl = play(S.bell, at); return useVoice ? 0.7 + voice(at + 0.7, key) : Math.min(bl, 1.2); }
    if (useVoice) { const d = voice(at, key); if (useBell) { play(S.bell, at + Math.max(0.6, d)); return Math.max(0.6, d) + 1; } return d; }
    if (useBell) return Math.min(play(S.bell, at), 1.2);
    return 0;
  };
  if (to === 'work') {
    // Beginn einer Belastung: Kommando (Hajime) mit leisem Startton darunter.
    // Folgt direkt auf eine andere Belastung (ohne Pause), kommt erst das Mate der vorigen.
    const at = from === 'work' ? t + endSound(t) + 0.3 : t;
    voice(at, 'start');
    play(S.judoStart, at, 0.55);
    return;
  }
  if (from === 'work' || isEnd || to === 'cooldown') {
    const d = endSound(t);
    if (isEnd && S.applause) play('applause', t + d + 0.4);
    return;
  }
  if (to === 'warmup' || to === 'start') { beep(t, 660, 0.2, 0.25); return; }
  beep(t, 988, 0.15, 0.25); // Ende einer Pause o. ä.
}

// Weicher Ausgleich: Ton nur planen, wenn die Seite noch nicht abgelaufen ist
export function cancelScheduled() {
  if (!ctx) return;
  const t = ctx.currentTime + 0.03;
  for (let i = scheduled.length - 1; i >= 0; i--) {
    const s = scheduled[i];
    if (s.at > t) { try { s.src.stop(); } catch { /* ignorieren */ } scheduled.splice(i, 1); }
    else if (s.end < t) scheduled.splice(i, 1);
  }
}

// Plant alle Töne der kommenden Zeit anhand der Ereignisse des Läufers (siehe IntervalRunner.upcomingCues)
export function schedule(cues) {
  if (!enabled()) return;
  cancelScheduled();
  const S = settings();
  const base = ctx.currentTime;
  for (const c of cues) {
    const t = base + c.in / 1000;
    if (c.kind === 'countdown') {
      // Die letzten drei Sekunden sind lauter
      const loud = c.sec <= 3;
      const snd = mode === 'hiit' ? S.hiitCount : S.judoCount;
      if (c.every) play(snd, t, loud ? 1.8 : 0.6);
      else if (S.countdown && S.countdownList.includes(c.sec)) play(snd, t, loud ? 1.6 : 1);
    } else if (c.kind === 'phase') {
      playTransition(t, c.from, c.phaseType, c.finalWork);
    } else if (c.kind === 'finish') {
      playTransition(t, 'work', 'finish');
    }
  }
}

// Sofort (Bedienung): z. B. Start oder Weiterschalten per Tipp
export function playNow(from, to, delay = 0.02, finalWork = false) {
  if (!enabled()) return;
  unlock();
  playTransition(ctx.currentTime + delay, from, to, finalWork);
}

export function previewSound(id, v = 1) {
  unlock();
  if (!ctx) return;
  play(id, ctx.currentTime + 0.05, v);
}
export const previewBell = () => previewSound(settings().bell);
export async function previewVoice(key = 'start') {
  unlock();
  if (!ctx) return;
  await prepare();
  voice(ctx.currentTime + 0.05, key, true);
}

export function vibrate(pattern) {
  if (settings().vibrate && navigator.vibrate) { try { navigator.vibrate(pattern); } catch { /* ignorieren */ } }
}
export const scheduledCount = () => scheduled.length;
