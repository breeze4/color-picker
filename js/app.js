import { normHue, shade, toHex, fromHex, rgbToHsv, baseByHue, kFor, textOn } from './color.js';
import { PRESETS, presetValues } from './presets.js';
import { valToPoint, pointToVal, limitToDisc } from './field.js';
import {
  MODELS, defaultState, cloneState, schemeHues, schemeColors, withAngle,
  exportMarkdown, exportCss, exportJson, stateToHash, hashToState, MIN_ANGLE, MAX_ANGLE,
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
const R_IN = C * 0.74;
const R_MID = (R_OUT + R_IN) / 2;
const R_DISC = C * 0.64;

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

function drawWheel() {
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.drawImage(drawRing(), 0, 0);
  const disc = drawDisc(state.hue);
  ctx.drawImage(disc, C - disc.width / 2, C - disc.height / 2);

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

  const main = state.vals[0];
  for (const h of [...hues].reverse()) {
    const p = posOnRing(h.hue);
    dot(p.x, p.y, h.id === 'pri' ? 12 : 9, toHex(shade(h.hue, main[0], main[1]).rgb), h.id === 'pri');
  }
  for (let i = 4; i >= 0; i--) {
    const p = discPos(state.vals[i]);
    dot(p.x, p.y, i === 0 ? 11 : 7, toHex(shade(state.hue, ...state.vals[i]).rgb), i === 0);
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
    row.className = 'color-row';
    const h2 = document.createElement('h2');
    h2.textContent = `${c.label} · ${c.hue}°`;
    row.appendChild(h2);
    const sw = document.createElement('div');
    sw.className = 'swatches';
    c.shades.forEach((sh) => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = sh.hex;
      b.style.color = textOn(sh.rgb);
      b.textContent = sh.hex;
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
  ang.disabled = state.model === 'mono';
  if (document.activeElement !== ang) ang.value = state.angle;
  if (document.activeElement !== $('in-hex')) $('in-hex').value = toHex(shade(state.hue, ...state.vals[0]).rgb);
  $('sel-preset').value = state.preset;
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
  for (let i = 0; i < 5; i++) {
    const p = discPos(state.vals[i]);
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
  canvas.setPointerCapture(ev.pointerId);
  drag = { ...hit, start: cloneState(state), pointer: hit.kind === 'disc' ? limitToDisc(...Object.values(discPoint(x, y))) : null };
  moveDrag(x, y);
});

canvas.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  const { x, y } = canvasXY(ev);
  moveDrag(x, y);
});

function endDrag(ev) {
  if (!drag) return;
  const start = drag.start;
  drag = null;
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
    if (drag.id === 'pri') n.hue = h;
    else if (drag.id === 'compl') n.hue = normHue(h - 180);
    else return preview(withAngle(n, angleFromPointer(drag.id, h)));
    return preview(n);
  }
  const p = limitToDisc(...Object.values(discPoint(x, y)));
  if (drag.index === 0) {
    const dx = p.x - drag.pointer.x, dy = p.y - drag.pointer.y;
    drag.pointer = p;
    n.vals = state.vals.map((v) => {
      const q = valToPoint(v);
      return pointToVal({ x: q.x + dx, y: q.y + dy });
    });
  } else {
    n.vals[drag.index] = pointToVal(p);
  }
  n.preset = 'custom';
  preview(n);
}

// ---------- control events ----------
document.querySelectorAll('[data-model]').forEach((b) => {
  b.addEventListener('click', () => {
    const n = cloneState(state);
    n.model = b.dataset.model;
    commit(n);
  });
});

$('chk-compl').addEventListener('change', (ev) => {
  const n = cloneState(state);
  n.compl = ev.target.checked;
  commit(n);
});

$('in-hue').addEventListener('change', (ev) => {
  const v = Number(ev.target.value);
  if (!Number.isFinite(v)) return;
  const n = cloneState(state);
  n.hue = normHue(Math.round(v));
  commit(n);
});

$('in-angle').addEventListener('change', (ev) => {
  const v = Number(ev.target.value);
  if (!Number.isFinite(v)) return;
  commit(withAngle(state, Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, v))));
});

// Typing a hex sets the hue and moves the main shade dot onto that
// color. The other four dots keep their offset from the main dot.
$('in-hex').addEventListener('change', (ev) => {
  const rgb = fromHex(ev.target.value);
  if (!rgb) { ev.target.value = toHex(shade(state.hue, ...state.vals[0]).rgb); return; }
  const hsv = rgbToHsv(rgb);
  const n = cloneState(state);
  n.hue = Math.round(hsv.h);
  const base = baseByHue(n.hue);
  const round = (n) => Math.round(Math.min(2, n) * 1e5) / 1e5;
  const target = [round(kFor(base.s, hsv.s)), round(kFor(base.v, hsv.v))];
  const from = valToPoint(state.vals[0]);
  const to = valToPoint(target);
  n.vals = state.vals.map((v, i) => {
    if (i === 0) return target;
    const q = valToPoint(v);
    return pointToVal({ x: q.x + to.x - from.x, y: q.y + to.y - from.y });
  });
  n.preset = 'custom';
  commit(n);
});

const sel = $('sel-preset');
for (const name of Object.keys(PRESETS)) {
  const o = document.createElement('option');
  o.value = name;
  o.textContent = name;
  sel.appendChild(o);
}
const custom = document.createElement('option');
custom.value = 'custom';
custom.textContent = 'custom';
sel.appendChild(custom);
sel.addEventListener('change', () => {
  if (sel.value === 'custom') return;
  const n = cloneState(state);
  n.preset = sel.value;
  n.vals = presetValues(sel.value);
  commit(n);
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
  n.model = MODELS[Math.floor(Math.random() * MODELS.length)];
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
