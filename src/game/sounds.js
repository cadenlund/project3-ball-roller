import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const SOURCES = {
  roll: require('../../assets/sounds/roll.wav'),
  wind: require('../../assets/sounds/wind.wav'),
  drone: require('../../assets/sounds/drone.wav'),
  coin: require('../../assets/sounds/coin.wav'),
  pad: require('../../assets/sounds/pad.wav'),
  boost: require('../../assets/sounds/boost.wav'),
  switch: require('../../assets/sounds/switch.wav'),
  gate: require('../../assets/sounds/gate.wav'),
  cannon: require('../../assets/sounds/cannon.wav'),
  fire: require('../../assets/sounds/fire.wav'),
  ballast: require('../../assets/sounds/ballast.wav'),
  spinner: require('../../assets/sounds/spinner.wav'),
  fall: require('../../assets/sounds/fall.wav'),
  goal: require('../../assets/sounds/goal.wav'),
  tap: require('../../assets/sounds/tap.wav'),
};
/** The beds that play continuously rather than as one-shots. */
const LOOPS = { roll: 0.25, wind: 0.5, drone: 0.4 };

let players = {};
let enabled = false;
let active = true;
let generation = 0;
let playing = { roll: false, wind: false, drone: false };
let lastSpinner = -Infinity;

export function loadSounds() {
  if (Object.keys(players).length) return;
  setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {});
  for (const [name, source] of Object.entries(SOURCES)) {
    try {
      players[name] = createAudioPlayer(source);
      players[name].volume = LOOPS[name] ?? 0.5;
      players[name].loop = name in LOOPS;
    } catch { /* Audio is optional on unsupported devices. */ }
  }
}

function silence() {
  generation++;
  playing = { roll: false, wind: false, drone: false };
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

/** Run a looping bed at `volume`, starting and stopping it only on a change. */
function setLoop(name, volume) {
  const player = players[name];
  if (!player) return;
  const next = enabled && active && volume > 0.01;
  try {
    player.volume = volume;
    if (next !== playing[name]) {
      playing[name] = next;
      if (next) player.play(); else player.pause();
    }
  } catch {}
}

export function setRolling(speed = 0) {
  setLoop('roll', speed > 0.3 ? Math.min(0.3, speed / 45) : 0);
}

/**
 * The wind. It is always there at this altitude, but it is the thing that
 * tells you how fast you are actually going, so it rises steeply with speed
 * and harder again once the track is no longer underneath you - a fall should
 * be audible before it is visible.
 */
export function setWind(speed = 0, airborne = false, drop = 0) {
  const rush = Math.min(1, speed / 26) ** 1.5;
  const falling = airborne ? Math.min(1, Math.max(0, drop - 4) / 30) : 0;
  setLoop('wind', Math.min(0.55, 0.1 + rush * 0.3 + falling * 0.34));
}

/**
 * The drone. It does not react to anything - that is the point. Wind tells you
 * how fast you are going; this only tells you where you are, which is a very
 * long way up, and it has to be steady or it stops meaning that.
 */
export function setAmbience(playing = true) {
  setLoop('drone', playing ? 0.34 : 0);
}

export function playGameSounds(state) {
  for (const event of state.events ?? []) {
    if (event.type === 'spinner') {
      if (state.time - lastSpinner < 0.15 && state.time >= lastSpinner) continue;
      lastSpinner = state.time;
    }
    playSound(event.type);
  }
  const rolling = state.status === 'playing' && state.grounded;
  setRolling(rolling ? Math.hypot(state.vx, state.vz) : 0);
  setWind(
    state.status === 'playing' ? Math.hypot(state.vx, state.vz) : 0,
    state.status === 'playing' && !state.grounded,
    -state.vy
  );
  setAmbience(state.status === 'playing');
}

/** Stop both beds - for a pause, a restart, or leaving the level. */
export function setQuiet() {
  setRolling(0);
  setLoop('wind', 0);
  setLoop('drone', 0);
}
