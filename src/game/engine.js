/**
 * Ball physics and level state.
 *
 * Everything here is a pure function over plain data - no React, no timers,
 * no rendering - so the whole game can be simulated and unit tested without a
 * device. `step()` takes the current state plus a tilt vector and returns the
 * next state; it never mutates its input.
 */

import { BALL_RADIUS, COIN_RADIUS, GOAL_RADIUS, HOLE_RADIUS, WORLD } from './levels';

export const ACCEL = 95;      // world units/s^2 at full tilt
export const FRICTION = 0.5;  // velocity retained per second
export const MAX_SPEED = 60;  // world units/s
export const BOUNCE = 0.45;   // fraction of speed kept when hitting a wall

export const STATUS = {
  PLAYING: 'playing',
  FELL: 'fell',
  FINISHED: 'finished',
};

export function createGameState(level) {
  return {
    levelId: level.id,
    x: level.start.x,
    y: level.start.y,
    vx: 0,
    vy: 0,
    time: 0,
    status: STATUS.PLAYING,
    coins: level.coins.map(() => false), // collected flags, by index
    falls: 0,
  };
}

function circleHitsRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function within(ax, ay, bx, by, r) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy < r * r;
}

/**
 * Advance the world by dt seconds.
 * `tilt` is {x, y} in roughly -1..1, from the gyro or the keyboard.
 */
export function step(state, level, tilt, dt) {
  if (state.status !== STATUS.PLAYING) return state;

  const s = { ...state, coins: [...state.coins] };

  s.vx += tilt.x * ACCEL * dt;
  s.vy += tilt.y * ACCEL * dt;

  // Exponential drag, framerate independent.
  const drag = Math.pow(FRICTION, dt);
  s.vx *= drag;
  s.vy *= drag;

  const speed = Math.hypot(s.vx, s.vy);
  if (speed > MAX_SPEED) {
    s.vx = (s.vx / speed) * MAX_SPEED;
    s.vy = (s.vy / speed) * MAX_SPEED;
  }

  // Move each axis separately so a collision on one axis still allows the
  // ball to slide along the other - that is what makes corridors feel right.
  const nextX = s.x + s.vx * dt;
  if (level.walls.some((w) => circleHitsRect(nextX, s.y, BALL_RADIUS, w))) {
    s.vx = -s.vx * BOUNCE;
  } else {
    s.x = nextX;
  }

  const nextY = s.y + s.vy * dt;
  if (level.walls.some((w) => circleHitsRect(s.x, nextY, BALL_RADIUS, w))) {
    s.vy = -s.vy * BOUNCE;
  } else {
    s.y = nextY;
  }

  s.x = Math.max(BALL_RADIUS, Math.min(WORLD - BALL_RADIUS, s.x));
  s.y = Math.max(BALL_RADIUS, Math.min(WORLD - BALL_RADIUS, s.y));
  s.time += dt;

  level.coins.forEach((c, i) => {
    if (!s.coins[i] && within(s.x, s.y, c.x, c.y, COIN_RADIUS + BALL_RADIUS)) {
      s.coins[i] = true;
    }
  });

  if (level.holes.some((h) => within(s.x, s.y, h.x, h.y, HOLE_RADIUS))) {
    s.status = STATUS.FELL;
    return s;
  }

  if (within(s.x, s.y, level.goal.x, level.goal.y, GOAL_RADIUS)) {
    s.status = STATUS.FINISHED;
  }

  return s;
}

/** Put the ball back at the start after a fall, keeping time and coins. */
export function respawn(state, level) {
  return {
    ...state,
    x: level.start.x,
    y: level.start.y,
    vx: 0,
    vy: 0,
    status: STATUS.PLAYING,
    falls: state.falls + 1,
  };
}
