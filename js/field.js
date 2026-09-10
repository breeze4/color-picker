// Geometry of the inner disc. Shade values [kS, kV] (each 0-2) map to
// a point in a unit disc. The square of values is stretched to fill
// the disc, so the corners of the value square touch the disc edge.

const T = 0.5; // k = 1 sits at coordinate 0.5, so the 0-1 range gets more room.

export function kToCoord(k) {
  return k < 1 ? k * (T + 1) - 1 : (k - 1) * (1 - T) + T;
}

export function coordToK(c) {
  return c < T ? (c + 1) / (T + 1) : (c - T) / (1 - T) + 1;
}

function stretch(x, y) {
  if (x === 0 && y === 0) return 1;
  const t = Math.atan2(y, x);
  return Math.max(Math.abs(Math.cos(t)), Math.abs(Math.sin(t)));
}

export function squareToDisc(x, y) {
  const m = stretch(x, y);
  return { x: x * m, y: y * m };
}

export function discToSquare(x, y) {
  const m = stretch(x, y);
  return { x: x / m, y: y / m };
}

// Keep a point inside the unit disc.
export function limitToDisc(x, y) {
  const r = Math.hypot(x, y);
  if (r <= 1) return { x, y };
  return { x: x / r, y: y / r };
}

// Disc coordinates: x right = more saturated, y up = brighter.
export function valToPoint([kS, kV]) {
  return squareToDisc(kToCoord(kS), -kToCoord(kV));
}

export function pointToVal({ x, y }) {
  const p = limitToDisc(x, y);
  const sq = discToSquare(p.x, p.y);
  const round = (n) => Math.round(n * 1e5) / 1e5;
  return [round(coordToK(sq.x)), round(coordToK(-sq.y))];
}
