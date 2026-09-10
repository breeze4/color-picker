import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseByHue, hsvToRgb, rgbToHsv, shade, toHex, fromHex, kFor, applyK } from '../js/color.js';
import { PRESETS } from '../js/presets.js';

// Reference vectors read from paletton.com's own color.wheel module.
const REF = [
  [30, 1, 1, 255, 116, 0],
  [60, 1, 1, 255, 170, 0],
  [100, 1, 1, 255, 225, 0],
  [150, 1, 0.9333333333333333, 159, 238, 0],
  [200, 1, 0.6604338958503925, 0, 168, 118],
  [240, 0.8954046337358049, 0.66973024417613, 18, 64, 171],
  [280, 0.9048789239143661, 0.681707025361878, 74, 17, 174],
  [340, 1, 0.8646051722609669, 220, 0, 85],
];

test('base color by hue matches Paletton', () => {
  for (const [h, s, v, r, g, b] of REF) {
    const base = baseByHue(h);
    assert.ok(Math.abs(base.s - s) < 1e-9, `s at ${h}`);
    assert.ok(Math.abs(base.v - v) < 1e-9, `v at ${h}`);
    assert.deepEqual(hsvToRgb(base), { r, g, b }, `rgb at ${h}`);
  }
});

test('default preset shades of red match Paletton palette', () => {
  const want = ['#aa3939', '#ffaaaa', '#d46a6a', '#801515', '#550000'];
  PRESETS.default.forEach(([kS, kV], i) => {
    assert.equal(toHex(shade(0, kS, kV).rgb), want[i]);
  });
});

test('rgbToHsv inverts hsvToRgb across the wheel', () => {
  for (let h = 0; h < 360; h += 7) {
    for (const [kS, kV] of [[1, 1], [0.7, 0.9], [0.4, 1.3]]) {
      const { hsv, rgb } = shade(h, kS, kV);
      const back = rgbToHsv(rgb);
      const dh = Math.min(Math.abs(back.h - hsv.h), 360 - Math.abs(back.h - hsv.h));
      assert.ok(dh < 2.5, `hue ${h} k=${kS},${kV}: got ${back.h}`);
      assert.ok(Math.abs(back.v - hsv.v) < 0.01, `v at ${h}`);
      assert.ok(Math.abs(back.s - hsv.s) < 0.02, `s at ${h}`);
    }
  }
});

test('kFor inverts applyK', () => {
  for (const base of [0.3, 0.7, 1]) {
    for (const k of [0, 0.5, 1, 1.5, 2]) {
      // At base 1 every k above 1 maps to 1, so only k <= 1 inverts.
      if (base === 1 && k > 1) continue;
      assert.ok(Math.abs(kFor(base, applyK(base, k)) - k) < 1e-9, `base ${base} k ${k}`);
    }
  }
});

test('hex round trip', () => {
  assert.deepEqual(fromHex('#AA3939'), { r: 170, g: 57, b: 57 });
  assert.equal(toHex(fromHex('aa3939')), '#aa3939');
  assert.equal(fromHex('nope'), null);
});
