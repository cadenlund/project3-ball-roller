import {
  BOOST_SLIP,
  BOOST_SPEED,
  BOOST_STEER,
  BOOST_TIME,
  OVERSPEED,
  STATUS,
  createGameState,
  step,
} from '../src/game/engine';
import { LEVELS, buildLevel } from '../src/game/levels';

const dt = 1 / 120;
const FWD = { x: 0, y: 1 };
const NONE = { x: 0, y: 0 };

const track = (boosters, extra = {}) =>
  buildLevel({ id: 'b', name: 'b', speed: 12, parTime: 60, run: [{ length: 260, width: 9 }], boosters, ...extra });

const roll = (level, tilt, frames, state = createGameState(level)) => {
  let s = state;
  for (let i = 0; i < frames; i++) s = step(s, level, typeof tilt === 'function' ? tilt(s) : tilt, dt);
  return s;
};

test('a booster is a floor on your speed, never a ceiling', () => {
  const level = track([{ z: 40, speed: 1.4 }]);
  // Arrive already going faster than the pad would set.
  const fast = { ...createGameState(level), z: 39, vz: level.speed * 2 };
  const after = step(fast, level, FWD, dt);
  expect(after.feedback.boost).toBe(1);
  // Well above the 1.4x the pad would have set, so it added rather than reset.
  expect(after.vz).toBeGreaterThan(level.speed * 1.9);
});

test('the surge survives the corner after it instead of evaporating', () => {
  const level = track([{ z: 20, speed: 1.8 }]);
  const hit = roll(level, FWD, 260);
  expect(hit.boost).toBeGreaterThan(0);
  // A second later it is still well clear of what tilt alone could manage.
  const later = roll(level, FWD, 120, hit);
  expect(later.vz).toBeGreaterThan(level.speed * 1.4);
  expect(BOOST_SLIP).toBeLessThan(1);
});

test('it lapses after its time, and drag reels the ball back to cruise', () => {
  const level = track([{ z: 20, speed: 1.8 }]);
  let s = roll(level, FWD, 260);
  expect(s.boost).toBeGreaterThan(0);
  s = roll(level, FWD, Math.ceil(BOOST_TIME / dt) + 240, s);
  expect(s.boost).toBe(0);
  expect(s.vz).toBeLessThanOrEqual(level.speed + 1e-6);
});

test('a second booster refreshes the clock rather than cutting it short', () => {
  const level = track([{ z: 20, speed: 1.8 }, { z: 150, speed: 1.2 }]);
  let s = roll(level, FWD, 260);
  expect(s.feedback.boost).toBe(1);

  // Run on until the first pad's boost is nearly spent, then take the second.
  let before = s;
  for (let i = 0; i < 120 * 20 && s.feedback.boost === 1; i++) { before = s; s = step(s, level, FWD, dt); }
  expect(s.feedback.boost).toBe(2);
  expect(before.boost).toBeLessThan(BOOST_TIME / 2); // it really had run down
  expect(s.boost).toBeCloseTo(BOOST_TIME, 1);        // and is full again
});

test('steering authority scales with the boost, so speed stays drivable', () => {
  const level = track([{ z: 20, speed: 1.8 }]);
  const boosted = roll(level, FWD, 260);
  expect(boosted.boost).toBeGreaterThan(0);
  const steered = roll(level, { x: 1, y: 1 }, 12, boosted);
  const plain = roll(level, { x: 1, y: 1 }, 12, { ...boosted, boost: 0, boostCap: 1 });
  expect(steered.vx).toBeGreaterThan(plain.vx);
  expect(BOOST_STEER).toBeGreaterThan(1);
});

test('nothing a booster does can outrun the runaway clamp', () => {
  const level = track([{ z: 20, speed: OVERSPEED }, { z: 40, speed: OVERSPEED }]);
  let s = createGameState(level);
  for (let i = 0; i < 120 * 20 && s.status === STATUS.PLAYING; i++) {
    s = step(s, level, FWD, dt);
    expect(s.vz).toBeLessThanOrEqual(level.speed * OVERSPEED + 1e-6);
  }
});

test('a ramp booster throws the ball off the deck as well as forward', () => {
  const level = track([{ z: 20, speed: 1.6, launch: 18 }]);
  let s = createGameState(level);
  let launched = null;
  for (let i = 0; i < 600 && !launched; i++) {
    s = step(s, level, FWD, dt);
    if (s.events.some((e) => e.type === 'boost')) launched = s;
  }
  expect(launched).not.toBeNull();
  expect(launched.grounded).toBe(false);
  expect(launched.vy).toBeCloseTo(18, 6);
  expect(launched.vz).toBeGreaterThan(level.speed * 1.5);
});

test('one crossing of a booster is one pickup, however slowly you cross it', () => {
  const level = track([{ z: 20, speed: 1.6 }]);
  // Creep over it at walking pace: it must still register exactly once.
  const crept = roll(level, { x: 0, y: 0.12 }, 120 * 12, { ...createGameState(level), z: 16 });
  expect(crept.feedback.boost).toBe(1);
});

test('leaving a booster arms it again for a second run over it', () => {
  const level = track([{ z: 20, speed: 1.6 }]);
  let s = roll(level, FWD, 260);
  expect(s.feedback.boost).toBe(1);
  s = roll(level, FWD, 240, s);   // roll well clear of it
  expect(s.onBooster).toBe(-1);
  // Back at the start of the deck, and over it again.
  s = roll(level, FWD, 400, { ...s, z: 4, vz: 0 });
  expect(s.feedback.boost).toBe(2);
});

test('a plain booster leaves the ball on the ground', () => {
  const level = track([{ z: 20, speed: 1.6 }]);
  const hit = roll(level, FWD, 260);
  expect(hit.grounded).toBe(true);
});

test('boost state resets on respawn, and never survives a fall', () => {
  const level = track([{ z: 20, speed: 1.8 }]);
  const hit = roll(level, FWD, 260);
  expect(hit.boost).toBeGreaterThan(0);
  const fresh = createGameState(level);
  expect(fresh.boost).toBe(0);
  expect(fresh.boostCap).toBe(1);
});

test('a standing ball is not dragged off by a booster it is parked on', () => {
  const level = track([{ z: 20, speed: 1.8 }]);
  const parked = roll(level, NONE, 60, { ...createGameState(level), z: 20 });
  expect(parked.feedback.boost).toBe(1); // once, not once per frame
  expect(parked.events.filter((e) => e.type === 'boost')).toHaveLength(0);
  expect(parked.status).toBe(STATUS.PLAYING);
});

describe('every booster in the game', () => {
  test('asks for a speed the engine can actually deliver', () => {
    for (const level of LEVELS) {
      for (const b of level.boosters) {
        expect(b.speed ?? BOOST_SPEED).toBeGreaterThan(1);
        expect(b.speed ?? BOOST_SPEED).toBeLessThanOrEqual(OVERSPEED);
      }
    }
  });
});
