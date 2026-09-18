/**
 * A scripted driver good enough to finish a level: hold forward, steer toward
 * the middle of whatever track is ahead, and jump nothing deliberately - the
 * pads do that. Used by the level suite to prove each level is completable
 * and to check pars are set to times a competent run can actually reach.
 *
 * Not a bot to beat the game, just a sanity check no level ships impossible.
 */
import { STATUS, createGameState, step } from '../src/game/engine';
import { segmentCenter } from '../src/game/levels';

const LOOKAHEAD = 6; // world units ahead to aim at

/** Where the driver wants to be, laterally, given where it is now. */
function targetX(level, s) {
  const aheadZ = s.z + LOOKAHEAD;
  const ahead =
    level.segments.find((seg) => aheadZ >= seg.z0 && aheadZ <= seg.z1) ??
    level.segments.find((seg) => seg.z0 > s.z) ??
    level.segments.find((seg) => s.z >= seg.z0 && s.z <= seg.z1);
  return ahead ? segmentCenter(ahead, s.time) : s.x;
}

/** Proportional steering with damping, so it settles instead of weaving. */
export function autopilotTilt(level, s) {
  const error = targetX(level, s) - s.x;
  const x = Math.max(-1, Math.min(1, error * 1.6 - s.vx * 0.35));
  return { x, y: 1 };
}

/**
 * Play a level to the end. Returns how it went - never throws, so a failing
 * run reports where it died rather than blowing up the test.
 */
export function autoplay(level, { dt = 1 / 120, maxSeconds = 180 } = {}) {
  let s = createGameState(level);
  let falls = 0;
  for (let i = 0; i < maxSeconds / dt; i++) {
    s = step(s, level, autopilotTilt(level, s), dt);
    if (s.status === STATUS.FINISHED) {
      return { finished: true, time: s.time, falls, coins: s.coins.filter(Boolean).length, z: s.z };
    }
    if (s.status === STATUS.FELL) {
      falls++;
      if (falls > 40) return { finished: false, time: s.time, falls, coins: 0, z: s.z };
      s = { ...s, x: level.start.x, y: 0.5, z: level.start.z, vx: 0, vy: 0, vz: 0, grounded: true, status: STATUS.PLAYING, falls };
    }
  }
  return { finished: false, time: s.time, falls, coins: s.coins.filter(Boolean).length, z: s.z };
}
