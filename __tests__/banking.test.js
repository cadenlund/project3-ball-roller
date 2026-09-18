import { BANK_GRIP, GRAVITY, STATUS, createGameState, step } from '../src/game/engine';
import {
  BALL_RADIUS,
  BANK_BALANCE,
  LEVELS,
  bankSecAt,
  bankTanAt,
  MAX_BANK,
  bankAt,
  buildLevel,
  centerAt,
  curvatureAt,
  driftAt,
  heightAt,
  segmentAt,
  slopeAt,
  surfaceAt,
  surfaceRate,
  widthAt,
} from '../src/game/levels';
import { sampleSegment } from '../src/components/trackMesh';
import { autopilotTilt } from '../test-utils/autopilot';

/**
 * Banking is the one piece of geometry the physics and the renderer have to
 * agree about exactly. If the drawn deck leans and the simulated deck does
 * not, the ball visibly sinks into the raised half of every corner - which is
 * the bug this file exists to keep fixed.
 */

const corner = buildLevel({ run: [{ length: 40, width: 6, bend: 8 }] }).segments[0];
const straight = buildLevel({ run: [{ length: 40, width: 6 }] }).segments[0];
const diagonal = buildLevel({ run: [{ length: 40, width: 6, bend: 8 }, { length: 40, width: 6 }] });

describe('the deck leans into its corners', () => {
  test('straight track is dead level', () => {
    for (let z = 0; z <= 40; z += 2) expect(bankAt(straight, z)).toBeCloseTo(0, 12);
  });

  test('a corner banks, and never past the limit', () => {
    let peak = 0;
    for (let z = 0; z <= 40; z += 0.5) peak = Math.max(peak, Math.abs(bankAt(corner, z)));
    expect(peak).toBeGreaterThan(0.05);
    expect(peak).toBeLessThanOrEqual(MAX_BANK);
  });

  test('it leans INTO the turn: the outside edge is the high one', () => {
    // bend > 0 turns toward +x, so the outside of the turn is -x. The deck
    // has to be higher out there, not lower - adverse camber would throw the
    // ball off exactly where it least wants to be thrown off.
    const z = 10; // early in the bend, where it is turning hardest
    expect(curvatureAt(corner, z)).toBeGreaterThan(0);
    const centre = centerAt(corner, z);
    const outside = surfaceAt(corner, centre - 2, z);
    const inside = surfaceAt(corner, centre + 2, z);
    expect(outside).toBeGreaterThan(inside);
  });

  test('a constant-angle diagonal is flat: heading is not turning', () => {
    // The second piece inherits the first one's exit heading and holds it.
    // It is at an angle, but it is not a corner, so it must not be banked.
    const [, second] = diagonal.segments;
    expect(Math.abs(driftAt(second, 60))).toBeLessThan(1e-9);
    expect(bankAt(second, 60)).toBeCloseTo(0, 9);
  });
});

describe('the drawn surface is the surface the ball rolls on', () => {
  test.each(LEVELS.map((l) => [l.id, l]))('level %i', (_, level) => {
    for (const seg of level.segments) {
      for (const sample of sampleSegment(seg, 0)) {
        const z = (seg.z0 + seg.z1) / 2 - sample.z;
        // Both edges of the drawn cross-section, put back into world space.
        for (const side of [-1, 1]) {
          const across = side * sample.half;
          const x = centerAt(seg, z, 0) + across * Math.cos(sample.bank);
          const drawnY = seg.y0 + sample.y + across * Math.sin(sample.bank);
          expect(surfaceAt(seg, x, z, 0)).toBeCloseTo(drawnY, 6);
        }
      }
    }
  });
});

describe('curvature never jumps at a seam', () => {
  // Position and heading matching stops a kink; curvature matching stops a
  // crease - and because bank is driven by curvature, it is also the only
  // reason the lean does not snap from one value to another mid-track.
  test.each(LEVELS.map((l) => [l.id, l]))('level %i', (_, level) => {
    for (const seg of level.segments) {
      expect(curvatureAt(seg, seg.z0)).toBeCloseTo(0, 9);
      expect(curvatureAt(seg, seg.z1)).toBeCloseTo(0, 9);
      expect(bankAt(seg, seg.z0)).toBeCloseTo(0, 9);
      expect(bankAt(seg, seg.z1)).toBeCloseTo(0, 9);
    }
  });
});

