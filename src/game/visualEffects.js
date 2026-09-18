/**
 * Fixed-size effect state: no per-frame React updates or growing particle
 * lists. Everything the renderer needs to make a moment feel like something -
 * a launch, a shove, a pickup, the rush of speed - lives in one object that
 * is advanced each frame and never reallocated.
 */
export const PARTICLE_COUNT = 48;
export const STREAK_COUNT = 40;
export const TRAIL_COUNT = 26;   // how many ghosts of the ball hang behind it
export const RING_COUNT = 5;     // impact rings, expanding and fading
const TRAIL_STEP = 1 / 60;       // how often a ghost is laid down

/** Streaks are laid out once, in a ring around the camera's line of sight. */
function createStreaks() {
  return Array.from({ length: STREAK_COUNT }, (_, i) => {
    const angle = i * 2.39996;
    const radius = 2.2 + ((i * 7) % 11) * 0.62;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.7,
      z: ((i * 13) % 40) + 2, // metres in front of the camera
      length: 2.5 + ((i * 5) % 7) * 0.9,
    };
  });
}

export function createEffects(state) {
  return {
    previous: state, age: 0, launch: 0, shake: 0, celebration: 0, cursor: 0,
    pad: -1, padPulse: 0,
    boost: -1, boostPulse: 0,
    rush: 0, kick: 0,
    particles: Array.from({ length: PARTICLE_COUNT }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 })),
    streaks: createStreaks(),
    // A line of fading ghosts behind the ball. Cheap motion blur, and the
    // only thing on screen that shows the shape of the line you just drove.
    trail: Array.from({ length: TRAIL_COUNT }, () => ({ life: 0, x: 0, y: 0, z: 0 })),
    trailCursor: 0,
    trailClock: 0,
    // Expanding rings, thrown off wherever the ball hits something.
    rings: Array.from({ length: RING_COUNT }, () => ({ life: 0, x: 0, y: 0, z: 0, size: 1, tone: 0 })),
    ringCursor: 0,
  };
}

/** Throw a ring at a point. `tone` picks its colour at the draw end. */
function ring(fx, x, y, z, size, tone) {
  const r = fx.rings[fx.ringCursor++ % RING_COUNT];
  Object.assign(r, { life: 1, x, y, z, size, tone });
}

function burst(fx, x, y, z, count) {
  for (let i = 0; i < count; i++) {
    const p = fx.particles[fx.cursor++ % PARTICLE_COUNT];
    const angle = i * 2.39996;
    Object.assign(p, { life: 0.65, x, y, z, vx: Math.cos(angle)*3, vy: 2 + (i%3), vz: Math.sin(angle)*3 });
  }
}

/**
 * How hard the world should feel like it is going past: cruising reads as
 * nothing, a booster or a long drop reads as everything.
 */
function rushFor(state, level) {
  const over = (Math.abs(state.vz) - level.speed * 0.85) / (level.speed * 1.1);
  const falling = state.grounded ? 0 : Math.max(0, (-state.vy - 8) / 26);
  // A live booster reads as full rush on its own, so the surge lands the
  // instant you touch the pad rather than once the speed has built.
  const boosting = state.boost > 0 ? 0.75 + Math.min(0.25, state.boost / 3) : 0;
  return Math.max(0, Math.min(1, Math.max(over, falling, boosting)));
}

export function advanceEffects(fx, state, level, delta) {
  const dt = Math.min(delta, 0.05);
  fx.age += dt;
  fx.launch = Math.max(0, fx.launch - dt);
  fx.padPulse = Math.max(0, fx.padPulse - dt);
  fx.boostPulse = Math.max(0, fx.boostPulse - dt);
  fx.kick = Math.max(0, fx.kick - dt * 1.8);
  fx.shake = Math.max(0, fx.shake - dt);
  fx.celebration = Math.max(0, fx.celebration - dt);
  const prev = fx.previous;
  if (state !== prev) {
    if (state.falls !== prev.falls || state.time < prev.time) {
      fx.launch = fx.shake = fx.padPulse = fx.boostPulse = fx.celebration = fx.kick = 0;
      fx.particles.forEach(p => { p.life = 0; });
      fx.trail.forEach(p => { p.life = 0; });
      fx.rings.forEach(r => { r.life = 0; });
    } else {
      state.coins.forEach((collected, i) => {
        if (collected && !prev.coins[i]) {
          const c = level.coins[i];
          burst(fx, c.x, c.y ?? 0.9, -c.z, 12);
        }
      });
      if (state.feedback.pad !== prev.feedback.pad) {
        fx.launch = 0.22; fx.padPulse = 0.4; fx.pad = state.feedback.lastPad;
        const p = level.pads[state.feedback.lastPad];
        if (p) ring(fx, p.x, p.y + 0.1, -p.z, 3.4, 0);
      }
      if (state.feedback.landing !== prev.feedback.landing) {
        ring(fx, state.x, state.y - 0.4, -state.z, 2.2, 1);
      }
      if (state.feedback.boost !== prev.feedback.boost) {
        fx.boostPulse = 0.5; fx.boost = state.feedback.lastBoost;
        fx.kick = 1; // the camera punch, so the surge is felt and not just seen
        const b = level.boosters[state.feedback.lastBoost];
        if (b) { burst(fx, b.x, b.y + 0.4, -b.z, 16); ring(fx, b.x, b.y, -b.z, 4.2, 2); }
      }
      if (state.feedback.spinner !== prev.feedback.spinner) fx.shake = 0.22;
      if (state.status === 'fell' && prev.status !== 'fell') fx.shake = 0.3;
      if (state.status === 'finished' && prev.status !== 'finished') {
        fx.celebration = 0.9;
        burst(fx, state.x, (level.goalY ?? 0) + 1.5, -level.goalZ, 36);
        ring(fx, state.x, (level.goalY ?? 0) + 0.2, -level.goalZ, 7, 3);
      }
    }
    fx.previous = state;
  }

  // Speed reads as a level, not an event, so it eases rather than decays.
  const target = state.status === 'playing' ? rushFor(state, level) : 0;
  fx.rush += (target - fx.rush) * Math.min(1, dt * 5);

  for (const p of fx.particles) {
    if (p.life <= 0) continue;
    p.life = Math.max(0, p.life - dt);
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.vy -= 9 * dt;
  }

  // The trail. A ghost is dropped at a fixed rate rather than per frame, so
  // the spacing reads as speed instead of as framerate.
  fx.trailClock += dt;
  if (fx.trailClock >= TRAIL_STEP && state.status === 'playing') {
    fx.trailClock = 0;
    const ghost = fx.trail[fx.trailCursor++ % TRAIL_COUNT];
    Object.assign(ghost, { life: 1, x: state.x, y: state.y, z: -state.z });
  }
  // Long enough to draw the shape of a corner, short enough not to trail the
  // whole level behind you - and it fades faster when you are barely moving.
  const fade = dt * (1.6 + (1 - fx.rush) * 1.4);
  for (const ghost of fx.trail) if (ghost.life > 0) ghost.life = Math.max(0, ghost.life - fade);

  for (const r of fx.rings) if (r.life > 0) r.life = Math.max(0, r.life - dt * 1.6);

  // Streaks sweep past the camera and wrap; they only move while there is
  // something to convey, so a stationary ball sits in still air.
  const sweep = (14 + fx.rush * 90) * dt;
  for (const p of fx.streaks) {
    p.z -= sweep;
    if (p.z < -4) p.z += 46;
  }

  return fx;
}
