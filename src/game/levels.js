/**
 * Level definitions.
 *
 * Every level is described in a fixed 100 x 100 "world" coordinate space and
 * scaled to whatever the device screen is at render time, so a level looks the
 * same on any display and none of the geometry below depends on pixels.
 *
 * walls    - axis-aligned rectangles the ball collides with
 * holes    - fall in and the level restarts
 * coins    - optional pickups, worth points
 * goal     - reach it to finish the level
 * parTime  - seconds; finishing under par is worth bonus points
 */

export const WORLD = 100;
export const BALL_RADIUS = 2.6;
export const GOAL_RADIUS = 5;
export const HOLE_RADIUS = 3.4;
export const COIN_RADIUS = 2;

const border = [
  { x: 0, y: 0, w: 100, h: 2 },
  { x: 0, y: 98, w: 100, h: 2 },
  { x: 0, y: 0, w: 2, h: 100 },
  { x: 98, y: 0, w: 2, h: 100 },
];

export const LEVELS = [
  {
    id: 1,
    name: 'First Roll',
    hint: 'Tilt to move. Reach the flag.',
    start: { x: 15, y: 15 },
    goal: { x: 85, y: 85 },
    walls: [...border],
    holes: [],
    coins: [{ x: 50, y: 50 }],
    parTime: 12,
  },
  {
    id: 2,
    name: 'Doorway',
    hint: 'A wall splits the room. Find the gap.',
    start: { x: 15, y: 50 },
    goal: { x: 85, y: 50 },
    walls: [...border, { x: 49, y: 2, w: 3, h: 38 }, { x: 49, y: 60, w: 3, h: 38 }],
    holes: [],
    coins: [{ x: 50, y: 20 }, { x: 50, y: 80 }],
    parTime: 16,
  },
  {
    id: 3,
    name: 'Mind the Gap',
    hint: 'Holes reset the level. Steer around them.',
    start: { x: 12, y: 12 },
    goal: { x: 88, y: 88 },
    walls: [...border, { x: 30, y: 30, w: 40, h: 3 }, { x: 30, y: 67, w: 40, h: 3 }],
    holes: [{ x: 50, y: 50 }, { x: 25, y: 75 }, { x: 75, y: 25 }],
    coins: [{ x: 20, y: 50 }, { x: 80, y: 50 }],
    parTime: 22,
  },
  {
    id: 4,
    name: 'Switchback',
    hint: 'Three corridors. No shortcuts.',
    start: { x: 8, y: 8 },
    goal: { x: 88, y: 88 },
    walls: [
      ...border,
      { x: 2, y: 26, w: 74, h: 3 },
      { x: 24, y: 50, w: 74, h: 3 },
      { x: 2, y: 74, w: 74, h: 3 },
    ],
    holes: [{ x: 84, y: 38 }, { x: 16, y: 62 }],
    coins: [{ x: 88, y: 14 }, { x: 12, y: 38 }, { x: 88, y: 62 }],
    parTime: 30,
  },
  {
    id: 5,
    name: 'The Spiral',
    hint: 'All the way in, then all the way out.',
    start: { x: 50, y: 6 },
    goal: { x: 50, y: 50 },
    walls: [
      ...border,
      { x: 14, y: 14, w: 72, h: 3 },
      { x: 14, y: 14, w: 3, h: 58 },
      { x: 14, y: 69, w: 58, h: 3 },
      { x: 69, y: 28, w: 3, h: 44 },
      { x: 28, y: 28, w: 44, h: 3 },
      { x: 28, y: 28, w: 3, h: 30 },
      { x: 28, y: 55, w: 30, h: 3 },
      { x: 55, y: 41, w: 3, h: 17 },
    ],
    holes: [{ x: 22, y: 22 }, { x: 78, y: 78 }, { x: 22, y: 78 }],
    coins: [{ x: 90, y: 8 }, { x: 8, y: 90 }, { x: 62, y: 36 }],
    parTime: 45,
  },
];

export function getLevel(id) {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`No level with id ${id}`);
  return level;
}

export const LEVEL_COUNT = LEVELS.length;
