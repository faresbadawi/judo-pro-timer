// Lokale Datenhaltung: Einstellungen, Programme, HIIT-Vorlagen und Verlauf (localStorage).
import { t } from './i18n.js';
import { mergeProgram } from './engine/program.js';
import { mergeIntervalConfig } from './engine/interval.js';

const KEY = 'judo.v1';

export const DEFAULT_SETTINGS = {
  lang: 'de',              // 'auto' | 'de' | 'en' | 'ar'
  theme: 'dark',           // 'dark' | 'light' | 'auto'
  accent: 'red',           // 'red' | 'gold'
  sound: true,
  volume: 0.85,
  voiceStyle: 'jp',        // 'jp' Judo-Kommandos | 'app' Sprache der App | 'off'
  bell: 'dong',            // 'dong' (Turnier-Gong) | 'temple' | 'gong' | 'buzzer' | 'none'
  judoStart: 'start',      // Startton unter dem Hajime
  judoCount: 'beep',       // Piepton im Countdown (Judo)
  hiitStart: 'start',      // HIIT: Beginn einer Übung
  hiitEnd: 'dong',         // HIIT: Ende einer Übung (Pause beginnt)
  hiitFinish: 'gong',      // HIIT: Ende des Trainings
  hiitCount: 'beep',       // HIIT: Piepton im Countdown
  endOrder: 'voice-bell',  // 'bell-voice' | 'voice-bell' | 'bell' | 'voice'
  countdown: true,
  countdownList: [10, 5, 3, 2, 1],
  applause: true,          // Applaus am Ende des Trainings
  vibrate: true,
  keepAwake: true,
  v2: true,
  v3: true,
  v4: true,
  v5: true,
  v6: true,
  v7: true
};

export const newId = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

const blk = (kind, dur, extra = {}) => ({ kind, name: kind === 'randori' ? 'Randori' : '', dur, ...extra });
const P = (nameKey, blocks, extra = {}) => ({ id: newId(), kind: 'program', nameKey, name: '', blocks, repeat: 1, repeatPause: 0, start: 10, cooldown: 0, ...extra });
const ex = (n, work, rest) => Array.from({ length: n }, () => ({ name: '', work, rest }));
const H = (nameKey, cfg) => ({ id: newId(), kind: 'hiit', nameKey, name: '', start: 10, cooldown: 0, sets: 1, setRest: 60, ...cfg });

const judoTemplates = () => [
  P('tpl.klassik', [blk('randori', 240), blk('pause', 30)], { repeat: 5 }),
  P('tpl.randoriBelastung', [blk('randori', 240), blk('exercise', 60, { name: 'Uchi-komi' }), blk('exercise', 60, { name: 'Belastung' }), blk('pause', 60)], { repeat: 3 }),
  P('tpl.threeTwoThree', [blk('randori', 180), blk('pause', 30), blk('randori', 120), blk('pause', 30), blk('randori', 180)]),
  P('tpl.openChange', [blk('randori', 1800, { name: 'Open Change' }), blk('pause', 60)]),
  P('tpl.bodenStand', [blk('randori', 180, { name: 'Randori Newaza' }), blk('randori', 240, { name: 'Randori Tachiwaza' }), blk('pause', 30)], { repeat: 3 }),
  P('tpl.bodenStandKumikata', [blk('randori', 180, { name: 'Randori Newaza' }), blk('randori', 240, { name: 'Randori Tachiwaza' }), blk('exercise', 60, { name: 'Kumi-kata' }), blk('pause', 30)], { repeat: 4 })
];

const hiitTemplates = () => [
  H('tpl.tabata', { exercises: ex(8, 20, 10) }),
  H('tpl.hiit4020', { cooldown: 60, exercises: ex(6, 40, 20) }),
  H('tpl.sommer', { cooldown: 120, exercises: ex(15, 45, 10) })
];

function defaultTemplates() {
  return [...judoTemplates(), ...hiitTemplates()];
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
  // Version 3: die mitgelieferten Judo-Programme werden durch die neuen Vorlagen ersetzt (eigene Programme bleiben)
  let upgraded = false;
  if (s.settings && !s.settings.v3) {
    state.items = [...judoTemplates(), ...state.items.filter((it) => !(it.kind === 'program' && it.nameKey?.startsWith('tpl.')))];
    state.settings.v3 = true; upgraded = true;
  }
  // Version 4: HIIT-Timer sind jetzt eine einfache Übungsliste; eigene alte Timer werden umgewandelt, die Vorlagen ersetzt
  if (s.settings && !s.settings.v4) {
    state.items = [...state.items.filter((it) => !(it.kind === 'hiit' && it.nameKey?.startsWith('tpl.'))).map((it) => (it.kind === 'hiit'
      ? { ...mergeIntervalConfig(it), id: it.id, kind: 'hiit', nameKey: it.nameKey, name: it.name } : it)), ...hiitTemplates()];
    state.settings.v4 = true; upgraded = true;
  }
  // Version 5: alle mitgelieferten Vorlagen werden durch die neuen ersetzt (eigene Programme bleiben); Sprache standardmäßig Deutsch
  if (s.settings && !s.settings.v5) {
    state.items = [...judoTemplates(), ...hiitTemplates(), ...state.items.filter((it) => !it.nameKey?.startsWith('tpl.'))];
    if (state.settings.lang === 'auto') state.settings.lang = 'de';
    state.settings.v5 = true; upgraded = true;
  }
  // Version 6: erst die Ansage (Mate), dann die Glocke – so geht die Ansage nicht im Glockenklang unter
  if (s.settings && !s.settings.v6) {
    if (state.settings.endOrder === 'bell-voice') state.settings.endOrder = 'voice-bell';
    state.settings.v6 = true; upgraded = true;
  }
  // Version 7: Programme ohne Namen ("Ohne Namen") sind Testeinträge und werden entfernt
  if (s.settings && !s.settings.v7) {
    state.items = state.items.filter((it) => it.nameKey || ((it.name || '').trim() && !/^(ohne namen|untitled|بدون اسم)$/i.test(it.name.trim())));
    state.settings.v7 = true; upgraded = true;
  }
  // Ältere Programme (Schritte mit "Pause danach") in Blöcke umwandeln, HIIT-Übungsnamen entfernen
  let migrated = false;
  state.items = state.items.map((it) => {
    if (it.kind === 'program' && it.steps) { migrated = true; return { ...mergeProgram(it), id: it.id, kind: 'program', nameKey: it.nameKey, name: it.name }; }
    if (it.kind === 'hiit' && it.exercises?.some((e) => 'name' in e)) { migrated = true; return { ...it, exercises: it.exercises.map(({ work, rest }) => ({ work, rest })) }; }
    return it;
  });
  if (!s.items || migrated || upgraded) save();
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
// Reihenfolge der Einträge einer Art ändern (ids in neuer Reihenfolge); andere Arten behalten ihren Platz
export function setOrder(kind, ids) {
  const byId = new Map(state.items.filter((i) => i.kind === kind).map((i) => [i.id, i]));
  const sorted = ids.map((id) => byId.get(id)).filter(Boolean);
  let k = 0;
  state.items = state.items.map((i) => (i.kind === kind ? sorted[k++] : i));
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
export function newHiit() { return { id: newId(), kind: 'hiit', nameKey: null, name: '', start: 10, cooldown: 0, sets: 1, setRest: 60, defaults: { work: 30, rest: 15 }, exercises: ex(4, 30, 15) }; }

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
