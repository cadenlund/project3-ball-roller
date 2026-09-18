import {
  MAX_LATERAL,
  STATUS,
  createGameState,
  respawn,
  step,
} from '../src/game/engine';
import { BALL_RADIUS, FALL_Y, bankAt, buildLevel, getLevel, segmentAt, surfaceAt } from '../src/game/levels';
import { autopilotTilt } from '../test-utils/autopilot';

const L1 = getLevel(1);
const NONE = { x: 0, y: 0 };
const FWD = { x: 0, y: 1 }; // full forward tilt
const dt = 1 / 60;

const run = (level, tilt, frames, state = createGameState(level)) => {
  let s = state;
  for (let i = 0; i < frames; i++) {
    s = step(s, level, typeof tilt === 'function' ? tilt(s) : tilt, dt);
  }
  return s;
};

// Small fixtures so each mechanic can be tested in isolation.
const straight = (extra = {}) =>
  buildLevel({ id: 't', name: 't', speed: 10, parTime: 10, run: [{ length: 60, width: 5 }], ...extra });

test('a new game starts at the level start, grounded, still and unscored', () => {
  const s = createGameState(L1);
  expect([s.x, s.z]).toEqual([L1.start.x, L1.start.z]);
  expect(s.y).toBe(BALL_RADIUS);
  expect([s.vx, s.vy, s.vz]).toEqual([0, 0, 0]);
  expect(s.grounded).toBe(true);
  expect(s.status).toBe(STATUS.PLAYING);
  expect(s.falls).toBe(0);
});

test('step does not mutate the state it is given', () => {
  const s = createGameState(L1);
  const before = JSON.parse(JSON.stringify(s));
  step(s, L1, { x: 1, y: 1 }, dt);
  expect(s).toEqual(before);
});

test('with no input at all, the ball goes nowhere', () => {
  const s = run(L1, NONE, 120);
  expect(Math.abs(s.z - L1.start.z)).toBeLessThan(0.5);
  expect(Math.abs(s.vz)).toBeLessThan(0.5);
});

test('tilting forward rolls the ball forward, up to the level speed cap', () => {
  const s = run(L1, FWD, 120);
  expect(s.z).toBeGreaterThan(L1.start.z + 5);
  expect(s.vz).toBeGreaterThan(L1.speed * 0.8);
  expect(s.vz).toBeLessThanOrEqual(L1.speed + 1e-6);
});

test('tilting back rolls the ball backward, at reduced speed', () => {
  const level = straight({ run: [{ length: 200, width: 6 }], goalZ: 199 });
  let s = createGameState(level);
  s = run(level, FWD, 300, s); // roll well up the track first
  const zBefore = s.z;
  s = run(level, { x: 0, y: -1 }, 240, s);
  expect(s.z).toBeLessThan(zBefore);
  expect(Math.abs(s.vz)).toBeLessThanOrEqual(level.speed * 0.5 + 1e-6);
});

test('reversing off the back of the track is a fall', () => {
  const s = run(straight(), { x: 0, y: -1 }, 400);
  expect(s.status).toBe(STATUS.FELL);
});

test('tilting steers the ball sideways', () => {
  const right = run(L1, { x: 1, y: 0 }, 30);
  expect(right.x).toBeGreaterThan(L1.start.x);
  const left = run(L1, { x: -1, y: 0 }, 30);
  expect(left.x).toBeLessThan(L1.start.x);
});

test('lateral speed is capped', () => {
  let s = createGameState(straight({ run: [{ length: 600, width: 400 }] }));
  for (let i = 0; i < 300; i++) {
    s = step(s, straight({ run: [{ length: 600, width: 400 }] }), { x: 1, y: 0 }, dt);
    expect(Math.abs(s.vx)).toBeLessThanOrEqual(MAX_LATERAL + 1e-6);
  }
});

test('letting go of the tilt brings the ball to rest', () => {
  const level = straight({ run: [{ length: 600, width: 100 }] });
  const rolling = run(level, { x: 1, y: 1 }, 60);
  const settled = run(level, NONE, 240, rolling);
  expect(Math.hypot(settled.vx, settled.vz)).toBeLessThan(0.5);
});

test('steering off the edge drops the ball, and it registers as a fall', () => {
  const s = run(straight(), { x: 1, y: 0.4 }, 400);
  expect(s.status).toBe(STATUS.FELL);
  expect(s.y).toBeLessThanOrEqual(FALL_Y);
});

test('driving into a gap with no pad is a fall', () => {
  const level = straight({ run: [{ length: 20, width: 5, gap: 6 }, { length: 20, width: 5 }] });
  const s = run(level, FWD, 600);
  expect(s.status).toBe(STATUS.FELL);
});

test('a bounce pad launches the ball off the ground', () => {
  const level = straight({ pads: [{ z: 20, x: 0, power: 20 }] });
  let s = createGameState(level);
  let peak = 0;
  for (let i = 0; i < 400; i++) {
    s = step(s, level, FWD, dt);
    peak = Math.max(peak, s.y);
  }
  expect(peak).toBeGreaterThan(BALL_RADIUS + 1.5);
});

test('a pad before a gap carries the ball across it', () => {
  const level = straight({
    run: [{ length: 30, width: 5, gap: 4 }, { length: 30, width: 5 }],
    pads: [{ z: 29, x: 0, power: 20 }],
  });
  const s = run(level, FWD, 600);
  expect(s.status).toBe(STATUS.FINISHED);
  expect(s.falls).toBe(0);
});

