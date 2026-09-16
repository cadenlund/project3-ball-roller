/**
 * Scoring. Kept separate from physics so the rules can change without
 * touching the simulation.
 */

export const COIN_POINTS = 250;
export const FALL_PENALTY = 150;
export const BASE_POINTS = 1000;
export const SPEED_BONUS = 40; // per second finished under par

/** Every line item behind a level's score, for the results screen breakdown. */
export function scoreBreakdown({ time, parTime, coinsCollected, falls }) {
  const under = Math.max(0, parTime - time);
  const timeBonus = Math.round(under * SPEED_BONUS);
  const coinBonus = coinsCollected * COIN_POINTS;
  const fallPenalty = falls * FALL_PENALTY;
  const total = Math.max(0, BASE_POINTS + timeBonus + coinBonus - fallPenalty);
  return { base: BASE_POINTS, timeBonus, coinBonus, fallPenalty, total };
}

export function scoreLevel(input) {
  return scoreBreakdown(input).total;
}

/** 1-3 stars, for the level-select screen. */
export function starsFor({ time, parTime, coinsCollected, coinTotal }) {
  let stars = 1;
  if (time <= parTime) stars += 1;
  if (coinTotal > 0 && coinsCollected === coinTotal) stars += 1;
  return stars;
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds * 100) % 100);
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return m > 0 ? `${m}:${pad(s)}.${pad(cs)}` : `${s}.${pad(cs)}`;
}
