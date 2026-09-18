/**
 * Level definitions.
 *
 * A level is a narrow track floating in space, running along the +Z axis.
 * The ball rolls forward on its own; the player steers left and right and
 * tries not to fall off the sides.
 *
 * Levels are authored as a `run`: an ordered list of track pieces, each with
 * a length, a width and a lateral offset `x`, optionally followed by a `gap`
 * of empty space. A piece may also carry `moving: { amplitude, speed, phase }`
 * to slide side to side, so the safe line shifts under the player.
 * `buildLevel` turns that into the absolute segment spans the engine and the
 * renderer share, so a level reads as one list, not a pile of coordinates.
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

/** Shared semantic colors, also available to menu cards and future levels. */
export const DEFAULT_THEME = Object.freeze({
  background: '#171025', fog: '#171025', track: '#785470', trackGlow: '#382139',
  edge: '#f9b8ce', accent: '#f9b8ce', pad: '#ffb44c', padGlow: '#e87129',
  spinner: '#ff655e', spinnerGlow: '#9c2637', coin: '#ffe38c', coinGlow: '#f5a636',
  ball: '#fff4e6', ballGlow: '#ffb477', goal: '#85f5dd', goalGlow: '#28a894',
  keyLight: '#ffe1cb', rimLight: '#d5acff',
});

const LEVEL_THEMES = [
  {}, // dusk rose
  { background: '#08182a', fog: '#08182a', track: '#345d82', trackGlow: '#183655',
    edge: '#9edfff', accent: '#9edfff', ballGlow: '#9edfff', keyLight: '#d9eeff', rimLight: '#80bfff' },
  { background: '#082420', fog: '#082420', track: '#397b70', trackGlow: '#16453f',
    edge: '#a2f7dc', accent: '#a2f7dc', ballGlow: '#89eacd', goal: '#e7ff9b', keyLight: '#dcffe9', rimLight: '#7bdad0' },
  { background: '#2a1020', fog: '#2a1020', track: '#884660', trackGlow: '#4d2038',
    edge: '#ffc1a4', accent: '#ffc1a4', spinner: '#ff8e63', spinnerGlow: '#bb432d', ballGlow: '#ffc1a4', keyLight: '#ffe0bc', rimLight: '#fa9fb4' },
  { background: '#11112e', fog: '#11112e', track: '#595084', trackGlow: '#302552',
    edge: '#d2c2ff', accent: '#d2c2ff', pad: '#ffc266', coin: '#fff0a6', ballGlow: '#cdb1ff', keyLight: '#f1dcff', rimLight: '#9ba7ff' },
  // 6 - deep sea: the sliding decks read best over cold, empty water.
  { background: '#04242c', fog: '#04242c', track: '#2e6b78', trackGlow: '#123a44',
    edge: '#9ff0ff', accent: '#9ff0ff', ballGlow: '#9ff0ff', goal: '#c7ff8f', keyLight: '#dbfaff', rimLight: '#6fd2e8' },
  // 7 - ultraviolet: hot magenta hazards against a bruised purple void.
  { background: '#25082c', fog: '#25082c', track: '#7a3182', trackGlow: '#431349',
    edge: '#f6b6ff', accent: '#f6b6ff', spinner: '#ff5fa8', spinnerGlow: '#a3115a',
    ballGlow: '#f6b6ff', keyLight: '#ffdcff', rimLight: '#c07dff' },
  // 8 - midnight gold: the finale, cold and dark with everything gilded.
  { background: '#0b1020', fog: '#0b1020', track: '#44507e', trackGlow: '#222a4d',
    edge: '#ffd98a', accent: '#ffd98a', pad: '#ffd166', coin: '#fff4b0',
    ballGlow: '#ffd98a', goal: '#7cf2c9', keyLight: '#fff0d0', rimLight: '#8fa6ff' },
];

/** Expand a raw level into segments with absolute spans, plus start/goal. */
export function buildLevel(raw) {
  const segments = [];
  let z = 0;
  for (const piece of raw.run) {
    segments.push({
      z0: z, z1: z + piece.length, x: piece.x ?? 0, width: piece.width,
      ...(piece.moving ? { moving: piece.moving } : {}),
    });
    z += piece.length + (piece.gap ?? 0);
  }
  const last = segments[segments.length - 1];
  return {
    pads: [],
    spinners: [],
    coins: [],
    ...raw,
    theme: { ...DEFAULT_THEME, ...LEVEL_THEMES[raw.id - 1], ...raw.theme },
    segments,
    totalLength: z,
    goalZ: raw.goalZ ?? last.z1 - 2,
    // Where the first segment actually is at t=0, not where it was authored:
    // a level opening on a moving platform would otherwise spawn the ball
    // beside the deck rather than on it.
    start: { x: segmentCenter(segments[0], 0), z: 3 },
  };
}

