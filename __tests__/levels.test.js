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

// Enough of a spread to cover any platform's cycle when checking reachability.
const SWING_SAMPLES = Array.from({ length: 64 }, (_, i) => (i * 12) / 64);

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

  test('adjoining segments (no gap between them) actually overlap sideways', () => {
    // Otherwise the track visibly fails to connect at that seam, even though
    // it's a false gap - z is continuous, only x has drifted too far.
    for (let i = 1; i < level.segments.length; i++) {
      const prev = level.segments[i - 1];
      const next = level.segments[i];
      if (next.z0 !== prev.z1) continue; // an intentional jump gap
      const halfSum = (prev.width + next.width) / 2;
      expect(Math.abs(next.x - prev.x)).toBeLessThan(halfSum);
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

  test('pads and spinners are never mounted on a moving platform', () => {
    // Both are authored in absolute world coordinates, so a sliding deck
    // would swim out from under them. Keep them on solid track.
    for (const thing of [...level.pads, ...level.spinners]) {
      const seg = level.segments.find((s) => thing.z >= s.z0 && thing.z <= s.z1);
      expect(seg?.moving).toBeUndefined();
    }
  });

  test('a moving platform never swings so far that it leaves its lane behind', () => {
    for (const seg of level.segments) {
      if (!seg.moving) continue;
      expect(seg.moving.amplitude).toBeGreaterThan(0);
      expect(Math.abs(seg.moving.speed)).toBeGreaterThan(0.1);
      // A deck that slides more than its own width past a neighbour reads as
      // teleporting rather than sliding.
      expect(seg.moving.amplitude).toBeLessThanOrEqual(seg.width);
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
      // Sample the swing: a coin over a moving platform only has to be
      // reachable at some point in the deck's travel, not at t=0.
      const onTrack = SWING_SAMPLES.some((t) => segmentAt(level, c.x, c.z, t) != null);
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
