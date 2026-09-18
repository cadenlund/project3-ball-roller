/**
 * The simulation driver.
 *
 * `step()` is pure but framerate-sensitive: integrating one second as sixty
 * 16ms slices and as a hundred and twenty 8ms slices does not land the ball
 * in quite the same place. Driving it straight off requestAnimationFrame
 * therefore made the game play slightly differently on a 120Hz phone than on
 * a 60Hz one - different pad jumps, different spinner timing, different pars.
 *
 * So the wall clock never reaches the physics directly. Elapsed time goes
 * into an accumulator and is drained in fixed FIXED_DT slices, which is the
 * only size `step()` is ever called with. What varies with the display is how
 * many slices run per frame, not what a slice means.
 */

export const FIXED_DT = 1 / 120;

/**
 * A long stall - backgrounding, a GC pause, the JS thread losing a beat -
 * leaves a huge accumulator. Catching all of it up at once would freeze the
 * frame and teleport the ball through the track it should have landed on, so
 * the excess is dropped: the game briefly runs in slow motion instead.
 */
export const MAX_CATCHUP = 8; // steps per frame, ~67ms of simulation

export function createStepper(advance, { fixedDt = FIXED_DT, maxCatchup = MAX_CATCHUP } = {}) {
  let accumulator = 0;

  return {
    /** Feed real elapsed seconds; runs `advance(fixedDt)` zero or more times. */
    advanceBy(elapsed) {
      if (!(elapsed > 0)) return 0; // also rejects NaN, from a bad timestamp
      accumulator += elapsed;

      const budget = fixedDt * maxCatchup;
      if (accumulator > budget) accumulator = budget;

      let steps = 0;
      while (accumulator >= fixedDt) {
        accumulator -= fixedDt;
        advance(fixedDt);
        steps++;
      }
      return steps;
    },

    /** Drop buffered time - after a pause, so it is not caught up at once. */
    reset() {
      accumulator = 0;
    },

    get pending() {
      return accumulator;
    },
  };
}
