import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { OtpVerifyScreen } from '@/screens/auth/OtpVerifyScreen';
import { PhoneEntryScreen } from '@/screens/auth/PhoneEntryScreen';

import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * Phone-first signup/login (task spec: Phone → OTP → authenticated Supabase
 * user). The previous email/password `LoginScreen`/`RegisterScreen` stay in
 * the repo, still unit-tested, but are no longer routed to here — this
 * replaces them as the app's one auth flow rather than adding a second one.
 */
export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="PhoneEntry">
        {({ navigation }) => (
          <PhoneEntryScreen
            onOtpSent={(normalizedPhone, devCode) =>
              navigation.navigate('OtpVerify', { normalizedPhone, devCode })
            }
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="OtpVerify">
        {({ navigation, route }) => (
          <OtpVerifyScreen
            normalizedPhone={route.params.normalizedPhone}
            initialDevCode={route.params.devCode}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
