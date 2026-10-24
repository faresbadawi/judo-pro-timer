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
  temple: (t) => { // japanische Tempelglocke (Rin): unharmonische Teiltöne, langer Ausklang
    [[1, 1, 3.6], [2.76, 0.5, 2.6], [5.4, 0.28, 1.8], [8.9, 0.14, 1.1]].forEach(([r, a, d]) => scheduled.push(partial(t, 520 * r, 0.34 * a, d)));
    return 3.6;
  },
  gong: (t) => { // tiefer Gong
    scheduled.push(noiseBurst(t, 0.25, 0.25, 600));
    [[1, 1, 5], [1.5, 0.6, 4], [2.02, 0.5, 3.2], [2.63, 0.3, 2.4], [3.4, 0.2, 1.6]].forEach(([r, a, d]) => scheduled.push(partial(t, 110 * r, 0.4 * a, d, 'sine', 0.35)));
    return 5;
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

/* ---------- Sprachclips ---------- */

// Stil: 'jp' = japanische Judo-Kommandos, 'app' = Sprache der App, 'off' = keine Sprache
const KEYS = ['start', 'stop', 'rest', 'ready', 'switch', 'finish'];
const decoded = new Map(); // "ordner/name" -> AudioBuffer | null

function voiceDir() {
  const v = settings().voiceStyle;
  if (v === 'off') return null;
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
function voice(t, key) {
  const dir = voiceDir();
  if (!dir) return 0;
  const buf = decoded.get(`${dir}/${key}`) || (key === 'switch' ? decoded.get(`${dir}/start`) : null);
  if (!buf) return 0;
  const g = ctx.createGain(); g.gain.value = 0.95;
  const src = ctx.createBufferSource(); src.buffer = buf;
  src.connect(g).connect(master);
  src.start(t);
  scheduled.push({ src, at: t, end: t + buf.duration });
  return buf.duration;
}

/* ---------- Ereignisse -> Töne ---------- */

// Töne für einen Phasenwechsel. from/to = Phasentypen (warmup, work, rest, extra, setrest, cooldown, finish)
function playTransition(t, from, to) {
  const S = settings();
  const bell = BELLS[S.bell];
  const order = S.endOrder;
  const isEnd = to === 'finish';
  if (to === 'work') {
    // Beginn einer Belastung: kurzer Ton, dann Kommando
    beep(t, 1175, 0.1, 0.3);
    voice(t + 0.14, from === 'work' ? 'switch' : 'start');
    return;
  }
  if (from === 'work' || isEnd || to === 'cooldown') {
    // Ende einer Belastung / Ende der Sitzung: Glocke und Kommando in wählbarer Reihenfolge
    const key = isEnd ? 'finish' : 'stop';
    const bellFirst = order === 'bell-voice' || order === 'bell';
    const useBell = order !== 'voice' && bell && S.bell !== 'none';
    const useVoice = order !== 'bell';
    if (useBell && bellFirst) { bell(t); if (useVoice) voice(t + 0.7, key); } else if (useVoice) {
      const d = voice(t, key);
      if (useBell) bell(t + Math.max(0.6, d));
    } else if (useBell) bell(t);
    return;
  }
  if (to === 'warmup') { beep(t, 660, 0.2, 0.25); return; }
  // Ende einer Pause o. ä.: sanfter Ton
  beep(t, 988, 0.15, 0.25);
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
      if (S.countdown && S.countdownList.includes(c.sec)) beep(t, c.sec === 1 ? 1175 : 880);
    } else if (c.kind === 'phase') {
      playTransition(t, c.from, c.phaseType);
    } else if (c.kind === 'finish') {
      playTransition(t, 'work', 'finish');
    }
  }
}

// Sofort (Bedienung): z. B. Start oder Weiterschalten per Tipp
export function playNow(from, to, delay = 0.02) {
  if (!enabled()) return;
  unlock();
  playTransition(ctx.currentTime + delay, from, to);
}

export function previewBell() {
  unlock();
  if (!ctx) return;
  const b = BELLS[settings().bell];
  if (b) b(ctx.currentTime + 0.05);
}
export async function previewVoice() {
  unlock();
  if (!ctx) return;
  await prepare();
  voice(ctx.currentTime + 0.05, 'start');
}

export function vibrate(pattern) {
  if (settings().vibrate && navigator.vibrate) { try { navigator.vibrate(pattern); } catch { /* ignorieren */ } }
}
export const scheduledCount = () => scheduled.length;
