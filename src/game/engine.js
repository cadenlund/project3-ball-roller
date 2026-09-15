/**
 * Ball physics and level state.
 *
 * Everything here is a pure function over plain data - no React, no timers,
 * no rendering - so the whole game can be simulated and unit tested without a
 * device. `step()` takes the current state plus a tilt vector and returns the
 * next state; it never mutates its input.
 *
 * The world: the ball rolls forward along +Z on its own at the level's
 * cruising speed. tilt.x steers left and right; tilt.y leans forward (faster)
 * or back (brakes). Leave the track under the ball and gravity takes over.
 */

import {
  BALL_RADIUS,
  COIN_RADIUS,
  FALL_Y,
  PAD_RADIUS,
  SPINNER_HALF_WIDTH,
  SPINNER_HEIGHT,
  segmentAt,
} from './levels';

export const GRAVITY = 55;        // world units/s^2
export const STEER_ACCEL = 34;    // lateral units/s^2 at full tilt
export const DRIVE_ACCEL = 30;    // forward/back units/s^2 at full tilt
export const ROLL_DRAG = 0.12;    // velocity retained per second while grounded
export const MAX_LATERAL = 11;    // lateral speed cap, units/s
export const REVERSE_FACTOR = 0.5;// reversing is allowed, at half the speed cap
export const AIR_CONTROL = 0.45;  // tilt strength while airborne
export const SPIN_PUSH = 9;       // sideways shove from a spinner hit

export const STATUS = {
  PLAYING: 'playing',
  FELL: 'fell',
  FINISHED: 'finished',
};

export function createGameState(level) {
  return {
    levelId: level.id,
    x: level.start.x,
    y: BALL_RADIUS,
    z: level.start.z,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: true,
    time: 0,
    status: STATUS.PLAYING,
    coins: level.coins.map(() => false), // collected flags, by index
    falls: 0,
  };
}

const clamp1 = (v) => Math.max(-1, Math.min(1, v));

/**
 * Advance the world by dt seconds.
 * `tilt` is {x, y} in roughly -1..1, from the accelerometer or the keyboard.
 */
export function step(state, level, tilt, dt) {
  if (state.status !== STATUS.PLAYING) return state;

  const s = { ...state, coins: [...state.coins] };
  s.time += dt;

  // Tilt drives both axes. Weaker in the air - you can nudge a jump, not
  // redirect it - and rolling drag only applies with the track underfoot.
  const control = s.grounded ? 1 : AIR_CONTROL;
  s.vx += clamp1(tilt.x) * STEER_ACCEL * control * dt;
  s.vz += clamp1(tilt.y) * DRIVE_ACCEL * control * dt;
  if (s.grounded) {
    const drag = Math.pow(ROLL_DRAG, dt); // exponential, framerate independent
    s.vx *= drag;
    s.vz *= drag;
  }
  s.vx = Math.max(-MAX_LATERAL, Math.min(MAX_LATERAL, s.vx));
  s.vz = Math.max(-level.speed * REVERSE_FACTOR, Math.min(level.speed, s.vz));

  // Spinners sweep the track and shove whatever they touch sideways.
  for (const sp of level.spinners) {
    if (s.y >= SPINNER_HEIGHT) continue;
    const a = sp.phase + sp.speed * s.time;
    const ux = Math.cos(a);
    const uz = Math.sin(a);
    const dx = s.x - sp.x;
    const dz = s.z - sp.z;
    const along = dx * ux + dz * uz;
    const perp = dx * -uz + dz * ux;
    if (Math.abs(along) <= sp.length / 2 && Math.abs(perp) < SPINNER_HALF_WIDTH + BALL_RADIUS) {
      const sign = perp >= 0 ? 1 : -1;
      const clear = SPINNER_HALF_WIDTH + BALL_RADIUS - Math.abs(perp) + 0.02;
      s.x += -uz * sign * clear;
      s.z += ux * sign * clear;
      s.vx += -uz * sign * SPIN_PUSH;
      s.vz += ux * sign * SPIN_PUSH;
    }
  }

  s.x += s.vx * dt;
  s.z += s.vz * dt;

  // Gravity, then let the track catch the ball if it is there to catch it.
  s.vy -= GRAVITY * dt;
  s.y += s.vy * dt;
  s.grounded = false;
  if (s.y <= BALL_RADIUS && s.vy <= 0 && segmentAt(level, s.x, s.z)) {
    s.y = BALL_RADIUS;
    s.vy = 0;
    s.grounded = true;
  }

  // Bounce pads launch a grounded ball.
  if (s.grounded) {
    for (const p of level.pads) {
      if (Math.abs(s.x - p.x) < PAD_RADIUS && Math.abs(s.z - p.z) < PAD_RADIUS) {
        s.vy = p.power;
        s.grounded = false;
        break;
      }
    }
  }

  level.coins.forEach((c, i) => {
    if (s.coins[i]) return;
    const dx = s.x - c.x;
    const dy = s.y - (c.y ?? 0.9);
    const dz = s.z - c.z;
    const r = COIN_RADIUS + BALL_RADIUS;
    if (dx * dx + dy * dy + dz * dz < r * r) s.coins[i] = true;
  });

  if (s.y < FALL_Y) {
    s.status = STATUS.FELL;
    return s;
  }

  if (s.z >= level.goalZ) {
    s.status = STATUS.FINISHED;
  }

  return s;
}

/** Put the ball back at the start after a fall, keeping time and coins. */
export function respawn(state, level) {
  return {
    ...state,
    x: level.start.x,
    y: BALL_RADIUS,
    z: level.start.z,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: true,
    status: STATUS.PLAYING,
    falls: state.falls + 1,
  };
}
