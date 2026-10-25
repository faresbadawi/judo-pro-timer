// Oberflächen: Start, Editoren für Programme und HIIT, Lauf-Bildschirm, Verlauf, Optionen.
import {
  h, fill, icon, iconBtn, num, durationField, counter, toggle, row, seg, openSheet, confirmDialog, toast, fmtDur, humanDur, $
} from './ui.js';
import * as store from './store.js';
import * as sess from './session.js';
import * as audio from './audio.js';
import { t, tm, LANGS } from './i18n.js';
import { programTotals, mergeProgram, validateProgram, newBlockId } from './engine/program.js';
import { buildPhases, totalSeconds, workSeconds, mergeIntervalConfig, validateIntervalConfig } from './engine/interval.js';
import { formatClock, formatElapsed } from './engine/clock.js';

export const go = (hash) => { location.hash = hash; };

// Namensvorschläge (japanische Begriffe bleiben in jeder Sprache gleich) und schnelle Dauern
const NAME_CHOICES = {
  randori: ['Randori', 'Randori Tachiwaza', 'Randori Newaza', 'Open Change', 'Golden Score'],
  exercise: ['Kumi-kata', 'Uchi-komi', 'Nage-komi', 'Belastung']
};
const QUICK_DURS = { randori: [60, 120, 180, 210, 240, 300], pause: [15, 30, 45, 60, 90, 120], work: [15, 20, 30, 40, 45, 60, 90], rest: [5, 10, 15, 20, 30, 45, 60] };

/* =============== Start =============== */

function summary(item) {
  if (item.kind === 'program') {
    const tot = programTotals(item);
    return `${t('n.blocks', { n: mergeProgram(item).blocks.filter((b) => b.kind !== 'pause').length })}${item.repeat > 1 ? ` × ${item.repeat}` : ''} · ${humanDur(tot.seconds)}`;
  }
  const ph = buildPhases(item);
  return `${t('n.exercises', { n: mergeIntervalConfig(item).exercises.length })}${item.sets > 1 ? ` · ${t('n.sets', { n: item.sets })}` : ''} · ${humanDur(totalSeconds(ph))}`;
}

function itemCard(item, onDrag) {
  const grip = h('button', { type: 'button', class: 'grip', 'aria-label': t('aria.drag'), title: t('aria.drag') }, icon('grip'));
  const card = h('div', { class: 'card item blk' },
    grip,
    h('button', { type: 'button', class: 'item-main', onclick: () => go(`#/${item.kind}/${item.id}`) },
      h('b', {}, store.itemName(item)), h('small', {}, summary(item))),
    iconBtn('edit', t('common.edit'), () => go(`#/${item.kind}/${item.id}`), 'sm'),
    iconBtn('trash', t('common.delete'), async () => { if (await confirmDialog(t('common.deleteConfirm', { name: store.itemName(item) }))) store.removeItem(item.id); }, 'sm danger'),
    h('button', { type: 'button', class: 'btn primary sm-start', 'aria-label': t('common.start'), onclick: () => launch(item) }, icon('play'), h('span', {}, t('common.start'))));
  grip.addEventListener('pointerdown', (e) => onDrag(e, card));
  return card;
}

export async function launch(item) {
  const ok = await sess.start(item);
  if (ok) go('#/run'); else toast(t('err.empty'));
}

// Start mit zwei Tabs unten: Judo-Programme | HIIT-Timer
export function homeView(tab = 'judo') {
  const live = sess.isLive();
  const isHiit = tab === 'hiit';
  const list = store.items(isHiit ? 'hiit' : 'program');
  // Reihenfolge per Ziehen am Griff ändern
  const listBox = h('div', { class: 'blocks' });
  const order = [...list];
  fill(listBox, order.map((it, i) => itemCard(it, (e, card) => startDrag(e, card, order.indexOf(it), listBox, order, () => store.setOrder(isHiit ? 'hiit' : 'program', order.map((x) => x.id))))));
  const tabBtn = (key, ic, label, hash) => h('button', { type: 'button', class: 'tab' + (tab === key ? ' active' : ''), 'aria-current': tab === key ? 'page' : null, onclick: () => go(hash) }, icon(ic), h('span', {}, label));
  return h('div', { class: 'page home has-tabs' },
    h('header', { class: 'brand-bar' },
      h('div', { class: 'brand' }, h('span', { class: 'mark' }, icon('belt')), h('div', {}, h('b', {}, 'JUDO PRO TIMER'), h('small', {}, t('home.tagline')))),
      h('div', { class: 'bar-actions' }, iconBtn('history', t('hist.title'), () => go('#/history')), iconBtn('gear', t('set.title'), () => go('#/settings')))),
    live ? h('button', { type: 'button', class: 'live-banner', onclick: () => go('#/run') }, icon('timer'), h('span', {}, `${t('home.running')}: ${store.itemName(sess.session.item)}`), icon('next', 'flip')) : null,
    h('div', { class: 'sec-head' }, h('h2', {}, t(isHiit ? 'home.hiit' : 'home.programs')), h('p', { class: 'muted small' }, t(isHiit ? 'home.hiitSub' : 'home.programsSub'))),
    listBox,
    h('button', { type: 'button', class: 'btn add', onclick: () => go(isHiit ? '#/hiit/new' : '#/program/new') }, icon('plus'), t(isHiit ? 'home.newHiit' : 'home.newProgram')),
    h('nav', { class: 'tabbar', 'aria-label': t('app.title') },
      tabBtn('judo', 'belt', t('tab.judo'), '#/'),
      tabBtn('hiit', 'bolt', t('tab.hiit'), '#/hiit')));
}

