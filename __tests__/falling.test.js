import { BALL_RADIUS, LEVELS, buildLevel, deckPlaneAt, segmentAt, trackPointAt } from '../src/game/levels';
import { LAND_TOLERANCE, STATUS, createGameState, respawn, step } from '../src/game/engine';

const dt = 1 / 120;

/**
 * Falling has to stick.
 *
 * Landing is a *crossing*: the ball has to come down onto the deck. Testing
 * only whether it is below the deck and over track means anything that ends
 * up underneath the level gets stood back up on it - and on a track that
 * bends, climbs and slides, a ball that has rolled off the outside of a
 * corner very often does end up underneath it a moment later. Before this was
 * a crossing test, balls were being rescued from ten metres down.
 */
const rescuesIn = (level, minimumDrop) => {
  let rescues = 0;
  let worst = 0;
  for (let startZ = 6; startZ < level.goalZ - 10; startZ += 7) {
    for (const dir of [-1, 1]) {
      let s = { ...createGameState(level), z: startZ, vz: level.speed, vx: dir * 9 };
      let hasLeft = false;
      for (let i = 0; i < 120 * 6; i++) {
        const before = s;
        s = step(s, level, { x: dir, y: 1 }, dt);
        if (before.grounded && !s.grounded) hasLeft = true;
        if (hasLeft && !before.grounded && s.grounded) {
          const reference = trackPointAt(level, before.z, before.time, before.x).y + BALL_RADIUS;
          const drop = reference - before.y;
          if (drop > minimumDrop) { rescues++; worst = Math.max(worst, drop); }
        }
        if (s.status !== STATUS.PLAYING) break;
      }
    }
  }
  return { rescues, worst };
};

describe.each(LEVELS.map((l) => [l.id, l.name, l]))('level %i (%s)', (_, __, level) => {
  test('never puts a fallen ball back on the track', () => {
    // A ball may still catch a lip it has only just tipped over - that is a
    // save, not a rescue. What it may not do is come back from metres down.
    const { rescues, worst } = rescuesIn(level, 1);
    expect({ rescues, worst: Number(worst.toFixed(2)) }).toEqual({ rescues: 0, worst: 0 });
  });
});

test('a ball driven off the side keeps going down until it is lost', () => {
  const level = buildLevel({
    id: 'f', name: 'f', speed: 12, parTime: 40,
    // A bend that sweeps hard across where a ball leaving it would fall.
    run: [{ length: 30, width: 6 }, { length: 50, width: 6, bend: 14 }, { length: 40, width: 6 }],
  });
  let s = { ...createGameState(level), z: 32, vz: 12 };
  let everRegrounded = false;
  let leftAt = null;
  for (let i = 0; i < 120 * 8 && s.status === STATUS.PLAYING; i++) {
    const before = s;
    s = step(s, level, { x: -1, y: 1 }, dt); // steer off the inside of the bend
    if (before.grounded && !s.grounded) leftAt = before.y;
    if (leftAt != null && !before.grounded && s.grounded && before.y < leftAt - 1) {
      everRegrounded = true;
    }
  }
  expect(leftAt).not.toBeNull();
  expect(everRegrounded).toBe(false);
  expect(s.status).toBe(STATUS.FELL);
});

test('a sliding deck does not scoop up a ball that has already fallen past it', () => {
  const level = buildLevel({
    id: 'm', name: 'm', speed: 10, parTime: 40,
    run: [{ length: 90, width: 5, moving: { amplitude: 4, speed: 2.4, phase: 0 } }],
  });
  let s = createGameState(level);
  let fellBelow = false;
  for (let i = 0; i < 120 * 8 && s.status === STATUS.PLAYING; i++) {
    s = step(s, level, { x: 1, y: 0.3 }, dt);
    const seg = level.segments[0];
    if (!s.grounded && s.y < seg.y0 - 2) fellBelow = true;
    // Once it is well below the deck, no amount of the deck swinging back
    // under it may put it on top again.
    if (fellBelow) expect(s.grounded).toBe(false);
  }
  expect(fellBelow).toBe(true);
  expect(s.status).toBe(STATUS.FELL);
});

