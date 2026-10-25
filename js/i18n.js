// Mehrsprachigkeit: Deutsch, Englisch, Arabisch (von rechts nach links).
import de from './lang/de.js';
import en from './lang/en.js';
import ar from './lang/ar.js';

const DICTS = { de, en, ar };
export const LANGS = [['de', 'Deutsch'], ['en', 'English'], ['ar', 'العربية']];
let current = 'de';

// pref: 'auto' | 'de' | 'en' | 'ar'. Bei 'auto' zählt die Sprache des Geräts (andere Sprachen: Englisch).
export function resolveLang(pref) {
  if (DICTS[pref]) return pref;
  // Erste unterstützte Sprache aus der Liste des Geräts; sonst Deutsch
  const list = navigator.languages?.length ? navigator.languages : [navigator.language || 'de'];
  for (const l of list) { const n = String(l).slice(0, 2).toLowerCase(); if (DICTS[n]) return n; }
  return 'de';
}
export function setLang(l) {
  current = DICTS[l] ? l : 'de';
  document.documentElement.lang = current;
  document.documentElement.dir = current === 'ar' ? 'rtl' : 'ltr';
  document.title = t('app.title');
}
export const lang = () => current;
export const isRtl = () => current === 'ar';

export function t(key, vars = {}) {
  let v = DICTS[current][key] ?? DICTS.de[key] ?? key;
  if (typeof v === 'function') v = v(vars);
  return String(v).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
// Fehlermeldungen tragen einen Übersetzungsschlüssel; unbekannte Texte bleiben unverändert.
export const tm = (msg) => (msg && DICTS[current][msg] !== undefined ? t(msg) : msg);
