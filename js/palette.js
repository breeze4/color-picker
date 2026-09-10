// Scheme logic and export text. No DOM here.
import { normHue, shade, toHex, rgbToHsl } from './color.js';
import { presetValues, DEFAULT_PRESET, PRESETS } from './presets.js';

export const MODELS = ['mono', 'analog', 'triad', 'tetrad'];
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
  };
}

export function cloneState(s) {
  return { ...s, vals: s.vals.map((v) => [...v]) };
}

// The hues in the scheme, in display order.
export function schemeHues(s) {
  const h = s.hue, a = s.angle;
  const out = [{ id: 'pri', hue: h }];
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
    shades: s.vals.map(([kS, kV]) => {
      const sh = shade(c.hue, kS, kV);
      return { ...sh, hex: toHex(sh.rgb) };
    }),
  }));
}

// Set the angle. Past 90 degrees analog and triad trade places, so the
// dots keep moving where the pointer goes.
export function withAngle(s, angle) {
  const n = cloneState(s);
  angle = Math.abs(angle);
  if (angle > 90 && (s.model === 'analog' || s.model === 'triad')) {
    n.model = s.model === 'analog' ? 'triad' : 'analog';
    angle = 180 - angle;
  }
  n.angle = Math.round(Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, angle)));
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
  out.push(`Scheme: ${model}${s.compl && s.model !== 'tetrad' ? ' + complement' : ''} · Base hue: ${s.hue}° · Angle: ${s.angle}° · Shades: ${s.preset}`);
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
  return `#h=${s.hue}&m=${s.model}&c=${s.compl ? 1 : 0}&a=${s.angle}&p=${s.preset}&v=${v}`;
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
  const v = (q.get('v') ?? '').split(';').map((p) => p.split(',').map(Number));
  if (v.length === 5 && v.every((p) => p.length === 2 && p.every((n) => Number.isFinite(n) && n >= 0 && n <= 2))) {
    s.vals = v;
  } else {
    s.preset = PRESETS[s.preset] ? s.preset : DEFAULT_PRESET;
    s.vals = presetValues(s.preset);
  }
  return s;
}
