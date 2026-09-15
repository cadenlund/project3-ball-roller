import {
  BALL_RADIUS,
  LEVELS,
  LEVEL_COUNT,
  PAD_RADIUS,
  buildLevel,
  getLevel,
  segmentAt,
} from '../src/game/levels';
import { GRAVITY } from '../src/game/engine';

test('there are five levels with unique, sequential ids', () => {
  expect(LEVEL_COUNT).toBe(5);
  expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5]);
});

test('getLevel throws for an id that does not exist', () => {
  expect(() => getLevel(99)).toThrow(/No level with id 99/);
});

test('buildLevel lays pieces end to end, leaving the declared gaps', () => {
  const l = buildLevel({ run: [{ length: 10, width: 4, gap: 3 }, { length: 5, width: 4 }] });
  expect(l.segments).toEqual([
    { z0: 0, z1: 10, x: 0, width: 4 },
    { z0: 13, z1: 18, x: 0, width: 4 },
  ]);
  expect(l.totalLength).toBe(18);
  expect(l.goalZ).toBe(16);
});

describe.each(LEVELS)('level $id ($name)', (level) => {
  test('has at least one track segment, all sanely sized', () => {
    expect(level.segments.length).toBeGreaterThan(0);
    for (const seg of level.segments) {
      expect(seg.z1).toBeGreaterThan(seg.z0);
      expect(seg.width).toBeGreaterThanOrEqual(2);
    }
  });

  test('segments never move backwards or overlap', () => {
    for (let i = 1; i < level.segments.length; i++) {
      expect(level.segments[i].z0).toBeGreaterThanOrEqual(level.segments[i - 1].z1);
    }
  });

  test('the ball starts on the track', () => {
    expect(segmentAt(level, level.start.x, level.start.z)).not.toBeNull();
  });

  test('the goal line is on the last segment', () => {
    const last = level.segments[level.segments.length - 1];
    expect(level.goalZ).toBeGreaterThan(last.z0);
    expect(level.goalZ).toBeLessThanOrEqual(last.z1);
  });

  test('every pad sits on the track', () => {
    for (const p of level.pads) {
      expect(segmentAt(level, p.x, p.z)).not.toBeNull();
      expect(p.power).toBeGreaterThan(0);
    }
  });

  test('every gap has a pad shortly before it, strong enough to clear it', () => {
    for (let i = 1; i < level.segments.length; i++) {
      const prev = level.segments[i - 1];
      const next = level.segments[i];
      if (next.z0 === prev.z1) continue; // no gap
      const pad = level.pads.find((p) => p.z <= prev.z1 && p.z >= prev.z1 - 8);
      expect(pad).toBeDefined();
      // Worst case the ball launches at first contact with the pad. The jump
      // must still carry it to the far side with 5% to spare.
      const launchZ = pad.z - PAD_RADIUS;
      const airtime = (2 * pad.power) / GRAVITY;
      const reach = airtime * level.speed * 0.95;
      expect(reach).toBeGreaterThanOrEqual(next.z0 - launchZ);
    }
  });

  test('every spinner pivots over the track, and actually spins', () => {
    for (const sp of level.spinners) {
      expect(segmentAt(level, sp.x, sp.z)).not.toBeNull();
      expect(Math.abs(sp.speed)).toBeGreaterThan(0.5);
      expect(sp.length).toBeGreaterThanOrEqual(3);
      expect(sp.length).toBeLessThanOrEqual(8);
    }
  });

  test('every coin is reachable: over the track, or low over a jumpable gap', () => {
    for (const c of level.coins) {
      const onTrack = segmentAt(level, c.x, c.z) != null;
      if (onTrack) continue;
      // Over a gap: must be within one, and low enough to grab mid-jump.
      const gap = level.segments.some(
        (seg, i) =>
          i > 0 && c.z > level.segments[i - 1].z1 && c.z < seg.z0
      );
      expect(gap).toBe(true);
      expect(c.y ?? 0.9).toBeLessThanOrEqual(2.5);
    }
  });

  test('no coin, pad or spinner sits on the start or past the goal', () => {
    for (const thing of [...level.coins, ...level.pads, ...level.spinners]) {
      expect(Math.abs(thing.z - level.start.z)).toBeGreaterThan(3);
      expect(thing.z).toBeLessThan(level.goalZ);
    }
  });

  test('par time is sane for the track length', () => {
    expect(level.parTime).toBeGreaterThan(5);
    expect(level.parTime).toBeLessThan(120);
    // Par must be beatable: a clean run takes about totalLength / speed.
    expect(level.parTime).toBeGreaterThan(level.totalLength / level.speed);
  });

  test('cruising speed is sane', () => {
    expect(level.speed).toBeGreaterThanOrEqual(5);
    expect(level.speed).toBeLessThanOrEqual(20);
  });

  test('the ball radius fits the narrowest piece of track', () => {
    for (const seg of level.segments) {
      expect(seg.width / 2).toBeGreaterThan(BALL_RADIUS * 2);
    }
  });
});