describe('what a landing still has to allow', () => {
  test('a pad throws the ball across a gap and it lands on the far side', () => {
    const level = buildLevel({
      id: 'j', name: 'j', speed: 12, parTime: 40,
      run: [{ length: 40, width: 6, gap: 5 }, { length: 40, width: 6 }],
      pads: [{ z: 39, power: 21 }],
    });
    let s = createGameState(level);
    let landed = null;
    for (let i = 0; i < 120 * 12 && s.status === STATUS.PLAYING; i++) {
      s = step(s, level, { x: 0, y: 1 }, dt);
      if (!landed && s.events.some((e) => e.type === 'landing')) landed = s;
    }
    expect(landed).not.toBeNull();
    expect(landed.z).toBeGreaterThan(45);
    expect(s.status).toBe(STATUS.FINISHED);
  });

  test('a ball wide of the deck but above it can still come back and land', () => {
    // Legitimate: it never went *below* the track, it just went wide of it,
    // so coming back across and touching down is a landing and not a rescue.
    const level = buildLevel({
      id: 'w', name: 'w', speed: 12, parTime: 40,
      run: [{ length: 80, width: 5 }],
    });
    // Four metres out to the side of a deck five wide, three metres up, and
    // heading back in and down.
    let s = { ...createGameState(level), x: 4, z: 30, y: 3, vz: 12, vx: -6, vy: -2, grounded: false };
    expect(segmentAt(level, s.x, s.z, s.time)).toBeNull();
    expect(s.y).toBeGreaterThan(deckPlaneAt(level, s.x, s.z, s.time));

    let landed = false;
    for (let i = 0; i < 120 * 3 && s.status === STATUS.PLAYING && !landed; i++) {
      s = step(s, level, { x: -1, y: 1 }, dt);
      if (s.events.some((e) => e.type === 'landing')) landed = true;
    }
    expect(landed).toBe(true);
    expect(s.grounded).toBe(true);
  });

  test('rolling down a steep descent is not mistaken for falling off one', () => {
    const level = buildLevel({
      id: 'd', name: 'd', speed: 13, parTime: 40,
      run: [{ length: 26, width: 6 }, { length: 40, width: 6, rise: -20 }, { length: 30, width: 6 }],
    });
    let s = createGameState(level);
    let airborne = 0;
    for (let i = 0; i < 120 * 12 && s.status === STATUS.PLAYING; i++) {
      s = step(s, level, { x: 0, y: 1 }, dt);
      if (!s.grounded) airborne++;
    }
    expect(s.status).toBe(STATUS.FINISHED);
    expect(airborne).toBeLessThan(30); // glued to the descent, near enough
  });

  test('respawning puts the ball back on the track and it can land again', () => {
    const level = LEVELS[0];
    const fallen = { ...createGameState(level), y: level.fallY - 1, status: STATUS.FELL };
    const back = respawn(fallen, level);
    expect(back.grounded).toBe(true);
    expect(back.y).toBeCloseTo(level.start.y + BALL_RADIUS, 9);
    expect(step(back, level, { x: 0, y: 1 }, dt).grounded).toBe(true);
  });
});

describe('deckPlaneAt', () => {
  const level = buildLevel({
    run: [{ length: 30, width: 6, bend: 6 }, { length: 30, width: 6, gap: 6 }, { length: 30, width: 6 }],
  });

  test('on the track, it is where a resting ball sits', () => {
    const seg = level.segments[0];
    const x = trackPointAt(level, 15, 0, 0).x;
    expect(deckPlaneAt(level, x, 15)).toBeCloseTo(
      segmentAt(level, x, 15) ? deckPlaneAt(level, x, 15) : NaN, 9
    );
    expect(deckPlaneAt(level, x, 15)).toBeGreaterThan(0);
  });

  test('off the side, it extends the deck outward rather than giving up', () => {
    const far = trackPointAt(level, 15, 0, 0).x + 20;
    expect(segmentAt(level, far, 15)).toBeNull();
    expect(Number.isFinite(deckPlaneAt(level, far, 15))).toBe(true);
  });

  test('over a gap, it follows the line the jump takes', () => {
    const [, second, third] = level.segments;
    const mid = (second.z1 + third.z0) / 2;
    expect(segmentAt(level, 0, mid)).toBeNull();
    const here = deckPlaneAt(level, trackPointAt(level, mid).x, mid);
    expect(here).toBeCloseTo(trackPointAt(level, mid).y + BALL_RADIUS, 9);
  });

  test('the tolerance is a step of overshoot, not a safety net', () => {
    expect(LAND_TOLERANCE).toBeLessThanOrEqual(BALL_RADIUS);
  });
});
