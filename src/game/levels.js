/**
 * Level definitions.
 *
 * A level is a narrow track floating in space, running along the +Z axis.
 * The ball rolls forward on its own; the player steers left and right and
 * tries not to fall off the sides.
 *
 * Levels are authored as a `run`: an ordered list of track pieces, each with
 * a length, a width and a lateral offset `x`, optionally followed by a `gap`
 * of empty space. `buildLevel` turns that into the absolute segment spans the
 * engine and the renderer share, so a level reads as one list, not a pile of
 * coordinates.
 *
 * pads     - bounce pads; roll over one to launch and clear the next gap
 * spinners - bars that sweep the track and shove the ball sideways
 * coins    - optional pickups, worth points
 * goalZ    - cross this line to finish (computed: near the end of the run)
 * speed    - the ball's cruising speed, world units/s
 * parTime  - seconds; finishing under par is worth bonus points
 */

export const BALL_RADIUS = 0.5;
export const COIN_RADIUS = 0.9;
export const PAD_RADIUS = 1.6;
export const SPINNER_HALF_WIDTH = 0.35;
export const SPINNER_HEIGHT = 1.6; // a launched ball flies clear above this
export const FALL_Y = -7;          // below this the ball has fallen off

/** Expand a raw level into segments with absolute spans, plus start/goal. */
export function buildLevel(raw) {
  const segments = [];
  let z = 0;
  for (const piece of raw.run) {
    segments.push({ z0: z, z1: z + piece.length, x: piece.x ?? 0, width: piece.width });
    z += piece.length + (piece.gap ?? 0);
  }
  const last = segments[segments.length - 1];
  return {
    pads: [],
    spinners: [],
    coins: [],
    ...raw,
    segments,
    totalLength: z,
    goalZ: raw.goalZ ?? last.z1 - 2,
    start: { x: segments[0].x, z: 3 },
  };
}

/** The track segment under (x, z), or null - null underfoot means falling. */
export function segmentAt(level, x, z) {
  return (
    level.segments.find(
      (s) => z >= s.z0 && z <= s.z1 && Math.abs(x - s.x) <= s.width / 2 + BALL_RADIUS * 0.4
    ) ?? null
  );
}

export const LEVELS = [
  {
    id: 1,
    name: 'First Roll',
    hint: 'Tilt to steer. Stay on the track.',
    speed: 10,
    parTime: 14,
    run: [
      { length: 26, width: 6 },
      { length: 22, width: 6, x: 2 },
      { length: 22, width: 6, x: -2 },
      { length: 30, width: 6 },
    ],
    coins: [{ z: 52, x: -1 }],
  },
  {
    id: 2,
    name: 'The Narrows',
    hint: 'The track thins out. Small corrections.',
    speed: 11,
    parTime: 17,
    run: [
      { length: 20, width: 6 },
      { length: 20, width: 4.4, x: 2 },
      { length: 20, width: 4.4, x: -2 },
      { length: 18, width: 3.2 },
      { length: 20, width: 2.6, x: 1.5 },
      { length: 24, width: 3.6 },
    ],
    coins: [{ z: 30, x: 3.6 }, { z: 50, x: -3.6 }],
  },
  {
    id: 3,
    name: 'Mind the Gap',
    hint: 'Orange pads launch you. Hit every one.',
    speed: 11,
    parTime: 24,
    run: [
      { length: 30, width: 5, gap: 4 },
      { length: 26, width: 5, gap: 4.5 },
      { length: 26, width: 5, gap: 4 },
      { length: 34, width: 5 },
    ],
    pads: [
      { z: 29, x: 0, power: 20 },
      { z: 59, x: 0, power: 20 },
      { z: 89.5, x: 0, power: 20 },
    ],
    coins: [{ z: 32, x: 0, y: 1.8 }, { z: 62.2, x: 0, y: 1.8 }],
  },
  {
    id: 4,
    name: 'Spin Cycle',
    hint: 'Time your way past the bars.',
    speed: 12,
    parTime: 26,
    run: [{ length: 150, width: 5.4 }],
    spinners: [
      { z: 45, x: 0, length: 5, speed: 2.4, phase: 0 },
      { z: 85, x: 0, length: 5.6, speed: -2.8, phase: 1.3 },
      { z: 120, x: 0, length: 6, speed: 3.2, phase: 2.1 },
    ],
    coins: [{ z: 65, x: 1.8 }, { z: 103, x: -1.8 }],
  },
  {
    id: 5,
    name: 'The Gauntlet',
    hint: 'Everything at once. Good luck.',
    speed: 12,
    parTime: 32,
    run: [
      { length: 30, width: 5 },
      { length: 25, width: 3.4, x: 1 },
      { length: 25, width: 3.4, x: -2, gap: 4.5 },
      { length: 30, width: 4.6 },
      { length: 26, width: 3, x: 1.5, gap: 4.5 },
      { length: 30, width: 4.6 },
      { length: 24, width: 2.6 },
      { length: 20, width: 6 },
    ],
    pads: [
      { z: 79, x: -2, power: 20 },
      { z: 139.5, x: 1.5, power: 20 },
    ],
    spinners: [
      { z: 100, x: 0, length: 5, speed: 2.6, phase: 0 },
      { z: 160, x: 0, length: 5.2, speed: -3, phase: 0.8 },
    ],
    coins: [{ z: 82, x: -2, y: 1.8 }, { z: 107, x: 1.6 }, { z: 187, x: 0 }],
  },
].map(buildLevel);

export function getLevel(id) {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`No level with id ${id}`);
  return level;
}

export const LEVEL_COUNT = LEVELS.length;
