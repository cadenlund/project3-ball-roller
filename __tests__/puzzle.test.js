import { STATUS, createGameState, isOpen, respawn, step } from '../src/game/engine';
import {
  BALL_RADIUS,
  GATE_HEIGHT,
  LEVELS,
  buildLevel,
  getLevel,
  segmentAt,
  trackPointAt,
} from '../src/game/levels';
import { autopilotTilt } from '../test-utils/autopilot';

const dt = 1 / 120;
const FWD = { x: 0, y: 1 };
const BACK = { x: 0, y: -1 };

const roll = (level, tilt, frames, state = createGameState(level)) => {
  let s = state;
  for (let i = 0; i < frames; i++) s = step(s, level, tilt, dt);
  return s;
};

const locked = (extra = {}) =>
  buildLevel({
    id: 'k', name: 'k', speed: 11, parTime: 60,
    run: [{ length: 200, width: 7 }],
    gates: [{ z: 60, id: 'a', width: 7 }],
    switches: [{ z: 100, id: 'a' }],
    ...extra,
  });

describe('a shut gate', () => {
  test('stops the ball rather than killing it', () => {
    const level = locked();
    const s = roll(level, FWD, 120 * 12);
    expect(s.status).toBe(STATUS.PLAYING);
    expect(s.z).toBeLessThan(60);
    expect(s.z).toBeGreaterThan(55);
  });

  test('says so, once, instead of grinding against the wall', () => {
    const level = locked();
    let s = createGameState(level);
    let bumps = 0;
    for (let i = 0; i < 120 * 12; i++) {
      s = step(s, level, FWD, dt);
      bumps += s.events.filter((e) => e.type === 'gate').length;
    }
    expect(bumps).toBeGreaterThan(0);
    expect(bumps).toBeLessThan(6);
  });

  test('lets the ball back out the way it came', () => {
    const level = locked();
    let s = roll(level, FWD, 120 * 8);
    s = roll(level, BACK, 120 * 4, s);
    expect(s.z).toBeLessThan(50);
    expect(s.status).toBe(STATUS.PLAYING);
  });

  test('is no obstacle at all to a ball thrown over it', () => {
    // Launched close enough to still be well up in the air over the barrier.
    const level = locked({ pads: [{ z: 57, power: 22 }] });
    const s = roll(level, FWD, 120 * 12);
    expect(s.z).toBeGreaterThan(64);
  });
});

describe('a switch', () => {
  test('opens every gate that shares its id, and stays open', () => {
    const level = buildLevel({
      id: 'k2', name: 'k2', speed: 11, parTime: 60,
      run: [{ length: 200, width: 7 }],
      gates: [{ z: 120, id: 'a', width: 7 }, { z: 160, id: 'a', width: 7 }],
      switches: [{ z: 40, id: 'a' }],
    });
    const hit = roll(level, FWD, 120 * 6);
    expect(hit.opened).toEqual([Infinity]); // a plain switch stays thrown
    for (const gate of level.gates) expect(isOpen(hit, level, gate)).toBe(true);
    const done = roll(level, FWD, 120 * 20, hit);
    expect(done.status).toBe(STATUS.FINISHED);
  });

  test('fires once, not once per frame spent sitting on it', () => {
    const level = locked({ switches: [{ z: 20, id: 'a' }] });
    // Parked right on top of it, going nowhere, for ten seconds.
    let s = { ...createGameState(level), z: 20 };
    let fired = 0;
    for (let i = 0; i < 120 * 10; i++) {
      s = step(s, level, { x: 0, y: 0 }, dt);
      fired += s.events.filter((e) => e.type === 'switch').length;
    }
    expect(fired).toBe(1);
  });

  test('does not open a gate belonging to a different lock', () => {
    const level = buildLevel({
      id: 'k3', name: 'k3', speed: 11, parTime: 60,
      run: [{ length: 200, width: 7 }],
      gates: [{ z: 120, id: 'b', width: 7 }],
      switches: [{ z: 40, id: 'a' }],
    });
    const s = roll(level, FWD, 120 * 20);
    expect(s.opened).toEqual([Infinity]);
    expect(isOpen(s, level, level.gates[0])).toBe(false);
    expect(s.z).toBeLessThan(120);
  });

  test('stays thrown across a fall, so the puzzle is solved only once', () => {
    const level = locked({ switches: [{ z: 20, id: 'a' }] });
    const hit = roll(level, FWD, 120 * 5);
    expect(hit.opened).toEqual([Infinity]);
    expect(respawn({ ...hit, status: STATUS.FELL }, level).opened).toEqual([Infinity]);
  });
});

