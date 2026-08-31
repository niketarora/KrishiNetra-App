import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle, type ScrollView } from 'react-native';

import { useGuideTarget } from '@/features/guide/useGuideTarget';

type Props = {
  /** Must be one of HIGHLIGHT_TARGETS — the same id the backend registry uses. */
  id: string;
  children: ReactNode;
  /** The ScrollView this sits in, so a SCROLL step can bring it into view. */
  scroll?: React.RefObject<ScrollView | null>;
  /**
   * Needed wherever the wrapped element was itself a flex child — a status card
   * in Home's two-column grid, say. Without it the wrapper collapses the tile.
   */
  style?: StyleProp<ViewStyle>;
};

/**
 * Wraps an element so the guide can scroll to it and spotlight it.
 *
 * A wrapper rather than a ref forwarded into `Card`/`StatusCard` for one
 * practical reason: Android collapses view-only Views out of the native
 * hierarchy, and a collapsed view cannot be measured. `collapsable={false}`
 * is what keeps the node real, and putting it here means the design-system
 * components stay unaware of the guide entirely.
 */
export function GuideTarget({ id, children, scroll, style }: Props) {
  const setView = useGuideTarget(id, scroll);

  return (
    <View ref={setView} collapsable={false} style={style}>
      {children}
    </View>
  );
}
