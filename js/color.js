// Color math for the artistic (RYB) wheel used by Paletton.
// Wheel hue is 0-359 on the RYB wheel. It is not the HSV hue.

// Anchor colors around the wheel. `sv` is the full-strength saturation
// and brightness at that anchor. Green and blue anchors are darker so
// the wheel looks even to the eye.
const ANCHOR = {
  r:  { rgb: [255, 0, 0],     s: 1,    v: 1 },
  rg: { rgb: [255, 255, 0],   s: 1,    v: 1 },
  g:  { rgb: [0, 255, 0],     s: 1,    v: 0.8 },
  gb: { rgb: [0, 255, 255],   s: 1,    v: 0.6 },
  b:  { rgb: [0, 0, 255],     s: 0.85, v: 0.7 },
  br: { rgb: [255, 0, 255],   s: 1,    v: 0.65 },
};

const HALF_PI = Math.PI / 2;
const lerpA = (a, b, n) => (n === -1 ? a : a + (b - a) / (1 + n));
const lerpB = (a, b, n) => (n === -1 ? b : b + (a - b) / (1 + n));

// Each segment maps a hue range to a ratio `n` between the mid and
// min RGB channel. `order` places (max, mid, min) into (r, g, b).
const SEGMENTS = [
  {
    from: 0, to: 120, a: ANCHOR.r, b: ANCHOR.rg, lerp: lerpA, k: 0.5,
    f: (h) => (h === 0 ? -1 : Math.tan(((120 - h) / 120) * HALF_PI) * 0.5),
    fi: (n) => (n === -1 ? 0 : 120 - (Math.atan(n / 0.5) * 120) / HALF_PI),
    order: (mx, md, mn) => [mx, md, mn],
  },
  {
    from: 120, to: 180, a: ANCHOR.rg, b: ANCHOR.g, lerp: lerpB, k: 0.5,
    f: (h) => (h === 180 ? -1 : Math.tan(((h - 120) / 60) * HALF_PI) * 0.5),
    fi: (n) => (n === -1 ? 180 : 120 + (Math.atan(n / 0.5) * 60) / HALF_PI),
    order: (mx, md, mn) => [md, mx, mn],
  },
  {
    from: 180, to: 210, a: ANCHOR.g, b: ANCHOR.gb, lerp: lerpA, k: 0.75,
    f: (h) => (h === 180 ? -1 : Math.tan(((210 - h) / 30) * HALF_PI) * 0.75),
    fi: (n) => (n === -1 ? 180 : 210 - (Math.atan(n / 0.75) * 30) / HALF_PI),
    order: (mx, md, mn) => [mn, mx, md],
  },
  {
    from: 210, to: 255, a: ANCHOR.gb, b: ANCHOR.b, lerp: lerpB, k: 1.33,
    f: (h) => (h === 255 ? -1 : Math.tan(((h - 210) / 45) * HALF_PI) * 1.33),
    fi: (n) => (n === -1 ? 255 : 210 + (Math.atan(n / 1.33) * 45) / HALF_PI),
    order: (mx, md, mn) => [mn, md, mx],
  },
  {
    from: 255, to: 315, a: ANCHOR.b, b: ANCHOR.br, lerp: lerpA, k: 1.33,
    f: (h) => (h === 255 ? -1 : Math.tan(((315 - h) / 60) * HALF_PI) * 1.33),
    fi: (n) => (n === -1 ? 255 : 315 - (Math.atan(n / 1.33) * 60) / HALF_PI),
    order: (mx, md, mn) => [md, mn, mx],
  },
  {
    from: 315, to: 360, a: ANCHOR.br, b: ANCHOR.r, lerp: lerpB, k: 1.33,
    f: (h) => (h === 0 ? -1 : Math.tan(((h - 315) / 45) * HALF_PI) * 1.33),
    fi: (n) => (n === -1 ? 0 : 315 + (Math.atan(n / 1.33) * 45) / HALF_PI),
    order: (mx, md, mn) => [mx, mn, md],
  },
];

export function normHue(h) {
  h = h % 360;
  if (h < 0) h += 360;
  return h;
}

function segmentFor(h) {
  h = normHue(h);
  return SEGMENTS.find((s) => h >= s.from && h < s.to);
}

// Full-strength saturation and brightness for a wheel hue.
export function baseByHue(h) {
  h = normHue(h);
  const seg = segmentFor(h);
  const n = seg.f(h);
  return {
    h,
    s: seg.lerp(seg.a.s, seg.b.s, n),
    v: seg.lerp(seg.a.v, seg.b.v, n),
  };
}

// Wheel HSV to RGB (0-255 integers).
export function hsvToRgb({ h, s, v }) {
  h = normHue(h);
  const seg = segmentFor(h);
  const n = seg.f(h);
  const mx = 255 * v;
  const mn = mx * (1 - s);
  const md = n === -1 ? mn : (mx + mn * n) / (1 + n);
  const [r, g, b] = seg.order(mx, md, mn);
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

// RGB to wheel HSV.
export function rgbToHsv({ r, g, b }) {
  if (r === g && g === b) {
    return { h: 0, s: 0, v: (r * 0.299 + g * 0.587 + b * 0.114) / 255 };
  }
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  let md, seg;
  if (mx === r) {
    if (mn === b) { md = g; seg = SEGMENTS[0]; } else { md = b; seg = SEGMENTS[5]; }
  } else if (mx === g) {
    if (mn === r) { md = b; seg = SEGMENTS[2]; } else { md = r; seg = SEGMENTS[1]; }
  } else {
    if (mn === r) { md = g; seg = SEGMENTS[3]; } else { md = r; seg = SEGMENTS[4]; }
  }
  const n = md === mn ? -1 : (mx - md) / (md - mn);
  return { h: normHue(seg.fi(n)), s: (mx - mn) / mx, v: mx / 255 };
}

// Apply a shade multiplier (0-2) to a base saturation or brightness.
// Below 1 it scales toward 0. Above 1 it moves toward 1.
export function applyK(base, k) {
  return k <= 1 ? base * k : base + (1 - base) * (k - 1);
}

// Inverse of applyK: which multiplier turns `base` into `target`.
export function kFor(base, target) {
  if (base === 0) return 0;
  return target <= base ? target / base : (target - base) / (1 - base) + 1;
}

// A shade of a wheel hue: kS and kV are the multipliers.
export function shade(h, kS, kV) {
  const base = baseByHue(h);
  const hsv = { h: base.h, s: applyK(base.s, kS), v: applyK(base.v, kV) };
  return { hsv, rgb: hsvToRgb(hsv) };
}

export function toHex({ r, g, b }) {
  const p = (c) => c.toString(16).padStart(2, '0');
  return `#${p(r)}${p(g)}${p(b)}`;
}

export function fromHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Standard RGB to HSL, for export text only.
export function rgbToHsl({ r, g, b }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const mx = Math.max(rn, gn, bn), mn = Math.min(rn, gn, bn);
  const l = (mx + mn) / 2;
  if (mx === mn) return { h: 0, s: 0, l };
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (mx === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

export function luminance({ r, g, b }) {
  const f = (c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

// Black or white text that reads on this color.
export function textOn(rgb) {
  return luminance(rgb) > 0.4 ? '#000' : '#fff';
}
