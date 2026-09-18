import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const SOURCES = {
  roll: require('../../assets/sounds/roll.wav'),
  coin: require('../../assets/sounds/coin.wav'),
  pad: require('../../assets/sounds/pad.wav'),
  spinner: require('../../assets/sounds/spinner.wav'),
  fall: require('../../assets/sounds/fall.wav'),
  goal: require('../../assets/sounds/goal.wav'),
  tap: require('../../assets/sounds/tap.wav'),
};
let players = {};
let enabled = false;
let active = true;
let generation = 0;
let rolling = false;
let lastSpinner = -Infinity;

export function loadSounds() {
  if (Object.keys(players).length) return;
  setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {});
  for (const [name, source] of Object.entries(SOURCES)) {
    try {
      players[name] = createAudioPlayer(source);
      players[name].volume = name === 'roll' ? 0.25 : 0.5;
      players[name].loop = name === 'roll';
    } catch { /* Audio is optional on unsupported devices. */ }
  }
}

function silence() {
  generation++;
  rolling = false;
  Object.values(players).forEach((player) => { try { player.pause(); } catch {} });
}
export function setSoundEnabled(value) {
  enabled = value;
  if (!value) silence();
}
export function setSoundActive(value) {
  active = value;
  if (!value) silence();
}
export function unloadSounds() {
  silence();
  Object.values(players).forEach((player) => { try { player.remove(); } catch {} });
  players = {};
}
export async function playSound(name) {
  const player = players[name];
  if (!enabled || !active || !player) return;
  const token = generation;
  try {
    await player.seekTo(0);
    if (enabled && active && token === generation && players[name] === player) player.play();
  } catch { /* Missing audio output must not interrupt gameplay. */ }
}
export function setRolling(speed = 0) {
  const player = players.roll;
  const next = enabled && active && speed > 0.3;
  if (!player) return;
  try {
    player.volume = Math.min(0.3, speed / 45);
    if (next !== rolling) {
      rolling = next;
      if (next) player.play(); else player.pause();
    }
  } catch {}
}
export function playGameSounds(state) {
  for (const event of state.events ?? []) {
    if (event.type === 'spinner') {
      if (state.time - lastSpinner < 0.15 && state.time >= lastSpinner) continue;
      lastSpinner = state.time;
    }
    playSound(event.type);
  }
  setRolling(state.status === 'playing' && state.grounded ? Math.hypot(state.vx, state.vz) : 0);
}
