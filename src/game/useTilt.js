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
 * On a device the accelerometer reports gravity, so tilting the phone rolls
 * the ball. Where there is no accelerometer (simulator, web, desktop) the
 * arrow keys and WASD take over.
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
        sub = Accelerometer.addListener(({ x, y }) => {
          // Screen y grows downward, so the device's y axis is inverted.
          tilt.current = { x: clamp(x), y: clamp(-y) };
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
      const y = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
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

const KEY_MAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down',
  A: 'left', D: 'right', W: 'up', S: 'down',
};

function clamp(v) {
  return Math.max(-1, Math.min(1, v));
}
