import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Saved progress: best score, best time and stars per level.
 * Shape: { "1": { score, time, stars, coins }, ... }
 */
const KEY = 'ballroller.progress.v1';

export async function loadProgress() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveProgress(progress) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage is best-effort; a failure here should never break play.
  }
}

/** Merge a finished run in, keeping the best result per level. */
export function mergeResult(progress, levelId, result) {
  const prev = progress[levelId];
  if (prev && prev.score >= result.score) return progress;
  return { ...progress, [levelId]: result };
}

export function totalScore(progress) {
  return Object.values(progress).reduce((sum, r) => sum + (r?.score ?? 0), 0);
}

export function isUnlocked(progress, levelId) {
  return levelId === 1 || Boolean(progress[levelId - 1]);
}
