import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTranslation } from 'react-i18next';

import { Banner, Icon, Skeleton, Text } from '@/components/ui';
import type { TutorialVideo } from '@/features/learning/tutorials';
import { colors } from '@/theme';

type Props = { video: TutorialVideo };

/** A bare HTML page with one `<video>` tag — the whole player. */
function videoHtml(url: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/><style>html,body{margin:0;padding:0;background:#000;height:100%}video{width:100%;height:100%}</style></head><body><video src="${url}" controls autoplay playsinline></video></body></html>`;
}

/**
 * Video playback for a tutorial, reusing `react-native-webview` — already a
 * dependency, already used for the avatar's 3D stage — rather than adding a
 * dedicated video-playback package. No video loads until the farmer taps
 * "Watch tutorial"; a failed load falls back to a plain notice, and the rest
 * of the tutorial around this component is unaffected either way.
 */
export function VideoPreview({ video }: Props) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  const minutes = Math.max(1, Math.round(video.durationSeconds / 60));

  if (failed) {
    return <Banner tone="neutral" icon="offline" title={t('learning.videoUnavailable')} />;
  }

  if (!playing) {
    return (
      <Pressable
        onPress={() => setPlaying(true)}
        style={styles.thumbnail}
        accessibilityRole="button"
        testID="video-thumbnail"
      >
        <View style={styles.playCircle}>
          <Icon name="play" size={26} color={colors.text.onPrimary} strokeWidth={1.6} />
        </View>
        <Text variant="bodyMedium" color={colors.text.onPrimary}>
          {t('learning.watchTutorial')}
        </Text>
        <Text variant="micro" color={colors.text.onPrimary}>
          {t('learning.durationMinutes', { count: minutes })}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.player}>
      <WebView
        originWhitelist={['*']}
        source={{ html: videoHtml(video.videoUrl) }}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState={true}
        renderLoading={() => <Skeleton height={200} />}
        onError={() => setFailed(true)}
        onHttpError={() => setFailed(true)}
        testID="video-webview"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.mapBase,
  },
  playCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  player: { height: 200, backgroundColor: '#000', overflow: 'hidden' },
});
