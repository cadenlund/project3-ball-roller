import { FIXED_DT, MAX_CATCHUP, createStepper } from '../src/game/loop';
import { STATUS, createGameState, step } from '../src/game/engine';
import { buildLevel } from '../src/game/levels';

const track = buildLevel({
  id: 't', name: 't', speed: 11, parTime: 30,
  run: [{ length: 120, width: 5 }],
  coins: [{ z: 30, x: 0 }],
});

/** Simulate `seconds` of play delivered at `fps`, and report where we end up. */
const playAt = (fps, seconds, tilt = { x: 0.3, y: 1 }) => {
  let state = createGameState(track);
  const stepper = createStepper((dt) => {
    state = step(state, track, tilt, dt);
  });
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) stepper.advanceBy(1 / fps);
  return state;
};

test('a slice is the only dt the simulation ever sees', () => {
  const seen = [];
  const stepper = createStepper((dt) => seen.push(dt));
  stepper.advanceBy(0.05);
  stepper.advanceBy(1 / 60);
  expect(new Set(seen)).toEqual(new Set([FIXED_DT]));
});

test('elapsed time is spent, not lost: steps match the time fed in', () => {
  let steps = 0;
  const stepper = createStepper(() => steps++);
  for (let i = 0; i < 60; i++) stepper.advanceBy(1 / 60);
  // One second at a 120Hz slice is 120 steps, give or take what is still buffered.
  expect(steps).toBe(120);
  expect(stepper.pending).toBeLessThan(FIXED_DT);
});

test('a partial slice buffers instead of stepping', () => {
  let steps = 0;
  const stepper = createStepper(() => steps++);
  stepper.advanceBy(FIXED_DT / 2);
  expect(steps).toBe(0);
  stepper.advanceBy(FIXED_DT / 2);
  expect(steps).toBe(1);
});

test('the same second of play lands in the same place at 60 and at 120fps', () => {
  const at60 = playAt(60, 4);
  const at120 = playAt(120, 4);
  expect(at120.z).toBeCloseTo(at60.z, 6);
  expect(at120.x).toBeCloseTo(at60.x, 6);
  expect(at120.time).toBeCloseTo(at60.time, 6);
  expect(at120.coins).toEqual(at60.coins);
});

test('an erratic framerate still tracks a steady one closely', () => {
  let state = createGameState(track);
  const stepper = createStepper((dt) => { state = step(state, track, { x: 0.3, y: 1 }, dt); });
  // Four seconds delivered in wildly uneven frames, none long enough to stall.
  let delivered = 0;
  for (let i = 0; delivered < 4; i++) {
    const frame = Math.min(0.004 + (i % 7) * 0.003, 4 - delivered);
    stepper.advanceBy(frame);
    delivered += frame;
  }
  const steady = playAt(60, 4);
  expect(state.z).toBeCloseTo(steady.z, 3);
});

test('a long stall is dropped rather than caught up all at once', () => {
  let steps = 0;
  const stepper = createStepper(() => steps++);
  stepper.advanceBy(5); // five seconds lost to a background or a GC pause
  expect(steps).toBe(MAX_CATCHUP);
});

test('reset drops buffered time, so a pause is not paid back on resume', () => {
  let steps = 0;
  const stepper = createStepper(() => steps++);
  stepper.advanceBy(FIXED_DT * 0.9);
  stepper.reset();
  expect(stepper.pending).toBe(0);
  stepper.advanceBy(FIXED_DT * 0.9);
  expect(steps).toBe(0);
});

test('a zero, negative or NaN frame time is ignored', () => {
  let steps = 0;
  const stepper = createStepper(() => steps++);
  for (const bad of [0, -1, NaN, undefined]) stepper.advanceBy(bad);
  expect(steps).toBe(0);
  expect(stepper.pending).toBe(0);
});

test('driving a real level to the goal still works end to end', () => {
  let state = createGameState(track);
  const stepper = createStepper((dt) => { state = step(state, track, { x: 0, y: 1 }, dt); });
  for (let i = 0; i < 60 * 30 && state.status === STATUS.PLAYING; i++) stepper.advanceBy(1 / 60);
  expect(state.status).toBe(STATUS.FINISHED);
  expect(state.falls).toBe(0);
});