/**
 * How far a segment has slid sideways from its authored x at `time`. Zero for
 * ordinary track; a moving platform swings as a sine so it is continuous,
 * reversible and identical on every replay of the same moment.
 */
export function segmentShift(seg, time) {
  if (!seg.moving) return 0;
  const { amplitude, speed, phase = 0 } = seg.moving;
  return amplitude * Math.sin(phase + speed * time);
}

/** Where a segment's centre actually is at `time`. */
export function segmentCenter(seg, time) {
  return seg.x + segmentShift(seg, time);
}

/**
 * The track segment under (x, z) at `time`, or null - null underfoot means
 * falling. `time` only matters where a level uses moving platforms.
 */
export function segmentAt(level, x, z, time = 0) {
  return (
    level.segments.find(
      (s) =>
        z >= s.z0 && z <= s.z1 &&
        Math.abs(x - segmentCenter(s, time)) <= s.width / 2 + BALL_RADIUS * 0.4
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
    parTime: 16,
    run: [
      { length: 20, width: 6 },
      { length: 20, width: 4.4, x: 2 },
      { length: 20, width: 4.4, x: -2 },
      { length: 18, width: 3.2 },
      { length: 20, width: 2.6, x: 1.5 },
      { length: 24, width: 3.6 },
    ],
    coins: [{ z: 30, x: 2.6 }, { z: 50, x: -2.6 }],
  },
  {
    id: 3,
    name: 'Mind the Gap',
    hint: 'Orange pads launch you. Hit every one.',
    speed: 11,
    parTime: 21,
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
    parTime: 25,
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
  {
    id: 6,
    name: 'Sidewinder',
    hint: 'The track slides. Ride it, do not fight it.',
    speed: 12,
    parTime: 21,
    run: [
      { length: 26, width: 5 },
      { length: 30, width: 4.5, moving: { amplitude: 3, speed: 1.1, phase: 0 } },
      { length: 24, width: 5 },
      { length: 30, width: 4, moving: { amplitude: 3.5, speed: 1.4, phase: 1.6 } },
      { length: 28, width: 5.5 },
    ],
    // Parked over the authored centre line, so each one is only reachable as
    // its deck swings back through the middle.
    coins: [{ z: 40, x: 0 }, { z: 95, x: 0 }, { z: 126, x: 0 }],
  },
  {
    id: 7,
    name: 'Crossfire',
    hint: 'Narrow lanes, and something sweeping every one of them.',
    speed: 12,
    parTime: 23,
    run: [
      { length: 30, width: 5 },
      { length: 26, width: 3.2 },
      { length: 30, width: 4.5, moving: { amplitude: 2.5, speed: 1.3, phase: 0.5 } },
      { length: 26, width: 3 },
      { length: 24, width: 5.5 },
    ],
    spinners: [
      { z: 20, x: 0, length: 5, speed: 2.6, phase: 0 },
      { z: 44, x: 0, length: 4.5, speed: -3, phase: 1.1 },
      { z: 99, x: 0, length: 4.5, speed: 3.2, phase: 2 },
    ],
    coins: [{ z: 70, x: 0 }, { z: 122, x: 1.5 }],
  },
  {
    id: 8,
    name: 'The Long Way Home',
    hint: 'Gaps, bars and sliding ground. Everything you know.',
    speed: 13,
    parTime: 32,
    run: [
      { length: 28, width: 5 },
      { length: 26, width: 3.4, x: 2, gap: 4.5 },
      { length: 30, width: 4.8 },
      { length: 30, width: 4.2, moving: { amplitude: 3, speed: 1.5, phase: 0.3 } },
      { length: 26, width: 3.2 },
      { length: 28, width: 4.6, moving: { amplitude: 3.5, speed: -1.8, phase: 2.2 } },
      { length: 26, width: 5.2 },
    ],
    pads: [{ z: 53, x: 2, power: 20 }],
    spinners: [
      { z: 20, x: 0, length: 5, speed: 2.8, phase: 0 },
      { z: 75, x: 0, length: 4.5, speed: 2.4, phase: 0.6 },
      { z: 132, x: 0, length: 4.5, speed: -3.2, phase: 1.4 },
    ],
    coins: [{ z: 56, x: 2, y: 1.8 }, { z: 103, x: 0 }, { z: 160, x: 0 }, { z: 190, x: 0 }],
  },
].map(buildLevel);

export function getLevel(id) {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`No level with id ${id}`);
  return level;
}

export const LEVEL_COUNT = LEVELS.length;
