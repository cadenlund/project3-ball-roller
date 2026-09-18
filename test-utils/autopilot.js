/**
 * A scripted driver good enough to finish a level: hold forward, steer toward
 * the centreline of whatever track is ahead, and jump nothing deliberately -
 * the pads do that. Used by the level suite to prove each level is completable
 * and to check pars are set to times a competent run can actually reach.
 *
 * Not a bot to beat the game, just a sanity check no level ships impossible.
 */
import { STATUS, createGameState, step } from '../src/game/engine';
import { BALL_RADIUS, bankAt, driftAt, trackPointAt } from '../src/game/levels';

/**
 * How far ahead to aim, as a time rather than a distance. A fixed distance is
 * too far on a slow, thin level - the driver cuts the corner and runs wide of
 * a line it has no room to run wide of - and not far enough on a fast one.
 */
const LOOKAHEAD_TIME = 0.5;
const AIRBORNE_TIME = 0.85; // in the air there is more time to line a landing up

/**
 * Where the driver wants to be, laterally. It aims at the centreline a little
 * way ahead rather than at its feet, so it leans into a bend before the bend
 * arrives instead of chasing it around the outside.
 */
const leadFor = (level, s) => level.speed * (s.grounded ? LOOKAHEAD_TIME : AIRBORNE_TIME);

function targetX(level, s) {
  return trackPointAt(level, s.z + leadFor(level, s), s.time, s.x).x;
}

/**
 * Some levels are locks, not races: the way through is a route you have to
 * work out, and no amount of following the centreline will find it. Those
 * levels ship the intended solution as a list of waypoints, and the driver
 * walks it - which is also what keeps the suite honest that the puzzle has an
 * answer at all, and that the answer still works after the level is edited.
 */
export const WAYPOINT_RADIUS = 3.5;
const CROSSING_SPEED = 5; // how fast the driver will slide across a lane

function waypoint(level, s, cursor) {
  const route = level.route;
  if (!route) return null;
  let i = cursor.at;
  while (i < route.length) {
    const point = route[i];
    if (Math.hypot(s.x - point.x, s.z - point.z) < WAYPOINT_RADIUS) i++;
    else break;
  }
  cursor.at = i;
  return route[i] ?? null;
}

/**
 * Steering in two parts. The feedforward half works out the sideways speed
 * the ball needs just to stay on a centreline that is already curving -
 * drift times forward speed - and asks for that directly, which is what a
 * driver does when they turn *into* a corner rather than chasing it round the
 * outside. The feedback half is a damped correction for wherever it actually
 * is. Camber falls out of this for free: the lean changes what vx the ball
 * settles at, and the controller simply asks for whatever makes up the
 * difference.
 */
export function autopilotTilt(level, s, cursor = { at: 0 }) {
  const here = trackPointAt(level, s.z, s.time, s.x);
  const wantVx = (here.segment ? driftAt(here.segment, s.z) : 0) * s.vz;

  // A shot is out of your hands. Steering during one only fights the barrel's
  // aim, and a cannon's aim is the whole reason it exists.
  if (s.events?.some((e) => e.type === 'fire')) cursor.coasting = true;
  if (s.grounded) cursor.coasting = false;
  if (cursor.coasting) return { x: 0, y: 0 };

  const point = waypoint(level, s, cursor);
  if (point) {
    // A waypoint says which way to go and which lane to be in, not where to
    // put the ball every metre of the way: between waypoints the driver still
    // follows the centreline, or it would hold a straight line through a bend
    // and roll off the outside of it. Only close to a waypoint does the
    // waypoint itself take over, which is what gets the ball across a
    // junction from one lane to another.
    const direction = point.z > s.z ? 1 : -1;
    const lane = trackPointAt(level, s.z + leadFor(level, s) * direction, s.time, point.x);
    const blend = Math.min(1, Math.abs(point.z - s.z) / 14);
    // Follow the centreline between waypoints - but only of the lane the ball
    // is actually on. Where a fork lies ahead, the nearest track a few metres
    // away belongs to a different lane entirely, and steering toward it means
    // driving off the side of the one underfoot. There, the waypoint's own x
    // is the only thing worth aiming at.
    const sameLane = lane.segment && here.segment && lane.segment.lane === here.segment.lane;
    const aim = sameLane ? point.x * (1 - blend) + lane.x * blend : point.x;
    // Aim at a lateral *speed*, not at a tilt. Steering straight off the
    // position error saturates whenever the target is a long way sideways -
    // which is exactly the case when crossing a junction from one lane to
    // another - and arrives at full lateral speed with no room to stop.
    // The speed asked for is the lane's own drift, which is what following a
    // curve costs, plus a bounded correction toward the waypoint.
    const follow = (here.segment ? driftAt(here.segment, s.z) : 0) * s.vz;
    const correct = Math.max(-CROSSING_SPEED, Math.min(CROSSING_SPEED, (aim - s.x) * 2));
    const x = Math.max(-1, Math.min(1, (follow + correct - s.vx) * 0.7));
    return { x, y: direction };
  }

  const error = targetX(level, s) - s.x;
  const x = Math.max(-1, Math.min(1, error * 1.8 + (wantVx - s.vx) * 0.6));
  return { x, y: 1 };
}

/**
 * Play a level to the end. Returns how it went - never throws, so a failing
 * run reports where it died rather than blowing up the test.
 */
export function autoplay(level, { dt = 1 / 120, maxSeconds = 180 } = {}) {
  let s = createGameState(level);
  let falls = 0;
  const cursor = { at: 0 };
  for (let i = 0; i < maxSeconds / dt; i++) {
    s = step(s, level, autopilotTilt(level, s, cursor), dt);
    if (s.status === STATUS.FINISHED) {
      return { finished: true, time: s.time, falls, coins: s.coins.filter(Boolean).length, z: s.z };
    }
    if (s.status === STATUS.FELL) {
      falls++;
      if (falls > 40) return { finished: false, time: s.time, falls, coins: 0, z: s.z };
      s = {
        ...s,
        x: level.start.x,
        y: (level.start.y ?? 0) + BALL_RADIUS,
        z: level.start.z,
        vx: 0, vy: 0, vz: 0,
        grounded: true, boost: 0, boostCap: 1,
        status: STATUS.PLAYING,
        falls,
      };
      cursor.at = 0; // back at the start, so the route starts again too
    }
  }
  return { finished: false, time: s.time, falls, coins: s.coins.filter(Boolean).length, z: s.z };
}
