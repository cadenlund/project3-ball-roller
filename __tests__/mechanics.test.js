import { DEFAULT_MASS, STATUS, createGameState, isOpen, respawn, step } from '../src/game/engine';
import {
  BALL_RADIUS,
  CANNON_HOLD,
  LEVELS,
  buildLevel,
  cannonShot,
  getLevel,
  segmentAt,
} from '../src/game/levels';

const dt = 1 / 120;
const FWD = { x: 0, y: 1 };
const NONE = { x: 0, y: 0 };
const roll = (level, tilt, frames, state = createGameState(level)) => {
  let s = state;
  for (let i = 0; i < frames; i++) s = step(s, level, tilt, dt);
  return s;
};

/** Drive until something happens, rather than for a guessed number of frames. */
const rollUntil = (level, tilt, done, state = createGameState(level), seconds = 20) => {
  let s = state;
  for (let i = 0; i < 120 * seconds; i++) {
    s = step(s, level, tilt, dt);
    if (done(s)) return s;
  }
  return s;
};

describe('cannons', () => {
  const track = (cannons, extra = {}) =>
    buildLevel({ id: 'c', name: 'c', speed: 11, parTime: 60, run: [{ length: 200, width: 8 }], cannons, ...extra });

  test('take hold of the ball, and nothing the player does matters until it fires', () => {
    const level = track([{ z: 30, aim: { y: 20, z: 15 } }]);
    let s = rollUntil(level, FWD, (g) => g.cannon >= 0);
    expect(s.cannon).toBe(0);
    const held = s;
    // Full tilt in every direction changes nothing at all.
    s = roll(level, { x: 1, y: -1 }, 12, s);
    expect(s.x).toBe(held.x);
    expect(s.z).toBe(held.z);
    expect([s.vx, s.vy, s.vz]).toEqual([0, 0, 0]);
    expect(s.cannonTime).toBeLessThan(held.cannonTime);
  });

  test('fire along their own aim, exactly, after their hold', () => {
    const aim = { x: -3, y: 24, z: 18 };
    const level = track([{ z: 30, aim, hold: 0.5 }]);
    let s = rollUntil(level, FWD, (g) => g.cannon >= 0);
    const loadedAt = s.time;
    let fired = null;
    for (let i = 0; i < 120 * 3 && !fired; i++) {
      s = step(s, level, { x: 1, y: -1 }, dt);
      if (s.events.some((e) => e.type === 'fire')) fired = s;
    }
    expect(fired).not.toBeNull();
    expect(fired.time - loadedAt).toBeCloseTo(0.5, 1);
    expect([fired.vx, fired.vy, fired.vz]).toEqual([aim.x, aim.y, aim.z]);
    expect(fired.cannon).toBe(-1);
  });

  test('one loading is one shot, not a barrel that swallows its own output', () => {
    // It fires the ball from where it loaded it, so the instant after firing
    // the ball is still inside the barrel.
    const level = track([{ z: 30, aim: { y: 22, z: 16 } }]);
    let s = createGameState(level);
    let shots = 0;
    for (let i = 0; i < 120 * 12; i++) {
      s = step(s, level, FWD, dt);
      shots += s.events.filter((e) => e.type === 'fire').length;
    }
    expect(shots).toBe(1);
  });

  test('a booster cannot be carried through one', () => {
    const level = track([{ z: 60, aim: { y: 20, z: 15 } }], { boosters: [{ z: 20, speed: 1.8 }] });
    let s = rollUntil(level, FWD, (g) => g.feedback.boost > 0);
    expect(s.boost).toBeGreaterThan(0);
    s = rollUntil(level, FWD, (g) => g.cannon >= 0, s);
    expect(s.cannon).toBe(0);
    expect(s.boost).toBe(0);
  });

  test('defaults to a sensible hold', () => {
    const level = track([{ z: 30, aim: { y: 20, z: 15 } }]);
    const s = rollUntil(level, FWD, (g) => g.cannon >= 0);
    expect(s.cannonTime).toBeLessThanOrEqual(CANNON_HOLD);
    expect(s.cannonTime).toBeGreaterThan(0);
  });
});

