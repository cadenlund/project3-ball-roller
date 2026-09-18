import {
  BALL_RADIUS,
  BANK_BALANCE,
  BOOST_LIFT,
  DEFAULT_SPEED,
  FALL_DEPTH,
  LEVELS,
  LEVEL_COUNT,
  PAD_RADIUS,
  bankAt,
  buildLevel,
  cannonShot,
  centerAt,
  driftAt,
  exitX,
  launchers,
  getLevel,
  heightAt,
  SPINNER_BAR_HALF,
  segmentAt,
  segmentShift,
  slopeAt,
  surfaceAt,
  trackPointAt,
  widthAt,
} from '../src/game/levels';
import { DRIVE_ACCEL, GRAVITY, MAX_LATERAL, OVERSPEED } from '../src/game/engine';

const entry = (seg) => seg.x;

// Enough of a spread to cover any platform's cycle when checking reachability.
const SWING_SAMPLES = Array.from({ length: 64 }, (_, i) => (i * 12) / 64);

test('every level has a unique, sequential id', () => {
  expect(LEVEL_COUNT).toBe(12);
  expect(LEVELS.map((l) => l.id)).toEqual(Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1));
});

test('getLevel throws for an id that does not exist', () => {
  expect(() => getLevel(99)).toThrow(/No level with id 99/);
});

test('buildLevel lays pieces end to end, leaving the declared gaps', () => {
  const l = buildLevel({ run: [{ length: 10, width: 4, gap: 3 }, { length: 5, width: 4 }] });
  // The shape of each piece, which is what the level actually declared.
  expect(l.segments.map(({ z0, z1, x, w0, width, bend, y0, y1, crest, lane }) =>
    ({ z0, z1, x, w0, width, bend, y0, y1, crest, lane }))).toEqual([
    { z0: 0, z1: 10, x: 0, w0: 4, width: 4, bend: 0, y0: 0, y1: 0, crest: 0, lane: 0 },
    { z0: 13, z1: 18, x: 0, w0: 4, width: 4, bend: 0, y0: 0, y1: 0, crest: 0, lane: 0 },
  ]);
  // ...plus what buildLevel works out once so the hot path does not have to:
  // how hard a corner leans, and whether this piece bends or climbs at all.
  const bankScale = (BANK_BALANCE * DEFAULT_SPEED * DEFAULT_SPEED) / GRAVITY;
  for (const seg of l.segments) {
    expect(seg.bankScale).toBeCloseTo(bankScale, 9);
    expect(seg.straight).toBe(true);
    expect(seg.level).toBe(true);
  }
  expect(l.totalLength).toBe(18);
  expect(l.goalZ).toBe(16);
});

test('a piece picks up where the last one left off: sideways, height and width', () => {
  const l = buildLevel({
    run: [
      { length: 20, width: 6, bend: 6, rise: 3 },
      { length: 20, width: 3, bend: -2 },          // no x or y: inherits both
      { length: 20, width: 3, x: 0, y: 0, entryWidth: 5 }, // unless it says
    ],
  });
  expect(l.segments.map((s) => [s.x, s.y0, s.y1, s.w0, s.width])).toEqual([
    [0, 0, 3, 6, 6],
    [6, 3, 3, 6, 3],
    [0, 0, 0, 5, 3],
  ]);
});

test('a narrowing tapers across its piece instead of stepping at the seam', () => {
  const l = buildLevel({ run: [{ length: 20, width: 6 }, { length: 20, width: 3 }] });
  const [wide, narrow] = l.segments;
  expect(widthAt(wide, 20)).toBeCloseTo(6, 9);
  expect(widthAt(narrow, 20)).toBeCloseTo(6, 9);   // flush at the joint
  expect(widthAt(narrow, 30)).toBeCloseTo(4.5, 9); // halfway down the taper
  expect(widthAt(narrow, 40)).toBeCloseTo(3, 9);
});

test('shaped pieces start and end exactly where their plain ends say they do', () => {
  // Every shaping function is flat at both ends, which is what lets pieces be
  // laid end to end without a kink. A weave that did not come home would tear
  // the track apart at the seam.
  const l = buildLevel({
    run: [{ length: 30, width: 5, bend: 4, rise: 3, crest: 6, wave: { amplitude: 3, cycles: 1 } }],
  });
  const [seg] = l.segments;
  expect(centerAt(seg, seg.z0)).toBeCloseTo(seg.x, 9);
  expect(centerAt(seg, seg.z1)).toBeCloseTo(exitX(seg), 9);
  expect(heightAt(seg, seg.z0)).toBeCloseTo(seg.y0, 9);
  expect(heightAt(seg, seg.z1)).toBeCloseTo(seg.y1, 9);
  // ...and the crest really does arc over the middle.
  expect(heightAt(seg, (seg.z0 + seg.z1) / 2)).toBeCloseTo(seg.y0 + 1.5 + 6, 6);
});

