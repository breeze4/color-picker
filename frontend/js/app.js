import { normHue, shade, toHex, fromHex, rgbToHsv, baseByHue, kFor, textOn } from './color.js';
import { PRESETS, presetValues } from './presets.js';
import { valToPoint, pointToVal, limitToDisc } from './field.js';
import {
  SCHEME_MODELS, defaultState, cloneState, schemeHues, schemeColors, withAngle,
  toFree, toModel, withHue, withFreeHue, withCompl, valsFor, withVals, LABELS, exportMarkdown, exportCss, exportJson, stateToHash, hashToState, MIN_ANGLE, MAX_ANGLE,
} from './palette.js';

// ---------- state and history ----------
let state = hashToState(location.hash);
const undo = [];
const redo = [];

function commit(next) {
  undo.push(cloneState(state));
  if (undo.length > 100) undo.shift();
  redo.length = 0;
  state = next;
  history.replaceState(null, '', stateToHash(state));
  render();
}

// Live update while dragging. No history entry.
function preview(next) {
  state = next;
  render();
}

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const canvas = $('wheel');
const ctx = canvas.getContext('2d');
const SIZE = canvas.width;
const C = SIZE / 2;
const R_OUT = C - 2;
// The disc keeps its size. The ring sits farther out so a row of color
// chips fits in the band between them.
const R_DISC = 141;
const R_IN = 185;
const R_MID = (R_OUT + R_IN) / 2;
const R_CHIP = (R_DISC + R_IN) / 2;
const CHIP_R = 8;

const hueToRad = (h) => ((h - 90) * Math.PI) / 180;
const posOnRing = (h) => ({ x: C + R_MID * Math.cos(hueToRad(h)), y: C + R_MID * Math.sin(hueToRad(h)) });
const hueAt = (x, y) => normHue(Math.round((Math.atan2(y - C, x - C) * 180) / Math.PI + 90));
const discPos = (v) => {
  const p = valToPoint(v);
  return { x: C + p.x * R_DISC, y: C + p.y * R_DISC };
};
const discPoint = (x, y) => ({ x: (x - C) / R_DISC, y: (y - C) / R_DISC });

// ---------- drawing ----------
let ringImage = null;
let discCache = { hue: -1, image: null };

function drawRing() {
  if (ringImage) return ringImage;
  const off = document.createElement('canvas');
  off.width = off.height = SIZE;
  const o = off.getContext('2d');
  for (let h = 0; h < 360; h++) {
    o.beginPath();
    o.moveTo(C, C);
    o.arc(C, C, R_OUT, hueToRad(h - 0.6), hueToRad(h + 0.6));
    o.closePath();
    o.fillStyle = toHex(shade(h, 1, 1).rgb);
    o.fill();
  }
  o.globalCompositeOperation = 'destination-out';
  o.beginPath();
  o.arc(C, C, R_IN, 0, Math.PI * 2);
  o.fill();
  ringImage = off;
  return off;
}

function drawDisc(hue) {
  if (discCache.hue === hue) return discCache.image;
  const d = Math.ceil(R_DISC * 2);
  const img = ctx.createImageData(d, d);
  const data = img.data;
  const base = baseByHue(hue);
  for (let py = 0; py < d; py++) {
    for (let px = 0; px < d; px++) {
      const x = (px + 0.5 - d / 2) / R_DISC;
      const y = (py + 0.5 - d / 2) / R_DISC;
      const r = Math.hypot(x, y);
      if (r > 1) continue;
      const [kS, kV] = pointToVal({ x, y });
      const { r: cr, g, b } = shade(base.h, kS, kV).rgb;
      const i = (py * d + px) * 4;
      data[i] = cr; data[i + 1] = g; data[i + 2] = b;
      data[i + 3] = r > 0.985 ? Math.round((1 - r) / 0.015 * 255) : 255;
    }
  }
  const off = document.createElement('canvas');
  off.width = off.height = d;
  off.getContext('2d').putImageData(img, 0, 0);
  discCache = { hue, image: off };
  return off;
}

function dot(x, y, r, fill, big) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = big ? 3 : 2;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#0008';
  ctx.stroke();
}

// Small number tag beside a dot. Matches the number on the swatches.
function tag(x, y, text) {
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 8;
  const tx = x + 12, ty = y - 12;
  ctx.fillStyle = '#000c';
  ctx.beginPath();
  ctx.roundRect(tx, ty - 8, w, 16, 4);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(text, tx + 4, ty + 0.5);
}

// Index of the inner dot under the pointer, or -1.
let hotIndex = -1;

