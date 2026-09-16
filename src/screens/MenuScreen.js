import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LEVELS } from '../game/levels';
import { isUnlocked, totalScore } from '../game/progress';
import { formatTime } from '../game/scoring';

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
  screen: { flex: 1, backgroundColor: '#020617', paddingTop: 72, paddingHorizontal: 22 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  gear: { fontSize: 26, color: '#64748b' },
  title: { fontSize: 40, fontWeight: '800', color: '#f8fafc' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  total: { fontSize: 18, color: '#fbbf24', fontWeight: '700', marginTop: 14 },
  list: { paddingVertical: 20, gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0f172a', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#1e293b',
  },
  locked: { opacity: 0.4 },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardNum: { fontSize: 24, fontWeight: '800', color: '#334155', width: 28 },
  cardText: { gap: 2 },
  cardName: { fontSize: 17, fontWeight: '600', color: '#e2e8f0' },
  cardMeta: { fontSize: 13, color: '#64748b' },
  stars: { fontSize: 16, color: '#fbbf24' },
});
