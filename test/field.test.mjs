import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kToCoord, coordToK, valToPoint, pointToVal, limitToDisc } from '../js/field.js';

test('k to coordinate endpoints', () => {
  assert.equal(kToCoord(0), -1);
  assert.equal(kToCoord(1), 0.5);
  assert.equal(kToCoord(2), 1);
  for (const k of [0, 0.25, 1, 1.5, 2]) {
    assert.ok(Math.abs(coordToK(kToCoord(k)) - k) < 1e-9);
  }
});

test('value to point and back', () => {
  for (const v of [[0, 0], [2, 2], [1, 1], [0.66667, 0.66667], [0.2, 1.8], [2, 0]]) {
    const p = valToPoint(v);
    assert.ok(Math.hypot(p.x, p.y) <= 1 + 1e-9, `inside disc for ${v}`);
    const back = pointToVal(p);
    assert.ok(Math.abs(back[0] - v[0]) < 1e-4 && Math.abs(back[1] - v[1]) < 1e-4, `${v} -> ${back}`);
  }
});

test('square corners land on the disc edge', () => {
  const p = valToPoint([2, 2]);
  assert.ok(Math.abs(Math.hypot(p.x, p.y) - 1) < 1e-9);
});

test('limit keeps points in the disc', () => {
  const p = limitToDisc(3, 4);
  assert.ok(Math.abs(Math.hypot(p.x, p.y) - 1) < 1e-9);
  assert.deepEqual(limitToDisc(0.2, 0.1), { x: 0.2, y: 0.1 });
});
