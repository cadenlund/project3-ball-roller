import { createGameState, step, respawn, STATUS } from '../src/game/engine';
import { getLevel, BALL_RADIUS } from '../src/game/levels';

const dt = 1 / 60;
const tilt = { x: 0, y: 0 };
test('coin pickup emits once and does not mutate prior state', () => {
  const level = getLevel(1);
  const before = { ...createGameState(level), x: -1, z: 52 };
  const after = step(before, level, tilt, dt);
  expect(after.events).toContainEqual({ type: 'coin', index: 0 });
  expect(before.coins[0]).toBe(false);
  expect(step(after, level, tilt, dt).events).toEqual([]);
});
test('pad launches and landings have distinct events', () => {
  const level = getLevel(3);
  const before = { ...createGameState(level), z: 29 };
  const launch = step(before, level, tilt, dt);
  expect(launch.events).toContainEqual({ type: 'pad', index: 0 });
  expect(launch.feedback.pad).toBe(1);
  expect(before.feedback.pad).toBe(0);
  const landing = step({ ...launch, z: 40, y: BALL_RADIUS, vy: -2 }, level, tilt, dt);
  expect(landing.events).toContainEqual({ type: 'landing' });
});
test('spinner contact emits a hit; fall and respawn do not retain stale events', () => {
  const level = getLevel(4);
  const hit = step({ ...createGameState(level), z: 45 }, level, tilt, dt);
  expect(hit.events).toContainEqual({ type: 'spinner' });
  const fall = step({ ...hit, x: 100, y: -8 }, level, tilt, dt);
  expect(fall.events).toContainEqual({ type: 'fall' });
  expect(respawn(fall, level).events).toEqual([]);
});
test('goal emits on crossing and terminal state is stable', () => {
  const level = getLevel(1);
  const win = step({ ...createGameState(level), z: level.goalZ }, level, tilt, dt);
  expect(win.events).toContainEqual({ type: 'goal' });
  expect(win.status).toBe(STATUS.FINISHED);
  expect(step(win, level, tilt, dt)).toBe(win);
});
