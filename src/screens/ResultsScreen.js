import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatTime } from '../game/scoring';
import { COLORS } from '../theme';

/**
 * Shown after `GameScreen` finishes a level: the score breakdown from
 * `scoring.js`, an animated star reveal, a "new best" callout when this run
 * beats the saved one, and Replay / Next / Menu to chain straight on.
 */
export function ResultsScreen({ level, result, isNewBest, hasNext, onReplay, onNext, onMenu }) {
  const { breakdown } = result;

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{level.name}</Text>
        <Text style={styles.title}>Level Complete!</Text>

        {isNewBest && (
          <View style={styles.bestBadge}>
            <Text style={styles.bestBadgeText}>New Best!</Text>
          </View>
        )}

        <View style={styles.stars}>
          {[0, 1, 2].map((i) => (
            <Star key={i} filled={i < result.stars} delay={i * 180} />
          ))}
        </View>

        <Text style={styles.time}>{formatTime(result.time)}</Text>

        <View style={styles.breakdown}>
          <Row label="Base" value={breakdown.base} />
          {breakdown.timeBonus > 0 && <Row label="Time bonus" value={breakdown.timeBonus} sign="+" />}
          {breakdown.coinBonus > 0 && <Row label={`Coins (${result.coins})`} value={breakdown.coinBonus} sign="+" />}
          {breakdown.fallPenalty > 0 && <Row label={`Falls (${result.falls})`} value={breakdown.fallPenalty} sign="-" />}
          <View style={styles.divider} />
          <Row label="Total" value={breakdown.total} bold />
        </View>

        <View style={styles.buttons}>
          <Pressable testID="results-replay" onPress={onReplay} style={styles.buttonOutline}>
            <Text style={styles.buttonOutlineText}>Replay</Text>
          </Pressable>
          {hasNext && (
            <Pressable testID="results-next" onPress={onNext} style={styles.buttonPrimary}>
              <Text style={styles.buttonPrimaryText}>Next Level</Text>
            </Pressable>
          )}
        </View>
        <Pressable testID="results-menu" onPress={onMenu} hitSlop={12}>
          <Text style={styles.menuLink}>Menu</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ label, value, sign, bold }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.rowLabelBold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowValueBold]}>
        {sign ?? ''}{value}
      </Text>
    </View>
  );
}

function Star({ filled, delay }) {
  const scale = useRef(new Animated.Value(filled ? 0 : 1)).current;

  useEffect(() => {
    if (!filled) return;
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [filled, delay]);

  return (
    <Animated.Text
      style={[styles.star, !filled && styles.starEmpty, { transform: [{ scale }] }]}
    >
      {filled ? '★' : '☆'}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.void, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 420, backgroundColor: COLORS.surface, borderRadius: 24,
    padding: 28, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  eyebrow: { color: COLORS.textMuted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: COLORS.text, fontSize: 26, fontWeight: '800', marginTop: 4 },
  bestBadge: {
    marginTop: 14, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: COLORS.gold,
  },
  bestBadgeText: { color: COLORS.void, fontWeight: '800', fontSize: 13 },
  stars: { flexDirection: 'row', gap: 10, marginTop: 20 },
  star: {
    fontSize: 40, color: COLORS.gold,
    textShadowColor: COLORS.gold, textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 },
  },
  starEmpty: { color: COLORS.border, textShadowRadius: 0 },
  time: { color: COLORS.cyanBright, fontSize: 20, fontWeight: '700', marginTop: 16 },
  breakdown: { width: '100%', marginTop: 24, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: COLORS.textDim, fontSize: 14 },
  rowValue: { color: COLORS.textDim, fontSize: 14, fontVariant: ['tabular-nums'] },
  rowLabelBold: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
  rowValueBold: { color: COLORS.gold, fontSize: 17, fontWeight: '800' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 26, width: '100%' },
  buttonOutline: {
    flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.cyan,
  },
  buttonOutlineText: { color: COLORS.cyanBright, fontWeight: '700', fontSize: 15 },
  buttonPrimary: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: COLORS.gold },
  buttonPrimaryText: { color: COLORS.void, fontWeight: '800', fontSize: 15 },
  menuLink: { color: COLORS.textFaint, marginTop: 18, fontSize: 14, textDecorationLine: 'underline' },
});
