import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { Icon, type IconName } from '@/components/ui';
import { useFarm } from '@/features/farm/FarmContext';
import { AlertDetailScreen } from '@/screens/alerts/AlertDetailScreen';
import { AlertsScreen } from '@/screens/alerts/AlertsScreen';
import { ARLearningScreen } from '@/screens/ar/ARLearningScreen';
import { CalendarEventDetailScreen } from '@/screens/calendar/CalendarEventDetailScreen';
import { CalendarScreen } from '@/screens/calendar/CalendarScreen';
import { FieldAnalysisScreen } from '@/screens/field/FieldAnalysisScreen';
import { MyFarmScreen } from '@/screens/farm/MyFarmScreen';
import { MyLandsScreen } from '@/screens/farm/MyLandsScreen';
import { RegisterCropScreen } from '@/screens/farm/RegisterCropScreen';
import { WalkBoundaryScreen } from '@/screens/farm/WalkBoundaryScreen';
import { HistoryScreen } from '@/screens/history/HistoryScreen';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { LearningHomeScreen } from '@/screens/learning/LearningHomeScreen';
import { TutorialDetailScreen } from '@/screens/learning/TutorialDetailScreen';
import { TutorialFlashcardScreen } from '@/screens/learning/TutorialFlashcardScreen';
import { MarketScreen } from '@/screens/market/MarketScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { ConfirmFieldScreen } from '@/screens/onboarding/ConfirmFieldScreen';
import { DrawBoundaryScreen } from '@/screens/onboarding/DrawBoundaryScreen';
import { SchemeDetailScreen } from '@/screens/schemes/SchemeDetailScreen';
import { SchemesScreen } from '@/screens/schemes/SchemesScreen';
import { UpdateDetailScreen } from '@/screens/updates/UpdateDetailScreen';
import { UpdatesScreen } from '@/screens/updates/UpdatesScreen';
import { VisualAssistantScreen } from '@/screens/visualAssistant/VisualAssistantScreen';
import { colors, fonts, layout, radius } from '@/theme';
import { centroid, fromGeoJSON } from '@/utils/geo';

import type { MainStackParamList, MainTabParamList } from './types';

