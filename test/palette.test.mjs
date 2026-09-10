import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState, schemeHues, schemeColors, withAngle, exportMarkdown, exportCss, exportJson, stateToHash, hashToState } from '../js/palette.js';

test('scheme hues per model', () => {
  const s = { ...defaultState(), hue: 10, angle: 30 };
  assert.deepEqual(schemeHues(s).map((c) => c.hue), [10]);
  assert.deepEqual(schemeHues({ ...s, compl: true }).map((c) => c.hue), [10, 190]);
  assert.deepEqual(schemeHues({ ...s, model: 'analog' }).map((c) => c.hue), [10, 40, 340]);
  assert.deepEqual(schemeHues({ ...s, model: 'triad' }).map((c) => c.hue), [10, 220, 160]);
  assert.deepEqual(schemeHues({ ...s, model: 'tetrad' }).map((c) => c.hue), [10, 40, 220, 190]);
});

test('angle past 90 swaps analog and triad', () => {
  const s = { ...defaultState(), model: 'analog', angle: 30 };
  const n = withAngle(s, 120);
  assert.equal(n.model, 'triad');
  assert.equal(n.angle, 60);
  assert.equal(withAngle(s, 2).angle, 5);
  assert.equal(withAngle(s, -40).angle, 40);
});

test('markdown export has a table per color and a css block', () => {
  const s = { ...defaultState(), model: 'triad' };
  const md = exportMarkdown(s, 'http://x/#h=0');
  assert.match(md, /^# Color palette/);
  assert.match(md, /## Primary/);
  assert.match(md, /## Secondary 2/);
  assert.match(md, /\| primary-0 \| `#aa3939` \| 170, 57, 57 \|/);
  assert.match(md, /--primary-0: #aa3939;/);
  assert.match(md, /```css/);
  assert.match(exportCss(s), /--secondary-1-4: #/);
  assert.equal(JSON.parse(exportJson(s)).primary[0], '#aa3939');
});

test('hash round trip', () => {
  const s = { ...defaultState(), hue: 200, model: 'tetrad', angle: 45, preset: 'dark' };
  s.vals[2] = [1.5, 0.25];
  const back = hashToState(stateToHash(s));
  assert.deepEqual(back, s);
  assert.deepEqual(hashToState(''), defaultState());
  assert.deepEqual(hashToState('#h=999&m=bogus&v=junk'), { ...defaultState(), hue: 359 });
});

test('five shades per color', () => {
  for (const c of schemeColors({ ...defaultState(), model: 'tetrad' })) {
    assert.equal(c.shades.length, 5);
    assert.match(c.shades[0].hex, /^#[0-9a-f]{6}$/);
  }
});
