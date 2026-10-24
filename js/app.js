// Einstieg: Daten laden, Darstellung anwenden, Seiten wechseln (Hash-Router), Service Worker.
import * as store from './store.js';
import { setLang, resolveLang, t } from './i18n.js';
import { fill, $ } from './ui.js';
import { homeView, programEditor, hiitEditor, runView, historyView, settingsView } from './views.js';
import { hasSession } from './session.js';

const ACCENT_COLOR = { red: '#d71f2f', gold: '#e8b923' };

function applyLook() {
  const S = store.settings();
  const root = document.documentElement;
  if (S.theme === 'auto') root.removeAttribute('data-theme'); else root.dataset.theme = S.theme;
  root.dataset.accent = S.accent;
  setLang(resolveLang(S.lang));
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = S.theme === 'light' ? '#f4f4f5' : '#0b0b0c';
}

let currentCleanup = null;
function route() {
  const [, kind, id] = (location.hash || '#/').split('/');
  const app = $('app');
  currentCleanup?.(); currentCleanup = null;
  let view;
  if (kind === 'program') view = programEditor(id || 'new');
  else if (kind === 'hiit') view = hiitEditor(id || 'new');
  else if (kind === 'run') view = hasSession() ? runView() : homeView();
  else if (kind === 'history') view = historyView();
  else if (kind === 'settings') view = settingsView();
  else view = homeView();
  if (kind === 'run' && !hasSession()) { location.replace('#/'); return; }
  document.body.classList.toggle('on-run', kind === 'run');
  fill(app, view);
  currentCleanup = view.__cleanup || null;
  window.scrollTo(0, 0);
}

async function init() {
  store.init();
  applyLook();
  store.onChange(() => {
    applyLook();
    // Einstellungen/Daten haben sich geändert: aktuelle Seite neu aufbauen (nicht den laufenden Timer)
    if (!(location.hash || '').startsWith('#/run')) {
      const y = window.scrollY; route(); window.scrollTo(0, y);
    }
  });
  window.addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator) {
    try {
      const had = !!navigator.serviceWorker.controller; let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!had || reloaded || hasSession()) return;
        reloaded = true; location.reload();
      });
      await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
    } catch { /* ohne Service Worker (z. B. file://) läuft die App nur online */ }
  }
}
init();
