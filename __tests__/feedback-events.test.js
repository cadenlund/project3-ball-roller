import { createGameState, step, respawn, STATUS } from '../src/game/engine';
import { BALL_RADIUS, getLevel, heightAt, segmentAt } from '../src/game/levels';

const dt = 1 / 60;
const tilt = { x: 0, y: 0 };

/**
 * Park the ball on the deck at a prop's position. Everything a level is made
 * of now sits on a track that bends and climbs, so tests say "on top of that
 * pad" rather than naming a coordinate the next edit will move.
 */
const at = (level, thing, extra = {}) => {
  const seg = segmentAt(level, thing.x, thing.z);
  return {
    ...createGameState(level),
    x: thing.x,
    z: thing.z,
    y: (seg ? heightAt(seg, thing.z) : 0) + BALL_RADIUS,
    ...extra,
  };
};

test('coin pickup emits once and does not mutate prior state', () => {
  const level = getLevel(1);
  const coin = level.coins[0];
  const before = { ...at(level, coin), y: coin.y };
  const after = step(before, level, tilt, dt);
  expect(after.events).toContainEqual({ type: 'coin', index: 0 });
  expect(before.coins[0]).toBe(false);
  expect(step(after, level, tilt, dt).events).toEqual([]);
});

test('pad launches and landings have distinct events', () => {
  const level = getLevel(3);
  const pad = level.pads[0];
  // Roll up to it rather than being dropped on it: a pad is tuned for a ball
  // that arrives with speed, and a standing jump would just drop in the gap.
  let before = { ...at(level, pad), z: pad.z - 16 };
  let launch = null;
  for (let i = 0; i < 60 * 6 && !launch; i++) {
    const previous = before;
    before = step(before, level, { x: 0, y: 1 }, dt);
    if (before.events.some((e) => e.type === 'pad')) { launch = before; before = previous; }
  }
  expect(launch).not.toBeNull();
  expect(launch.events).toContainEqual({ type: 'pad', index: 0 });
  expect(launch.feedback.pad).toBe(1);
  expect(before.feedback.pad).toBe(0);
  expect(launch.grounded).toBe(false);

  // Fly the jump out: touching down on the far side is a landing, and it is
  // a different event from the launch that started it.
  let s = launch;
  let landed = null;
  for (let i = 0; i < 60 * 6 && !landed && s.status === STATUS.PLAYING; i++) {
    s = step(s, level, { x: 0, y: 1 }, dt);
    if (s.events.some((e) => e.type === 'landing')) landed = s;
  }
  expect(landed).not.toBeNull();
  expect(landed.grounded).toBe(true);
  expect(landed.z).toBeGreaterThan(pad.z);
});

test('a booster emits a boost, raises the speed cap and lets it lapse', () => {
  const level = getLevel(4);
  const booster = level.boosters[0];
  const hit = step(at(level, booster), level, tilt, dt);
  expect(hit.events).toContainEqual({ type: 'boost', index: 0 });
  expect(hit.feedback.boost).toBe(1);
  expect(hit.vz).toBeGreaterThan(level.speed);
  expect(hit.boost).toBeGreaterThan(0);

  // The clock runs down from here. (That it reaches zero, and what happens
  // when a second booster lands on top of it, is boosters.test.js's job -
  // this level has three more of them further down the track.)
  const later = step(hit, level, tilt, dt);
  expect(later.boost).toBeLessThan(hit.boost);
});

test('spinner contact emits a hit; fall and respawn do not retain stale events', () => {
  const level = getLevel(5);
  const spinner = level.spinners[0];
  const hit = step(at(level, spinner), level, tilt, dt);
  expect(hit.events).toContainEqual({ type: 'spinner' });
  const fall = step({ ...hit, x: 100, y: level.fallY - 1 }, level, tilt, dt);
  expect(fall.events).toContainEqual({ type: 'fall' });
  expect(respawn(fall, level).events).toEqual([]);
});

test('goal emits on crossing and terminal state is stable', () => {
  const level = getLevel(1);
  const win = step(
    at(level, { x: level.goalX, z: level.goalZ + 0.5 }),
    level,
    tilt,
    dt
  );
  expect(win.events).toContainEqual({ type: 'goal' });
  expect(win.status).toBe(STATUS.FINISHED);
  expect(step(win, level, tilt, dt)).toBe(win);
});
