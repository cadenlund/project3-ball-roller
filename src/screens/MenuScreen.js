import { FeedbackPressable as Pressable } from '../components/FeedbackPressable';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { LEVELS, LEVEL_COUNT } from '../game/levels';
import { isUnlocked, totalScore } from '../game/progress';
import { formatTime } from '../game/scoring';
import { COLORS } from '../theme';

export function MenuScreen({ progress, onPlay, onSettings }) {
  const totalStars = Object.values(progress).reduce((sum, r) => sum + (r?.stars ?? 0), 0);

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.title}>Ball Roller</Text>
          <Text style={styles.subtitle}>Caden · Ben · Jordan · Project 3</Text>
        </View>
        <Pressable testID="open-settings" onPress={onSettings} hitSlop={12}>
          <Text style={styles.gear}>&#9881;</Text>
        </Pressable>
      </View>

      <View style={styles.totals}>
        <Text style={styles.total} testID="total-score">
          {totalScore(progress)} pts
        </Text>
        <Text style={styles.totalStars} testID="total-stars">
          &#9733; {totalStars}/{LEVEL_COUNT * 3}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {LEVELS.map((level) => {
          const unlocked = isUnlocked(progress, level.id);
          const best = progress[level.id];
          return (
            <Pressable
              key={level.id}
              testID={`level-${level.id}`}
              disabled={!unlocked}
              onPress={() => onPlay(level.id)}
              style={[styles.card, { borderLeftWidth: 4, borderLeftColor: level.theme.accent }, !unlocked && styles.locked, best && styles.cardCleared]}
            >
              <View style={styles.cardMain}>
                <Text style={[styles.cardNum, unlocked && { color: level.theme.accent }]}>{unlocked ? level.id : '\u{1F512}'}</Text>
                <View style={styles.cardText}>
                  <Text style={styles.cardName}>{unlocked ? level.name : 'Locked'}</Text>
                  <Text style={styles.cardMeta}>
                    {unlocked
                      ? best
                        ? `${best.score} pts  ·  ${formatTime(best.time)}`
                        : `par ${level.parTime}s`
                      : `Beat Level ${level.id - 1} to unlock`}
                  </Text>
                </View>
              </View>
              <Stars count={best?.stars ?? 0} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Stars({ count }) {
  return (
    <View style={styles.stars}>
      {[0, 1, 2].map((i) => (
        <Text key={i} style={[styles.star, i >= count && styles.starEmpty]}>
          &#9733;
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.void, paddingTop: 72, paddingHorizontal: 22 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  gear: { fontSize: 26, color: COLORS.textMuted },
  title: {
    fontSize: 40, fontWeight: '800', color: COLORS.text,
    textShadowColor: COLORS.ember + '55', textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 },
  },
  subtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 4 },
  totals: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 },
  total: { fontSize: 18, color: COLORS.gold, fontWeight: '700' },
  totalStars: { fontSize: 16, color: COLORS.goldBright, fontWeight: '700' },
  list: { paddingVertical: 20, gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardCleared: { borderColor: COLORS.gold + '66' },
  locked: { opacity: 0.4 },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardNum: { fontSize: 24, fontWeight: '800', color: COLORS.textFaint, width: 28, textAlign: 'center' },
  cardText: { gap: 2 },
  cardName: { fontSize: 17, fontWeight: '600', color: COLORS.text },
  cardMeta: { fontSize: 13, color: COLORS.textMuted },
  stars: { flexDirection: 'row', gap: 2 },
  star: { fontSize: 15, color: COLORS.gold },
  starEmpty: { color: COLORS.border },
});
