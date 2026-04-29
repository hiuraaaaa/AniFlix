import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { View } from 'react-native';
import { useTheme } from 'react-native-paper';
import {
  default as Reanimated,
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const DEFAULT_SIZE = 10;
const DURATION = 400;

export default function LoadingIndicator({ size = DEFAULT_SIZE }: { size?: number }) {
  const theme = useTheme();
  const a1 = useSharedValue(0);
  const a2 = useSharedValue(0);
  const a3 = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      const easing = Easing.inOut(Easing.ease);

      const animate = (val: typeof a1, delay: number) => {
        setTimeout(() => {
          val.set(
            withRepeat(
              withSequence(
                withTiming(1, { duration: DURATION, easing }),
                withTiming(0, { duration: DURATION, easing }),
              ),
              -1,
              false,
            ),
          );
        }, delay);
      };

      animate(a1, 0);
      animate(a2, DURATION * 0.4);
      animate(a3, DURATION * 0.8);

      return () => {
        cancelAnimation(a1);
        cancelAnimation(a2);
        cancelAnimation(a3);
      };
    }, [a1, a2, a3]),
  );

  const style1 = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(a1.get(), [0, 1], [0.5, 1.3]) }],
    opacity: interpolate(a1.get(), [0, 0.5, 1], [0.4, 1, 0.4]),
  }));

  const style2 = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(a2.get(), [0, 1], [0.5, 1.3]) }],
    opacity: interpolate(a2.get(), [0, 0.5, 1], [0.4, 1, 0.4]),
  }));

  const style3 = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(a3.get(), [0, 1], [0.5, 1.3]) }],
    opacity: interpolate(a3.get(), [0, 0.5, 1], [0.4, 1, 0.4]),
  }));

  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      <Reanimated.View
        style={[
          {
            backgroundColor: theme.colors.primary,
            borderRadius: 100,
            height: size,
            width: size,
          },
          style1,
        ]}
      />
      <Reanimated.View
        style={[
          {
            backgroundColor: theme.colors.primary,
            borderRadius: 100,
            height: size,
            width: size,
          },
          style2,
        ]}
      />
      <Reanimated.View
        style={[
          {
            backgroundColor: theme.colors.primary,
            borderRadius: 100,
            height: size,
            width: size,
          },
          style3,
        ]}
      />
    </View>
  );
}
