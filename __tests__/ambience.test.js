import { createGameState, step } from '../src/game/engine';
import { LEVELS, getLevel } from '../src/game/levels';
import {
  advanceEffects,
  createEffects,
  RING_COUNT,
  TRAIL_COUNT,
} from '../src/game/visualEffects';
import { CLOUD_COUNT, HIGH_CLOUD_COUNT, STAR_COUNT, SUN_DIRECTION } from '../src/components/Sky';

const dt = 1 / 60;

describe('the ball leaves a trail', () => {
  const level = getLevel(1);

  test('ghosts are laid down at a fixed rate, so spacing reads as speed', () => {
    const fast = createEffects(createGameState(level));
    const slow = createEffects(createGameState(level));
    let a = { ...createGameState(level), vz: 20 };
    let b = { ...createGameState(level), vz: 4 };
    for (let i = 0; i < 40; i++) {
      a = { ...a, z: a.z + 20 * dt, time: a.time + dt };
      b = { ...b, z: b.z + 4 * dt, time: b.time + dt };
      advanceEffects(fast, a, level, dt);
      advanceEffects(slow, b, level, dt);
    }
    const spread = (fx) => {
      const live = fx.trail.filter((g) => g.life > 0).map((g) => g.z);
      return Math.max(...live) - Math.min(...live);
    };
    expect(spread(fast)).toBeGreaterThan(spread(slow) * 3);
  });

  test('it fades out rather than growing forever', () => {
    const fx = createEffects(createGameState(level));
    let s = createGameState(level);
    for (let i = 0; i < 120; i++) {
      s = step(s, level, { x: 0, y: 1 }, dt);
      advanceEffects(fx, s, level, dt);
    }
    expect(fx.trail).toHaveLength(TRAIL_COUNT);
    expect(fx.trail.some((g) => g.life > 0)).toBe(true);
    // Stand still and it clears itself out.
    const parked = { ...s, vz: 0 };
    for (let i = 0; i < 300; i++) advanceEffects(fx, parked, level, dt);
    expect(fx.trail.every((g) => g.life <= 1)).toBe(true);
  });

  test('a fall wipes it, so the respawned ball has no tail from its last life', () => {
    const fx = createEffects(createGameState(level));
    let s = createGameState(level);
    for (let i = 0; i < 60; i++) {
      s = step(s, level, { x: 0, y: 1 }, dt);
      advanceEffects(fx, s, level, dt);
    }
    expect(fx.trail.filter((g) => g.life > 0).length).toBeGreaterThan(5);
    const respawned = { ...s, falls: s.falls + 1, x: level.start.x, z: level.start.z };
    advanceEffects(fx, respawned, level, dt);
    // Whatever is left of the trail starts again from where the ball now is,
    // rather than still drawing the line it fell off.
    for (const ghost of fx.trail) {
      if (ghost.life > 0) expect(ghost.z).toBeCloseTo(-respawned.z, 6);
    }
    expect(fx.rings.every((r) => r.life === 0)).toBe(true);
  });
});

describe('impacts throw a ring', () => {
  test('a landing, a pad, a booster and the finish each throw one', () => {
    const jumps = getLevel(3);   // has pads
    const fast = getLevel(4);    // has boosters
    const cases = [
      ['landing', jumps, (b) => ({ ...b, feedback: { ...b.feedback, landing: 1 } })],
      ['pad', jumps, (b) => ({ ...b, feedback: { ...b.feedback, pad: 1, lastPad: 0 } })],
      ['boost', fast, (b) => ({ ...b, feedback: { ...b.feedback, boost: 1, lastBoost: 0 } })],
      ['goal', jumps, (b) => ({ ...b, status: 'finished' })],
    ];
    for (const [what, level, change] of cases) {
      const base = createGameState(level);
      const fx = createEffects(base);
      advanceEffects(fx, change(base), level, dt);
      expect({ [what]: fx.rings.filter((r) => r.life > 0).length }).toEqual({ [what]: 1 });
    }
  });

  test('rings expire, and there are never more of them than there are slots', () => {
    const level = getLevel(4);
    const fx = createEffects(createGameState(level));
    let s = createGameState(level);
    for (let i = 0; i < 60 * 25; i++) {
      s = step(s, level, { x: 0, y: 1 }, dt);
      advanceEffects(fx, s, level, dt);
      expect(fx.rings).toHaveLength(RING_COUNT);
    }
    for (let i = 0; i < 200; i++) advanceEffects(fx, s, level, dt);
    expect(fx.rings.every((r) => r.life === 0)).toBe(true);
  });
});

describe('the sky', () => {
  test('the sun is a direction, not a position, and it is low', () => {
    expect(SUN_DIRECTION.length()).toBeCloseTo(1, 6);
    // Low in the sky: long light across the track rather than noon overhead.
    expect(SUN_DIRECTION.y).toBeGreaterThan(0);
    expect(SUN_DIRECTION.y).toBeLessThan(0.45);
  });

  test('there is weather above the track as well as below it', () => {
    expect(CLOUD_COUNT).toBeGreaterThan(0);
    expect(HIGH_CLOUD_COUNT).toBeGreaterThan(0);
    expect(STAR_COUNT).toBeGreaterThan(50);
  });

  test('every level names a full sky, so none of them falls back to the default', () => {
    for (const level of LEVELS) {
      for (const key of ['sky', 'horizon', 'cloud', 'ground', 'sun', 'haze', 'star']) {
        expect(typeof level.theme[key]).toBe('string');
        expect(level.theme[key]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  test('the ground is darker than the sky it hangs under', () => {
    const lum = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      return (((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255;
    };
    for (const level of LEVELS) {
      expect(lum(level.theme.ground)).toBeLessThan(lum(level.theme.horizon));
      expect(lum(level.theme.cloud)).toBeGreaterThan(lum(level.theme.ground));
    }
  });
});

describe('the rush', () => {
  const level = getLevel(4);

  test('a booster reads as full speed the instant it is touched', () => {
    const fx = createEffects(createGameState(level));
    const cruising = { ...createGameState(level), vz: level.speed * 0.5 };
    advanceEffects(fx, cruising, level, dt);
    const calm = fx.rush;
    const boosted = { ...cruising, boost: 2 };
    for (let i = 0; i < 20; i++) advanceEffects(fx, boosted, level, dt);
    expect(fx.rush).toBeGreaterThan(calm + 0.4);
  });

  test('a long drop reads as rush too, even at a standstill', () => {
    const fx = createEffects(createGameState(level));
    const falling = { ...createGameState(level), vz: 0, vy: -34, grounded: false };
    for (let i = 0; i < 20; i++) advanceEffects(fx, falling, level, dt);
    expect(fx.rush).toBeGreaterThan(0.5);
  });

  test('and it eases rather than snapping, so speed is a state and not an event', () => {
    const fx = createEffects(createGameState(level));
    const quick = { ...createGameState(level), vz: level.speed * 2 };
    advanceEffects(fx, quick, level, dt);
    const afterOne = fx.rush;
    expect(afterOne).toBeGreaterThan(0);
    expect(afterOne).toBeLessThan(0.5);
  });
});
