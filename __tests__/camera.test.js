import { STATUS, createGameState, step } from '../src/game/engine';
import { LEVELS, getLevel } from '../src/game/levels';
import {
  FACING_SPEED,
  FOV_BASE,
  createCameraRig,
  framing,
  trackCamera,
} from '../src/game/camera';
import { autopilotTilt } from '../test-utils/autopilot';

const dt = 1 / 120;
// A phone held upright: the narrow axis is the one that loses things.
const ASPECT = 390 / 844;

/**
 * You have to be able to see the ball.
 *
 * This is not a nicety - it is the whole interface. The camera used to look
 * up the track no matter what, so the moment a level asked you to drive
 * backwards (which two of them do) the ball left the frame behind the lens
 * and there was nothing on screen to say where it had gone.
 */
function driveWatching(level, seconds = 90) {
  const rig = createCameraRig();
  let s = createGameState(level);
  const cursor = { at: 0 };
  let worst = { ndc: 0, depth: Infinity, z: 0, behind: 0 };
  for (let i = 0; i < 120 * seconds && s.status === STATUS.PLAYING; i++) {
    s = step(s, level, autopilotTilt(level, s, cursor), dt);
    trackCamera(rig, level, s, dt, { rush: Math.min(1, Math.abs(s.vz) / (level.speed * 1.8)) });
    const view = framing(rig, s, ASPECT);
    const ndc = Math.max(Math.abs(view.ndcX), Math.abs(view.ndcY));
    if (view.depth <= 0) worst.behind++;
    if (ndc > worst.ndc) worst = { ...worst, ndc, depth: view.depth, z: s.z };
  }
  return { ...worst, finished: s.status === STATUS.FINISHED, time: s.time };
}

describe.each(LEVELS.map((l) => [l.id, l.name, l]))('level %i (%s)', (_, __, level) => {
  test('keeps the ball on screen from start to finish', () => {
    const worst = driveWatching(level);
    expect(worst.finished).toBe(true);
    expect(worst.behind).toBe(0);      // never once behind the lens
    expect(worst.ndc).toBeLessThan(1); // and never off the edge of the frame
  });
});

describe('turning round', () => {
  const level = getLevel(11); // The Locksmith, whose answer is a reverse leg

  test('the view swings to look back when the ball genuinely reverses', () => {
    const rig = createCameraRig();
    let s = { ...createGameState(level), vz: 12 };
    for (let i = 0; i < 120; i++) trackCamera(rig, level, s, dt, {});
    expect(rig.seat.z).toBeLessThan(s.z); // sat behind, looking forward
    expect(rig.aim.z).toBeGreaterThan(s.z);

    s = { ...s, vz: -8 };
    for (let i = 0; i < 300; i++) trackCamera(rig, level, s, dt, {});
    expect(rig.seat.z).toBeGreaterThan(s.z); // now sat the other side of it
    expect(rig.aim.z).toBeLessThan(s.z);
  });

  test('it does not swing for a ball that is merely jostled', () => {
    const rig = createCameraRig();
    let s = { ...createGameState(level), vz: 12 };
    for (let i = 0; i < 120; i++) trackCamera(rig, level, s, dt, {});
    const before = rig.target;
    // A nudge backwards, well under the threshold.
    s = { ...s, vz: -(FACING_SPEED - 0.5) };
    for (let i = 0; i < 120; i++) trackCamera(rig, level, s, dt, {});
    expect(rig.target).toBe(before);
  });

  test('it swings round the outside, never through the ball', () => {
    const rig = createCameraRig();
    let s = { ...createGameState(level), z: 60, vz: 12 };
    for (let i = 0; i < 120; i++) trackCamera(rig, level, s, dt, {});
    s = { ...s, vz: -8 };
    let closest = Infinity;
    for (let i = 0; i < 400; i++) {
      trackCamera(rig, level, s, dt, {});
      closest = Math.min(closest, Math.hypot(rig.seat.x - s.x, rig.seat.z - s.z));
    }
    // It orbits at roughly its normal stand-off distance the whole way round.
    expect(closest).toBeGreaterThan(4);
  });
});

describe('the lens', () => {
  const level = getLevel(1);

  test('widens with speed and punches on a booster, and settles back', () => {
    const rig = createCameraRig();
    const s = createGameState(level);
    trackCamera(rig, level, s, dt, {});
    expect(rig.fov).toBeCloseTo(FOV_BASE, 6);
    trackCamera(rig, level, s, dt, { rush: 1 });
    const fast = rig.fov;
    expect(fast).toBeGreaterThan(FOV_BASE);
    trackCamera(rig, level, s, dt, { rush: 1, kick: 1 });
    expect(rig.fov).toBeGreaterThan(fast);
    trackCamera(rig, level, s, dt, {});
    expect(rig.fov).toBeCloseTo(FOV_BASE, 6);
  });

  test('a shove rattles the seat and never the aim', () => {
    const rig = createCameraRig();
    const s = createGameState(level);
    trackCamera(rig, level, s, dt, {});
    const aim = { ...rig.aim };
    trackCamera(rig, level, s, dt, { shake: 1, age: 1.7 });
    expect(Math.abs(rig.shakeX) + Math.abs(rig.shakeY)).toBeGreaterThan(0);
    expect(rig.aim.x).toBeCloseTo(aim.x, 1);
  });
});
