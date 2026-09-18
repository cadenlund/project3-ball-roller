import { LEVELS } from '../src/game/levels';
import { autoplay } from '../test-utils/autopilot';

/**
 * The autopilot holds full forward and steers straight down the middle of
 * whatever is ahead. It is deliberately not clever: if it can finish a level
 * without falling, the level is genuinely completable and not a trap. Its
 * time is therefore a floor on a human's, and pars are judged against it.
 */
const runs = new Map(LEVELS.map((level) => [level.id, autoplay(level)]));

describe.each(LEVELS)('level $id ($name)', (level) => {
  const run = () => runs.get(level.id);

  test('can be finished without falling off once', () => {
    expect(run().finished).toBe(true);
    expect(run().falls).toBe(0);
  });

  test('a clean run beats par, so two stars are actually attainable', () => {
    expect(run().time).toBeLessThan(level.parTime);
  });

  test('par is not so generous that beating it is automatic', () => {
    // Much past double a perfect run and par stops meaning anything.
    expect(level.parTime).toBeLessThan(run().time * 2.2);
  });

  test('the level takes long enough to be worth playing', () => {
    expect(run().time).toBeGreaterThan(6);
  });
});

test('levels get harder: each one takes longer to clear than the first', () => {
  const first = runs.get(1).time;
  for (const level of LEVELS.slice(1)) {
    expect(runs.get(level.id).time).toBeGreaterThan(first * 0.9);
  }
});

test('pars rise across the game rather than wandering', () => {
  const pars = LEVELS.map((l) => l.parTime);
  expect(pars[pars.length - 1]).toBeGreaterThan(pars[0]);
});