// The color that the inner disc edits. Falls back to the primary when
// that color leaves the scheme.
let active = 'pri';

function activeColor() {
  const hues = schemeHues(state);
  const c = hues.find((h) => h.id === active) ?? hues[0];
  active = c.id;
  return c;
}

// Chip positions on an arc at the top of the band, one per scheme color.
function chipPositions() {
  const hues = schemeHues(state);
  const step = 8;
  return hues.map((h, i) => {
    const a = ((-90 + (i - (hues.length - 1) / 2) * step) * Math.PI) / 180;
    return { ...h, x: C + R_CHIP * Math.cos(a), y: C + R_CHIP * Math.sin(a) };
  });
}

function drawChips(act) {
  const chips = chipPositions();
  if (chips.length < 2) return;
  for (const ch of chips) {
    const main = valsFor(state, ch.id)[0];
    if (ch.id === act.id) {
      ctx.beginPath();
      ctx.arc(ch.x, ch.y, CHIP_R + 4, 0, Math.PI * 2);
      ctx.fillStyle = '#e0b34a';
      ctx.fill();
    }
    dot(ch.x, ch.y, CHIP_R, toHex(shade(ch.hue, main[0], main[1]).rgb), false);
  }
}

function drawWheel() {
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.drawImage(drawRing(), 0, 0);
  const act = activeColor();
  const vals = valsFor(state, act.id);
  const disc = drawDisc(act.hue);
  ctx.drawImage(disc, C - disc.width / 2, C - disc.height / 2);
  drawChips(act);

  // Lines from the center to each hue on the ring.
  const hues = schemeHues(state);
  ctx.strokeStyle = '#0006';
  ctx.lineWidth = 1;
  for (const h of hues) {
    const p = posOnRing(h.hue);
    ctx.beginPath();
    ctx.moveTo(C + R_DISC * Math.cos(hueToRad(h.hue)), C + R_DISC * Math.sin(hueToRad(h.hue)));
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  for (const h of [...hues].reverse()) {
    const p = posOnRing(h.hue);
    const main = valsFor(state, h.id)[0];
    dot(p.x, p.y, h.id === 'pri' ? 12 : 9, toHex(shade(h.hue, main[0], main[1]).rgb), h.id === 'pri');
    if (h.id === act.id && state.model === 'free') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, (h.id === 'pri' ? 12 : 9) + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#e0b34a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  for (let i = 4; i >= 0; i--) {
    const p = discPos(vals[i]);
    dot(p.x, p.y, i === 0 ? 11 : 7, toHex(shade(act.hue, ...vals[i]).rgb), i === 0);
  }
  for (let i = 0; i < 5; i++) {
    const p = discPos(vals[i]);
    tag(p.x, p.y, String(i));
  }
}

// ---------- preview box ----------
// Layout copied from Paletton's preview: a 360 unit square with four
// quadrants. Each quadrant is one hue's main shade with the other four
// shades as small squares. Numbers are in 360ths of the box.
const PREVIEW = [
  { id: 'pri', box: [0, 0, 216, 216], vars: [[130, 10, 50], [70, 10, 50], [10, 70, 50], [10, 130, 50]] },
  { id: 'sec1', box: [216, 0, 144, 216], vars: [[104, 10, 30], [104, 50, 30], [104, 90, 30], [104, 130, 30]] },
  { id: 'sec2', box: [0, 216, 216, 144], vars: [[10, 104, 30], [50, 104, 30], [90, 104, 30], [130, 104, 30]] },
  { id: 'compl', box: [216, 216, 144, 144], vars: [[24, 104, 30], [64, 104, 30], [104, 64, 30], [104, 24, 30]] },
];

function renderPreview(colors) {
  const byId = Object.fromEntries(colors.map((c) => [c.id, c]));
  const pct = (n) => `${(n / 360) * 100}%`;
  const el = $('preview');
  el.innerHTML = '';
  for (const q of PREVIEW) {
    const c = byId[q.id] ?? byId.pri;
    const [x, y, w, h] = q.box;
    const box = document.createElement('div');
    box.style.cssText = `left:${pct(x)};top:${pct(y)};width:${pct(w)};height:${pct(h)};background:${c.shades[0].hex}`;
    box.title = c.label;
    q.vars.forEach(([vx, vy, vs], i) => {
      const v = document.createElement('div');
      v.style.cssText = `left:${(vx / w) * 100}%;top:${(vy / h) * 100}%;width:${(vs / w) * 100}%;height:${(vs / h) * 100}%;background:${c.shades[i + 1].hex}`;
      v.title = `${c.label} ${i + 1}`;
      box.appendChild(v);
    });
    el.appendChild(box);
  }
}

// ---------- palette panel ----------
function renderPalette() {
  const colors = schemeColors(state);
  renderPreview(colors);
  const strip = $('strip');
  strip.innerHTML = '';
  for (const c of colors) {
    for (const sh of c.shades) {
      const d = document.createElement('div');
      d.style.background = sh.hex;
      strip.appendChild(d);
    }
  }
  const pal = $('palette');
  pal.innerHTML = '';
  for (const c of colors) {
    const row = document.createElement('div');
    row.className = 'color-row' + (c.id === active ? ' active' : '');
    const h2 = document.createElement('h2');
    h2.textContent = `${c.label} · ${c.hue}°`;
    h2.title = state.model === 'free' ? 'Click to edit this color\'s shades' : 'Click to show this hue in the wheel';
    h2.addEventListener('click', () => { active = c.id; render(); });
    row.appendChild(h2);
    const sw = document.createElement('div');
    sw.className = 'swatches';
    c.shades.forEach((sh, i) => {
      const b = document.createElement('button');
      b.className = 'swatch' + (i === hotIndex ? ' hot' : '');
      b.dataset.idx = i;
      b.style.background = sh.hex;
      b.style.color = textOn(sh.rgb);
      b.textContent = sh.hex;
      const idx = document.createElement('span');
      idx.className = 'idx';
      idx.textContent = i;
      b.appendChild(idx);
      b.title = 'Click to copy';
      b.addEventListener('click', () => copyText(sh.hex, b));
      sw.appendChild(b);
    });
    row.appendChild(sw);
    pal.appendChild(row);
  }
}

async function copyText(text, el) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  if (el) {
    el.classList.add('copied');
    setTimeout(() => el.classList.remove('copied'), 900);
  }
}

