import { FeedbackPressable as Pressable } from '../components/FeedbackPressable';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { playGameSounds, setRolling } from '../game/sounds';
import { Scene } from '../components/Scene';
import { STATUS, createGameState, respawn, step } from '../game/engine';
import { getLevel } from '../game/levels';
import { formatTime, scoreBreakdown, starsFor } from '../game/scoring';
import { COLORS } from '../theme';

// Level start, and every respawn, pause on 3-2-1-Go before the engine loop
// resumes - `at` is ms from the trigger, `value` is what the overlay shows.
const COUNTDOWN = [
  { at: 0, value: '3' },
  { at: 700, value: '2' },
  { at: 1400, value: '1' },
  { at: 2100, value: 'GO' },
  { at: 2500, value: null },
];

export function GameScreen({ levelId, onExit, onFinish, tiltHook }) {
  const level = getLevel(levelId);

  const { tilt, source, setTilt } = tiltHook;
  const [view, setView] = useState(() => createGameState(level));
  const [countdown, setCountdown] = useState('3');
  const stateRef = useRef(view);
  const rafRef = useRef(null);
  const frozenRef = useRef(true); // mirrors `countdown != null`; read every frame
  const countdownTimers = useRef([]);

  const runCountdown = () => {
    countdownTimers.current.forEach(clearTimeout);
    frozenRef.current = true;
    countdownTimers.current = COUNTDOWN.map(({ at, value }) =>
      setTimeout(() => {
        setCountdown(value);
        if (value == null) frozenRef.current = false;
      }, at)
    );
  };

  useEffect(() => {
    stateRef.current = createGameState(level);
    setView(stateRef.current);
    runCountdown();
    let last = null;

    const loop = (now) => {
      if (last != null && !frozenRef.current) {
        const dt = Math.min((now - last) / 1000, 1 / 30);
        const previous = stateRef.current;
        stateRef.current = step(previous, level, tilt.current, dt);
        if (stateRef.current !== previous) playGameSounds(stateRef.current);
        setView(stateRef.current);
      }
      last = now;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      setRolling(0);
      cancelAnimationFrame(rafRef.current);
      countdownTimers.current.forEach(clearTimeout);
    };
  }, [levelId]);

  // A fall drops the ball back at the start after a short beat, then runs
  // the same 3-2-1 countdown as the level start before play resumes.
  useEffect(() => {
    if (view.status !== STATUS.FELL) return;
    const t = setTimeout(() => {
      stateRef.current = respawn(stateRef.current, level);
      setView(stateRef.current);
      runCountdown();
    }, 550);
    return () => clearTimeout(t);
  }, [view.status]);

  useEffect(() => {
    if (view.status !== STATUS.FINISHED) return;
    const coinsCollected = view.coins.filter(Boolean).length;
    const breakdown = scoreBreakdown({ time: view.time, parTime: level.parTime, coinsCollected, falls: view.falls });
    onFinish(levelId, {
      score: breakdown.total,
      breakdown,
      time: view.time,
      coins: coinsCollected,
      falls: view.falls,
      stars: starsFor({ time: view.time, parTime: level.parTime, coinsCollected, coinTotal: level.coins.length }),
    });
  }, [view.status]);

  const coinsCollected = view.coins.filter(Boolean).length;
  const isLate = view.time > level.parTime;

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
        <Text style={[styles.timer, isLate && styles.timerLate]} testID="timer">
          {formatTime(view.time)}
        </Text>
      </View>

      <View style={styles.stats} pointerEvents="none">
        <StatChip testID="coin-stat" value={`${coinsCollected}/${level.coins.length}`} label="coins" pulseOn={coinsCollected} />
        {view.falls > 0 && <StatChip testID="fall-stat" value={view.falls} label="falls" danger />}
      </View>

      <View style={styles.footer} pointerEvents="none">
        <Text style={styles.source}>
          {source === 'gyro' ? 'tilt to roll' : 'WASD / arrows to roll'}
        </Text>
      </View>

      {view.status === STATUS.FELL && (
        <View style={styles.fell} pointerEvents="none">
          <Text style={styles.fellText}>You fell!</Text>
        </View>
      )}

      {countdown && (
        <View style={styles.countdown} pointerEvents="none">
          <CountdownNumber value={countdown} />
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

/** A HUD pill for coins/falls, with a little pop whenever `pulseOn` changes. */
function StatChip({ testID, value, label, danger, pulseOn }) {
  const scale = useRef(new Animated.Value(1)).current;
  const prev = useRef(pulseOn);

  useEffect(() => {
    if (pulseOn === undefined || pulseOn === prev.current) return;
    prev.current = pulseOn;
    scale.setValue(1.35);
    Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  }, [pulseOn]);

  return (
    <View style={styles.statChip} testID={testID}>
      <Animated.Text style={[styles.statValue, danger && styles.statValueDanger, { transform: [{ scale }] }]}>
        {value}
      </Animated.Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CountdownNumber({ value }) {
  const scale = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    scale.setValue(0.4);
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }).start();
  }, [value]);

  return (
    <Animated.Text style={[styles.countdownText, { transform: [{ scale }] }]}>{value}</Animated.Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.void },
  hud: {
    position: 'absolute', top: 64, left: 0, right: 0, paddingHorizontal: 22,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  back: { color: COLORS.textMuted, fontSize: 28, width: 40 },
  levelName: { color: COLORS.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  hint: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginTop: 2 },
  timer: {
    color: COLORS.cyanBright, fontSize: 18, fontWeight: '700', width: 72, textAlign: 'right',
    textShadowColor: COLORS.cyan, textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 },
  },
  timerLate: { color: COLORS.ember, textShadowColor: COLORS.ember },
  stats: {
    position: 'absolute', top: 112, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 10,
  },
  statChip: {
    flexDirection: 'row', alignItems: 'baseline', gap: 5,
    backgroundColor: COLORS.surface + 'cc', borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12,
  },
  statValue: { color: COLORS.goldBright, fontSize: 14, fontWeight: '800' },
  statValueDanger: { color: COLORS.ember },
  statLabel: { color: COLORS.textMuted, fontSize: 12 },
  footer: { position: 'absolute', bottom: 28, left: 0, right: 0, alignItems: 'center', gap: 4 },
  source: { color: COLORS.textFaint, fontSize: 12 },
  fell: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  fellText: {
    color: COLORS.ember, fontSize: 28, fontWeight: '800',
    textShadowColor: COLORS.ember, textShadowRadius: 16, textShadowOffset: { width: 0, height: 0 },
  },
  countdown: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  countdownText: {
    color: COLORS.gold, fontSize: 72, fontWeight: '900',
    textShadowColor: COLORS.gold, textShadowRadius: 30, textShadowOffset: { width: 0, height: 0 },
  },
  pad: { position: 'absolute', bottom: 76, alignSelf: 'center', width: 168, height: 168 },
  padBtn: {
    position: 'absolute', width: 54, height: 54, borderRadius: 12,
    backgroundColor: COLORS.surface + 'cc', borderWidth: 1, borderColor: COLORS.border,
  },
  pad_up: { top: 0, left: 57 },
  pad_down: { bottom: 0, left: 57 },
  pad_left: { left: 0, top: 57 },
  pad_right: { right: 0, top: 57 },
});