describe('a ball rolling a banked corner', () => {
  const level = buildLevel({
    id: 'b', name: 'b', speed: 12, parTime: 40,
    run: [{ length: 30, width: 7 }, { length: 50, width: 7, bend: 9 }, { length: 30, width: 7 }],
  });

  test('rests on the deck, never inside it', () => {
    let s = createGameState(level);
    let banked = 0;
    for (let i = 0; i < 120 * 12 && s.status !== 'fell'; i++) {
      s = step(s, level, { x: Math.sin(i / 40) * 0.35, y: 1 }, 1 / 120);
      if (!s.grounded) continue;
      const seg = segmentAt(level, s.x, s.z, s.time);
      if (!seg) continue;
      const bank = bankAt(seg, s.z);
      if (Math.abs(bank) > 0.05) banked++;
      // The gap between the ball's centre and the deck below it, measured
      // perpendicular to the deck, is exactly one radius. Less would be the
      // ball inside the road; more would be it hovering.
      const clearance = (s.y - surfaceAt(seg, s.x, s.z, s.time)) * Math.cos(bank);
      expect(clearance).toBeCloseTo(BALL_RADIUS, 6);
    }
    expect(banked).toBeGreaterThan(100); // it really did spend time leaning
  });

  test('is pushed toward the inside of the turn by the camber', () => {
    // Hands off the wheel: the only sideways force is the lean of the deck,
    // and it must push the same way the corner goes.
    const seg = level.segments[1];
    const startX = centerAt(seg, 45, 0);
    let s = { ...createGameState(level), x: startX, z: 45, vz: 12 };
    for (let i = 0; i < 20; i++) s = step(s, level, { x: 0, y: 0 }, 1 / 120);
    expect(curvatureAt(seg, 45)).toBeGreaterThan(0);
    expect(s.vx).toBeGreaterThan(0); // toward +x, the way the bend turns
    expect(s.x).toBeGreaterThan(startX);
  });

  test('camber pull is gravity down the deck, not an invented force', () => {
    const seg = level.segments[1];
    const z = 45;
    const bank = bankAt(seg, z);
    let s = { ...createGameState(level), x: centerAt(seg, z, 0), z, vz: 0, vx: 0 };
    const next = step(s, level, { x: 0, y: 0 }, 1 / 120);
    const expected = -GRAVITY * BANK_GRIP * Math.sin(bank) * Math.cos(bank) / 120;
    // Drag acts on the result, so compare before it: within a few percent.
    expect(next.vx / expected).toBeGreaterThan(0.95);
    expect(next.vx / expected).toBeLessThanOrEqual(1);
  });
});

test('the deck stays exactly as wide as it says it is, measured along the lean', () => {
  // Width is measured across the tilted surface, so a banked deck is narrower
  // in world x than it is in metres of road. Both readings have to agree.
  for (let z = 0; z <= 40; z += 2) {
    const bank = bankAt(corner, z);
    const half = widthAt(corner, z) / 2;
    const edge = centerAt(corner, z) + half * Math.cos(bank);
    expect(segmentAt({ segments: [corner] }, edge, z)).not.toBeNull();
    const past = centerAt(corner, z) + (half + BALL_RADIUS) * Math.cos(bank);
    expect(segmentAt({ segments: [corner] }, past, z)).toBeNull();
    expect(surfaceAt(corner, edge, z)).toBeCloseTo(heightAt(corner, z) + half * Math.sin(bank), 9);
  }
});

