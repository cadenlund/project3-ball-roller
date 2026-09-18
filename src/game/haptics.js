import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

let enabled = false;
let active = true;
let lastHit = -Infinity;
export function setHapticsEnabled(value) { enabled = value; }
export function setHapticsActive(value) { active = value; }

/** Unsupported hardware and web are silent; a rejected vibration is harmless. */
export function haptic(type) {
  if (!enabled || !active || Platform.OS === 'web') return;
  try {
    let result;
    if (type === 'tap') result = Haptics.selectionAsync();
    else if (type === 'goal' || type === 'fall') {
      result = Haptics.notificationAsync(type === 'goal'
        ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    } else {
      const style = { coin: 'Light', pad: 'Medium', landing: 'Medium', spinner: 'Heavy' }[type];
      if (!style) return;
      result = Haptics.impactAsync(Haptics.ImpactFeedbackStyle[style]);
    }
    result?.catch(() => {});
  } catch { /* Some simulators have no haptic hardware. */ }
}

export function playGameHaptics(state) {
  // One strongest response per physics frame avoids overlapping vibrations.
  const priority = ['goal', 'fall', 'spinner', 'pad', 'landing', 'coin'];
  const type = priority.find(type => state.events?.some(event => event.type === type));
  if (!type) return;
  if (type === 'spinner') {
    if (state.time >= lastHit && state.time - lastHit < 0.2) return;
    lastHit = state.time;
  }
  haptic(type);
}
