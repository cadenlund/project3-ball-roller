import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persisted player settings: sound/haptics toggles (read by Jordan's audio and
 * haptics work), steering sensitivity, a calibrated tilt neutral, and whether
 * the first-launch tutorial has been shown. Same load/save shape as
 * `progress.js`, kept as its own key so resetting progress never touches
 * settings.
 */
const KEY = 'ballroller.settings.v1';

export const DEFAULT_SETTINGS = {
  sound: true,
  haptics: true,
  sensitivity: 1,
  neutralPitch: null, // null = use the built-in default until calibrated
  tutorialSeen: false,
};

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage is best-effort; a failure here should never break play.
  }
}
