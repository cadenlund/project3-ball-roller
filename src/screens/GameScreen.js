import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Scene } from '../components/Scene';
import { STATUS, createGameState, respawn, step } from '../game/engine';
import { getLevel } from '../game/levels';
import { formatTime, scoreLevel, starsFor } from '../game/scoring';
import { useTilt } from '../game/useTilt';

export function GameScreen({ levelId, onExit, onFinish }) {
  const level = getLevel(levelId);

  const { tilt, source, setTilt } = useTilt();
  const [view, setView] = useState(() => createGameState(level));
  const stateRef = useRef(view);
  const rafRef = useRef(null);

  useEffect(() => {
    stateRef.current = createGameState(level);
    setView(stateRef.current);
    let last = null;

    const loop = (now) => {
      if (last != null) {
        const dt = Math.min((now - last) / 1000, 1 / 30);
        stateRef.current = step(stateRef.current, level, tilt.current, dt);
        setView(stateRef.current);
      }
      last = now;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [levelId]);

  // A fall drops the ball back at the start after a short beat.
  useEffect(() => {
    if (view.status !== STATUS.FELL) return;
    const t = setTimeout(() => {
      stateRef.current = respawn(stateRef.current, level);
      setView(stateRef.current);
    }, 550);
    return () => clearTimeout(t);
  }, [view.status]);

  useEffect(() => {
    if (view.status !== STATUS.FINISHED) return;
    const coinsCollected = view.coins.filter(Boolean).length;
    onFinish(levelId, {
      score: scoreLevel({ time: view.time, parTime: level.parTime, coinsCollected, falls: view.falls }),
      time: view.time,
      coins: coinsCollected,
      stars: starsFor({ time: view.time, parTime: level.parTime, coinsCollected, coinTotal: level.coins.length }),
    });
  }, [view.status]);

  return (
    <View style={styles.screen}>
      <Scene level={level} stateRef={stateRef} />

      <View style={styles.hud} pointerEvents="box-none">
        <Pressable onPress={onExit} testID="exit" hitSlop={12}>
          <Text style={styles.back}>&larr;</Text>
        </Pressable>
        <View>
          <Text style={styles.levelName}>{level.name}</Text>
          <Text style={styles.hint}>{level.hint}</Text>
        </View>
        <Text style={styles.timer} testID="timer">{formatTime(view.time)}</Text>
      </View>

      <View style={styles.footer} pointerEvents="none">
        <Text style={styles.meta}>
          {view.coins.filter(Boolean).length}/{level.coins.length} coins
          {view.falls > 0 ? `  ·  ${view.falls} falls` : ''}
        </Text>
        <Text style={styles.source}>
          {source === 'gyro' ? 'tilt to roll' : 'WASD / arrows to roll'}
        </Text>
      </View>

      {view.status === STATUS.FELL && (
        <View style={styles.fell} pointerEvents="none">
          <Text style={styles.fellText}>You fell!</Text>
        </View>
      )}

      {/* On-screen pad so the game is playable with no gyro and no keyboard. */}
      {source !== 'gyro' && (
        <View style={styles.pad} pointerEvents="box-none">
          {[
            { id: 'up', dx: 0, dy: 1 }, { id: 'left', dx: -1, dy: 0 },
            { id: 'down', dx: 0, dy: -1 }, { id: 'right', dx: 1, dy: 0 },
          ].map((d) => (
            <Pressable
              key={d.id}
              testID={`pad-${d.id}`}
              style={[styles.padBtn, styles[`pad_${d.id}`]]}
              onPressIn={() => setTilt({ x: d.dx, y: d.dy })}
              onPressOut={() => setTilt({ x: 0, y: 0 })}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020617' },
  hud: {
    position: 'absolute', top: 64, left: 0, right: 0, paddingHorizontal: 22,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  back: { color: '#94a3b8', fontSize: 28, width: 40 },
  levelName: { color: '#e2e8f0', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  hint: { color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 2 },
  timer: { color: '#38bdf8', fontSize: 18, fontWeight: '700', width: 72, textAlign: 'right' },
  footer: { position: 'absolute', bottom: 28, left: 0, right: 0, alignItems: 'center', gap: 4 },
  meta: { color: '#94a3b8', fontSize: 14 },
  source: { color: '#475569', fontSize: 12 },
  fell: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  fellText: { color: '#f87171', fontSize: 28, fontWeight: '800' },
  pad: { position: 'absolute', bottom: 76, alignSelf: 'center', width: 168, height: 168 },
  padBtn: {
    position: 'absolute', width: 54, height: 54, borderRadius: 12,
    backgroundColor: '#1e293b88', borderWidth: 1, borderColor: '#334155',
  },
  pad_up: { top: 0, left: 57 },
  pad_down: { bottom: 0, left: 57 },
  pad_left: { left: 0, top: 57 },
  pad_right: { right: 0, top: 57 },
});
