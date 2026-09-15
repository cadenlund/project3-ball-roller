import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { loadProgress, mergeResult, saveProgress } from './src/game/progress';
import { GameScreen } from './src/screens/GameScreen';
import { MenuScreen } from './src/screens/MenuScreen';

export default function App() {
  const [progress, setProgress] = useState({});
  const [levelId, setLevelId] = useState(null); // null = menu

  useEffect(() => {
    loadProgress().then(setProgress);
  }, []);

  const handleFinish = (id, result) => {
    setProgress((prev) => {
      const next = mergeResult(prev, id, result);
      saveProgress(next);
      return next;
    });
    setLevelId(null);
  };

  return (
    <View style={styles.root}>
      {levelId == null ? (
        <MenuScreen progress={progress} onPlay={setLevelId} />
      ) : (
        <GameScreen levelId={levelId} onExit={() => setLevelId(null)} onFinish={handleFinish} />
      )}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#020617' },
});
