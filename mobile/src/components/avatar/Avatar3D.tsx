import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type { AvatarState } from '@/features/avatar/avatarMachine';

import { resolveDirective } from './animation/animationController';
import { buildSceneHtml, type SceneEvent } from './avatar3d/scene';
import { loadAvatarAssets } from './avatar3d/assets';

type Props = {
  state: AvatarState;
  reduceMotion: boolean;
  /**
   * Called when the scene cannot run — a missing model, a WebGL failure, a
   * crashed WebView. The stage then shows the photograph instead.
   */
  onUnavailable: () => void;
};

/**
 * The rigged 3D farmer, rendered by three.js inside a WebView.
 *
 * A WebView rather than expo-gl + react-three-fiber: full three.js and GLTF
 * support with no native GL bridging, no version coupling to the Expo SDK, and
 * a scene that can be opened in a desktop browser to debug. The cost is a
 * message hop per state change, which is nothing for state-driven animation.
 *
 * This component renders the avatar and nothing else. The scrim, the live pill,
 * the subtitle and the source chip all stay in `AvatarStage`, which is what
 * §4.6 asks: replace the visual, not the surrounding interface.
 */
export function Avatar3D({ state, reduceMotion, onUnavailable }: Props) {
  const webView = useRef<WebView>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    void loadAvatarAssets().then((assets) => {
      if (!active) return;

      if (!assets.threeUrl || !assets.modelUrl) {
        // No model bundled yet. Not an error worth showing a farmer — the
        // photograph is a perfectly good avatar.
        onUnavailable();
        return;
      }

      setHtml(buildSceneHtml(assets.threeUrl, assets.modelUrl));
    });

    return () => {
      active = false;
    };
  }, [onUnavailable]);

  const directive = useMemo(
    () => resolveDirective(state, reduceMotion),
    [state, reduceMotion],
  );

  // Post only when the directive actually changes, which is on a state change.
  // The scene owns every per-frame decision itself.
  useEffect(() => {
    if (!ready) return;

    webView.current?.postMessage(JSON.stringify({ type: 'directive', ...directive }));
  }, [directive, ready]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let payload: SceneEvent;
      try {
        payload = JSON.parse(event.nativeEvent.data) as SceneEvent;
      } catch {
        return;
      }

      if (payload.type === 'ready') {
        setReady(true);
        return;
      }

      if (payload.type === 'error') {
        console.warn('[avatar3d]', payload.reason);
        onUnavailable();
      }
    },
    [onUnavailable],
  );

  if (!html) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <WebView
        ref={webView}
        source={{ html }}
        style={styles.webView}
        // The page is a local string with no navigation; nothing here should
        // ever load a remote document.
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        mediaPlaybackRequiresUserAction
        // Transparency comes from the style above plus the page's own
        // `background: transparent`, so the stage's colour and scrim show
        // through instead of a white flash before the first rendered frame.
        scrollEnabled={false}
        overScrollMode="never"
        onMessage={handleMessage}
        onError={() => onUnavailable()}
        onRenderProcessGone={() => onUnavailable()}
        onHttpError={() => onUnavailable()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  webView: { flex: 1, backgroundColor: 'transparent' },
});
