import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ConfirmFieldScreen } from '@/screens/onboarding/ConfirmFieldScreen';
import { DrawBoundaryScreen } from '@/screens/onboarding/DrawBoundaryScreen';
import { FieldLocationScreen } from '@/screens/onboarding/FieldLocationScreen';
import { RegisterFieldMethodScreen } from '@/screens/onboarding/RegisterFieldMethodScreen';
import { WalkBoundaryScreen } from '@/screens/farm/WalkBoundaryScreen';
import { centroid } from '@/utils/geo';

import type { OnboardingStackParamList } from './types';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/**
 * The first-run field setup. Reached only when the farmer is signed in but has
 * no farm; saving one flips the root navigator over to the main app, so no
 * screen here navigates to Home by hand.
 */
export function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="RegisterFieldMethod">
        {({ navigation }) => (
          <RegisterFieldMethodScreen
            onSelectWalk={(centre, accuracy) =>
              navigation.navigate('WalkBoundary', { centre, accuracy })
            }
            onSelectDraw={(centre, accuracy) =>
              navigation.navigate('DrawBoundary', { centre, accuracy })
            }
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="WalkBoundary">
        {({ navigation, route }) => (
          <WalkBoundaryScreen
            initialCentre={route.params?.centre}
            onWalked={(points, accuracy) =>
              navigation.navigate('ConfirmField', {
                points,
                accuracy,
              })
            }
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="FieldLocation">
        {({ navigation }) => (
          <FieldLocationScreen
            onContinue={(centre) => navigation.navigate('DrawBoundary', { centre })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="DrawBoundary">
        {({ navigation, route }) => (
          <DrawBoundaryScreen
            initialCentre={route.params.centre}
            initialPoints={route.params.points}
            onConfirm={(points, accuracy) =>
              navigation.navigate('ConfirmField', {
                points,
                accuracy: accuracy ?? route.params.accuracy,
              })
            }
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="ConfirmField">
        {({ navigation, route }) => (
          <ConfirmFieldScreen
            points={route.params.points}
            initialName={route.params.name}
            accuracy={route.params.accuracy}
            // The FarmProvider now holds a farm, which swaps this navigator
            // out for the main app — there is nothing further to do here.
            onSaved={() => undefined}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
