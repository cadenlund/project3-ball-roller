import { STATUS, createGameState, step } from '../src/game/engine';
import { BALL_RADIUS, buildLevel, segmentAt, segmentCenter, segmentShift } from '../src/game/levels';

const dt = 1 / 120;
const NONE = { x: 0, y: 0 };
const FWD = { x: 0, y: 1 };

const run = (level, tilt, frames, state = createGameState(level)) => {
  let s = state;
  for (let i = 0; i < frames; i++) s = step(s, level, tilt, dt);
  return s;
};

/** One long platform that slides side to side under the whole run. */
const sliding = (moving = { amplitude: 3, speed: 1.5, phase: 0 }, extra = {}) =>
  buildLevel({
    id: 'm', name: 'm', speed: 10, parTime: 30,
    run: [{ length: 90, width: 5, moving }],
    ...extra,
  });

describe('segmentShift', () => {
  test('ordinary track never moves', () => {
    const level = buildLevel({ id: 's', name: 's', speed: 10, parTime: 10, run: [{ length: 20, width: 5 }] });
    for (const t of [0, 1, 7.5, 100]) expect(segmentShift(level.segments[0], t)).toBe(0);
  });

  test('a platform swings within its amplitude and comes back', () => {
    const seg = sliding({ amplitude: 3, speed: 2, phase: 0 }).segments[0];
    for (let t = 0; t < 20; t += 0.05) expect(Math.abs(segmentShift(seg, t))).toBeLessThanOrEqual(3 + 1e-9);
    const period = (2 * Math.PI) / 2;
    expect(segmentShift(seg, period)).toBeCloseTo(segmentShift(seg, 0), 9);
  });

  test('phase offsets two platforms against each other', () => {
    const a = sliding({ amplitude: 3, speed: 2, phase: 0 }).segments[0];
    const b = sliding({ amplitude: 3, speed: 2, phase: Math.PI }).segments[0];
    expect(segmentShift(a, 1.3)).toBeCloseTo(-segmentShift(b, 1.3), 9);
  });
});

describe('segmentAt with a moving platform', () => {
  const level = sliding({ amplitude: 3, speed: 1, phase: Math.PI / 2 }); // starts at +3

  test('the track is found where the platform now is, not where it was authored', () => {
    expect(segmentAt(level, 3, 40, 0)).not.toBeNull();  // shifted right at t=0
    expect(segmentAt(level, -2.6, 40, 0)).toBeNull();   // nothing that far left yet
  });

  test('half a period later the same two points have swapped', () => {
    const half = Math.PI; // speed 1, so half a period is PI seconds
    expect(segmentAt(level, -3, 40, half)).not.toBeNull();
    expect(segmentAt(level, 3, 40, half)).toBeNull();
  });

  test('it still reads as ordinary track when no time is given', () => {
    const still = buildLevel({ id: 'n', name: 'n', speed: 10, parTime: 10, run: [{ length: 20, width: 5 }] });
    expect(segmentAt(still, 0, 10)).not.toBeNull();
    expect(segmentAt(still, 9, 10)).toBeNull();
  });
});

