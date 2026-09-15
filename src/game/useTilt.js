import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';

/**
 * Tilt input, with a keyboard fallback.
 *
 * Returns a ref holding {x, y} in roughly -1..1, plus which source is live.
 * A ref rather than state on purpose: the game loop reads this every frame and
 * re-rendering on every sensor sample would be wasteful.
 *
 * On a device the accelerometer reports gravity, which is turned into pitch
 * and roll angles around a resting hold of ~45 degrees - nobody plays with
 * their phone flat. From there, tip the phone away from you to roll forward
 * (y positive), pull it toward you to roll back, and tilt sideways to steer
 * (x positive = right). Where there is no accelerometer (simulator, web,
 * desktop) the arrow keys and WASD take over.
 */
export function useTilt() {
  const tilt = useRef({ x: 0, y: 0 });
  const [source, setSource] = useState('none');

  useEffect(() => {
    let sub = null;
    let cancelled = false;

    (async () => {
      const available = await Accelerometer.isAvailableAsync().catch(() => false);
      if (cancelled) return;

      if (available) {
        Accelerometer.setUpdateInterval(16);
        sub = Accelerometer.addListener(({ x, y, z }) => {
          // Angles, not raw g's: pitch is how far the top of the phone is
          // tipped up toward the player (flat = 0), roll how far it is tipped
          // sideways. abs(z) keeps this the same on iOS and Android, whose
          // accelerometer z signs differ.
          const pitch = Math.atan2(-y, Math.abs(z));
          const roll = Math.atan2(x, Math.hypot(y, z));
          tilt.current = {
            x: clamp(roll / ROLL_BAND),
            y: clamp((NEUTRAL_PITCH - pitch) / PITCH_BAND),
          };
        });
        setSource('gyro');
      } else {
        setSource('keys');
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  useEffect(() => {
    if (source !== 'keys' || Platform.OS !== 'web') return;

    const held = new Set();
    const apply = () => {
      const x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      const y = (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0); // up = forward
      tilt.current = { x, y };
    };
    const key = (e) => KEY_MAP[e.key] ?? null;
    const down = (e) => { const k = key(e); if (k) { held.add(k); apply(); e.preventDefault(); } };
    const up = (e) => { const k = key(e); if (k) { held.delete(k); apply(); } };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [source]);

  return { tilt, source, setTilt: (v) => { tilt.current = v; } };
}

// Resting neutral: top of the phone tipped ~45 degrees up toward the player.
// Full input is reached PITCH_BAND/ROLL_BAND past neutral - so forward maxes
// out just before the phone is flat, and backward near vertical.
const NEUTRAL_PITCH = Math.PI / 4;
const PITCH_BAND = (40 * Math.PI) / 180;
const ROLL_BAND = (35 * Math.PI) / 180;

const KEY_MAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down',
  A: 'left', D: 'right', W: 'up', S: 'down',
};

function clamp(v) {
  return Math.max(-1, Math.min(1, v));
}
