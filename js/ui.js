// Oberflächen-Helfer: Elemente bauen, Symbole, Bedienelemente, Dialoge.
import { t } from './i18n.js';
import { formatElapsed } from './engine/clock.js';

export const $ = (id) => document.getElementById(id);

export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'value' || k === 'checked' || k === 'disabled') e[k] = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(c));
  }
  return e;
}
export function fill(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  return el;
}

const P = {
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="5" width="4.2" height="14" rx="1.4" fill="currentColor" stroke="none"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4" fill="currentColor" stroke="none"/>',
  prev: '<path d="M18 6v12L9.5 12 18 6Z" fill="currentColor"/><path d="M6.5 6v12"/>',
  next: '<path d="M6 6v12l8.5-6L6 6Z" fill="currentColor"/><path d="M17.5 6v12"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5M14 11v5"/>',
  edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3ZM14 8l3 3"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 8.5V6.7A2.2 2.2 0 0 0 13.3 4.5H6.7A2.2 2.2 0 0 0 4.5 6.7v6.6a2.2 2.2 0 0 0 2.2 2.2h1.8"/>',
  grip: '<circle cx="9" cy="6" r="1.3" fill="currentColor"/><circle cx="15" cy="6" r="1.3" fill="currentColor"/><circle cx="9" cy="12" r="1.3" fill="currentColor"/><circle cx="15" cy="12" r="1.3" fill="currentColor"/><circle cx="9" cy="18" r="1.3" fill="currentColor"/><circle cx="15" cy="18" r="1.3" fill="currentColor"/>',
  up: '<path d="M6 14l6-6 6 6"/>',
  down: '<path d="M6 10l6 6 6-6"/>',
  clock: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.6 1.8M9.5 3.5h5"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4M9.5 3h5M12 3v3M18.2 7l1.3-1.3"/>',
  belt: '<path d="M3 9.5l9 2.5 9-2.5v5l-9 2.5-9-2.5v-5Z"/><path d="M10.5 12l-2 8M13.5 12l2 8"/>',
  bolt: '<path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12L13 3Z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
  history: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4 4.5V8h3.5M12 8v4.2l2.8 1.6"/>',
  repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h11M15 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H6M9 21l-3-3 3-3"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  volume: '<path d="M5 9.5h3l4-3.5v12l-4-3.5H5v-5ZM15.5 9a4 4 0 0 1 0 6M18 6.8a7 7 0 0 1 0 10.4"/>',
  hourglass: '<path d="M7 3.5h10M7 20.5h10M8 3.5c0 4 4 5 4 8.5s-4 4.5-4 8.5M16 3.5c0 4-4 5-4 8.5s4 4.5 4 8.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/><path d="M8.5 12H20"/>',
  download: '<path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14"/>',
  upload: '<path d="M12 15V4M7.5 8l4.5-4.5L16.5 8M5 19.5h14"/>'
};
export function icon(name, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'ico ' + cls);
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.9');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.innerHTML = P[name] || '';
  return s;
}
export function iconBtn(name, label, onClick, cls = '') {
  return h('button', { class: 'icon-btn ' + cls, type: 'button', 'aria-label': label, title: label, onclick: onClick }, icon(name));
}

/* ---------- Zeitangaben ---------- */

// Text mit Zahlen, der in jeder Schreibrichtung gleich gelesen wird (z. B. "+10 s")
export const num = (text) => h('bdi', { dir: 'ltr' }, text);

export const fmtDur = (sec) => {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60); const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};
// "4:30", "270" (Sekunden, wenn > 99), "4" (Minuten) -> Sekunden
export function parseDur(text) {
  const x = String(text).trim().replace(',', '.');
  if (!x) return null;
  if (x.includes(':')) {
    const [m, s] = x.split(':');
    const v = (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0);
    return Number.isFinite(v) ? v : null;
  }
  const n = parseFloat(x);
  if (!Number.isFinite(n)) return null;
  return n > 99 ? Math.round(n) : Math.round(n * 60);
}
export const fmtLong = (ms) => {
  const t = formatElapsed(ms);
  return t;
};
export const humanDur = (sec) => {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60;
  const parts = [];
  if (h) parts.push(`${h} ${t('unit.h')}`);
  if (m) parts.push(`${m} ${t('unit.min')}`);
  if (s && !h) parts.push(`${s} ${t('unit.s')}`);
  return parts.join(' ') || `0 ${t('unit.s')}`;
};