// ---------- controls ----------
function renderControls() {
  document.querySelectorAll('[data-model]').forEach((b) => {
    b.classList.toggle('active', b.dataset.model === state.model);
  });
  const chk = $('chk-compl');
  chk.checked = state.model === 'tetrad' ? true : state.compl;
  chk.disabled = state.model === 'tetrad';
  if (document.activeElement !== $('in-hue')) $('in-hue').value = state.hue;
  const ang = $('in-angle');
  ang.disabled = state.model === 'mono' || state.model === 'free';
  if (document.activeElement !== ang) ang.value = state.angle;
  const act = activeColor();
  if (document.activeElement !== $('in-hex')) $('in-hex').value = toHex(shade(act.hue, ...valsFor(state, act.id)[0]).rgb);
  renderPreset();
  $('btn-undo').disabled = undo.length === 0;
  $('btn-redo').disabled = redo.length === 0;
}

function render() {
  drawWheel();
  renderPalette();
  renderControls();
}

// ---------- pointer handling on the wheel ----------
let drag = null;

function canvasXY(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: ((ev.clientX - r.left) / r.width) * SIZE, y: ((ev.clientY - r.top) / r.height) * SIZE };
}

function hitTest(x, y) {
  for (const ch of chipPositions()) {
    if (Math.hypot(ch.x - x, ch.y - y) <= CHIP_R + 4) return { kind: 'chip', id: ch.id };
  }
  const vals = valsFor(state, activeColor().id);
  for (let i = 0; i < 5; i++) {
    const p = discPos(vals[i]);
    if (Math.hypot(p.x - x, p.y - y) <= (i === 0 ? 14 : 10)) return { kind: 'disc', index: i };
  }
  for (const h of schemeHues(state)) {
    const p = posOnRing(h.hue);
    if (Math.hypot(p.x - x, p.y - y) <= 14) return { kind: 'ring', id: h.id };
  }
  const r = Math.hypot(x - C, y - C);
  if (r >= R_IN && r <= R_OUT) return { kind: 'ring', id: 'pri' };
  if (r <= R_DISC) return { kind: 'disc', index: 0 };
  return null;
}

function angleFromPointer(id, h) {
  const s = state;
  const diff = (from) => {
    let d = normHue(h - from);
    if (d > 180) d -= 360;
    return d;
  };
  if (s.model === 'analog') return id === 'sec1' ? diff(s.hue) : -diff(s.hue);
  if (s.model === 'triad') return id === 'sec1' ? diff(s.hue + 180) : -diff(s.hue + 180);
  return id === 'sec1' ? diff(s.hue) : diff(s.hue + 180); // tetrad
}

