jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()), selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { haptic, setHapticsEnabled, setHapticsActive, playGameHaptics } from '../src/game/haptics';
const originalOS = Platform.OS;
beforeEach(() => { jest.clearAllMocks(); Platform.OS = 'ios'; setHapticsEnabled(true); setHapticsActive(true); });
afterEach(() => { Platform.OS = originalOS; });
test('events map to subtle impacts and notifications', () => {
  haptic('coin'); haptic('pad'); haptic('landing'); haptic('spinner'); haptic('fall'); haptic('goal'); haptic('tap');
  expect(Haptics.impactAsync.mock.calls).toEqual([['light'], ['medium'], ['medium'], ['heavy']]);
  expect(Haptics.notificationAsync.mock.calls).toEqual([['warning'], ['success']]);
  expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
});
test('toggle, web and background suppress feedback', () => {
  setHapticsEnabled(false); haptic('coin');
  setHapticsEnabled(true); Platform.OS = 'web'; haptic('coin');
  Platform.OS = 'ios'; setHapticsActive(false); haptic('coin');
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
});
test('rolling never vibrates and sustained spinner contact is throttled', () => {
  playGameHaptics({ time: 1, events: [] });
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
  playGameHaptics({ time: 1, events: [{ type: 'coin' }, { type: 'spinner' }] });
  playGameHaptics({ time: 1.05, events: [{ type: 'spinner' }] });
  expect(Haptics.impactAsync.mock.calls).toEqual([['heavy']]);
});
test('unsupported hardware failures do not interrupt play', async () => {
  Haptics.impactAsync.mockRejectedValueOnce(new Error('no hardware'));
  expect(() => haptic('coin')).not.toThrow();
  await Promise.resolve();
});
