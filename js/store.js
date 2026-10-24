// Lokale Datenhaltung: Einstellungen, Programme, HIIT-Vorlagen und Verlauf (localStorage).
import { t } from './i18n.js';
import { mergeProgram } from './engine/program.js';

const KEY = 'judo.v1';

export const DEFAULT_SETTINGS = {
  lang: 'auto',            // 'auto' | 'de' | 'en' | 'ar'
  theme: 'dark',           // 'dark' | 'light' | 'auto'
  accent: 'red',           // 'red' | 'gold'
  sound: true,
  volume: 0.85,
  voiceStyle: 'jp',        // 'jp' Judo-Kommandos | 'app' Sprache der App | 'off'
  bell: 'dong',            // 'dong' (Turnier-Gong) | 'temple' | 'gong' | 'buzzer' | 'none'
  endOrder: 'bell-voice',  // 'bell-voice' | 'voice-bell' | 'bell' | 'voice'
  countdown: true,
  countdownList: [10, 5, 3, 2, 1],
  vibrate: true,
  keepAwake: true,
  v2: true
};

export const newId = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

const blk = (kind, dur, extra = {}) => ({ kind, name: kind === 'randori' ? 'Randori' : '', dur, open: false, quiet: false, ...extra });
const P = (nameKey, blocks, extra = {}) => ({ id: newId(), kind: 'program', nameKey, name: '', blocks, repeat: 1, repeatPause: 0, start: 10, cooldown: 0, ...extra });
const H = (nameKey, cfg) => ({ id: newId(), kind: 'hiit', nameKey, name: '', warmup: 0, cooldown: 0, sets: 1, setRest: 60, rounds: 8, roundRest: 0, reps: 1, ...cfg });

function defaultTemplates() {
  return [
    P('tpl.randori', [blk('randori', 240), blk('pause', 30)], { repeat: 5 }),
    P('tpl.randoriUchi', [blk('randori', 300), blk('exercise', 60, { name: 'Uchi-komi' }), blk('pause', 30)], { repeat: 4 }),
    P('tpl.threeThreeTwo', [blk('randori', 180), blk('pause', 20), blk('randori', 180), blk('pause', 20), blk('randori', 120)]),
    P('tpl.open', [blk('randori', 0, { open: true }), blk('pause', 30)], { repeat: 3 }),
    P('tpl.ipponChange', [blk('exercise', 1200, { name: 'Ippon Change', quiet: true })]),
    H('tpl.tabata', { rounds: 8, exercises: [{ work: 20, rest: 10 }] }),
    H('tpl.hiit4020', { warmup: 120, cooldown: 60, rounds: 6, exercises: [{ work: 40, rest: 20 }] }),
    H('tpl.conditioning', { warmup: 120, cooldown: 120, sets: 2, setRest: 60, rounds: 2, exercises: [
      { work: 40, rest: 20 }, { work: 40, rest: 20 }, { work: 40, rest: 20 }, { work: 40, rest: 20 }] })
  ];
}

let state = null;
const listeners = new Set();

export function init() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { s = {}; }
  state = {
    settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) },
    items: s.items || defaultTemplates(),
    history: s.history || [],
    session: null // laufende Sitzung als Notfall-Sicherung (siehe saveSession)
  };
  // Frühe Version: Standard war die Tempelglocke; neuer Standard ist der Turnier-Gong
  if (s.settings && !s.settings.v2) { if (state.settings.bell === 'temple') state.settings.bell = 'dong'; state.settings.v2 = true; save(); }
  // Ältere Programme (Schritte mit "Pause danach") in Blöcke umwandeln, HIIT-Übungsnamen entfernen
  let migrated = false;
  state.items = state.items.map((it) => {
    if (it.kind === 'program' && it.steps) { migrated = true; return { ...mergeProgram(it), id: it.id, kind: 'program', nameKey: it.nameKey, name: it.name }; }
    if (it.kind === 'hiit' && it.exercises?.some((e) => 'name' in e)) { migrated = true; return { ...it, exercises: it.exercises.map(({ work, rest }) => ({ work, rest })) }; }
    return it;
  });
  if (!s.items || migrated) save();
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ settings: state.settings, items: state.items, history: state.history })); } catch { /* Speicher voll */ }
}
const commit = () => { save(); listeners.forEach((fn) => fn()); };
export const onChange = (fn) => listeners.add(fn);

export const settings = () => state.settings;
export function updateSettings(patch) { Object.assign(state.settings, patch); commit(); }

export const items = (kind) => state.items.filter((i) => !kind || i.kind === kind);
export const getItem = (id) => state.items.find((i) => i.id === id) || null;
export const itemName = (i) => (i.nameKey ? t(i.nameKey) : i.name) || t('common.untitled');

export function saveItem(item) {
  const idx = state.items.findIndex((x) => x.id === item.id);
  if (idx >= 0) state.items[idx] = item; else state.items.push(item);
  commit();
}
export function removeItem(id) { state.items = state.items.filter((i) => i.id !== id); commit(); }
export function duplicateItem(id) {
  const src = getItem(id);
  if (!src) return null;
  const copy = structuredClone(src);
  copy.id = newId(); copy.name = `${itemName(src)} (2)`; copy.nameKey = null;
  state.items.push(copy); commit();
  return copy;
}
export function newProgram() { return { id: newId(), kind: 'program', nameKey: null, name: '', blocks: [blk('randori', 240), blk('pause', 30), blk('randori', 240)], repeat: 1, repeatPause: 0, start: 10, cooldown: 0 }; }
export function newHiit() { return { id: newId(), kind: 'hiit', nameKey: null, name: '', warmup: 0, cooldown: 0, sets: 1, setRest: 60, rounds: 8, roundRest: 0, reps: 1, exercises: [{ work: 20, rest: 10 }] }; }

export function addHistory(entry) {
  state.history.push({ t: new Date().toISOString(), ...entry });
  state.history = state.history.slice(-300);
  commit();
}
export const history = () => state.history;
export function clearHistory() { state.history = []; commit(); }

export function exportData() { return JSON.stringify({ app: 'judo-pro-timer', version: 1, items: state.items, settings: state.settings }, null, 1); }
export function importData(text) {
  const d = JSON.parse(text);
  if (d.app !== 'judo-pro-timer' || !Array.isArray(d.items)) throw new Error('data.notBackup');
  // Vorhandene Einträge mit gleicher ID werden ersetzt, neue ergänzt
  for (const it of d.items) {
    const i = state.items.findIndex((x) => x.id === it.id);
    if (i >= 0) state.items[i] = it; else state.items.push(it);
  }
  if (d.settings) state.settings = { ...state.settings, ...d.settings };
  commit();
  return d.items.length;
}
export function resetAll() { state.settings = { ...DEFAULT_SETTINGS }; state.items = defaultTemplates(); state.history = []; commit(); }
