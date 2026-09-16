import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/game/settings';

test('loadSettings returns the defaults when nothing has been saved', async () => {
  expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
});

test('saveSettings then loadSettings round-trips, filling in any missing keys with defaults', async () => {
  await saveSettings({ sound: false, haptics: true, sensitivity: 1.25, neutralPitch: 0.5, tutorialSeen: true });
  expect(await loadSettings()).toEqual({
    sound: false,
    haptics: true,
    sensitivity: 1.25,
    neutralPitch: 0.5,
    tutorialSeen: true,
  });
});

test('loadSettings merges a partial save over the defaults', async () => {
  await saveSettings({ sound: false });
  expect(await loadSettings()).toEqual({ ...DEFAULT_SETTINGS, sound: false });
});
