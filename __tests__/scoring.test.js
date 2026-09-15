import { isUnlocked, mergeResult, totalScore } from '../src/game/progress';
import { COIN_POINTS, FALL_PENALTY, formatTime, scoreLevel, starsFor } from '../src/game/scoring';

const base = { time: 10, parTime: 20, coinsCollected: 0, falls: 0 };

describe('scoreLevel', () => {
  test('finishing faster scores more', () => {
    expect(scoreLevel({ ...base, time: 5 })).toBeGreaterThan(scoreLevel({ ...base, time: 15 }));
  });

  test('there is no speed bonus past par', () => {
    expect(scoreLevel({ ...base, time: 25 })).toBe(scoreLevel({ ...base, time: 40 }));
  });

  test('each coin is worth its points', () => {
    expect(scoreLevel({ ...base, coinsCollected: 2 }) - scoreLevel(base)).toBe(2 * COIN_POINTS);
  });

  test('each fall costs its penalty', () => {
    expect(scoreLevel(base) - scoreLevel({ ...base, falls: 1 })).toBe(FALL_PENALTY);
  });

  test('a score never goes negative', () => {
    expect(scoreLevel({ ...base, time: 999, falls: 100 })).toBe(0);
  });
});

describe('starsFor', () => {
  test('finishing at all earns one star', () => {
    expect(starsFor({ time: 99, parTime: 20, coinsCollected: 0, coinTotal: 3 })).toBe(1);
  });

  test('beating par earns a second', () => {
    expect(starsFor({ time: 10, parTime: 20, coinsCollected: 0, coinTotal: 3 })).toBe(2);
  });

  test('every coin earns the third', () => {
    expect(starsFor({ time: 10, parTime: 20, coinsCollected: 3, coinTotal: 3 })).toBe(3);
  });
});

describe('formatTime', () => {
  test.each([
    [0, '0.00'],
    [9.5, '9.50'],
    [61.25, '1:01.25'],
  ])('%is formats as %s', (secs, want) => {
    expect(formatTime(secs)).toBe(want);
  });
});

describe('progress', () => {
  test('a better run replaces the old one', () => {
    const p = mergeResult({}, 1, { score: 100 });
    expect(mergeResult(p, 1, { score: 250 })[1].score).toBe(250);
  });

  test('a worse run is discarded', () => {
    const p = mergeResult({}, 1, { score: 250 });
    expect(mergeResult(p, 1, { score: 100 })[1].score).toBe(250);
  });

  test('total adds every level', () => {
    expect(totalScore({ 1: { score: 100 }, 2: { score: 250 } })).toBe(350);
  });

  test('level 1 is open, later levels need the one before', () => {
    expect(isUnlocked({}, 1)).toBe(true);
    expect(isUnlocked({}, 2)).toBe(false);
    expect(isUnlocked({ 1: { score: 10 } }, 2)).toBe(true);
  });
});