describe('a banked corner does not throw the ball off the track', () => {
  /**
   * The bug this guards: a grounded ball used to track only the *length-wise*
   * slope of the deck. On a banked corner the surface also falls away across
   * its own width, so a ball sliding down the camber was running off a
   * descent - the deck dropped out from under it faster than gravity pulled
   * it down, and it went airborne the instant a corner started. From the
   * player's seat the ball stopped responding and then died.
   */
  test.each(LEVELS.map((l) => [l.id, l]))('level %i keeps the ball on the deck through every corner', (_, level) => {
    let s = createGameState(level);
    const cursor = { at: 0 };
    let onBankedTrack = 0;
    let thrownOff = 0;
    for (let i = 0; i < 120 * 60 && s.status === STATUS.PLAYING; i++) {
      const before = s;
      s = step(s, level, autopilotTilt(level, s, cursor), 1 / 120);
      const seg = segmentAt(level, s.x, s.z, s.time);
      if (!seg) continue; // out over a gap: nothing underneath to leave
      const bank = bankAt(seg, s.z);
      if (Math.abs(bank) < 0.02) continue;
      onBankedTrack++;
      // The moment that matters is leaving the deck. On a corner with no
      // gradient along it, and with nothing that launches the ball, the only
      // thing that can have thrown it off is the camber.
      const launched = s.events.some((e) => e.type === 'pad' || e.type === 'boost');
      if (before.grounded && !s.grounded && !launched && Math.abs(slopeAt(seg, s.z)) < 0.05) {
        thrownOff++;
      }
    }
    expect(onBankedTrack).toBeGreaterThan(50);
    expect(thrownOff).toBe(0);
  });

  test('the ball tracks the surface exactly as it slides down a camber', () => {
    const level = buildLevel({
      id: 'c', name: 'c', speed: 12, parTime: 40,
      run: [{ length: 30, width: 9 }, { length: 60, width: 9, bend: 12 }, { length: 30, width: 9 }],
    });
    let s = { ...createGameState(level), z: 40, vz: 12 };
    let slid = 0;
    for (let i = 0; i < 120 * 4; i++) {
      const before = s;
      s = step(s, level, { x: 0, y: 1 }, 1 / 120); // no steering: only camber moves it
      const seg = segmentAt(level, s.x, s.z, s.time);
      if (!seg || !s.grounded) continue;
      if (Math.abs(s.x - before.x) > 0.001) slid++;
      const rest = surfaceAt(seg, s.x, s.z, s.time) + BALL_RADIUS / Math.cos(bankAt(seg, s.z));
      expect(s.y).toBeCloseTo(rest, 6);
    }
    expect(slid).toBeGreaterThan(100);
  });

  test('the lean is what the corner needs, not a number picked for looks', () => {
    // tan(bank) = BANK_BALANCE * v^2 * curvature / g, capped.
    for (const level of LEVELS) {
      for (const seg of level.segments) {
        for (let i = 1; i < 20; i++) {
          const z = seg.z0 + ((seg.z1 - seg.z0) * i) / 20;
          const want = (BANK_BALANCE * level.speed * level.speed * curvatureAt(seg, z)) / GRAVITY;
          const capped = Math.max(-MAX_BANK, Math.min(MAX_BANK, Math.atan(want)));
          expect(bankAt(seg, z)).toBeCloseTo(-capped, 9);
        }
      }
    }
  });

  test('a gentle bend leans gently and a tight one leans hard', () => {
    const gentle = buildLevel({ speed: 11, run: [{ length: 60, width: 6, bend: 4 }] }).segments[0];
    const tight = buildLevel({ speed: 11, run: [{ length: 30, width: 6, bend: 8 }] }).segments[0];
    const peak = (seg) => Math.max(...Array.from({ length: 60 }, (_, i) =>
      Math.abs(bankAt(seg, seg.z0 + ((seg.z1 - seg.z0) * i) / 60))));
    expect(peak(tight)).toBeGreaterThan(peak(gentle) * 3);
  });
});

describe('surfaceRate', () => {
  /**
   * It is written analytically for speed, which means it can silently stop
   * agreeing with the surface it is supposed to describe. So it is checked
   * against a plain numerical derivative of `surfaceAt` along the ball's own
   * path - the definition it is an optimisation of.
   */
  const numeric = (seg, x, z, vx, vz, h = 1e-4) => {
    const at = (t) => surfaceAt(seg, x + vx * t, z + vz * t, 0);
    return (at(h) - at(-h)) / (2 * h);
  };

  test.each(LEVELS.map((l) => [l.id, l]))('matches the real surface on level %i', (_, level) => {
    for (const seg of level.segments) {
      if (seg.moving) continue; // the deck is sliding; the comparison needs a fixed one
      for (let i = 1; i < 12; i++) {
        const z = seg.z0 + ((seg.z1 - seg.z0) * i) / 12;
        for (const across of [-1.5, 0, 1.5]) {
          const x = centerAt(seg, z, 0) + across;
          for (const [vx, vz] of [[0, 10], [6, 0], [-4, 12]]) {
            expect(surfaceRate(seg, x, z, vx, vz, 0)).toBeCloseTo(numeric(seg, x, z, vx, vz), 3);
          }
        }
      }
    }
  });

  test('is just the gradient on flat, straight deck', () => {
    const flat = buildLevel({ run: [{ length: 40, width: 6 }] }).segments[0];
    expect(surfaceRate(flat, 1.5, 20, 5, 10, 0)).toBe(0);
    const ramp = buildLevel({ run: [{ length: 40, width: 6, rise: 6 }] }).segments[0];
    expect(surfaceRate(ramp, 1.5, 20, 5, 10, 0)).toBeCloseTo(slopeAt(ramp, 20) * 10, 9);
  });
});

test('the tangent shortcuts agree with the angle they stand in for', () => {
  // bankTanAt, bankSecAt and the camber term are all written without trig.
  // They have to keep matching the angle bankAt reports.
  for (const level of LEVELS) {
    for (const seg of level.segments) {
      for (let i = 0; i <= 20; i++) {
        const z = seg.z0 + ((seg.z1 - seg.z0) * i) / 20;
        const angle = bankAt(seg, z);
        expect(bankTanAt(seg, z)).toBeCloseTo(Math.tan(angle), 9);
        expect(bankSecAt(seg, z)).toBeCloseTo(1 / Math.cos(angle), 9);
        const tan = bankTanAt(seg, z);
        expect(tan / (1 + tan * tan)).toBeCloseTo(Math.sin(angle) * Math.cos(angle), 9);
      }
    }
  }
});
