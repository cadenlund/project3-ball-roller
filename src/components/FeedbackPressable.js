import { Pressable } from 'react-native';
import { haptic } from '../game/haptics';
import { playSound } from '../game/sounds';

/** One place for button feedback; disabled Pressables never fire onPress. */
export function FeedbackPressable({ onPress, ...props }) {
  return <Pressable {...props} onPress={(event) => { playSound('tap'); haptic('tap'); onPress?.(event); }} />;
}