import { RegisterFieldMethodScreen } from '@/screens/onboarding/RegisterFieldMethodScreen';

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

  const openRegisterCrop = () => {
    if (farm) {
      navigation.navigate('RegisterCropInfo', {
        points: fromGeoJSON(farm.boundary),
        accuracy: farm.location_accuracy,
      });
    } else {
      navigation.navigate('RegisterLandMethod');
    }
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text.secondary,
        tabBarStyle: {
          height: layout.navHeight,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          // A light lift so the bar reads as sitting above the content
          // rather than a hairline dividing two flat surfaces.
          elevation: 8,
          shadowColor: '#1C1F1A',
          shadowOpacity: 0.06,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: -2 },
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        // The active destination gets a soft pill behind its icon, on top of
        // the colour change — "unmistakable" per the visual-refinement brief,
        // not just a slightly different shade of green.
        tabBarIcon: ({ color, focused }) => (
          <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
            <Icon name={TAB_ICONS[route.name]} size={20} color={color} />
          </View>
        ),
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
            onOpenRegisterCrop={openRegisterCrop}
            onOpenLearning={() => navigation.navigate('Learning')}
            onOpenCalendar={() => navigation.navigate('Calendar')}
            onOpenSchemes={() => navigation.navigate('Schemes')}
            onOpenUpdates={() => navigation.navigate('Updates')}
            onOpenAlerts={() => navigation.navigate('Alerts')}
            onOpenVisualAssistant={() => navigation.navigate('VisualAssistant')}
          />
        )}
      </Tab.Screen>

      <Tab.Screen name="Field" options={{ title: t('nav.field') }}>
        {() => <FieldAnalysisScreen />}
      </Tab.Screen>

      <Tab.Screen name="Market" component={MarketScreen} options={{ title: t('nav.market') }} />

      <Tab.Screen name="History" options={{ title: t('nav.history') }}>
        {() => <HistoryScreen onRegisterLand={() => navigation.navigate('MyLands')} />}
      </Tab.Screen>
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

  // LearningHomeScreen takes no navigation hooks of its own (see its file
  // comment) — it just re-fetches progress on mount, so remounting it here
  // whenever it regains focus is what makes "1 of 8 completed" show up
  // immediately after marking a tutorial complete and coming back.
  const [learningKey, setLearningKey] = useState(0);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Tabs" component={MainTabs} />

      <Stack.Screen name="Profile">
        {({ navigation }) => (
          <ProfileScreen
            onBack={() => navigation.goBack()}
            onOpenMyFarm={() => navigation.navigate('MyLands')}
            onOpenSchemes={() => navigation.navigate('Schemes')}
            onOpenAlerts={() => navigation.navigate('Alerts')}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="EditBoundary">
        {({ navigation, route }) => (
          <DrawBoundaryScreen
            initialCentre={route.params.centre}
            initialPoints={route.params.points}
            onConfirm={(points, accuracy) =>
              navigation.navigate('ConfirmEdit', {
                points,
                name: route.params.name,
                accuracy: accuracy ?? route.params.accuracy,
              })
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
            accuracy={route.params.accuracy}
            mode="edit"
            // Unlike first-run setup, the farmer already has a home to return
            // to, so pop back to the tabs once the boundary is updated.
            onSaved={() => navigation.navigate('Tabs')}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="MyLands">
        {({ navigation }) => (
          <MyLandsScreen
            onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs'))}
            onOpenMyFarm={() => navigation.navigate('MyFarm')}
            onAddLand={() => navigation.navigate('RegisterLandMethod')}
            onEditLand={(land) => {
              navigation.navigate('EditBoundary', {
                centre: {
                  latitude: Number(land.centroid_lat),
                  longitude: Number(land.centroid_lng),
                },
                points: fromGeoJSON(land.boundary),
                name: land.name,
                accuracy: land.location_accuracy,
              });
            }}
          />
        )}
      </Stack.Screen>

      {/*
        Profile → My Farm — Feature #1's optional land-registration flow.
        Reachable any time from Profile/My Lands. MyFarm shows
        either the registered farm's summary or a "Register your land" empty
        state; editing an existing farm's boundary from here reuses the exact
        EditBoundary/ConfirmEdit route pair above.
      */}
      <Stack.Screen name="MyFarm">
        {({ navigation }) => (
          <MyFarmScreen
            onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs'))}
            onRegisterLand={() => navigation.navigate('RegisterLandMethod')}
            onEditBoundary={() => {
              if (!farm) return;
              navigation.navigate('EditBoundary', {
                centre: {
                  latitude: Number(farm.centroid_lat),
                  longitude: Number(farm.centroid_lng),
                },
                points: fromGeoJSON(farm.boundary),
                name: farm.name,
                accuracy: farm.location_accuracy,
              });
            }}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="RegisterLandMethod">
        {({ navigation }) => (
          <RegisterFieldMethodScreen
            onSelectWalk={(centre, accuracy) =>
              navigation.navigate('RegisterLand', { centre, accuracy })
            }
            onSelectDraw={(centre, accuracy) =>
              navigation.navigate('RegisterBoundary', {
                centre,
                points: [],
                accuracy,
              })
            }
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="RegisterLand">
        {({ navigation, route }) => (
          <WalkBoundaryScreen
            initialCentre={route.params?.centre}
            onWalked={(points, accuracy) =>
              navigation.navigate('RegisterBoundary', {
                centre: centroid(points),
                points,
                accuracy: accuracy ?? route.params?.accuracy,
              })
            }
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      {/* Same DrawBoundaryScreen the edit flow uses, reused unmodified. */}
      <Stack.Screen name="RegisterBoundary">
        {({ navigation, route }) => (
          <DrawBoundaryScreen
            initialCentre={route.params.centre}
            initialPoints={route.params.points}
            onConfirm={(points, accuracy) =>
              navigation.navigate('RegisterCropInfo', {
                points,
                accuracy: accuracy ?? route.params.accuracy,
              })
            }
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="RegisterCropInfo">
        {({ navigation, route }) => (
          <RegisterCropScreen
            points={route.params.points}
            accuracy={route.params.accuracy}
            mode="create"
            onSaved={() =>
              navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })
            }
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      {/* Home → Krishi Academy — Feature #14's local tutorial library. */}
      <Stack.Screen
        name="Learning"
        listeners={{ focus: () => setLearningKey((key) => key + 1) }}
      >
        {({ navigation }) => (
          <LearningHomeScreen
            key={learningKey}
            onBack={() => navigation.goBack()}
            onOpenTutorial={(tutorialId) => navigation.navigate('TutorialDetail', { tutorialId })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="TutorialDetail">
        {({ navigation, route }) => (
          <TutorialDetailScreen
            tutorialId={route.params.tutorialId}
            onBack={() => navigation.goBack()}
            onOpenAr={(tutorialId) => navigation.navigate('ARGuide', { tutorialId })}
            onOpenFlashcards={(tutorialId) => navigation.navigate('TutorialFlashcard', { tutorialId })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="TutorialFlashcard">
        {({ navigation, route }) => (
          <TutorialFlashcardScreen
            tutorialId={route.params.tutorialId}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      {/* Tutorial detail → AR Learning Preview — a UI-only prototype, not real CV. */}
      <Stack.Screen name="ARGuide">
        {({ navigation, route }) => (
          <ARLearningScreen
            tutorialId={route.params.tutorialId}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      {/* Home → Smart Farm Calendar — Feature #10's forward-looking demo UI. */}
      <Stack.Screen name="Calendar">
        {({ navigation }) => (
          <CalendarScreen
            onBack={() => navigation.goBack()}
            onRegisterLand={() => navigation.navigate('MyFarm')}
            onOpenEvent={(eventId) => navigation.navigate('CalendarEventDetail', { eventId })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="CalendarEventDetail">
        {({ navigation, route }) => (
          <CalendarEventDetailScreen
            eventId={route.params.eventId}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      {/* Home/Profile → Government Schemes — local demo scheme directory. */}
      <Stack.Screen name="Schemes">
        {({ navigation }) => (
          <SchemesScreen
            onBack={() => navigation.goBack()}
            onOpenScheme={(schemeId) => navigation.navigate('SchemeDetail', { schemeId })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="SchemeDetail">
        {({ navigation, route }) => (
          <SchemeDetailScreen
            schemeId={route.params.schemeId}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      {/* Home → Krishi Updates — local demo agri-news feed. */}
      <Stack.Screen name="Updates">
        {({ navigation }) => (
          <UpdatesScreen
            onBack={() => navigation.goBack()}
            onOpenUpdate={(updateId) => navigation.navigate('UpdateDetail', { updateId })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="UpdateDetail">
        {({ navigation, route }) => (
          <UpdateDetailScreen
            updateId={route.params.updateId}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="VisualAssistant">
        {({ navigation }) => <VisualAssistantScreen onBack={() => navigation.goBack()} />}
      </Stack.Screen>

      {/* Home/Profile → Alerts — demo communication history, reused from both entry points. */}
      <Stack.Screen name="Alerts">
        {({ navigation }) => (
          <AlertsScreen
            onBack={() => navigation.goBack()}
            onOpenAlert={(alertId) => navigation.navigate('AlertDetail', { alertId })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="AlertDetail">
        {({ navigation, route }) => (
          <AlertDetailScreen alertId={route.params.alertId} onBack={() => navigation.goBack()} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 40,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: { backgroundColor: colors.successBg },
});
