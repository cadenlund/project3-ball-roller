import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppState, StyleSheet, View } from 'react-native';

import { LEVEL_COUNT, getLevel } from './src/game/levels';
import { loadProgress, mergeResult, saveProgress } from './src/game/progress';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './src/game/settings';
import { useTilt } from './src/game/useTilt';
import { GameScreen } from './src/screens/GameScreen';
import { MenuScreen } from './src/screens/MenuScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TutorialOverlay } from './src/screens/TutorialOverlay';
import { loadSounds, unloadSounds, setSoundEnabled, setSoundActive } from './src/game/sounds';
import { COLORS } from './src/theme';

export default function App() {
  const [progress, setProgress] = useState({});
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [levelId, setLevelId] = useState(null); // null = menu
  const [screen, setScreen] = useState('menu'); // 'menu' | 'settings'
  const [showTutorial, setShowTutorial] = useState(false);
  const [results, setResults] = useState(null); // { levelId, result, isNewBest } | null

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

  useEffect(() => {
    loadSounds();
    setSoundActive(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
    const sub = AppState.addEventListener('change', (state) => setSoundActive(state === 'active'));
    return () => { sub.remove(); unloadSounds(); };
  }, []);

  useEffect(() => { setSoundEnabled(settings.sound); }, [settings.sound]);

  const updateSettings = (next) => {
    setSoundEnabled(next.sound);
    setSettings(next);
    saveSettings(next);
  };

  const handleFinish = (id, result) => {
    setProgress((prev) => {
      const prevBest = prev[id];
      const isNewBest = !prevBest || result.score > prevBest.score;
      const next = mergeResult(prev, id, result);
      saveProgress(next);
      setResults({ levelId: id, result, isNewBest });
      return next;
    });
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
  if (results) {
    body = (
      <ResultsScreen
        level={getLevel(results.levelId)}
        result={results.result}
        isNewBest={results.isNewBest}
        hasNext={results.levelId < LEVEL_COUNT}
        onReplay={() => { setResults(null); setLevelId(results.levelId); }}
        onNext={() => { const next = results.levelId + 1; setResults(null); setLevelId(next); }}
        onMenu={() => { setResults(null); setLevelId(null); }}
      />
    );
  } else if (levelId != null) {
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
  root: { flex: 1, backgroundColor: COLORS.void },
});