canvas.addEventListener('pointerdown', (ev) => {
  const { x, y } = canvasXY(ev);
  const hit = hitTest(x, y);
  if (!hit) return;
  ev.preventDefault();
  if (hit.kind === 'chip') { active = hit.id; render(); return; }
  canvas.setPointerCapture(ev.pointerId);
  drag = { ...hit, start: cloneState(state), pointer: hit.kind === 'disc' ? limitToDisc(...Object.values(discPoint(x, y))) : null };
  hotIndex = hit.kind === 'disc' ? hit.index : -1;
  if (hit.kind === 'ring') active = hit.id;
  moveDrag(x, y);
});

canvas.addEventListener('pointermove', (ev) => {
  const { x, y } = canvasXY(ev);
  if (drag) return moveDrag(x, y);
  const hit = hitTest(x, y);
  const chip = hit && hit.kind === 'chip' ? schemeHues(state).find((h) => h.id === hit.id) : null;
  canvas.style.cursor = chip ? 'pointer' : '';
  canvas.title = chip ? `Edit ${LABELS[chip.id]} shades` : '';
  const av = valsFor(state, activeColor().id);
  const idx = hit && hit.kind === 'disc' && Math.hypot(discPos(av[hit.index]).x - x, discPos(av[hit.index]).y - y) <= 14 ? hit.index : -1;
  if (idx !== hotIndex) { hotIndex = idx; setHot(); }
});

canvas.addEventListener('pointerleave', () => { if (!drag && hotIndex !== -1) { hotIndex = -1; setHot(); } });

function setHot() {
  document.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('hot', Number(b.dataset.idx) === hotIndex));
}

function endDrag(ev) {
  if (!drag) return;
  const start = drag.start;
  drag = null;
  hotIndex = -1;
  const end = state;
  state = start;
  commit(end);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

function moveDrag(x, y) {
  const n = cloneState(state);
  if (drag.kind === 'ring') {
    const h = hueAt(x, y);
    if (drag.id === 'pri') return preview(withHue(state, h));
    // The complement dot, or any dot in free mode, moves alone.
    if (drag.id === 'compl' || state.model === 'free') return preview(withFreeHue(state, drag.id, h));
    return preview(withAngle(n, angleFromPointer(drag.id, h)));
  }
  const p = limitToDisc(...Object.values(discPoint(x, y)));
  const id = activeColor().id;
  const vals = valsFor(state, id).map((v) => [...v]);
  if (drag.index === 0) {
    const dx = p.x - drag.pointer.x, dy = p.y - drag.pointer.y;
    drag.pointer = p;
    vals.forEach((v, i) => {
      const q = valToPoint(v);
      vals[i] = pointToVal({ x: q.x + dx, y: q.y + dy });
    });
  } else {
    vals[drag.index] = pointToVal(p);
  }
  const next = withVals(state, id, vals);
  next.preset = 'custom';
  preview(next);
}

// ---------- control events ----------
document.querySelectorAll('[data-model]').forEach((b) => {
  b.addEventListener('click', () => {
    const m = b.dataset.model;
    commit(m === 'free' ? toFree(state) : toModel(state, m));
  });
});

$('chk-compl').addEventListener('change', (ev) => commit(withCompl(state, ev.target.checked)));

$('in-hue').addEventListener('change', (ev) => {
  const v = Number(ev.target.value);
  if (!Number.isFinite(v)) return;
  commit(withHue(state, v));
});

$('in-angle').addEventListener('change', (ev) => {
  const v = Number(ev.target.value);
  if (!Number.isFinite(v) || state.model === 'free') return;
  commit(withAngle(state, Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, v))));
});

// Typing a hex sets the hue and moves the main shade dot onto that
// color. The other four dots keep their offset from the main dot.
$('in-hex').addEventListener('change', (ev) => {
  const act = activeColor();
  const cur = valsFor(state, act.id);
  const rgb = fromHex(ev.target.value);
  if (!rgb) { ev.target.value = toHex(shade(act.hue, ...cur[0]).rgb); return; }
  const hsv = rgbToHsv(rgb);
  const hue = Math.round(hsv.h);
  const n = act.id === 'pri' ? withHue(state, hue) : withFreeHue(state, act.id, hue);
  const base = baseByHue(hue);
  const round = (n) => Math.round(Math.min(2, n) * 1e5) / 1e5;
  const target = [round(kFor(base.s, hsv.s)), round(kFor(base.v, hsv.v))];
  const from = valToPoint(cur[0]);
  const to = valToPoint(target);
  const vals = cur.map((v, i) => {
    if (i === 0) return target;
    const q = valToPoint(v);
    return pointToVal({ x: q.x + to.x - from.x, y: q.y + to.y - from.y });
  });
  const next = withVals(n, act.id, vals);
  next.preset = 'custom';
  commit(next);
});

