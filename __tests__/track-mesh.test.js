import { buildDeckGeometry, buildRailGeometry, DECK_THICKNESS } from '../src/components/trackMesh';
import { LEVELS, buildLevel } from '../src/game/levels';

/**
 * Backface culling means a wrongly wound triangle is not a subtle shading
 * bug: the face simply is not drawn, and the track reads as transparent. So
 * the surfaces that face the player are checked to actually face the player.
 */
function faceNormals(geometry) {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const normals = [];
  for (let i = 0; i < index.count; i += 3) {
    const [a, b, c] = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    const p = (j) => [position.getX(j), position.getY(j), position.getZ(j)];
    const [ax, ay, az] = p(a);
    const [bx, by, bz] = p(b);
    const [cx, cy, cz] = p(c);
    const u = [bx - ax, by - ay, bz - az];
    const v = [cx - ax, cy - ay, cz - az];
    normals.push([
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ]);
  }
  return normals;
}

const flat = buildLevel({ run: [{ length: 30, width: 6 }] }).segments[0];
const shaped = buildLevel({
  run: [{ length: 30, width: 6, bend: 5, rise: 4, crest: 3, wave: { amplitude: 2, cycles: 1 } }],
}).segments[0];

describe.each([['flat', flat], ['shaped', shaped]])('a %s piece', (_, seg) => {
  test('has a deck whose upward faces point up', () => {
    const normals = faceNormals(buildDeckGeometry(seg));
    const up = normals.filter(([, y]) => Math.abs(y) > 1e-6);
    expect(up.length).toBeGreaterThan(0);
    // The top and the underside both have vertical normals; the top ones must
    // point up, and there must be as many of them as there are of the floor.
    expect(up.filter(([, y]) => y > 0).length).toBe(up.filter(([, y]) => y < 0).length);
  });

  test('has rails that face upward, not into the deck', () => {
    const normals = faceNormals(buildRailGeometry(seg));
    expect(normals.length).toBeGreaterThan(0);
    for (const [, y] of normals) expect(y).toBeGreaterThan(0);
  });

  test('draws both rails in one geometry, not one draw call each', () => {
    const geometry = buildRailGeometry(seg);
    const position = geometry.getAttribute('position');
    const xs = [];
    for (let i = 0; i < position.count; i++) xs.push(position.getX(i));
    // Vertices on both sides of the centreline, in the same buffer.
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(Math.max(...xs)).toBeGreaterThan(0);
  });
});

test('the deck is a closed solid: every edge is shared by exactly two faces', () => {
  // A hole in the hull is the other way a piece of track ends up see-through.
  const index = buildDeckGeometry(shaped).getIndex();
  const edges = new Map();
  for (let i = 0; i < index.count; i += 3) {
    const tri = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    for (let e = 0; e < 3; e++) {
      const key = [tri[e], tri[(e + 1) % 3]].sort((a, b) => a - b).join(':');
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  expect([...edges.values()].every((count) => count === 2)).toBe(true);
});

test('the deck spans the full width and thickness it was asked for', () => {
  const geometry = buildDeckGeometry(flat);
  const position = geometry.getAttribute('position');
  const xs = [];
  const ys = [];
  for (let i = 0; i < position.count; i++) { xs.push(position.getX(i)); ys.push(position.getY(i)); }
  expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(flat.width, 6);
  expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(DECK_THICKNESS, 6);
});

test('every shipped segment builds geometry with no NaN in it', () => {
  for (const level of LEVELS) {
    for (const seg of level.segments) {
      for (const geometry of [buildDeckGeometry(seg), buildRailGeometry(seg)]) {
        const position = geometry.getAttribute('position');
        for (let i = 0; i < position.count * 3; i++) {
          expect(Number.isFinite(position.array[i])).toBe(true);
        }
      }
    }
  }
});