/* ---------- Bedienelemente ---------- */

// Zeitfeld mit − und +: Mitte ist ein Eingabefeld (m:ss)
export function durationField({ value, onChange, min = 0, max = 5999, step = 15, label = '' }) {
  const input = h('input', { type: 'text', inputmode: 'numeric', class: 'dur-input', 'aria-label': label, value: fmtDur(value) });
  let v = value;
  const set = (n, notify = true) => { v = Math.min(max, Math.max(min, n)); input.value = fmtDur(v); if (notify) onChange(v); };
  input.addEventListener('change', () => { const p = parseDur(input.value); set(p == null ? v : p); });
  input.addEventListener('focus', () => input.select());
  const repeatBtn = (delta, ic, aria) => {
    let timer = null; let count = 0;
    const stop = () => { clearTimeout(timer); timer = null; };
    const go = () => { set(v + delta * step * (count > 8 ? 4 : 1)); count++; timer = setTimeout(go, count > 3 ? 90 : 350); };
    const b = h('button', { type: 'button', 'aria-label': aria }, icon(ic));
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); count = 0; go(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, stop));
    return b;
  };
  return h('div', { class: 'durfield' }, repeatBtn(-1, 'minus', '−'), input, repeatBtn(1, 'plus', '+'));
}

export function counter({ value, min = 1, max = 99, step = 1, unit = '', onChange, label = '' }) {
  const out = h('output', {});
  let v = value;
  const show = () => { out.textContent = v + unit; };
  const set = (d) => { v = Math.min(max, Math.max(min, v + d * step)); show(); onChange(v); };
  show();
  return h('div', { class: 'counter', role: 'group', 'aria-label': label },
    h('button', { type: 'button', 'aria-label': '−', onclick: () => set(-1) }, icon('minus')), out,
    h('button', { type: 'button', 'aria-label': '+', onclick: () => set(1) }, icon('plus')));
}

export const toggle = (checked, onChange, label = '') =>
  h('input', { type: 'checkbox', class: 'switch', checked, 'aria-label': label, onchange: (e) => onChange(e.target.checked) });

export const row = (label, control, hint) =>
  h('div', { class: 'row' }, h('div', { class: 'row-text' }, h('div', { class: 'row-label' }, label), hint ? h('div', { class: 'row-hint' }, hint) : null), control);

export const seg = (options, value, onPick) =>
  h('div', { class: 'seg' }, options.map(([k, label]) => h('button', { type: 'button', class: k === value ? 'on' : '', onclick: () => onPick(k) }, label)));

/* ---------- Fenster ---------- */

export function openSheet({ title, body, foot, onClose, tall = false }) {
  const dlg = h('dialog', { class: 'sheet' + (tall ? ' tall' : '') });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    dlg.classList.add('closing');
    setTimeout(() => { dlg.close(); dlg.remove(); onClose && onClose(); }, 180);
  };
  dlg.append(
    h('div', { class: 'sheet-head' }, h('h2', {}, title || ''), iconBtn('close', t('common.close'), close, 'flat')),
    h('div', { class: 'sheet-body' }, body),
    foot ? h('div', { class: 'sheet-foot' }, foot) : null);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  document.body.append(dlg);
  dlg.showModal();
  return { close, dlg, body: dlg.querySelector('.sheet-body') };
}

export function confirmDialog(text, { ok = t('common.delete'), danger = true, title = t('common.sure') } = {}) {
  return new Promise((resolve) => {
    let answer = false;
    const sheet = openSheet({
      title,
      body: h('p', { class: 'muted' }, text),
      foot: [
        h('button', { class: 'btn', type: 'button', onclick: () => sheet.close() }, t('common.cancel')),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), type: 'button', onclick: () => { answer = true; sheet.close(); } }, ok)
      ],
      onClose: () => resolve(answer)
    });
  });
}

let toastTimer = null;
export function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
