import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors } from '@/theme';

type Props = {
  height: number;
  width?: ViewStyle['width'];
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * A flat loading block. Deliberately not animated: design.md §4.5 rules out
 * shimmer so the loading state costs nothing on a mid-range device.
 *
 * It carries no accessibility role: an empty, non-accessible View is already
 * skipped by TalkBack, and the screen around it announces its own loading
 * caption instead.
 */
export function Skeleton({ height, width = '100%', style, testID = 'skeleton' }: Props) {
  return <View style={[styles.block, { height, width }, style]} testID={testID} />;
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.border },
});
