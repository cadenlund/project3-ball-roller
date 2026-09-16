import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { loadProgress, mergeResult, saveProgress } from './src/game/progress';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './src/game/settings';
import { useTilt } from './src/game/useTilt';
import { GameScreen } from './src/screens/GameScreen';
import { MenuScreen } from './src/screens/MenuScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TutorialOverlay } from './src/screens/TutorialOverlay';

export default function App() {
  const [progress, setProgress] = useState({});
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [levelId, setLevelId] = useState(null); // null = menu
  const [screen, setScreen] = useState('menu'); // 'menu' | 'settings'
  const [showTutorial, setShowTutorial] = useState(false);

  // Owned here, not in GameScreen, so the sensor subscription stays alive
  // across menu/settings/game and the tutorial can read the live input source.
  const tiltHook = useTilt({
    neutralPitch: settings.neutralPitch ?? undefined,
    sensitivity: settings.sensitivity,
  });

  useEffect(() => {
    loadProgress().then(setProgress);
    loadSettings().then((s) => {
      setSettings(s);
      if (!s.tutorialSeen) setShowTutorial(true);
    });
  }, []);

  const updateSettings = (next) => {
    setSettings(next);
    saveSettings(next);
  };

  const handleFinish = (id, result) => {
    setProgress((prev) => {
      const next = mergeResult(prev, id, result);
      saveProgress(next);
      return next;
    });
    setLevelId(null);
  };

  const dismissTutorial = () => {
    setShowTutorial(false);
    if (!settings.tutorialSeen) updateSettings({ ...settings, tutorialSeen: true });
  };

  const handleResetProgress = () => {
    setProgress({});
    saveProgress({});
  };

  let body;
  if (levelId != null) {
    body = (
      <GameScreen levelId={levelId} onExit={() => setLevelId(null)} onFinish={handleFinish} tiltHook={tiltHook} />
    );
  } else if (screen === 'settings') {
    body = (
      <SettingsScreen
        settings={settings}
        onChange={updateSettings}
        onBack={() => setScreen('menu')}
        onResetProgress={handleResetProgress}
        onShowTutorial={() => setShowTutorial(true)}
        tiltHook={tiltHook}
      />
    );
  } else {
    body = <MenuScreen progress={progress} onPlay={setLevelId} onSettings={() => setScreen('settings')} />;
  }

  return (
    <View style={styles.root}>
      {body}
      {showTutorial && <TutorialOverlay source={tiltHook.source} onDismiss={dismissTutorial} />}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020617' },
});
