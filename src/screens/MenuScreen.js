import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LEVELS } from '../game/levels';
import { isUnlocked, totalScore } from '../game/progress';
import { formatTime } from '../game/scoring';
import { COLORS } from '../theme';

export function MenuScreen({ progress, onPlay, onSettings }) {
  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.title}>Ball Roller</Text>
          <Text style={styles.subtitle}>Caden Lund &middot; Project 3</Text>
        </View>
        <Pressable testID="open-settings" onPress={onSettings} hitSlop={12}>
          <Text style={styles.gear}>&#9881;</Text>
        </Pressable>
      </View>
      <Text style={styles.total} testID="total-score">
        {totalScore(progress)} pts
      </Text>

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
              style={[styles.card, !unlocked && styles.locked]}
            >
              <View style={styles.cardMain}>
                <Text style={styles.cardNum}>{level.id}</Text>
                <View style={styles.cardText}>
                  <Text style={styles.cardName}>{unlocked ? level.name : 'Locked'}</Text>
                  <Text style={styles.cardMeta}>
                    {best
                      ? `${best.score} pts  ·  ${formatTime(best.time)}`
                      : `par ${level.parTime}s`}
                  </Text>
                </View>
              </View>
              <Text style={styles.stars}>{best ? '★'.repeat(best.stars) : ''}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
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
  total: { fontSize: 18, color: COLORS.gold, fontWeight: '700', marginTop: 14 },
  list: { paddingVertical: 20, gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  locked: { opacity: 0.4 },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardNum: { fontSize: 24, fontWeight: '800', color: COLORS.textFaint, width: 28 },
  cardText: { gap: 2 },
  cardName: { fontSize: 17, fontWeight: '600', color: COLORS.text },
  cardMeta: { fontSize: 13, color: COLORS.textMuted },
  stars: { fontSize: 16, color: COLORS.gold },
});