describe('ballast', () => {
  const track = (ballast, extra = {}) =>
    buildLevel({ id: 'w', name: 'w', speed: 11, parTime: 60, run: [{ length: 200, width: 8 }], ballast, ...extra });

  test('changes what the ball weighs, and says so once', () => {
    const level = track([{ z: 30, mass: 2 }]);
    let s = createGameState(level);
    expect(s.mass).toBe(DEFAULT_MASS);
    let changes = 0;
    for (let i = 0; i < 120 * 8; i++) {
      s = step(s, level, FWD, dt);
      changes += s.events.filter((e) => e.type === 'ballast').length;
    }
    expect(s.mass).toBe(2);
    expect(changes).toBe(1);
  });

  test('a pad is an impulse: it barely lifts a heavy ball and throws a light one', () => {
    const peak = (mass) => {
      const level = track([{ z: 20, mass }], { pads: [{ z: 60, power: 20 }] });
      let s = createGameState(level);
      let high = 0;
      for (let i = 0; i < 120 * 12; i++) {
        s = step(s, level, FWD, dt);
        high = Math.max(high, s.y);
      }
      return high;
    };
    const heavy = peak(2);
    const light = peak(0.5);
    expect(light).toBeGreaterThan(heavy * 3);
  });

  test('a heavy ball shrugs off a bar that flings a light one', () => {
    // A bar parked broadside shoves whatever hits it straight back down the
    // track, so the measure is how far it loses, not how far it slides.
    const knockback = (mass) => {
      const level = track([{ z: 20, mass }], {
        run: [{ length: 200, width: 60 }],
        spinners: [{ z: 60, length: 6, speed: 0, phase: 0 }],
      });
      let s = createGameState(level);
      let worst = 0;
      for (let i = 0; i < 120 * 12 && s.status === STATUS.PLAYING; i++) {
        const before = s;
        s = step(s, level, FWD, dt);
        if (s.feedback.spinner !== before.feedback.spinner) {
          worst = Math.max(worst, before.vz - s.vz);
        }
      }
      return worst;
    };
    expect(knockback(0.5)).toBeGreaterThan(knockback(3) * 2);
  });

  test('is a station, not a pickup: you can go back and change your mind', () => {
    const level = track([{ z: 30, mass: 2 }, { z: 60, mass: 0.5 }]);
    let s = rollUntil(level, FWD, (g) => g.mass === 0.5);
    expect(s.mass).toBe(0.5);
    s = rollUntil(level, { x: 0, y: -1 }, (g) => g.mass === 2, s, 40);
    expect(s.mass).toBe(2);
  });

  test('a fall hands the ball back at its own weight', () => {
    const level = track([{ z: 30, mass: 2 }]);
    const heavy = roll(level, FWD, 120 * 8);
    expect(heavy.mass).toBe(2);
    expect(respawn({ ...heavy, status: STATUS.FELL }, level).mass).toBe(DEFAULT_MASS);
  });
});

describe('weighted plates and timed locks', () => {
  const locked = (switches, extra = {}) =>
    buildLevel({
      id: 'p', name: 'p', speed: 11, parTime: 60,
      run: [{ length: 240, width: 8 }],
      gates: [{ z: 150, id: 'a', width: 8 }],
      switches,
      ...extra,
    });

  test('a plate ignores a ball too light to press it', () => {
    const level = locked([{ z: 40, id: 'a', needs: 2 }]);
    const s = roll(level, FWD, 120 * 20);
    expect(s.mass).toBe(DEFAULT_MASS);
    expect(isOpen(s, level, level.gates[0])).toBe(false);
    expect(s.z).toBeLessThan(150);
  });

  test('...and opens for one heavy enough', () => {
    const level = locked([{ z: 40, id: 'a', needs: 2 }], { ballast: [{ z: 20, mass: 2 }] });
    const s = roll(level, FWD, 120 * 20);
    expect(s.mass).toBe(2);
    expect(isOpen(s, level, level.gates[0])).toBe(true);
    expect(s.z).toBeGreaterThan(150);
  });

  test('a timed lock shuts again, and the clock starts when it is pressed', () => {
    const level = locked([{ z: 40, id: 'a', hold: 3 }]);
    let s = createGameState(level);
    let pressedAt = null;
    for (let i = 0; i < 120 * 6 && !pressedAt; i++) {
      s = step(s, level, FWD, dt);
      if (s.events.some((e) => e.type === 'switch')) pressedAt = s.time;
    }
    expect(pressedAt).not.toBeNull();
    expect(s.opened[0]).toBeCloseTo(3, 1);
    expect(isOpen(s, level, level.gates[0])).toBe(true);

    // Roll clear of the plate and let it run out.
    s = roll(level, NONE, 120 * 4, { ...s, z: 80, vz: 0 });
    expect(s.opened[0]).toBe(0);
    expect(isOpen(s, level, level.gates[0])).toBe(false);
  });

  test('standing on a timer keeps it open without re-announcing itself', () => {
    const level = locked([{ z: 40, id: 'a', hold: 3 }]);
    let s = { ...createGameState(level), z: 40 };
    let announced = 0;
    for (let i = 0; i < 120 * 8; i++) {
      s = step(s, level, NONE, dt);
      announced += s.events.filter((e) => e.type === 'switch').length;
    }
    expect(announced).toBe(1);
    expect(s.opened[0]).toBeCloseTo(3, 1);
  });

  test('a plain switch never runs out', () => {
    const level = locked([{ z: 40, id: 'a' }]);
    let s = roll(level, FWD, 120 * 6);
    expect(s.opened[0]).toBe(Infinity);
    s = roll(level, NONE, 120 * 30, { ...s, vz: 0 });
    expect(s.opened[0]).toBe(Infinity);
  });
});

