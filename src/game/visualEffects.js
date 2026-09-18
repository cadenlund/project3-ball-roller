/** Fixed-size effect state: no per-frame React updates or growing particle lists. */
export const PARTICLE_COUNT = 48;
export function createEffects(state) {
  return {
    previous: state, age: 0, launch: 0, shake: 0, celebration: 0, cursor: 0,
    pad: -1, padPulse: 0,
    particles: Array.from({ length: PARTICLE_COUNT }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 })),
  };
}
function burst(fx, x, y, z, count) {
  for (let i = 0; i < count; i++) {
    const p = fx.particles[fx.cursor++ % PARTICLE_COUNT];
    const angle = i * 2.39996;
    Object.assign(p, { life: 0.65, x, y, z, vx: Math.cos(angle)*3, vy: 2 + (i%3), vz: Math.sin(angle)*3 });
  }
}
export function advanceEffects(fx, state, level, delta) {
  const dt = Math.min(delta, 0.05);
  fx.age += dt;
  fx.launch = Math.max(0, fx.launch - dt);
  fx.padPulse = Math.max(0, fx.padPulse - dt);
  fx.shake = Math.max(0, fx.shake - dt);
  fx.celebration = Math.max(0, fx.celebration - dt);
  const prev = fx.previous;
  if (state !== prev) {
    if (state.falls !== prev.falls || state.time < prev.time) {
      fx.launch = fx.shake = fx.padPulse = fx.celebration = 0;
      fx.particles.forEach(p => { p.life = 0; });
    } else {
      state.coins.forEach((collected, i) => {
        if (collected && !prev.coins[i]) {
          const c = level.coins[i];
          burst(fx, c.x, c.y ?? 0.9, -c.z, 12);
        }
      });
      if (state.feedback.pad !== prev.feedback.pad) {
        fx.launch = 0.22; fx.padPulse = 0.4; fx.pad = state.feedback.lastPad;
      }
      if (state.feedback.spinner !== prev.feedback.spinner || (state.y < 0 && prev.y >= 0)) fx.shake = 0.22;
      if (state.status === 'finished' && prev.status !== 'finished') {
        fx.celebration = 0.9;
        burst(fx, state.x, 1.5, -level.goalZ, 36);
      }
    }
    fx.previous = state;
  }
  for (const p of fx.particles) {
    if (p.life <= 0) continue;
    p.life = Math.max(0, p.life - dt);
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.vy -= 9 * dt;
  }
  return fx;
}
