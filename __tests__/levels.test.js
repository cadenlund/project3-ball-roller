import { BALL_RADIUS, GOAL_RADIUS, LEVELS, LEVEL_COUNT, WORLD, getLevel } from '../src/game/levels';

const overlaps = (cx, cy, r, w) => {
  const nx = Math.max(w.x, Math.min(cx, w.x + w.w));
  const ny = Math.max(w.y, Math.min(cy, w.y + w.h));
  return Math.hypot(cx - nx, cy - ny) < r;
};

test('there are five levels with unique, sequential ids', () => {
  expect(LEVEL_COUNT).toBe(5);
  expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5]);
});

test('getLevel throws for an id that does not exist', () => {
  expect(() => getLevel(99)).toThrow(/No level with id 99/);
});

describe.each(LEVELS)('level $id ($name)', (level) => {
  test('start and goal are inside the world', () => {
    for (const p of [level.start, level.goal]) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(WORLD);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(WORLD);
    }
  });

  test('the ball does not start inside a wall', () => {
    const stuck = level.walls.filter((w) => overlaps(level.start.x, level.start.y, BALL_RADIUS, w));
    expect(stuck).toEqual([]);
  });

  test('the goal is not buried in a wall', () => {
    const blocked = level.walls.filter((w) => overlaps(level.goal.x, level.goal.y, GOAL_RADIUS * 0.5, w));
    expect(blocked).toEqual([]);
  });

  test('no hole or coin sits on the start or the goal', () => {
    for (const p of [...level.holes, ...level.coins]) {
      expect(Math.hypot(p.x - level.start.x, p.y - level.start.y)).toBeGreaterThan(5);
    }
    for (const h of level.holes) {
      expect(Math.hypot(h.x - level.goal.x, h.y - level.goal.y)).toBeGreaterThan(5);
    }
  });

  test('par time is sane', () => {
    expect(level.parTime).toBeGreaterThan(5);
    expect(level.parTime).toBeLessThan(120);
  });
});

test('levels get harder: par time never decreases', () => {
  const pars = LEVELS.map((l) => l.parTime);
  expect([...pars].sort((a, b) => a - b)).toEqual(pars);
});
