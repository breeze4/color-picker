// Scheme logic and export text. No DOM here.
import { normHue, shade, toHex, rgbToHsl } from './color.js';
import { presetValues, DEFAULT_PRESET, PRESETS } from './presets.js';

export const MODELS = ['mono', 'analog', 'triad', 'tetrad', 'free'];
export const SCHEME_MODELS = ['mono', 'analog', 'triad', 'tetrad'];
export const MIN_ANGLE = 5;
export const MAX_ANGLE = 175;

export const LABELS = {
  pri: 'Primary',
  sec1: 'Secondary 1',
  sec2: 'Secondary 2',
  compl: 'Complement',
};

export function defaultState() {
  return {
    hue: 0,
    model: 'mono',
    compl: false,
    angle: 30,
    preset: DEFAULT_PRESET,
    vals: presetValues(DEFAULT_PRESET),
    // Free mode only: absolute hues, or null when that color is absent.
    hues: null,
    // Free mode only: a shade set per accent color, or null to share `vals`.
    valsBy: null,
  };
}

const copyVals = (v) => (v ? v.map((p) => [...p]) : null);

export function cloneState(s) {
  return {
    ...s,
    vals: copyVals(s.vals),
    hues: s.hues ? { ...s.hues } : null,
    valsBy: s.valsBy ? Object.fromEntries(Object.entries(s.valsBy).map(([k, v]) => [k, copyVals(v)])) : null,
  };
}

// The five shade values that a color uses.
export function valsFor(s, id) {
  return (s.model === 'free' && s.valsBy?.[id]) || s.vals;
}

// Replace one color's shade values. Outside free mode every color shares.
export function withVals(s, id, vals) {
  const n = cloneState(s);
  if (s.model === 'free' && id !== 'pri' && n.hues?.[id] != null) {
    n.valsBy = { ...(n.valsBy ?? {}), [id]: copyVals(vals) };
  } else {
    n.vals = copyVals(vals);
  }
  return n;
}

// The hues in the scheme, in display order.
export function schemeHues(s) {
  const h = s.hue, a = s.angle;
  const out = [{ id: 'pri', hue: h }];
  if (s.model === 'free') {
    for (const id of ['sec1', 'sec2', 'compl']) {
      if (s.hues?.[id] != null) out.push({ id, hue: normHue(s.hues[id]) });
    }
    return out;
  }
  if (s.model === 'analog') {
    out.push({ id: 'sec1', hue: normHue(h + a) }, { id: 'sec2', hue: normHue(h - a) });
  } else if (s.model === 'triad') {
    out.push({ id: 'sec1', hue: normHue(h + 180 + a) }, { id: 'sec2', hue: normHue(h + 180 - a) });
  } else if (s.model === 'tetrad') {
    out.push({ id: 'sec1', hue: normHue(h + a) }, { id: 'sec2', hue: normHue(h + 180 + a) });
  }
  if (s.compl || s.model === 'tetrad') out.push({ id: 'compl', hue: normHue(h + 180) });
  return out;
}

// Every color with its five shades.
export function schemeColors(s) {
  return schemeHues(s).map((c) => ({
    ...c,
    label: LABELS[c.id],
    shades: valsFor(s, c.id).map(([kS, kV]) => {
      const sh = shade(c.hue, kS, kV);
      return { ...sh, hex: toHex(sh.rgb) };
    }),
  }));
}

// Set the angle. Past 90 degrees analog and triad trade places, so the
// dots keep moving where the pointer goes.
export function withAngle(s, angle) {
  const n = cloneState(s);
  if (s.model === 'free') return n;
  angle = Math.abs(angle);
  if (angle > 90 && (s.model === 'analog' || s.model === 'triad')) {
    n.model = s.model === 'analog' ? 'triad' : 'analog';
    angle = 180 - angle;
  }
  n.angle = Math.round(Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, angle)));
  return n;
}

// Unlock the scheme: keep the hues where they are, then let each move alone.
export function toFree(s) {
  if (s.model === 'free') return cloneState(s);
  const n = cloneState(s);
  const cur = Object.fromEntries(schemeHues(s).map((c) => [c.id, c.hue]));
  n.hues = { sec1: cur.sec1 ?? null, sec2: cur.sec2 ?? null, compl: cur.compl ?? null };
  n.valsBy = Object.fromEntries(['sec1', 'sec2', 'compl'].map((id) => [id, n.hues[id] == null ? null : copyVals(s.vals)]));
  n.model = 'free';
  return n;
}

// Lock back into a scheme. The free hues are dropped.
export function toModel(s, model) {
  const n = cloneState(s);
  n.model = model;
  n.hues = null;
  n.valsBy = null;
  return n;
}

// Set the base hue. In free mode the other hues turn with it.
export function withHue(s, hue) {
  const n = cloneState(s);
  hue = normHue(Math.round(hue));
  if (s.model === 'free') {
    const d = hue - s.hue;
    for (const id of Object.keys(n.hues)) {
      if (n.hues[id] != null) n.hues[id] = normHue(n.hues[id] + d);
    }
  }
  n.hue = hue;
  return n;
}

// Free mode: move one hue. Outside free mode this unlocks first.
export function withFreeHue(s, id, hue) {
  const n = toFree(s);
  n.hues[id] = normHue(Math.round(hue));
  return n;
}