/* =============== Editor: Judo-Programm =============== */

function topBar(title, backHash = '#/') {
  return h('header', { class: 'top-bar' }, h('button', { type: 'button', class: 'icon-btn flat', 'aria-label': t('common.back'), onclick: () => go(backHash) }, icon('back', 'flip')), h('h1', {}, title));
}

function stickyBar(sumEl, actions) {
  return h('div', { class: 'sticky-bar' }, sumEl, h('div', { class: 'btn-row' }, actions));
}

// Karte per Zeiger ziehen: der Griff ist links, beim Ziehen rücken die anderen Blöcke zur Seite
function startDrag(e, card, from, list, arr, after) {
  e.preventDefault();
  const handle = e.currentTarget;
  try { handle.setPointerCapture(e.pointerId); } catch { /* synthetischer Zeiger */ }
  const cards = [...list.children];
  const rects = cards.map((c) => c.getBoundingClientRect());
  const gap = cards.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
  const size = rects[from].height + gap;
  const startY = e.clientY; const startScroll = window.scrollY;
  let to = from; let y = startY;
  card.classList.add('dragging');
  const place = () => {
    const dy = y - startY + (window.scrollY - startScroll);
    card.style.transform = `translateY(${dy}px)`;
    const center = rects[from].top + rects[from].height / 2 + dy;
    to = from;
    cards.forEach((_, i) => { if (i < from && center < rects[i].top + rects[i].height / 2) to = Math.min(to, i); if (i > from && center > rects[i].top + rects[i].height / 2) to = Math.max(to, i); });
    cards.forEach((c, i) => {
      if (i === from) return;
      c.style.transform = (from < to && i > from && i <= to) ? `translateY(${-size}px)` : (to < from && i >= to && i < from) ? `translateY(${size}px)` : '';
    });
  };
  const edge = setInterval(() => {
    const step = y < 90 ? -12 : y > window.innerHeight - 150 ? 12 : 0;
    if (step) { window.scrollBy(0, step); place(); }
  }, 16);
  const move = (ev) => { y = ev.clientY; place(); };
  const end = (ev) => {
    clearInterval(edge);
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', end);
    handle.removeEventListener('pointercancel', end);
    if (ev.type !== 'pointercancel' && to !== from) { const [b] = arr.splice(from, 1); arr.splice(to, 0, b); }
    after();
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}


// Karte mit Standardzeiten: je Zeile ein Zeitfeld und darunter Schnellwerte zum Antippen
function quickCard(rows) {
  const box = h('div', { class: 'card' });
  const draw = () => fill(box, rows.map((r) => {
    const chips = h('div', { class: 'chips' }, r.quick.map((sec) =>
      h('button', { type: 'button', class: 'chip' + (r.get() === sec ? ' on' : ''), 'data-sec': sec, onclick: () => { r.set(sec); draw(); } }, fmtDur(sec))));
    return h('div', { class: 'def-row' },
      row(r.label, durationField({ value: r.get(), min: 1, quick: r.quick, label: r.label,
        onChange: (v) => { r.set(v); chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', +c.dataset.sec === v)); } }), r.hint),
      chips);
  }));
  draw();
  return box;
}

export function programEditor(id) {
  const existing = id !== 'new' ? store.getItem(id) : null;
  const d = existing ? mergeProgram(existing) : mergeProgram(store.newProgram());
  d.id = existing ? existing.id : store.newProgram().id;
  d.nameKey = existing ? existing.nameKey : null;
  d.name = existing ? store.itemName(existing) : '';
  const shown = d.name;
  const list = h('div', { class: 'blocks' });
  const sumEl = h('div', { class: 'sumline' });

  const updateSummary = () => {
    const tot = programTotals(d);
    fill(sumEl, h('div', {}, h('small', {}, t('pe.total')), h('b', {}, humanDur(tot.seconds))),
      h('div', {}, h('small', {}, t('pe.work')), h('b', {}, humanDur(tot.workSeconds))));
  };

  const move = (i, delta) => { const j = i + delta; if (j < 0 || j >= d.blocks.length) return; [d.blocks[i], d.blocks[j]] = [d.blocks[j], d.blocks[i]]; drawBlocks(); list.children[j]?.querySelector('.grip')?.focus(); };

  const drawBlocks = () => {
    fill(list, d.blocks.map((b, i) => {
      const pause = b.kind === 'pause';
      const grip = h('button', { type: 'button', class: 'grip', 'aria-label': t('aria.drag'), title: t('aria.drag'),
        onkeydown: (e) => { if (e.key === 'ArrowUp') { e.preventDefault(); move(i, -1); } else if (e.key === 'ArrowDown') { e.preventDefault(); move(i, 1); } } }, icon('grip'));
      const card = h('div', { class: `card blk blk-${b.kind}${b.more ? '' : ''}` });
      grip.addEventListener('pointerdown', (e) => startDrag(e, card, i, list, d.blocks, () => { drawBlocks(); updateSummary(); }));
      const nameEl = b.kind === 'exercise'
        ? h('input', { type: 'text', class: 'name-input', value: b.name, maxlength: 30, placeholder: t('blk.exercisePh'), 'aria-label': t('blk.exercise'), oninput: (e) => { b.name = e.target.value; } })
        : h('span', { class: 'blk-title' }, t('blk.' + b.kind) === b.name || !b.name ? t('blk.' + b.kind) : b.name);
      const tools = [];
      if (!pause) tools.push(iconBtn('gear', t('blk.options'), () => { b.more = !b.more; drawBlocks(); }, 'sm' + (b.more ? ' on' : '')));
      tools.push(iconBtn('dup', t('common.duplicate'), () => { d.blocks.splice(i + 1, 0, { ...b, id: newBlockId(), more: false }); drawBlocks(); updateSummary(); }, 'sm'));
      tools.push(iconBtn('trash', t('common.remove'), () => { d.blocks.splice(i, 1); drawBlocks(); updateSummary(); }, 'sm danger'));
      const timeEl = durationField({ value: b.dur || 60, min: 1, quick: QUICK_DURS[pause ? 'pause' : 'randori'], label: t('pe.duration'), onChange: (v) => { b.dur = v; updateSummary(); } });
      card.append(h('div', { class: 'blk-head' }, grip, nameEl), h('div', { class: 'blk-row' }, timeEl, h('div', { class: 'tools' }, tools)));
      if (b.more && !pause) card.append(h('div', { class: 'blk-more' },
        b.kind === 'randori' ? h('label', { class: 'field' }, h('span', {}, t('blk.nameOwn')),
          h('input', { type: 'text', value: b.name, maxlength: 30, placeholder: t('blk.' + b.kind), oninput: (e) => { b.name = e.target.value; nameEl.tagName === 'INPUT' ? (nameEl.value = b.name) : (nameEl.textContent = b.name || t('blk.' + b.kind)); } })) : null,
        h('small', { class: 'sub' }, t('blk.nameChoose')),
        h('div', { class: 'chips' }, NAME_CHOICES[b.kind].map((n) =>
          h('button', { type: 'button', class: 'chip' + (b.name === n ? ' on' : ''), onclick: () => { b.name = n; drawBlocks(); } }, n)))));
      return card;
    }));
  };

  const add = (kind) => {
    d.blocks.push({ id: newBlockId(), kind, name: kind === 'randori' ? 'Randori' : '', dur: d.defaults[kind] });
    drawBlocks(); updateSummary();
    list.lastElementChild?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  // Standarddauer für Randori und Pause: gilt für neue Blöcke und setzt alle vorhandenen Blöcke dieser Art um
  const applyDefault = (kind, v) => { d.defaults[kind] = v; d.blocks.forEach((b) => { if (b.kind === kind) b.dur = v; }); drawBlocks(); updateSummary(); };
  const defaultsBox = quickCard([
    { label: t('pe.def.randori'), hint: t('pe.def.randoriHint'), get: () => d.defaults.randori, quick: QUICK_DURS.randori, set: (v) => applyDefault('randori', v) },
    { label: t('pe.def.pause'), hint: t('pe.def.pauseHint'), get: () => d.defaults.pause, quick: QUICK_DURS.pause, set: (v) => applyDefault('pause', v) }]);

  const save = () => {
    const c = mergeProgram(d);
    if (validateProgram(c).length) { toast(t('err.invalid')); return null; }
    const out = { ...c, id: d.id, kind: 'program' };
    const typed = d.name.trim();
    if (!typed && !d.nameKey) { toast(t('err.name')); document.querySelector('label.field input')?.focus(); return null; }
    out.nameKey = d.nameKey && typed === shown ? d.nameKey : null;
    out.name = out.nameKey ? '' : typed;
    store.saveItem(out);
    return out;
  };

  drawBlocks(); updateSummary();
  return h('div', { class: 'page editor' },
    topBar(existing ? t('pe.edit') : t('pe.new')),
    h('label', { class: 'field' }, h('span', {}, t('pe.name')), h('input', { type: 'text', value: d.name, maxlength: 40, placeholder: t('pe.namePh'), oninput: (e) => { d.name = e.target.value; } })),
    h('h3', { class: 'sec-title' }, t('pe.defaults')),
    h('p', { class: 'muted hint' }, t('pe.defaultsHint')),
    defaultsBox,
    h('h3', { class: 'sec-title' }, t('pe.general')),
    h('div', { class: 'card' },
      row(t('pe.start'), durationField({ value: d.start, min: 0, fixedStep: 1, quick: [3, 5, 10, 15, 20, 30], label: t('pe.start'), onChange: (v) => { d.start = v; updateSummary(); } }), t('pe.startHint')),
      row(t('pe.cooldown'), durationField({ value: d.cooldown, min: 0, quick: [30, 60, 120, 180, 300], label: t('pe.cooldown'), onChange: (v) => { d.cooldown = v; updateSummary(); } })),
      row(t('pe.repeat'), counter({ value: d.repeat, min: 1, max: 99, unit: '×', quick: [1, 2, 3, 4, 5, 6, 8, 10], label: t('pe.repeat'), onChange: (v) => { d.repeat = v; updateSummary(); } }), t('pe.repeatHint')),
      row(t('pe.repeatPause'), durationField({ value: d.repeatPause, min: 0, quick: [0, 15, 30, 60, 90, 120], label: t('pe.repeatPause'), onChange: (v) => { d.repeatPause = v; updateSummary(); } }))),
    h('h3', { class: 'sec-title' }, t('pe.sequence')),
    h('p', { class: 'muted hint' }, t('pe.dragHint')),
    list,
    h('div', { class: 'add-row' },
      h('button', { type: 'button', class: 'btn add', onclick: () => add('randori') }, icon('plus'), t('blk.randori')),
      h('button', { type: 'button', class: 'btn add', onclick: () => add('exercise') }, icon('plus'), t('blk.exercise')),
      h('button', { type: 'button', class: 'btn add', onclick: () => add('pause') }, icon('plus'), t('blk.pause'))),
    existing ? h('button', { type: 'button', class: 'btn danger ghost', onclick: async () => { if (await confirmDialog(t('common.deleteConfirm', { name: store.itemName(existing) }))) { store.removeItem(existing.id); go('#/'); } } }, icon('trash'), t('common.delete')) : null,
    h('div', { class: 'spacer' }),
    stickyBar(sumEl, [
      h('button', { type: 'button', class: 'btn ghost', onclick: () => go('#/') }, icon('close'), t('common.cancel')),
      h('button', { type: 'button', class: 'btn', onclick: () => { if (save()) { toast(t('common.saved')); go('#/'); } } }, icon('check'), t('common.save')),
      h('button', { type: 'button', class: 'btn primary', onclick: () => { const it = save(); if (it) launch(it); } }, icon('play'), t('common.start'))]));
}

/* =============== Editor: HIIT =============== */

export function hiitEditor(id) {
  const existing = id !== 'new' ? store.getItem(id) : null;
  const d = mergeIntervalConfig(existing || store.newHiit());
  d.id = existing ? existing.id : store.newHiit().id;
  d.nameKey = existing ? existing.nameKey : null;
  d.name = existing ? store.itemName(existing) : '';
  const shown = d.name;
  const exBox = h('div', { class: 'steps' });
  const countBox = h('div', {});
  const sumEl = h('div', { class: 'sumline' });

  const updateSummary = () => {
    const ph = buildPhases(mergeIntervalConfig(d));
    fill(sumEl, h('div', {}, h('small', {}, t('pe.total')), h('b', {}, humanDur(totalSeconds(ph)))),
      h('div', {}, h('small', {}, t('pe.work')), h('b', {}, humanDur(workSeconds(ph)))));
  };
  const newEx = () => ({ name: '', work: d.defaults.work, rest: d.defaults.rest });
  const drawCount = () => fill(countBox, row(t('he.count'), counter({ value: d.exercises.length, min: 1, max: 99, unit: '×', label: t('he.count'), onChange: (n) => {
    while (d.exercises.length < n) d.exercises.push(newEx());
    while (d.exercises.length > n) d.exercises.pop();
    drawEx(); updateSummary();
  } }), t('he.countHint')));
  const swap = (i, j) => { if (j < 0 || j >= d.exercises.length) return; [d.exercises[i], d.exercises[j]] = [d.exercises[j], d.exercises[i]]; drawEx(); exBox.children[j]?.querySelector('.grip')?.focus(); };
  const drawEx = () => {
    fill(exBox, d.exercises.map((e, i) => {
      const last = i === d.exercises.length - 1;
      const grip = h('button', { type: 'button', class: 'grip', 'aria-label': t('aria.drag'), title: t('aria.drag'),
        onkeydown: (ev) => { if (ev.key === 'ArrowUp') { ev.preventDefault(); swap(i, i - 1); } else if (ev.key === 'ArrowDown') { ev.preventDefault(); swap(i, i + 1); } } }, icon('grip'));
      const card = h('div', { class: 'card step blk blk-exercise' });
      grip.addEventListener('pointerdown', (ev) => startDrag(ev, card, i, exBox, d.exercises, () => { drawEx(); updateSummary(); }));
      card.append(
        h('div', { class: 'blk-head' }, grip,
          h('span', { class: 'step-n' }, i + 1),
          h('input', { type: 'text', class: 'name-input', value: e.name, maxlength: 30, placeholder: t('he.exercise', { n: i + 1 }), 'aria-label': t('he.exName'), oninput: (ev) => { e.name = ev.target.value; } })),
        h('div', { class: 'step-grid' },
          h('div', { class: 'fld' }, h('label', {}, t('he.work')), durationField({ value: e.work, min: 1, quick: QUICK_DURS.work, label: t('he.work'), onChange: (v) => { e.work = v; updateSummary(); } })),
          last ? h('div', { class: 'fld muted small' }, t('he.lastRest')) : h('div', { class: 'fld' }, h('label', {}, t('he.rest')), durationField({ value: e.rest, min: 0, quick: QUICK_DURS.rest, label: t('he.rest'), onChange: (v) => { e.rest = v; updateSummary(); } }))),
        h('div', { class: 'tools ex-tools' },
          iconBtn('dup', t('common.duplicate'), () => { d.exercises.splice(i + 1, 0, { ...e }); drawEx(); drawCount(); updateSummary(); }, 'sm'),
          iconBtn('trash', t('common.remove'), () => { if (d.exercises.length > 1) { d.exercises.splice(i, 1); drawEx(); drawCount(); updateSummary(); } else toast(t('he.minEx')); }, 'sm danger')));
      return card;
    }));
  };
  // Standardzeit der Übung: gilt für neue Übungen und setzt alle vorhandenen Übungen um
  const applyDefault = (key, v) => { d.defaults[key] = v; d.exercises.forEach((e) => { e[key] = v; }); drawEx(); updateSummary(); };
  const defaultsBox = quickCard([
    { label: t('he.def.work'), hint: t('he.def.workHint'), get: () => d.defaults.work, quick: QUICK_DURS.work, set: (v) => applyDefault('work', v) }]);

  const save = () => {
    const c = mergeIntervalConfig(d);
    if (validateIntervalConfig(c).length) { toast(t('err.invalid')); return null; }
    const out = { ...c, id: d.id, kind: 'hiit' };
    const typed = d.name.trim();
    if (!typed && !d.nameKey) { toast(t('err.name')); document.querySelector('label.field input')?.focus(); return null; }
    out.nameKey = d.nameKey && typed === shown ? d.nameKey : null;
    out.name = out.nameKey ? '' : typed;
    store.saveItem(out);
    return out;
  };
  drawEx(); drawCount(); updateSummary();
  return h('div', { class: 'page editor' },
    topBar(existing ? t('he.edit') : t('he.new'), '#/hiit'),
    h('label', { class: 'field' }, h('span', {}, t('pe.name')), h('input', { type: 'text', value: d.name, maxlength: 40, placeholder: t('he.namePh'), oninput: (e) => { d.name = e.target.value; } })),
    h('h3', { class: 'sec-title' }, t('pe.defaults')),
    h('p', { class: 'muted hint' }, t('he.defaultsHint')),
    defaultsBox,
    h('h3', { class: 'sec-title' }, t('he.structure')),
    h('div', { class: 'card' },
      row(t('pe.start'), durationField({ value: d.start, min: 0, fixedStep: 1, quick: [3, 5, 10, 15, 20, 30], label: t('pe.start'), onChange: (v) => { d.start = v; updateSummary(); } }), t('pe.startHint')),
      countBox,
      row(t('he.restBetween'), durationField({ value: d.defaults.rest, min: 0, quick: QUICK_DURS.rest, label: t('he.restBetween'), onChange: (v) => applyDefault('rest', v) }), t('he.restBetweenHint')),
      row(t('he.sets'), counter({ value: d.sets, min: 1, max: 99, unit: '×', quick: [1, 2, 3, 4, 5, 6], label: t('he.sets'), onChange: (v) => { d.sets = v; updateSummary(); } }), t('he.setsHint')),
      row(t('he.setRest'), durationField({ value: d.setRest, min: 0, quick: [30, 45, 60, 90, 120, 180], label: t('he.setRest'), onChange: (v) => { d.setRest = v; updateSummary(); } }), t('he.setRestHint')),
      row(t('pe.cooldown'), durationField({ value: d.cooldown, min: 0, quick: [30, 60, 120, 180, 300], label: t('pe.cooldown'), onChange: (v) => { d.cooldown = v; updateSummary(); } }))),
    h('h3', { class: 'sec-title' }, t('he.exercises')),
    h('p', { class: 'muted hint' }, t('he.listHint')),
    exBox,
    existing ? h('button', { type: 'button', class: 'btn danger ghost', onclick: async () => { if (await confirmDialog(t('common.deleteConfirm', { name: store.itemName(existing) }))) { store.removeItem(existing.id); go('#/hiit'); } } }, icon('trash'), t('common.delete')) : null,
    h('div', { class: 'spacer' }),
    stickyBar(sumEl, [
      h('button', { type: 'button', class: 'btn ghost', onclick: () => go('#/hiit') }, icon('close'), t('common.cancel')),
      h('button', { type: 'button', class: 'btn', onclick: () => { if (save()) { toast(t('common.saved')); go('#/hiit'); } } }, icon('check'), t('common.save')),
      h('button', { type: 'button', class: 'btn primary', onclick: () => { const it = save(); if (it) launch(it); } }, icon('play'), t('common.start'))]));
}

/* =============== Lauf-Bildschirm =============== */

const backHash = () => (sess.session.item?.kind === 'hiit' ? '#/hiit' : '#/');
const RING_LEN = 2 * Math.PI * 46;
const PHASE_CLASS = { start: 'warm', warmup: 'warm', work: 'work', rest: 'rest', extra: 'rest', setrest: 'rest', cooldown: 'warm' };

export function runView() {
  const r = sess.session.runner;
  if (!r) { go('#/'); return h('div'); }
  const el = {
    root: h('div', { class: 'run' }),
    phase: h('div', { class: 'run-phase' }), label: h('div', { class: 'run-label' }), clock: h('div', { class: 'run-clock', role: 'timer' }),
    meta: h('div', { class: 'run-meta' }), bar: h('i'), next: h('div', { class: 'run-next' }),
    dots: h('div', { class: 'run-dots', 'aria-hidden': 'true' }),
    ring: (() => {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('class', 'ring-svg'); svg.setAttribute('aria-hidden', 'true');
      const mk = (cls) => { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', 50); c.setAttribute('cy', 50); c.setAttribute('r', 46); c.setAttribute('class', cls); svg.append(c); return c; };
      mk('ring-track'); const prog = mk('ring-prog'); prog.setAttribute('stroke-dasharray', RING_LEN); prog.setAttribute('stroke-dashoffset', RING_LEN);
      return { svg, prog };
    })(),
    tTotal: h('b', {}), tActive: h('b', {}), tPaused: h('b', {}), tPlanned: h('b', {}),
    pauseBtn: h('button', { type: 'button', class: 'rbtn main' }), skipBtn: h('button', { type: 'button', class: 'rbtn' }), prevBtn: h('button', { type: 'button', class: 'rbtn' })
  };
  el.prevBtn.append(icon('prev', 'flip')); el.prevBtn.setAttribute('aria-label', t('run.prev')); el.prevBtn.onclick = () => sess.previous();
  el.skipBtn.append(icon('next', 'flip')); el.skipBtn.setAttribute('aria-label', t('run.next')); el.skipBtn.onclick = () => sess.skip();
  el.pauseBtn.onclick = () => sess.toggle();

  const describeNext = () => {
    const nx = r.phases[r.i + 1];
    if (!nx) return t('run.last');
    const name = nx.type === 'work' ? (nx.label || t('phase.work')) : t('phase.' + nx.type) + (nx.label ? ` → ${nx.label}` : '');
    return `${t('run.upNext')}: ${name} · ${fmtDur(nx.dur)}`;
  };

  // Leuchtende Punkte: ein Punkt je Übung/Randori. Erledigt = gefüllt, aktuell = leuchtet, kommend = Umriss
  let dotKey = '';
  const drawDots = (rr, s) => {
    const work = rr.phases.map((p, i) => (p.type === 'work' ? i : -1)).filter((i) => i >= 0);
    const key = work.join(',');
    if (key !== dotKey) {
      dotKey = key;
      fill(el.dots, work.map((i) => h('i', { 'data-i': i })));
      el.dots.classList.toggle('many', work.length > 18);
      el.dots.hidden = work.length < 2;
    }
    el.dots.querySelectorAll('i').forEach((d) => {
      const i = +d.dataset.i; const isCur = i === rr.i && s.state !== 'finished';
      const nextUp = !isCur && i > rr.i && !rr.phases.slice(rr.i + 1, i).some((p) => p.type === 'work');
      d.className = s.state === 'finished' || i < rr.i ? 'done' : isCur ? 'cur' : nextUp ? 'next' : '';
    });
  };

  const update = () => {
    const rr = sess.session.runner;
    if (!rr) return;
    const s = rr.snapshot();
    const ph = s.phase;
    el.root.className = `run ph-${PHASE_CLASS[ph.type] || 'work'} st-${s.state}`;
    el.phase.textContent = s.state === 'finished' ? t('run.finished') : s.state === 'ready' ? t('run.ready') : s.state === 'paused' ? `${t('run.paused')} · ${t('phase.' + ph.type)}` : t('phase.' + ph.type);
    const lbl = ph.type === 'work' ? ph.label : (ph.label ? `${t('run.upNext')}: ${ph.label}` : '');
    el.label.textContent = s.state === 'finished' ? store.itemName(sess.session.item) : lbl;
    el.clock.textContent = s.state === 'finished' ? '00:00' : formatClock(s.phaseRemainingMs);
    el.clock.classList.toggle('long', el.clock.textContent.length > 5);
    const frac = s.state === 'finished' ? 1 : Math.min(1, s.phaseElapsedMs / Math.max(1, s.phaseMs));
    el.ring.prog.setAttribute('stroke-dashoffset', String(RING_LEN * (1 - frac)));
    drawDots(rr, s);
    const metas = [];
    if (ph.type === 'work' && ph.finalWork && s.state !== 'finished') metas.push(t('run.lastOne'));
    if (ph.steps > 0 && ph.step >= 0) metas.push(t('run.step', { a: ph.step + 1, b: ph.steps }));
    if (ph.sets > 1) metas.push(t('run.set', { a: ph.set, b: ph.sets }));
    if (ph.exCount > 1 && ph.exIdx >= 0) metas.push(t('run.exercise', { a: ph.exIdx + 1, b: ph.exCount }));
    if (ph.rounds > 1 && ph.round > 0) metas.push(t(ph.sets ? 'run.round' : 'run.repeat', { a: ph.round, b: ph.rounds }));
    if (ph.reps > 1 && ph.rep > 0) metas.push(t('run.rep', { a: ph.rep, b: ph.reps }));
    el.meta.textContent = metas.join('  ·  ');
    el.bar.style.width = `${Math.round(s.progress * 100)}%`;
    el.next.textContent = s.state === 'finished' ? t('run.cheer') : describeNext();
    el.tTotal.textContent = formatClock(s.totalRemainingMs);
    el.tActive.textContent = formatElapsed(s.activeMs);
    el.tPaused.textContent = formatElapsed(s.pausedMs);
    el.tPlanned.textContent = formatClock(s.plannedMs);
    const playing = s.state === 'running';
    fill(el.pauseBtn, icon(s.state === 'finished' ? 'repeat' : playing ? 'pause' : 'play'));
    el.pauseBtn.setAttribute('aria-label', s.state === 'finished' ? t('run.again') : playing ? t('run.pause') : t('run.resume'));
    el.pauseBtn.onclick = () => (s.state === 'finished' ? sess.restart() : sess.toggle());
    el.skipBtn.disabled = s.state === 'finished'; el.prevBtn.disabled = s.state === 'finished';
  };

  const askStop = async () => {
    const live = sess.isLive();
    if (live) { const wasRunning = r.state === 'running'; if (wasRunning) sess.pause(); const ok = await confirmDialog(t('run.stopText'), { ok: t('run.stop'), title: t('run.stopTitle') }); if (!ok) { if (wasRunning) sess.resume(); return; } }
    const back = backHash();
    sess.stopSession(true); go(back);
  };
  const fs = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}); };

  fill(el.root,
    h('header', { class: 'run-top' },
      iconBtn('close', t('run.stop'), askStop, 'flat'),
      h('div', { class: 'run-title' }, store.itemName(sess.session.item)),
      h('div', { class: 'run-top-r' }, iconBtn('replay', t('run.restartPhase'), () => sess.restartPhase(), 'flat'), iconBtn('expand', t('run.fullscreen'), fs, 'flat'), iconBtn('down', t('run.minimize'), () => go(backHash()), 'flat'))),
    h('div', { class: 'run-bar' }, el.bar),
    h('div', { class: 'run-main', onclick: () => sess.toggle() }, el.phase, el.label, h('div', { class: 'ring' }, el.ring.svg, el.clock), el.meta, el.dots, el.next),
    h('div', { class: 'run-side' },
      h('div', { class: 'stats' },
        h('div', {}, h('small', {}, t('run.remaining')), el.tTotal),
        h('div', {}, h('small', {}, t('run.active')), el.tActive),
        h('div', {}, h('small', {}, t('run.paused')), el.tPaused),
        h('div', {}, h('small', {}, t('run.planned')), el.tPlanned)),
      h('div', { class: 'run-controls' }, el.prevBtn, el.pauseBtn, el.skipBtn)));
  update();
  const off = sess.onSession((type) => { if (type === 'stop') return; update(); });
  el.root.__cleanup = off;
  return el.root;
}

/* =============== Verlauf =============== */

export function historyView() {
  const list = store.history().slice().reverse();
  return h('div', { class: 'page' },
    topBar(t('hist.title')),
    list.length ? list.map((e) => {
      const d = new Date(e.t);
      return h('div', { class: 'card hist' },
        h('div', { class: 'hist-top' }, h('b', {}, e.name), h('small', {}, d.toLocaleString(document.documentElement.lang, { dateStyle: 'medium', timeStyle: 'short' }))),
        h('div', { class: 'hist-grid' },
          h('div', {}, h('small', {}, t('run.planned')), h('b', {}, fmtDur(e.plannedSec))),
          h('div', {}, h('small', {}, t('run.active')), h('b', {}, fmtDur(e.activeSec))),
          h('div', {}, h('small', {}, t('run.paused')), h('b', {}, fmtDur(e.pausedSec || 0))),
          h('div', {}, h('small', {}, t('hist.status')), h('b', {}, e.completed ? t('hist.done') : t('hist.stopped')))));
    }) : h('div', { class: 'empty' }, icon('history'), h('p', {}, t('hist.empty'))),
    list.length ? h('button', { type: 'button', class: 'btn danger ghost', onclick: async () => { if (await confirmDialog(t('hist.clearConfirm'))) store.clearHistory(); } }, icon('trash'), t('hist.clear')) : null);
}

/* =============== Optionen =============== */

function download(name, text) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function settingsView() {
  const S = store.settings();
  const set = (p) => store.updateSettings(p);
  const importer = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const n = store.importData(await f.text()); toast(t('data.imported', { n })); } catch (err) { toast(tm(err.message) || t('data.invalid')); }
    e.target.value = '';
  } });
  const sel = (value, options, onPick, label) => h('select', { 'aria-label': label, onchange: (e) => onPick(e.target.value) },
    options.map(([k, l]) => h('option', { value: k, ...(k === value ? { selected: true } : {}) }, l)));
  // Auswahl eines Tons mit sofortiger Vorschau
  const soundRow = (label, key, ids, hint) => row(label, sel(S[key], ids.map((id) => [id, t('snd.' + id)]), (v) => { set({ [key]: v }); audio.previewSound(v, 1.4); }, label), hint);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  return h('div', { class: 'page' },
    topBar(t('set.title')),
    h('h3', { class: 'sec-title' }, t('set.sound')),
    h('div', { class: 'card' },
      row(t('set.soundOn'), toggle(S.sound, (v) => set({ sound: v }), t('set.soundOn'))),
      row(t('set.volume'), h('input', { type: 'range', class: 'vol', min: 0.2, max: 1, step: 0.05, value: S.volume, 'aria-label': t('set.volume'),
        oninput: (e) => { store.settings().volume = +e.target.value; }, onchange: (e) => { set({ volume: +e.target.value }); audio.unlock(); audio.previewSound('beep2'); } })),
      row(t('set.countdown'), toggle(S.countdown, (v) => set({ countdown: v }), t('set.countdown')), t('set.countdownHint')),
      S.countdown ? h('div', { class: 'chips' }, [10, 5, 3, 2, 1].map((n) =>
        h('button', { type: 'button', class: 'chip' + (S.countdownList.includes(n) ? ' on' : ''), onclick: () => set({ countdownList: S.countdownList.includes(n) ? S.countdownList.filter((x) => x !== n) : [...S.countdownList, n].sort((a, b) => b - a) }) }, `${n} s`))) : null,
      row(t('set.applause'), toggle(S.applause, (v) => { set({ applause: v }); if (v) audio.previewSound('applause'); }, t('set.applause')), t('set.applauseHint')),
      row(t('set.vibrate'), toggle(S.vibrate, (v) => set({ vibrate: v }), t('set.vibrate')), t('set.vibrateHint'))),

    h('h3', { class: 'sec-title' }, t('set.judoSounds')),
    h('p', { class: 'muted hint' }, t('set.judoSoundsHint')),
    h('div', { class: 'card' },
      row(t('set.voice'), sel(S.voiceStyle, [['jp', t('set.voiceJp')], ['app', t('set.voiceApp')], ['off', t('set.voiceOff')]], (v) => { set({ voiceStyle: v }); audio.previewVoice(); }, t('set.voice')), t('set.voiceHint')),
      soundRow(t('set.judoStart'), 'judoStart', audio.SOUND_IDS, t('set.judoStartHint')),
      soundRow(t('set.judoEnd'), 'bell', audio.SOUND_IDS, t('set.judoEndHint')),
      row(t('set.endOrder'), sel(S.endOrder, [['voice-bell', t('set.orderVoiceBell')], ['bell-voice', t('set.orderBellVoice')], ['bell', t('set.orderBell')], ['voice', t('set.orderVoice')]], (v) => set({ endOrder: v }), t('set.endOrder')), t('set.endOrderHint')),
      soundRow(t('set.countSound'), 'judoCount', audio.COUNT_IDS),
      h('div', { class: 'btn-row', style: 'margin-top:10px' },
        h('button', { type: 'button', class: 'btn', onclick: () => audio.previewVoice('start') }, icon('volume'), t('set.testVoice')),
        h('button', { type: 'button', class: 'btn', onclick: () => audio.previewVoice('stop') }, icon('volume'), t('set.testMate')),
        h('button', { type: 'button', class: 'btn', onclick: () => audio.previewVoice('finish') }, icon('volume'), t('set.testFinish')))),

    h('h3', { class: 'sec-title' }, t('set.hiitSounds')),
    h('p', { class: 'muted hint' }, t('set.hiitSoundsHint')),
    h('div', { class: 'card' },
      soundRow(t('set.hiitStart'), 'hiitStart', audio.SOUND_IDS, t('set.hiitStartHint')),
      soundRow(t('set.hiitEnd'), 'hiitEnd', audio.SOUND_IDS, t('set.hiitEndHint')),
      soundRow(t('set.hiitFinish'), 'hiitFinish', audio.SOUND_IDS),
      soundRow(t('set.countSound'), 'hiitCount', audio.COUNT_IDS)),
    h('h3', { class: 'sec-title' }, t('set.screen')),
    h('div', { class: 'card' },
      row(t('set.keepAwake'), toggle(S.keepAwake, (v) => set({ keepAwake: v }), t('set.keepAwake')), t('set.keepAwakeHint'))),
    h('h3', { class: 'sec-title' }, t('set.look')),
    h('div', { class: 'card' },
      row(t('set.lang'), sel(S.lang, [['auto', t('set.langAuto')], ...LANGS], (v) => set({ lang: v }), t('set.lang'))),
      row(t('set.theme'), seg([['dark', t('set.dark')], ['light', t('set.light')], ['auto', t('set.auto')]], S.theme, (k) => set({ theme: k }))),
      row(t('set.accent'), seg([['red', t('set.red')], ['gold', t('set.gold')]], S.accent, (k) => set({ accent: k })))),
    h('h3', { class: 'sec-title' }, t('set.data')),
    h('div', { class: 'card' },
      importer,
      h('p', { class: 'muted small', style: 'margin-top:0' }, t('set.dataInfo')),
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn', onclick: () => download(`judo-timer-${new Date().toISOString().slice(0, 10)}.json`, store.exportData()) }, icon('download'), t('set.export')),
        h('button', { type: 'button', class: 'btn', onclick: () => importer.click() }, icon('upload'), t('set.import'))),
      h('button', { type: 'button', class: 'btn danger ghost', style: 'margin-top:10px', onclick: async () => { if (await confirmDialog(t('set.resetConfirm'), { ok: t('set.reset') })) { store.resetAll(); toast(t('set.resetDone')); } } }, icon('trash'), t('set.reset'))),
    !standalone ? h('div', { class: 'card' }, h('h2', {}, t('set.install')), h('p', { class: 'muted small', style: 'margin:0' }, t('set.installText'))) : null,
    h('p', { class: 'muted small center' }, `JUDO PRO TIMER · ${t('set.offline')}`),
    h('p', { class: 'muted small center' }, t('set.credits')));
}