// ---------- shade preset picker ----------
// A button that shows the current preset as five blocks in the active
// hue, and a menu that shows every preset the same way.
const presetBtn = $('btn-preset');
const presetMenu = $('preset-menu');

function blocks(hue, vals) {
  const el = document.createElement('span');
  el.className = 'blocks';
  for (const [kS, kV] of vals) {
    const b = document.createElement('span');
    b.style.background = toHex(shade(hue, kS, kV).rgb);
    el.appendChild(b);
  }
  return el;
}

function presetRow(name, hue, vals) {
  const row = document.createElement('button');
  row.type = 'button';
  row.setAttribute('role', 'option');
  row.dataset.preset = name;
  row.appendChild(blocks(hue, vals));
  const label = document.createElement('span');
  label.className = 'name';
  label.textContent = name;
  row.appendChild(label);
  return row;
}

function renderPreset() {
  const act = activeColor();
  presetBtn.innerHTML = '';
  presetBtn.appendChild(blocks(act.hue, valsFor(state, act.id)));
  const label = document.createElement('span');
  label.className = 'name';
  label.textContent = state.preset;
  presetBtn.appendChild(label);
  if (presetMenu.hidden) return;
  presetMenu.innerHTML = '';
  for (const name of Object.keys(PRESETS)) {
    const row = presetRow(name, act.hue, PRESETS[name]);
    row.classList.toggle('active', name === state.preset);
    presetMenu.appendChild(row);
  }
}

function openPresetMenu(open) {
  presetMenu.hidden = !open;
  presetBtn.setAttribute('aria-expanded', String(open));
  if (open) {
    renderPreset();
    (presetMenu.querySelector('.active') ?? presetMenu.firstElementChild)?.focus();
  }
}

presetBtn.addEventListener('click', () => openPresetMenu(presetMenu.hidden));
presetMenu.addEventListener('click', (ev) => {
  const row = ev.target.closest('[data-preset]');
  if (!row) return;
  const n = withVals(state, activeColor().id, presetValues(row.dataset.preset));
  n.preset = row.dataset.preset;
  openPresetMenu(false);
  commit(n);
});
// Opening rebuilds the button, so a click target can be detached by the
// time the document sees it. Stop clicks inside the picker here instead.
presetBtn.closest('.preset-picker').addEventListener('click', (ev) => ev.stopPropagation());
document.addEventListener('click', () => {
  if (!presetMenu.hidden) openPresetMenu(false);
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !presetMenu.hidden) { openPresetMenu(false); presetBtn.focus(); }
});

$('btn-undo').addEventListener('click', () => {
  if (!undo.length) return;
  redo.push(cloneState(state));
  state = undo.pop();
  history.replaceState(null, '', stateToHash(state));
  render();
});

$('btn-redo').addEventListener('click', () => {
  if (!redo.length) return;
  undo.push(cloneState(state));
  state = redo.pop();
  history.replaceState(null, '', stateToHash(state));
  render();
});

$('btn-reset').addEventListener('click', () => commit(defaultState()));

$('btn-random').addEventListener('click', () => {
  const n = cloneState(state);
  n.hue = Math.floor(Math.random() * 360);
  n.model = SCHEME_MODELS[Math.floor(Math.random() * SCHEME_MODELS.length)];
  n.hues = null;
  n.compl = Math.random() < 0.4;
  n.angle = 15 + Math.floor(Math.random() * 46);
  const names = Object.keys(PRESETS);
  n.preset = names[Math.floor(Math.random() * names.length)];
  n.vals = presetValues(n.preset);
  commit(n);
});

// ---------- export dialog ----------
const dlg = $('export-dialog');
let format = 'markdown';

function exportText() {
  if (format === 'css') return exportCss(state);
  if (format === 'json') return exportJson(state);
  return exportMarkdown(state, location.href);
}

function renderExport() {
  document.querySelectorAll('[data-format]').forEach((b) => b.classList.toggle('active', b.dataset.format === format));
  $('export-text').value = exportText();
}

$('btn-export').addEventListener('click', () => {
  renderExport();
  dlg.showModal();
});
document.querySelectorAll('[data-format]').forEach((b) => {
  b.addEventListener('click', () => { format = b.dataset.format; renderExport(); });
});
$('btn-close').addEventListener('click', () => dlg.close());
$('btn-copy').addEventListener('click', () => copyText(exportText(), $('btn-copy')));
dlg.addEventListener('click', (ev) => { if (ev.target === dlg) dlg.close(); });

window.addEventListener('hashchange', () => {
  state = hashToState(location.hash);
  render();
});

render();
