import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors } from '@/theme';

type Props = {
  children: ReactNode;
  /** Which safe-area edges to inset. The map screen opts out of the bottom. */
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Screen shell: background colour + safe-area insets, nothing else. */
export function Screen({ children, edges = ['top'], style, testID }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={edges} testID={testID}>
      <View style={[styles.body, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
});
