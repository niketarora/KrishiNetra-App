import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { Icon, type IconName } from '@/components/ui';
import { useFarm } from '@/features/farm/FarmContext';
import { FieldAnalysisScreen } from '@/screens/field/FieldAnalysisScreen';
import { HistoryScreen } from '@/screens/history/HistoryScreen';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { MarketScreen } from '@/screens/market/MarketScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { ConfirmFieldScreen } from '@/screens/onboarding/ConfirmFieldScreen';
import { DrawBoundaryScreen } from '@/screens/onboarding/DrawBoundaryScreen';
import { VisualAssistantScreen } from '@/screens/visualAssistant/VisualAssistantScreen';
import { colors, fonts, layout } from '@/theme';
import { fromGeoJSON } from '@/utils/geo';

import type { MainStackParamList, MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

type MainNavigation = NativeStackNavigationProp<MainStackParamList>;

const TAB_ICONS: Record<keyof MainTabParamList, IconName> = {
  Home: 'home',
  Field: 'field',
  Market: 'market',
  History: 'history',
};

function MainTabs() {
  const { t } = useTranslation();
  const navigation = useNavigation<MainNavigation>();
  const { farm } = useFarm();

  const openEditBoundary = () => {
    if (!farm) return;
    const points = fromGeoJSON(farm.boundary);
    navigation.navigate('EditBoundary', {
      centre: { latitude: Number(farm.centroid_lat), longitude: Number(farm.centroid_lng) },
      points,
      name: farm.name,
    });
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: {
          height: layout.navHeight,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontFamily: fonts.regular, fontSize: 12 },
        tabBarIcon: ({ color }) => <Icon name={TAB_ICONS[route.name]} size={20} color={color} />,
      })}
    >
      <Tab.Screen name="Home" options={{ title: t('nav.home') }}>
        {({ navigation: tabNavigation }) => (
          <HomeScreen
            onOpenProfile={() => navigation.navigate('Profile')}
            // Tab switches go through the tab navigator so they replace the
            // active tab rather than pushing onto the stack.
            onOpenAnalysis={() => tabNavigation.navigate('Field')}
            onOpenMarket={() => tabNavigation.navigate('Market')}
            onEditBoundary={openEditBoundary}
            onOpenVisualAssistant={() => navigation.navigate('VisualAssistant')}
          />
        )}
      </Tab.Screen>

      <Tab.Screen name="Field" options={{ title: t('nav.field') }}>
        {() => <FieldAnalysisScreen />}
      </Tab.Screen>

      <Tab.Screen name="Market" component={MarketScreen} options={{ title: t('nav.market') }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: t('nav.history') }} />
    </Tab.Navigator>
  );
}

/**
 * The signed-in app. Profile and the boundary editor sit above the tabs as
 * pushed screens; the avatar is neither, because it is an interaction layer
 * rendered over the whole navigator (see App.tsx).
 */
export function MainNavigator() {
  const { farm } = useFarm();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Tabs" component={MainTabs} />

      <Stack.Screen name="Profile">
        {({ navigation }) => (
          <ProfileScreen
            onBack={() => navigation.goBack()}
            onEditField={() => {
              if (!farm) return;
              navigation.navigate('EditBoundary', {
                centre: {
                  latitude: Number(farm.centroid_lat),
                  longitude: Number(farm.centroid_lng),
                },
                points: fromGeoJSON(farm.boundary),
                name: farm.name,
              });
            }}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="EditBoundary">
        {({ navigation, route }) => (
          <DrawBoundaryScreen
            initialCentre={route.params.centre}
            initialPoints={route.params.points}
            onConfirm={(points) =>
              navigation.navigate('ConfirmEdit', { points, name: route.params.name })
            }
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="ConfirmEdit">
        {({ navigation, route }) => (
          <ConfirmFieldScreen
            points={route.params.points}
            initialName={route.params.name}
            // Unlike first-run setup, the farmer already has a home to return
            // to, so pop back to the tabs once the boundary is updated.
            onSaved={() => navigation.navigate('Tabs')}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="VisualAssistant">
        {({ navigation }) => <VisualAssistantScreen onBack={() => navigation.goBack()} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