test('a spinner shoves the ball off its line', () => {
  // A bar dead ahead, parked broadside across the track.
  const level = straight({ spinners: [{ z: 20, x: 0, length: 6, speed: 0.9, phase: 0 }] });
  let s = createGameState(level);
  let maxDrift = 0;
  for (let i = 0; i < 600; i++) {
    s = step(s, level, FWD, dt);
    maxDrift = Math.max(maxDrift, Math.abs(s.x));
    if (s.status !== STATUS.PLAYING) break;
  }
  expect(maxDrift).toBeGreaterThan(0.5);
});

test('a launched ball flies clear over a spinner', () => {
  const level = straight({
    pads: [{ z: 16, x: 0, power: 20 }],
    // Parked broadside: only the jump arc decides whether the ball is hit.
    spinners: [{ z: 20, x: 0, length: 6, speed: 0, phase: 0 }],
  });
  // With the launch, the ball passes z=20 in the air and is never shoved.
  let s = createGameState(level);
  for (let i = 0; i < 600 && s.status === STATUS.PLAYING; i++) {
    s = step(s, level, FWD, dt);
    if (s.z > 22) break;
  }
  expect(Math.abs(s.x)).toBeLessThan(0.2);
});

test('rolling over a coin collects it, once', () => {
  const level = straight({ coins: [{ z: 20, x: 0 }] });
  const s = run(level, FWD, 300);
  expect(s.coins).toEqual([true]);
});

test('a coin off the racing line is not collected by accident', () => {
  const level = straight({ run: [{ length: 60, width: 12 }], coins: [{ z: 20, x: 4 }] });
  const s = run(level, FWD, 300);
  expect(s.coins).toEqual([false]);
});

test('crossing the goal line finishes the level', () => {
  const s = run(straight(), FWD, 600);
  expect(s.status).toBe(STATUS.FINISHED);
});

test('nothing moves once the level is finished or lost', () => {
  const done = run(straight(), FWD, 600);
  expect(step(done, straight(), { x: 1, y: -1 }, dt)).toBe(done);
});

test('respawn returns the ball to the start, counts the fall, keeps the clock and coins', () => {
  const level = straight({ coins: [{ z: 10, x: 0 }] });
  let s = run(level, FWD, 120); // collects the coin on the way
  s = run(level, { x: 1, y: 0.4 }, 400, s);
  expect(s.status).toBe(STATUS.FELL);
  const r = respawn(s, level);
  expect([r.x, r.z, r.y]).toEqual([level.start.x, level.start.z, BALL_RADIUS]);
  expect(r.status).toBe(STATUS.PLAYING);
  expect(r.falls).toBe(s.falls + 1);
  expect(r.time).toBe(s.time);
  expect(r.coins).toEqual([true]);
});

test('the simulation is deterministic', () => {
  const wiggle = (s) => ({ x: Math.sin(s.time * 3), y: Math.cos(s.time * 2) / 2 });
  const a = run(getLevel(5), wiggle, 900);
  const b = run(getLevel(5), wiggle, 900);
  expect(a).toEqual(b);
});

test('time only ever moves forward', () => {
  let s = createGameState(L1);
  for (let i = 0; i < 200; i++) {
    const next = step(s, L1, NONE, dt);
    expect(next.time).toBeGreaterThan(s.time);
    s = next;
  }
});

// The track bends now, so "hold forward" is no longer a strategy - a driver
// has to steer to stay on it at all. Following the centreline is, though.
const follow = (level) => (s) => autopilotTilt(level, s);

test('level 1 is beatable just by following the track, under par, cleanly', () => {
  const s = run(L1, follow(L1), 60 * L1.parTime);
  expect(s.status).toBe(STATUS.FINISHED);
  expect(s.time).toBeLessThan(L1.parTime);
  expect(s.falls).toBe(0);
});

test('level 3 is beatable following the track: every pad clears its gap', () => {
  const L3 = getLevel(3);
  const s = run(L3, follow(L3), 60 * L3.parTime);
  expect(s.status).toBe(STATUS.FINISHED);
  expect(s.falls).toBe(0);
});

describe.each([1, 2, 3, 4, 5, 6, 7, 8])('level %i under a chaotic driver', (id) => {
  test('never NaNs, never sinks through the track, falls are always caught', () => {
    const level = getLevel(id);
    let s = createGameState(level);
    for (let i = 0; i < 3000; i++) {
      const tilt = { x: Math.sin(i / 9), y: 0.6 + Math.cos(i / 13) / 2 };
      s = step(s, level, tilt, dt);
      expect(Number.isFinite(s.x + s.y + s.z + s.vx + s.vy + s.vz)).toBe(true);
      // Grounded means resting on the deck - at the height of the banked
      // surface under the ball, not of the flat centreline beside it.
      if (s.grounded) {
        const seg = segmentAt(level, s.x, s.z, s.time);
        expect(seg).not.toBeNull();
        const rest = surfaceAt(seg, s.x, s.z, s.time) + BALL_RADIUS / Math.cos(bankAt(seg, s.z));
        expect(s.y).toBeCloseTo(rest, 6);
      }
      expect(s.y).toBeGreaterThan(level.fallY - 2);
      if (s.status !== STATUS.PLAYING) {
        if (s.status === STATUS.FELL) s = respawn(s, level);
        else break;
      }
    }
  });
});
