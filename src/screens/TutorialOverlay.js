import { FeedbackPressable as Pressable } from '../components/FeedbackPressable';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../theme';

/**
 * First-launch "how to play" overlay. Shown once automatically (App.js
 * gates that on `settings.tutorialSeen`) and reachable again from the
 * settings screen. The controls line adapts to whichever input is actually
 * live: tilt on a device, keys on web, the on-screen D-pad otherwise.
 */
export function TutorialOverlay({ source, onDismiss }) {
  const controlsText =
    source === 'gyro'
      ? 'Tip your phone away from you to roll forward, toward you to brake, and side to side to steer.'
      : source === 'keys'
        ? 'Use WASD or the arrow keys: up/W rolls forward, down/S brakes, left/right steers.'
        : 'Use the on-screen pad: up rolls forward, down brakes, left/right steers.';

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.title}>How to Play</Text>

        <Text style={styles.section}>Controls</Text>
        <Text style={styles.body}>{controlsText}</Text>

        <Text style={styles.section}>On the track</Text>
        <Text style={styles.body}>
          <Text style={styles.bold}>Orange pads</Text> launch you across gaps - roll over one at speed.{'\n'}
          <Text style={styles.bold}>Red spinners</Text> sweep the track; time your run to dodge them.{'\n'}
          <Text style={styles.bold}>Gold coins</Text> are optional, worth bonus points.{'\n'}
          Roll off the edge and you'll fall - you respawn at the start of the level, no run lost.
        </Text>

        <Pressable testID="tutorial-dismiss" onPress={onDismiss} style={styles.button}>
          <Text style={styles.buttonText}>Got it</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.void + 'dd', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 420, backgroundColor: COLORS.surface, borderRadius: 20,
    padding: 24, gap: 6, borderWidth: 1, borderColor: COLORS.border,
  },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  section: { fontSize: 13, fontWeight: '700', color: COLORS.cyanBright, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { fontSize: 15, color: COLORS.textDim, lineHeight: 22 },
  bold: { fontWeight: '700', color: COLORS.text },
  button: {
    marginTop: 20, backgroundColor: COLORS.gold, borderRadius: 14, padding: 16, alignItems: 'center',
  },
  buttonText: { color: COLORS.void, fontSize: 16, fontWeight: '700' },
});