test('props are placed against the track, not against the world', () => {
  const l = buildLevel({
    run: [{ length: 40, width: 6, bend: 8, rise: 10 }],
    coins: [{ z: 20, across: 2 }],
    pads: [{ z: 20, power: 20 }],
  });
  const [seg] = l.segments;
  expect(l.coins[0].x).toBeCloseTo(centerAt(seg, 20) + 2, 9);
  expect(l.coins[0].y).toBeCloseTo(heightAt(seg, 20) + 0.9, 9);
  expect(l.pads[0].x).toBeCloseTo(centerAt(seg, 20), 9);
  expect(l.pads[0].y).toBeCloseTo(heightAt(seg, 20), 9);
});

test('the fall line sits below the lowest point of the track, dip included', () => {
  const l = buildLevel({ run: [{ length: 40, width: 5, crest: -9 }] });
  expect(l.fallY).toBeCloseTo(-9 - FALL_DEPTH, 6);
});

describe.each(LEVELS)('level $id ($name)', (level) => {
  test('has at least one track segment, all sanely sized', () => {
    expect(level.segments.length).toBeGreaterThan(0);
    for (const seg of level.segments) {
      expect(seg.z1).toBeGreaterThan(seg.z0);
      expect(seg.width).toBeGreaterThanOrEqual(2);
    }
  });

  test('the main run never moves backwards or overlaps itself', () => {
    for (let i = 1; i < level.mainSegments.length; i++) {
      expect(level.mainSegments[i].z0).toBeGreaterThanOrEqual(level.mainSegments[i - 1].z1);
    }
  });

  test('a spur runs beside the main line, never through it', () => {
    // Two lanes may share a stretch of the level, but not a piece of space:
    // wherever they overlap in z they have to be clear of each other in x, or
    // the ball would be on both at once and on neither in particular.
    for (const spur of level.segments.filter((s) => s.lane > 0)) {
      for (const spine of level.mainSegments) {
        if (spur.z1 <= spine.z0 || spur.z0 >= spine.z1) continue;
        const lo = Math.max(spur.z0, spine.z0);
        const hi = Math.min(spur.z1, spine.z1);
        for (let i = 0; i <= 12; i++) {
          const z = lo + ((hi - lo) * i) / 12;
          const clear = widthAt(spur, z) / 2 + widthAt(spine, z) / 2 + BALL_RADIUS * 2;
          expect(Math.abs(centerAt(spur, z, 0) - centerAt(spine, z, 0))).toBeGreaterThan(clear);
        }
      }
    }
  });

  test('adjoining segments (no gap between them) actually join up', () => {
    // Otherwise the track visibly fails to connect at that seam, even though
    // it's a false gap - z is continuous, only the line has drifted too far.
    for (let i = 1; i < level.mainSegments.length; i++) {
      const prev = level.mainSegments[i - 1];
      const next = level.mainSegments[i];
      if (next.z0 !== prev.z1) continue; // an intentional jump gap
      const halfSum = (prev.width + next.width) / 2;
      expect(Math.abs(entry(next) - exitX(prev))).toBeLessThan(halfSum);
      // A step in the deck would be a wall to roll into, not a slope, and a
      // step in the width would be a visible notch in the edge of the track.
      expect(next.y0).toBeCloseTo(prev.y1, 9);
      expect(next.w0).toBeCloseTo(prev.width, 9);
      expect(widthAt(next, next.z0)).toBeCloseTo(widthAt(prev, prev.z1), 9);
    }
  });

  test('no climb is steeper than the ball can actually get up', () => {
    // Gravity along the slope is GRAVITY * sin(angle) and the ball can only
    // push back with DRIVE_ACCEL, so a climb past that is a wall: stop on it
    // once and the run is stuck. Descents get a looser bound - dropping fast
    // is the point of them - but nothing may be a cliff either way.
    for (const seg of level.segments) {
      for (let i = 0; i <= 20; i++) {
        const z = seg.z0 + ((seg.z1 - seg.z0) * i) / 20;
        const slope = slopeAt(seg, z);
        const pull = (GRAVITY * Math.abs(slope)) / Math.sqrt(1 + slope * slope);
        if (slope > 0) expect(pull).toBeLessThan(DRIVE_ACCEL * 0.8);
        expect(Math.abs(slope)).toBeLessThan(1);
      }
    }
  });

  test('the ball starts on the track, at its height', () => {
    expect(segmentAt(level, level.start.x, level.start.z)).not.toBeNull();
    expect(level.start.y).toBeCloseTo(heightAt(level.segments[0], level.start.z), 9);
  });

  test('the level opens on flat ground, so nobody is dropped into a slope', () => {
    expect(Math.abs(slopeAt(level.segments[0], level.start.z))).toBeLessThan(0.05);
  });

  test('the goal line is on the last segment', () => {
    const last = level.mainSegments[level.mainSegments.length - 1];
    expect(level.goalZ).toBeGreaterThan(last.z0);
    expect(level.goalZ).toBeLessThanOrEqual(last.z1);
  });

  test('every pad sits on the track, on its surface', () => {
    for (const p of level.pads) {
      const seg = segmentAt(level, p.x, p.z);
      expect(seg).not.toBeNull();
      expect(p.power).toBeGreaterThan(0);
      expect(p.y).toBeCloseTo(heightAt(seg, p.z), 6);
    }
  });

  test('every booster sits over the track and actually speeds you up', () => {
    for (const b of level.boosters) {
      const seg = segmentAt(level, b.x, b.z);
      expect(seg).not.toBeNull();
      expect(b.speed ?? 0).toBeGreaterThan(1);
      expect(b.speed).toBeLessThanOrEqual(OVERSPEED);
      // It hovers over the deck rather than lying flush in it, but not so
      // high the ball would pass underneath.
      expect(b.lift).toBe(BOOST_LIFT);
      expect(b.y).toBeCloseTo(surfaceAt(seg, b.x, b.z, 0) + BOOST_LIFT, 6);
      expect(BOOST_LIFT).toBeLessThan(BALL_RADIUS * 2);
    }
  });

  test('pads and spinners are never mounted on a moving platform', () => {
    // Both are authored in absolute world coordinates, so a sliding deck
    // would swim out from under them. Keep them on solid track.
    for (const thing of [...level.pads, ...level.boosters, ...level.spinners]) {
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

  test('every gap has a launcher before it, strong enough to clear it', () => {
    for (let i = 1; i < level.mainSegments.length; i++) {
      const prev = level.mainSegments[i - 1];
      const next = level.mainSegments[i];
      if (next.z0 === prev.z1) continue; // no gap
      // A gap a spur bridges is not a jump - it is a fork, and the way across
      // is to drive round it rather than over it.
      const bridged = level.segments.some(
        (spur) => spur.lane > 0 && spur.z0 <= prev.z1 + 0.01 && spur.z1 >= next.z0 - 0.01
      );
      if (bridged) continue;
      // Nor is a gap a cannon is aimed across: nothing is meant to jump it.
      const shot = level.cannons.some((c) => c.z <= prev.z1 && cannonShot(level, c).z > next.z0);
      if (shot) continue;
      const launcher = launchers(level).find((l) => l.z <= prev.z1 && l.z >= prev.z1 - 8);
      expect(launcher).toBeDefined();
      // Worst case the ball launches at first contact. The jump must still
      // carry it to the far side with 5% to spare. Any drop across the gap is
      // free airtime, so judging it flat is the safe read.
      const launchZ = launcher.z - PAD_RADIUS;
      const speed = level.speed * launcher.speed;
      const airtime = 2 * Math.sqrt((2 * launcher.apex) / GRAVITY);
      const reach = airtime * speed * 0.95;
      expect(reach).toBeGreaterThanOrEqual(next.z0 - launchZ);

      // Spanning the distance is not the same as clearing the ledge. Where
      // the far side is higher, fly the actual arc: how high is the ball at
      // the moment it arrives over the lip? Comparing the step against the
      // apex instead would pass jumps that peak long after the wall.
      const step = next.y0 - prev.y1;
      if (step > 0) {
        const t = (next.z0 - launchZ) / speed;
        const climb = Math.sqrt(2 * GRAVITY * launcher.apex) * t - (GRAVITY * t * t) / 2;
        expect(climb).toBeGreaterThan(step + 0.3);
      }
    }
  });

  test('no curve turns harder than the ball can steer through it', () => {
    // Following the centreline costs dx/dz * forward speed of lateral speed.
    // Ask for more than the ball has and the track cannot be driven at all.
    for (const seg of level.segments) {
      for (let i = 0; i <= 40; i++) {
        const z = seg.z0 + ((seg.z1 - seg.z0) * i) / 40;
        expect(Math.abs(driftAt(seg, z)) * level.speed).toBeLessThan(MAX_LATERAL * 0.85);
      }
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
      // `lift` is height over the deck, so this reads the same whether the
      // track under the coin is at ground level or forty metres up.
      if (onTrack) {
        expect(c.lift).toBeLessThanOrEqual(2.5);
        continue;
      }
      // Over a gap: must be within one, and on the arc of the jump that
      // crosses it rather than under it. A pad throws the ball
      // power^2 / 2g above the deck, and nothing is worth placing right at
      // the apex, so allow most of that climb.
      const gap = level.segments.some(
        (seg, i) =>
          i > 0 && c.z > level.segments[i - 1].z1 && c.z < seg.z0
      );
      expect(gap).toBe(true);
      const apex = Math.max(...launchers(level).map((l) => l.apex));
      expect(c.lift).toBeLessThanOrEqual(apex);
      expect(c.y).toBeCloseTo(trackPointAt(level, c.z).y + c.lift, 6);
    }
  });

  test('no coin, pad or spinner sits on the start or past the goal', () => {
    for (const thing of [...level.coins, ...level.pads, ...level.boosters, ...level.spinners]) {
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

  test('the goal gate is drawn on the line the ball actually crosses', () => {
    const last = level.mainSegments[level.mainSegments.length - 1];
    expect(level.goalX).toBeCloseTo(centerAt(last, level.goalZ, 0), 9);
    expect(level.goalY).toBeCloseTo(heightAt(last, level.goalZ), 9);
  });

  test('the ball radius fits the narrowest piece of track', () => {
    for (const seg of level.segments) {
      expect(seg.width / 2).toBeGreaterThan(BALL_RADIUS * 2);
    }
  });
});

describe.each(LEVELS)('level $id ($name) spinners', (level) => {
  test('every bar clears the deck right round its sweep', () => {
    // A bar is rigid and the track is not flat. Its tip passes over track
    // that slopes, banks and curves away from the pivot, and anywhere that
    // track rises above the bar's underside it saws straight through it.
    for (const sp of level.spinners) {
      const reach = sp.length / 2 + SPINNER_BAR_HALF;
      for (let i = 0; i < 64; i++) {
        const angle = (i * 2 * Math.PI) / 64;
        for (const r of [reach, reach * 0.7, reach * 0.4, 0]) {
          const x = sp.x + Math.cos(angle) * r;
          const z = sp.z + Math.sin(angle) * r;
          const seg = level.segments.find((g) => z >= g.z0 && z <= g.z1);
          if (!seg) continue;
          // The bar turns in the deck's own plane, so its underside at this
          // point is the mounting plane less half its thickness.
          const plane = sp.y + (z - sp.z) * sp.pitch + (x - sp.x) * Math.tan(sp.roll);
          expect(plane - SPINNER_BAR_HALF).toBeGreaterThan(surfaceAt(seg, x, z, 0));
        }
      }
    }
  });

  test('but no bar floats so high the ball rolls under it', () => {
    for (const sp of level.spinners) {
      expect(sp.y - trackPointAt(level, sp.z).y).toBeLessThan(BALL_RADIUS * 2);
    }
  });

  test('is mounted in the plane of the deck under it', () => {
    for (const sp of level.spinners) {
      const seg = level.segments.find((g) => sp.z >= g.z0 && sp.z <= g.z1);
      expect(sp.pitch).toBeCloseTo(slopeAt(seg, sp.z), 9);
      expect(sp.roll).toBeCloseTo(bankAt(seg, sp.z), 9);
    }
  });
});


test('the straight and level shortcuts agree with the maths they skip', () => {
  // Both flags exist only to let the hot path bail out early. If one is ever
  // set on a piece that does bend or climb, the geometry silently flattens.
  for (const level of LEVELS) {
    for (const seg of level.segments) {
      for (let i = 0; i <= 20; i++) {
        const z = seg.z0 + ((seg.z1 - seg.z0) * i) / 20;
        if (seg.straight) {
          // A sliding deck is still 'straight': it does not bend, it translates.
          expect(centerAt(seg, z, 0)).toBeCloseTo(seg.x + segmentShift(seg, 0), 9);
          expect(driftAt(seg, z)).toBe(0);
          expect(bankAt(seg, z)).toBe(0);
        }
        if (seg.level) {
          expect(heightAt(seg, z)).toBeCloseTo(seg.y0, 9);
          expect(slopeAt(seg, z)).toBe(0);
        }
      }
    }
  }
});
