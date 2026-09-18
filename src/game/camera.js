/**
 * The chase camera.
 *
 * Pure functions over plain data, in the engine's own coordinates (+Z is
 * forward), so what the player can see is something the test suite can check
 * rather than something you find out about on a device. The renderer flips Z
 * and applies the result; it makes no decisions of its own.
 *
 * The camera frames the *track*, not the ball: it sits back along the line the
 * ball came in on, rides at a height set by the deck beneath it, and looks at
 * a point well up the centreline ahead. Position and aim are eased rather than
 * snapped, which is what stops a spinner hit or a hard bend whipping the view.
 */
import { driftAt, trackPointAt } from './levels';

export const CAM_BACK = 9.4;       // metres behind the ball
export const CAM_LIFT = 5.2;       // metres above the deck
export const CAM_AHEAD = 15;       // how far up the track it looks
export const CAM_EASE = 6.5;       // position follow rate, per second
export const AIM_EASE = 5;         // aim follow rate, per second
export const CAM_SPEED_BACK = 3.2; // extra distance at full speed, for the rush
export const CAM_ROLL = 0.28;      // how much of the corner the horizon takes

export const FOV_BASE = 62;
export const FOV_RUSH = 12;        // degrees of extra field of view at speed
export const FOV_KICK = 9;         // and the punch the moment a booster fires

/**
 * Turning round.
 *
 * Some levels are solved by driving backwards, and a camera that only ever
 * looks up the track leaves the ball behind it the moment you do - which
 * reads, from the seat, as the ball vanishing. So the view swings round.
 *
 * It swings as an *orbit*: interpolating the seat through world space would
 * drag the camera straight through the ball on the way past. Interpolating
 * the angle carries it around the outside instead. The speed threshold, and
 * the lag on the swing, stop a ball that is merely jostled from spinning the
 * world round the player.
 */
export const FACING_SPEED = 3;  // how fast you must be going to turn the view
export const FACING_EASE = 2.4; // and how fast it swings when you do

/**
 * Held upright, a phone has about fifteen degrees of view to either side -
 * the narrow axis is the one that loses things. So wherever the camera would
 * *like* to point, keeping the ball inside the frame wins: a few metres of
 * lateral offset is enough to put it off the edge, and a cannon shot or a
 * wide junction offers a great deal more than a few metres.
 */
export const SAFE_FRAME = 0.62; // how far out in the frame the ball may drift
export const DEFAULT_ASPECT = 390 / 844;

/** Exponential smoothing that behaves the same at any framerate. */
export const approach = (rate, dt) => 1 - Math.exp(-rate * dt);

const lerp = (a, b, t) => a + (b - a) * t;

export function createCameraRig() {
  return {
    seat: { x: 0, y: 0, z: 0 },
    aim: { x: 0, y: 0, z: 0 },
    angle: 0,  // 0 looking up the track, PI looking back down it
    target: 0, // and where it is swinging to
    fov: FOV_BASE,
    roll: 0,
    started: false,
  };
}

/**
 * Advance the rig by dt and return it. `fx` supplies the two things the view
 * borrows from the effect layer: how much rush to widen the lens by, and the
 * kick from a booster.
 */
