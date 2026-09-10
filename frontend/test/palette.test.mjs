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

test('free mode keeps the hues and lets each move alone', async () => {
  const { toFree, toModel, withHue, withFreeHue, withCompl } = await import('../js/palette.js');
  const s = { ...defaultState(), hue: 10, angle: 30, model: 'triad' };
  const f = toFree(s);
  assert.equal(f.model, 'free');
  assert.deepEqual(f.hues, { sec1: 220, sec2: 160, compl: null });
  assert.deepEqual(schemeHues(f).map((c) => c.hue), [10, 220, 160]);
  // one hue moves alone
  const m = withFreeHue(f, 'sec1', 300);
  assert.deepEqual(schemeHues(m).map((c) => c.hue), [10, 300, 160]);
  // dragging the complement from a locked scheme unlocks it
  const c = withFreeHue({ ...s, compl: true }, 'compl', 200);
  assert.equal(c.model, 'free');
  assert.deepEqual(schemeHues(c).map((c) => c.hue), [10, 220, 160, 200]);
  // the base hue turns everything
  const r = withHue(c, 20);
  assert.deepEqual(schemeHues(r).map((c) => c.hue), [20, 230, 170, 210]);
  // complement toggle in free mode
  assert.equal(schemeHues(withCompl(c, false)).length, 3);
  assert.equal(schemeHues(withCompl(withCompl(c, false), true)).at(-1).hue, 190);
  // a scheme button locks it again
  const back = toModel(c, 'mono');
  assert.equal(back.model, 'mono');
  assert.equal(back.hues, null);
  assert.deepEqual(schemeHues(back).map((c) => c.hue), [10, 190]);
  // angle changes do nothing in free mode
  assert.equal(withAngle(c, 80).model, 'free');
});

test('free mode hash round trip', async () => {
  const { toFree } = await import('../js/palette.js');
  const f = toFree({ ...defaultState(), hue: 10, model: 'analog', compl: true });
  f.hues.sec2 = null;
  f.valsBy.sec2 = null;
  const back = hashToState(stateToHash(f));
  assert.deepEqual(back, f);
  assert.match(stateToHash(f), /&f=40,_,190&/);
});

test('free mode gives each color its own shade set', async () => {
  const { toFree, toModel, withVals, valsFor, withCompl } = await import('../js/palette.js');
  const s = { ...defaultState(), hue: 10, model: 'analog', compl: true };
  const f = toFree(s);
  // entering free mode copies the shared set to every present color
  assert.deepEqual(f.valsBy.sec1, s.vals);
  assert.deepEqual(f.valsBy.compl, s.vals);
  assert.notEqual(f.valsBy.sec1, f.vals);
  // one color changes alone
  const custom = [[1, 1], [0.5, 1], [0.7, 1], [1, 0.7], [1, 0.4]];
  const m = withVals(f, 'sec1', custom);
  assert.deepEqual(valsFor(m, 'sec1'), custom);
  assert.deepEqual(valsFor(m, 'pri'), s.vals);
  assert.deepEqual(valsFor(m, 'sec2'), s.vals);
  const colors = Object.fromEntries(schemeColors(m).map((c) => [c.id, c]));
  assert.notEqual(colors.sec1.shades[0].hex, colors.pri.shades[0].hex.replace('x', 'y'));
  assert.equal(colors.sec1.shades[0].hex, schemeColors({ ...m, vals: custom }).find((c) => c.id === 'sec1').shades[0].hex);
  // the primary set is the shared one
  const p = withVals(m, 'pri', custom);
  assert.deepEqual(p.vals, custom);
  assert.deepEqual(valsFor(p, 'sec2'), s.vals);
  // outside free mode a change is shared
  const shared = withVals(s, 'sec1', custom);
  assert.deepEqual(shared.vals, custom);
  assert.equal(shared.valsBy, null);
  // removing and adding the complement resets its set from the primary
  const noc = withCompl(m, false);
  assert.equal(noc.valsBy.compl, null);
  assert.deepEqual(withCompl(noc, true).valsBy.compl, s.vals);
  // locking drops the per-color sets
  assert.equal(toModel(m, 'triad').valsBy, null);
  // hash round trip keeps the sets
  assert.deepEqual(hashToState(stateToHash(m)), m);
  assert.match(stateToHash(m), /&w1=1,1;0.5,1;/);
});