describe('a ball on a moving platform', () => {
  test('is carried along with the deck instead of being left behind', () => {
    const level = sliding({ amplitude: 3, speed: 1.6, phase: 0 });
    const s = run(level, NONE, 120); // one second, no input at all
    expect(s.grounded).toBe(true);
    expect(s.status).toBe(STATUS.PLAYING);
    // It moved sideways only because the platform did - and it is still
    // sitting in the same spot on the deck it started on.
    expect(Math.abs(s.x)).toBeGreaterThan(0.5);
    expect(s.x - segmentCenter(level.segments[0], s.time)).toBeCloseTo(0, 6);
  });

  test('keeps riding for many swings without drifting off the deck', () => {
    const level = sliding({ amplitude: 3.5, speed: 2.2, phase: 0.7 });
    let s = createGameState(level);
    for (let i = 0; i < 120 * 12; i++) {
      s = step(s, level, NONE, dt);
      expect(s.status).toBe(STATUS.PLAYING);
      expect(Math.abs(s.x - segmentCenter(level.segments[0], s.time))).toBeLessThan(0.2);
    }
  });

  test('can still be steered across the deck while it rides', () => {
    const level = sliding({ amplitude: 2, speed: 1.2, phase: 0 });
    const s = run(level, { x: 1, y: 0 }, 60);
    // Offset from the platform centre is the player's doing, not the platform's.
    expect(s.x - segmentCenter(level.segments[0], s.time)).toBeGreaterThan(0.3);
  });

  test('a platform sliding out from under an airborne ball drops it', () => {
    // Launched straight up by a pad, it hangs while the deck swings away.
    const level = buildLevel({
      id: 'j', name: 'j', speed: 10, parTime: 30,
      run: [{ length: 90, width: 3, moving: { amplitude: 9, speed: 2.6, phase: 0 } }],
      pads: [{ z: 3, x: 0, power: 22 }], // fires on the first step, from a standstill
    });
    let s = createGameState(level);
    let airborne = false;
    for (let i = 0; i < 120 * 6 && s.status === STATUS.PLAYING; i++) {
      s = step(s, level, NONE, dt);
      if (!s.grounded) airborne = true;
    }
    expect(airborne).toBe(true);
    expect(s.status).toBe(STATUS.FELL);
  });

  test('rolling off the edge of a moving platform is still a fall', () => {
    const level = sliding({ amplitude: 2, speed: 1, phase: 0 });
    const s = run(level, { x: 1, y: 0 }, 120 * 6);
    expect(s.status).toBe(STATUS.FELL);
  });

  test('a ball in the air is not carried sideways by the deck below it', () => {
    const level = buildLevel({
      id: 'a', name: 'a', speed: 10, parTime: 30,
      run: [{ length: 90, width: 14, moving: { amplitude: 4, speed: 2.4, phase: 0 } }],
      pads: [{ z: 3, x: 0, power: 20 }], // fires on the first step, from a standstill
    });
    let s = createGameState(level);
    let checked = 0;
    for (let i = 0; i < 120 * 3 && s.status === STATUS.PLAYING; i++) {
      const before = s;
      s = step(s, level, NONE, dt);
      // Clear of the deck on both sides of the step - so no landing, and no
      // carry, can have happened in between. x must not have moved at all.
      if (before.y > BALL_RADIUS + 1 && s.y > BALL_RADIUS + 1) {
        expect(s.x).toBeCloseTo(before.x, 9);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });
});

describe('moving platforms keep the engine honest', () => {
  test('the simulation stays deterministic', () => {
    const level = sliding({ amplitude: 3, speed: 1.9, phase: 0.4 });
    const drive = (s) => ({ x: Math.sin(s.time * 2) * 0.4, y: 0.5 });
    let a = createGameState(level);
    let b = createGameState(level);
    for (let i = 0; i < 600; i++) {
      a = step(a, level, drive(a), dt);
      b = step(b, level, drive(b), dt);
    }
    expect(a).toEqual(b);
  });

  test('step still does not mutate the state it is given', () => {
    const level = sliding();
    const s = createGameState(level);
    const before = JSON.parse(JSON.stringify(s));
    step(s, level, FWD, dt);
    expect(s).toEqual(before);
  });

  test('nothing NaNs or sinks through a swinging deck', () => {
    const level = sliding({ amplitude: 3, speed: 2.5, phase: 0 });
    let s = createGameState(level);
    for (let i = 0; i < 1200; i++) {
      s = step(s, level, { x: Math.sin(i / 11) * 0.5, y: Math.cos(i / 17) }, dt);
      expect(Number.isFinite(s.x + s.y + s.z + s.vx + s.vy + s.vz)).toBe(true);
      if (s.grounded) expect(s.y).toBe(BALL_RADIUS);
      if (s.status !== STATUS.PLAYING) break;
    }
  });
});