// Add or remove the complement.
export function withCompl(s, on) {
  const n = cloneState(s);
  n.compl = on;
  if (s.model === 'free') {
    n.hues.compl = on ? (s.hues.compl ?? normHue(s.hue + 180)) : null;
    n.valsBy = { ...(n.valsBy ?? {}), compl: on ? (s.valsBy?.compl ?? copyVals(s.vals)) : null };
  }
  return n;
}

export function slug(label) {
  return label.toLowerCase().replace(/\s+/g, '-');
}

function hslText({ h, s, l }) {
  return `${Math.round(h)}°, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%`;
}

function cssBlock(colors) {
  const lines = [':root {'];
  for (const c of colors) {
    c.shades.forEach((sh, i) => lines.push(`  --${slug(c.label)}-${i}: ${sh.hex};`));
  }
  lines.push('}');
  return lines.join('\n');
}

export function exportMarkdown(s, url) {
  const colors = schemeColors(s);
  const model = s.model[0].toUpperCase() + s.model.slice(1);
  const out = ['# Color palette', ''];
  const angle = s.model === 'free' || s.model === 'mono' ? '' : ` · Angle: ${s.angle}°`;
  const compl = s.compl && s.model !== 'tetrad' && s.model !== 'free' ? ' + complement' : '';
  out.push(`Scheme: ${model}${compl} · Base hue: ${s.hue}°${angle} · Shades: ${s.preset}`);
  if (url) out.push('', `Edit: ${url}`);
  for (const c of colors) {
    out.push('', `## ${c.label}`, '', '| Shade | Hex | RGB | HSL |', '| --- | --- | --- | --- |');
    c.shades.forEach((sh, i) => {
      const { r, g, b } = sh.rgb;
      out.push(`| ${slug(c.label)}-${i} | \`${sh.hex}\` | ${r}, ${g}, ${b} | ${hslText(rgbToHsl(sh.rgb))} |`);
    });
  }
  out.push('', '## CSS', '', '```css', cssBlock(colors), '```', '');
  return out.join('\n');
}

export function exportCss(s) {
  return cssBlock(schemeColors(s)) + '\n';
}

export function exportJson(s) {
  const obj = {};
  for (const c of schemeColors(s)) {
    obj[slug(c.label)] = c.shades.map((sh) => sh.hex);
  }
  return JSON.stringify(obj, null, 2) + '\n';
}

// URL hash <-> state.
export function stateToHash(s) {
  const v = s.vals.map(([a, b]) => `${a},${b}`).join(';');
  const packVals = (vals) => vals.map(([a, b]) => `${a},${b}`).join(';');
  let f = '';
  if (s.model === 'free') {
    f = `&f=${['sec1', 'sec2', 'compl'].map((id) => s.hues[id] ?? '_').join(',')}`;
    for (const [id, key] of [['sec1', 'w1'], ['sec2', 'w2'], ['compl', 'wc']]) {
      if (s.valsBy?.[id]) f += `&${key}=${packVals(s.valsBy[id])}`;
    }
  }
  return `#h=${s.hue}&m=${s.model}&c=${s.compl ? 1 : 0}&a=${s.angle}&p=${s.preset}${f}&v=${v}`;
}

export function hashToState(hash) {
  const s = defaultState();
  if (!hash || hash.length < 2) return s;
  const q = new URLSearchParams(hash.slice(1));
  const num = (k, lo, hi, dflt) => {
    const n = Number(q.get(k));
    return Number.isFinite(n) && q.has(k) ? Math.min(hi, Math.max(lo, n)) : dflt;
  };
  s.hue = Math.round(num('h', 0, 359, 0));
  s.angle = Math.round(num('a', MIN_ANGLE, MAX_ANGLE, 30));
  s.model = MODELS.includes(q.get('m')) ? q.get('m') : 'mono';
  s.compl = q.get('c') === '1';
  s.preset = PRESETS[q.get('p')] ? q.get('p') : 'custom';
  const parseVals = (text) => {
    const v = (text ?? '').split(';').map((p) => p.split(',').map(Number));
    const ok = v.length === 5 && v.every((p) => p.length === 2 && p.every((n) => Number.isFinite(n) && n >= 0 && n <= 2));
    return ok ? v : null;
  };
  const v = parseVals(q.get('v'));
  if (v) {
    s.vals = v;
  } else {
    s.preset = PRESETS[s.preset] ? s.preset : DEFAULT_PRESET;
    s.vals = presetValues(s.preset);
  }
  if (s.model === 'free') {
    const f = (q.get('f') ?? '').split(',');
    const hue = (t) => (t === '_' || t === '' || !Number.isFinite(Number(t)) ? null : normHue(Math.round(Number(t))));
    s.hues = { sec1: hue(f[0]), sec2: hue(f[1]), compl: hue(f[2]) };
    s.compl = s.hues.compl != null;
    s.valsBy = {};
    for (const [id, key] of [['sec1', 'w1'], ['sec2', 'w2'], ['compl', 'wc']]) {
      s.valsBy[id] = s.hues[id] == null ? null : (parseVals(q.get(key)) ?? copyVals(s.vals));
    }
  }
  return s;
}
