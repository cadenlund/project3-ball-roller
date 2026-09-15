import { MAX_SPEED, STATUS, createGameState, respawn, step } from '../src/game/engine';
import { BALL_RADIUS, LEVELS, WORLD, getLevel } from '../src/game/levels';

const L1 = getLevel(1);
const NONE = { x: 0, y: 0 };
const dt = 1 / 60;

const run = (level, tilt, frames, state = createGameState(level)) => {
  let s = state;
  for (let i = 0; i < frames; i++) s = step(s, level, typeof tilt === 'function' ? tilt(s) : tilt, dt);
  return s;
};

test('a new game starts at the level start, still and unscored', () => {
  const s = createGameState(L1);
  expect([s.x, s.y]).toEqual([L1.start.x, L1.start.y]);
  expect([s.vx, s.vy]).toEqual([0, 0]);
  expect(s.status).toBe(STATUS.PLAYING);
  expect(s.falls).toBe(0);
});

test('step does not mutate the state it is given', () => {
  const s = createGameState(L1);
  const before = JSON.parse(JSON.stringify(s));
  step(s, L1, { x: 1, y: 1 }, dt);
  expect(s).toEqual(before);
});

test('tilting moves the ball in that direction', () => {
  const s = run(L1, { x: 1, y: 0 }, 30);
  expect(s.x).toBeGreaterThan(L1.start.x);
});

test('friction brings a rolling ball to rest', () => {
  const moving = run(L1, { x: 1, y: 0 }, 30);
  const coasting = run(L1, NONE, 600, moving);
  expect(Math.hypot(coasting.vx, coasting.vy)).toBeLessThan(1);
});

test('speed is capped', () => {
  let s = createGameState(L1);
  for (let i = 0; i < 600; i++) {
    s = step(s, L1, { x: 1, y: 1 }, dt);
    expect(Math.hypot(s.vx, s.vy)).toBeLessThanOrEqual(MAX_SPEED + 1e-6);
  }
});

test('the ball never leaves the world, whatever it is told to do', () => {
  let s = createGameState(getLevel(4));
  const level = getLevel(4);
  for (let i = 0; i < 1200; i++) {
    const tilt = { x: Math.sin(i / 7), y: Math.cos(i / 11) };
    s = step(s, level, tilt, dt);
    expect(s.x).toBeGreaterThanOrEqual(BALL_RADIUS - 1e-6);
    expect(s.x).toBeLessThanOrEqual(WORLD - BALL_RADIUS + 1e-6);
    expect(s.y).toBeGreaterThanOrEqual(BALL_RADIUS - 1e-6);
    expect(s.y).toBeLessThanOrEqual(WORLD - BALL_RADIUS + 1e-6);
  }
});

test('walls block the ball instead of letting it pass through', () => {
  // Level 2's divider has a doorway at y 40-60, so aim at the solid part.
  const level = getLevel(2);
  const start = { ...createGameState(level), y: 20 };
  const s = run(level, { x: 1, y: 0 }, 240, start);
  expect(s.x).toBeLessThan(49); // never crossed into the right half
});

test('the doorway in level 2 is passable', () => {
  const level = getLevel(2);
  const s = run(level, { x: 1, y: 0 }, 240); // starts at y 50, in the gap
  expect(s.x).toBeGreaterThan(52);
});

test('reaching the goal finishes the level', () => {
  const level = getLevel(1);
  const s = run(level, { x: 1, y: 1 }, 1200);
  expect(s.status).toBe(STATUS.FINISHED);
});

test('a finished level ignores further input', () => {
  const finished = run(getLevel(1), { x: 1, y: 1 }, 1200);
  expect(step(finished, L1, { x: -1, y: -1 }, dt)).toBe(finished);
});

test('rolling over a coin collects it, once', () => {
  const level = getLevel(1);
  const s = run(level, { x: 1, y: 1 }, 1200);
  expect(s.coins.filter(Boolean).length).toBeGreaterThan(0);
});

test('falling in a hole stops play, and respawn puts the ball back', () => {
  const level = {
    ...getLevel(1),
    holes: [{ x: 30, y: 15 }],
    goal: { x: 95, y: 95 },
  };
  const fell = run(level, { x: 1, y: 0 }, 600);
  expect(fell.status).toBe(STATUS.FELL);

  const back = respawn(fell, level);
  expect([back.x, back.y]).toEqual([level.start.x, level.start.y]);
  expect([back.vx, back.vy]).toEqual([0, 0]);
  expect(back.status).toBe(STATUS.PLAYING);
  expect(back.falls).toBe(1);
});

test('time advances with the simulation', () => {
  const s = run(L1, NONE, 60);
  expect(s.time).toBeCloseTo(1, 1);
});

test.each(LEVELS.map((l) => l.id))('level %i can be simulated without blowing up', (id) => {
  const level = getLevel(id);
  let s = createGameState(level);
  for (let i = 0; i < 900; i++) {
    s = step(s, level, { x: Math.sin(i / 13), y: Math.cos(i / 9) }, dt);
    expect(Number.isFinite(s.x)).toBe(true);
    expect(Number.isFinite(s.y)).toBe(true);
    if (s.status === STATUS.FELL) s = respawn(s, level);
  }
});