export function trackCamera(rig, level, state, dt, fx = {}) {
  const { rush = 0, kick = 0, shake = 0, age = 0 } = fx;

  // Which way to look. Held until the ball is genuinely travelling the other
  // way, so drifting back a metre does not turn the world around.
  if (Math.abs(state.vz) > FACING_SPEED) {
    rig.target = state.vz > 0 ? 0 : Math.PI;
  }
  rig.angle = lerp(rig.angle, rig.target ?? 0, approach(FACING_EASE, dt));

  const facing = Math.cos(rig.angle);
  const swing = Math.sin(rig.angle);
  const back = CAM_BACK + rush * CAM_SPEED_BACK;

  // Seat and aim, both measured along the track from the ball. Mid-swing the
  // camera is out to the side of the ball rather than on top of it.
  const seatZ = state.z - back * facing;
  const aimZ = state.z + CAM_AHEAD * facing;
  const behind = trackPointAt(level, seatZ, state.time, state.x);
  const ahead = trackPointAt(level, aimZ, state.time, state.x);

  // Sat on the racing line, but leaning toward the ball's own lane so the
  // player can always see which side of the deck they are on.
  const seat = {
    x: behind.x + (state.x - behind.x) * 0.55 + swing * back * 0.7,
    y: Math.max(behind.y, state.y - 1.5) + CAM_LIFT,
    z: seatZ,
  };
  const aim = {
    x: ahead.x * 0.8 + state.x * 0.2,
    y: ahead.y + 1.2,
    z: aimZ,
  };

  if (!rig.started) {
    rig.started = true;
    rig.seat = { ...seat };
    rig.aim = { ...aim };
  } else {
    const p = approach(CAM_EASE, dt);
    const a = approach(AIM_EASE, dt);
    rig.seat.x = lerp(rig.seat.x, seat.x, p);
    rig.seat.y = lerp(rig.seat.y, seat.y, p);
    rig.seat.z = lerp(rig.seat.z, seat.z, p);
    rig.aim.x = lerp(rig.aim.x, aim.x, a);
    rig.aim.y = lerp(rig.aim.y, aim.y, a);
    rig.aim.z = lerp(rig.aim.z, aim.z, a);
  }

  // A shove rattles the seat, never the aim - shaking what the camera is
  // looking at reads as the world moving rather than as the hit landing.
  rig.shakeX = Math.sin(age * 91) * shake * 0.55;
  rig.shakeY = Math.cos(age * 73) * shake * 0.55;

  rig.fov = FOV_BASE + rush * FOV_RUSH + kick * FOV_KICK;
  const under = trackPointAt(level, state.z, state.time, state.x).segment;
  rig.roll = Math.atan(under ? driftAt(under, state.z) : 0) * CAM_ROLL * facing;

  // The aim follows the *track*, which is what makes the view read as a road
  // rather than as a ball on a string - but the track is not always where the
  // ball is. Off a junction, or in the middle of a cannon shot, the two part
  // company by more than the frame is wide. So the aim is pulled back toward
  // the ball by exactly as much as it takes to keep it on screen, and no more.
  const aspect = rig.aspect ?? DEFAULT_ASPECT;
  for (let i = 0; i < 4; i++) {
    const view = framing(rig, state, aspect);
    const over = Math.max(Math.abs(view.ndcX), Math.abs(view.ndcY)) / SAFE_FRAME;
    if (!(over > 1)) break;
    const pull = Math.min(0.9, 1 - 1 / over);
    rig.aim.x = lerp(rig.aim.x, state.x, pull);
    rig.aim.y = lerp(rig.aim.y, state.y, pull);
    rig.aim.z = lerp(rig.aim.z, state.z, pull);
  }
  return rig;
}

/**
 * Where the ball falls in the frame: {ndcX, ndcY, depth}, in clip space where
 * ±1 is the edge of the screen and depth is metres in front of the lens.
 * Negative depth means it is behind the camera, which is the worst version of
 * "you cannot see the ball" because nothing on screen hints at where it went.
 */
export function framing(rig, ball, aspect) {
  const fx = rig.seat.x + (rig.shakeX ?? 0);
  const fy = rig.seat.y + (rig.shakeY ?? 0);
  const fz = rig.seat.z;

  // Camera basis: forward toward the aim, then right = forward x worldUp and
  // up = right x forward, which is the usual orthonormal look-at frame.
  let f = [rig.aim.x - fx, rig.aim.y - fy, rig.aim.z - fz];
  const fl = Math.hypot(f[0], f[1], f[2]) || 1;
  f = [f[0] / fl, f[1] / fl, f[2] / fl];
  let r = [-f[2], 0, f[0]];
  const rl = Math.hypot(r[0], r[1], r[2]) || 1;
  r = [r[0] / rl, r[1] / rl, r[2] / rl];
  const u = [
    r[1] * f[2] - r[2] * f[1],
    r[2] * f[0] - r[0] * f[2],
    r[0] * f[1] - r[1] * f[0],
  ];

  const d = [ball.x - fx, ball.y - fy, ball.z - fz];
  const depth = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
  const right = d[0] * r[0] + d[1] * r[1] + d[2] * r[2];
  const up = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];

  const halfV = Math.tan(((rig.fov ?? FOV_BASE) * Math.PI) / 360);
  const halfH = halfV * aspect;
  return {
    depth,
    ndcX: depth > 0 ? right / (depth * halfH) : Infinity,
    ndcY: depth > 0 ? up / (depth * halfV) : Infinity,
  };
}
