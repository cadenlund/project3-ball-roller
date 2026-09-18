jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({ play: jest.fn(), pause: jest.fn(), remove: jest.fn(), seekTo: jest.fn(() => Promise.resolve()) })),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));
import { createAudioPlayer } from 'expo-audio';
import { loadSounds, unloadSounds, setSoundEnabled, playSound, setRolling, setSoundActive } from '../src/game/sounds';
beforeEach(() => { jest.clearAllMocks(); loadSounds(); setSoundEnabled(true); setSoundActive(true); });
afterEach(unloadSounds);
test('muting cancels pending playback and stops all players', async () => {
  const pending = playSound('coin');
  setSoundEnabled(false);
  await pending;
  for (const result of createAudioPlayer.mock.results) {
    expect(result.value.play).not.toHaveBeenCalled();
    expect(result.value.pause).toHaveBeenCalled();
  }
});
test('rolling starts only while moving and stops when airborne/stationary', () => {
  const roll = createAudioPlayer.mock.results[0].value;
  setRolling(5); setRolling(6);
  expect(roll.play).toHaveBeenCalledTimes(1);
  setRolling(0);
  expect(roll.pause).toHaveBeenCalledTimes(1);
});
test('background and unmount cancel playback and release resources', async () => {
  setSoundActive(false);
  await playSound('goal');
  const players = createAudioPlayer.mock.results.map(r => r.value);
  unloadSounds();
  players.forEach(p => { expect(p.play).not.toHaveBeenCalled(); expect(p.remove).toHaveBeenCalledTimes(1); });
});