describe('The Locksmith', () => {
  const level = getLevel(11);

  test('is a fork: two lanes bridge the drop, at the same z', () => {
    const spurs = level.segments.filter((s) => s.lane > 0);
    expect(spurs).toHaveLength(2);
    const [shut, key] = spurs;
    expect(shut.z0).toBe(key.z0);
    expect(segmentAt(level, shut.x, shut.z0 + 10)).not.toBeNull();
    expect(segmentAt(level, key.x, key.z0 + 10)).not.toBeNull();
    // ...and nothing at all in between them.
    expect(segmentAt(level, (shut.x + key.x) / 2, shut.z0 + 10)).toBeNull();
  });

  test('the lane that goes somewhere is the one that is locked', () => {
    const gate = level.gates[0];
    const lane = segmentAt(level, gate.x, gate.z);
    expect(lane.lane).toBeGreaterThan(0);
    // It reaches the far side of the drop; the other lane does not.
    const onward = level.mainSegments.find((s) => s.z0 >= lane.z1);
    expect(onward).toBeDefined();
    expect(lane.z1).toBeCloseTo(onward.z0, 6);
  });

  test('the lane with the switch is a dead end', () => {
    const sw = level.switches[0];
    const lane = segmentAt(level, sw.x, sw.z);
    expect(lane.lane).toBeGreaterThan(0);
    // Nothing continues in that lane, and the drop past it is real: not just
    // absent from the list, but absent from the air in front of the ball.
    for (const ahead of [2, 6, 12, 20, 30]) {
      expect(segmentAt(level, sw.x, lane.z1 + ahead)).toBeNull();
    }
    // The nearest track beyond the drop is the *other* lane, well out of
    // reach - there is nothing to land on in this one.
    const beyond = trackPointAt(level, lane.z1 + 6, 0, sw.x).segment;
    expect(beyond?.lane).not.toBe(lane.lane);
  });

  test('cannot be finished by simply driving forwards', () => {
    // The point of the stage: no amount of nerve gets past a shut gate.
    let s = createGameState(level);
    for (let i = 0; i < 120 * 60; i++) {
      s = step(s, level, FWD, dt);
      if (s.status === STATUS.FELL) s = respawn(s, level);
      expect(s.status).not.toBe(STATUS.FINISHED);
    }
  });

  test('is finished by the route it ships, and that route really reverses', () => {
    let s = createGameState(level);
    const cursor = { at: 0 };
    let threw = null;
    let reversed = 0;
    for (let i = 0; i < 120 * 90 && s.status === STATUS.PLAYING; i++) {
      s = step(s, level, autopilotTilt(level, s, cursor), dt);
      if (s.events.some((e) => e.type === 'switch')) threw = s.time;
      if (s.vz < -1) reversed += dt;
    }
    expect(s.status).toBe(STATUS.FINISHED);
    expect(s.falls).toBe(0);
    expect(threw).not.toBeNull();
    // Several seconds of it are spent driving backwards out of the dead end.
    expect(reversed).toBeGreaterThan(2);
    expect(s.time).toBeLessThan(level.parTime);
  });

  test('the switch is genuinely past the gate it opens', () => {
    // If it were before it, the lock would open itself on the way past.
    expect(level.switches[0].z).toBeGreaterThan(level.gates[0].z);
  });
});

describe('every level', () => {
  test('has a gate for each switch and a switch for each gate', () => {
    for (const level of LEVELS) {
      for (const gate of level.gates) {
        expect(level.switches.some((w) => w.id === gate.id)).toBe(true);
        expect(gate.width).toBeGreaterThan(0);
      }
      for (const w of level.switches) {
        expect(level.gates.some((g) => g.id === w.id)).toBe(true);
      }
    }
  });

  test('puts every gate and switch on the track, on its surface', () => {
    for (const level of LEVELS) {
      for (const thing of [...level.gates, ...level.switches]) {
        const seg = segmentAt(level, thing.x, thing.z);
        expect(seg).not.toBeNull();
        expect(thing.y).toBeCloseTo(trackPointAt(level, thing.z, 0, thing.x).y, 6);
      }
    }
  });

  test('never shuts a gate across the whole width of an unavoidable lane without a way through', () => {
    // Every gate must be openable: its switch has to be somewhere the ball
    // can actually stand.
    for (const level of LEVELS) {
      for (const w of level.switches) {
        expect(segmentAt(level, w.x, w.z)).not.toBeNull();
      }
    }
  });

  test('a route, where one is shipped, starts and ends on solid track', () => {
    for (const level of LEVELS) {
      for (const point of level.route ?? []) {
        expect(segmentAt(level, point.x, point.z)).not.toBeNull();
      }
    }
  });
});

test('a gate only blocks what is low enough to hit it', () => {
  const level = locked();
  const gate = level.gates[0];
  const high = step({ ...createGameState(level), z: gate.z - 0.5, y: gate.y + GATE_HEIGHT + BALL_RADIUS, vz: 11, vy: 2 }, level, FWD, dt);
  expect(high.z).toBeGreaterThan(gate.z - 0.5);
  expect(high.events.some((e) => e.type === 'gate')).toBe(false);
});