describe('every level that ships these', () => {
  test('aims each cannon at somewhere there is actually track', () => {
    for (const level of LEVELS) {
      for (const cannon of level.cannons) {
        const shot = cannonShot(level, cannon);
        expect(shot.landed).toBe(true);
        // ...and not straight back into the barrel it came out of.
        expect(Math.hypot(shot.x - cannon.x, shot.z - cannon.z)).toBeGreaterThan(8);
      }
    }
  });

  test('puts every cannon and ballast station on the track', () => {
    for (const level of LEVELS) {
      for (const thing of [...level.cannons, ...level.ballast]) {
        expect(segmentAt(level, thing.x, thing.z)).not.toBeNull();
      }
    }
  });

  test('gives every weighted plate a weight the level can actually supply', () => {
    for (const level of LEVELS) {
      for (const plate of level.switches.filter((w) => w.needs)) {
        const heaviest = Math.max(DEFAULT_MASS, ...level.ballast.map((b) => b.mass));
        expect(heaviest).toBeGreaterThanOrEqual(plate.needs);
      }
    }
  });

  test('gives every timed lock long enough to be worth pressing', () => {
    for (const level of LEVELS) {
      for (const timer of level.switches.filter((w) => w.hold)) {
        expect(timer.hold).toBeGreaterThan(3);
      }
    }
  });
});

describe('The Ballast level', () => {
  const level = getLevel(7);

  test('cannot be finished by rolling straight through it', () => {
    let s = createGameState(level);
    for (let i = 0; i < 120 * 60; i++) {
      s = step(s, level, FWD, dt);
      if (s.status === STATUS.FELL) s = respawn(s, level);
      expect(s.status).not.toBe(STATUS.FINISHED);
    }
  });

  test('the door needs weight the last jump cannot carry', () => {
    const plate = level.switches[0];
    const heavy = level.ballast.find((b) => b.mass >= plate.needs);
    expect(heavy).toBeDefined();
    // ...and the jump would not clear its gap at that weight.
    const pad = level.pads[0];
    const apexHeavy = (pad.power / heavy.mass) ** 2 / (2 * 55);
    const gap = level.mainSegments.find((g, i) => i > 0 && g.z0 > level.mainSegments[i - 1].z1);
    const before = level.mainSegments[level.mainSegments.indexOf(gap) - 1];
    const airtime = 2 * Math.sqrt((2 * apexHeavy) / 55);
    expect(airtime * level.speed).toBeLessThan(gap.z0 - (before.z1 - 2));
  });

  test('the ballast stations sit in lanes you can steer around', () => {
    // Otherwise the trip back for the light one undoes itself on the way.
    for (const station of level.ballast) {
      const seg = segmentAt(level, station.x, station.z);
      const centre = station.x - (station.across ?? 0);
      expect(Math.abs(station.across)).toBeGreaterThan(1);
      // There is deck on the far side of the centreline from it.
      expect(segmentAt(level, centre - Math.sign(station.across) * 1.8, station.z)).not.toBeNull();
      void seg;
    }
  });
});
