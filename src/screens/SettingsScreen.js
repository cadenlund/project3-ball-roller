import { FeedbackPressable as Pressable } from '../components/FeedbackPressable';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { haptic } from '../game/haptics';
import { COLORS } from '../theme';

const SENSITIVITY_STEPS = [0.75, 1, 1.25, 1.5];

/**
 * Settings screen: sound/haptics toggles (Jordan's audio and haptics work
 * read these flags), steering sensitivity, tilt calibration, a link back
 * into the tutorial, and a progress reset.
 */
export function SettingsScreen({ settings, onChange, onBack, onResetProgress, onShowTutorial, tiltHook }) {
  const [justCalibrated, setJustCalibrated] = useState(false);

  const set = (patch) => onChange({ ...settings, ...patch });

  const handleCalibrate = () => {
    const neutralPitch = tiltHook.calibrate();
    set({ neutralPitch });
    setJustCalibrated(true);
    setTimeout(() => setJustCalibrated(false), 1500);
  };

  const handleReset = () => {
    Alert.alert('Reset progress?', 'This clears every level’s best score, time and stars. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: onResetProgress },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} testID="settings-back" hitSlop={12}>
          <Text style={styles.back}>&larr;</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <Row label="Sound">
          <Switch
            testID="sound-toggle"
            value={settings.sound}
            onValueChange={(v) => { set({ sound: v }); haptic('tap'); }}
            trackColor={{ false: COLORS.surfaceAlt, true: COLORS.cyanDeep }}
            thumbColor={settings.sound ? COLORS.cyan : undefined}
          />
        </Row>

        <Row label="Haptics">
          <Switch
            testID="haptics-toggle"
            value={settings.haptics}
            onValueChange={(v) => { set({ haptics: v }); if (v) haptic('tap'); }}
            trackColor={{ false: COLORS.surfaceAlt, true: COLORS.cyanDeep }}
            thumbColor={settings.haptics ? COLORS.cyan : undefined}
          />
        </Row>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Steering sensitivity</Text>
          <View style={styles.chips}>
            {SENSITIVITY_STEPS.map((v) => (
              <Pressable
                key={v}
                testID={`sensitivity-${v}`}
                onPress={() => set({ sensitivity: v })}
                style={[styles.chip, settings.sensitivity === v && styles.chipActive]}
              >
                <Text style={[styles.chipText, settings.sensitivity === v && styles.chipTextActive]}>{v}&times;</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tilt calibration</Text>
          {tiltHook.source === 'gyro' ? (
            <>
              <Text style={styles.hint}>
                Hold your phone the way you'll play, then tap calibrate to make that pose neutral.
              </Text>
              <Pressable testID="calibrate" onPress={handleCalibrate} style={styles.button}>
                <Text style={styles.buttonText}>{justCalibrated ? 'Calibrated ✓' : 'Calibrate tilt'}</Text>
              </Pressable>
              {settings.neutralPitch != null && (
                <Pressable onPress={() => set({ neutralPitch: null })}>
                  <Text style={styles.linkText}>Reset to default</Text>
                </Pressable>
              )}
            </>
          ) : (
            <Text style={styles.hint}>Calibration needs a device with a tilt sensor.</Text>
          )}
        </View>

        <Pressable testID="how-to-play" onPress={onShowTutorial} style={styles.button}>
          <Text style={styles.buttonText}>How to play</Text>
        </Pressable>

        <Pressable testID="reset-progress" onPress={handleReset} style={[styles.button, styles.dangerButton]}>
          <Text style={[styles.buttonText, styles.dangerText]}>Reset progress</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Row({ label, children }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.void, paddingTop: 64, paddingHorizontal: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: COLORS.textMuted, fontSize: 28, width: 40 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  list: { paddingVertical: 24, gap: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  rowLabel: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  section: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, gap: 10,
  },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  hint: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.cyan, borderColor: COLORS.cyan },
  chipText: { color: COLORS.textMuted, fontWeight: '600' },
  chipTextActive: { color: COLORS.void },
  button: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  buttonText: { color: COLORS.cyanBright, fontSize: 16, fontWeight: '700' },
  dangerButton: { borderColor: COLORS.emberDeep },
  dangerText: { color: COLORS.danger },
  linkText: { color: COLORS.textFaint, fontSize: 13, textDecorationLine: 'underline' },
});
