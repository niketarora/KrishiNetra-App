import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/features/auth/AuthContext';
import { LanguageProvider } from '@/features/language/LanguageContext';
import { RootNavigator } from '@/navigation/RootNavigator';
import { colors } from '@/theme';

// Initialises i18next before any component renders a string.
import '@/i18n';

/**
 * Only the three weights the type scale actually uses, required by file path.
 *
 * Importing from the package root would pull in all nine weights of both
 * families — about 3 MB of fonts, most of it never rendered. Noto Sans
 * Devanagari alone is 220 KB per weight.
 */
const FONTS = {
  Archivo_400Regular: require('@expo-google-fonts/archivo/400Regular/Archivo_400Regular.ttf'),
  Archivo_500Medium: require('@expo-google-fonts/archivo/500Medium/Archivo_500Medium.ttf'),
  Archivo_600SemiBold: require('@expo-google-fonts/archivo/600SemiBold/Archivo_600SemiBold.ttf'),
  NotoSansDevanagari_400Regular: require('@expo-google-fonts/noto-sans-devanagari/400Regular/NotoSansDevanagari_400Regular.ttf'),
  NotoSansDevanagari_500Medium: require('@expo-google-fonts/noto-sans-devanagari/500Medium/NotoSansDevanagari_500Medium.ttf'),
  NotoSansDevanagari_600SemiBold: require('@expo-google-fonts/noto-sans-devanagari/600SemiBold/NotoSansDevanagari_600SemiBold.ttf'),
};

export default function App() {
  const [fontsLoaded] = useFonts(FONTS);

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {fontsLoaded ? (
          <AuthProvider>
            {/*
              Language sits above the navigator so the login screen is already
              in the farmer's language, before there is a profile to read one
              from.
            */}
            <LanguageProvider>
              <RootNavigator />
            </LanguageProvider>
          </AuthProvider>
        ) : (
          // Plain RN views only: the app's Text component asks for Archivo,
          // which does not exist until useFonts resolves.
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
