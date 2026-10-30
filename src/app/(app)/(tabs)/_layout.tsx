import { Ionicons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import { Pressable, View, type ColorValue } from 'react-native';

import type { IconName } from '@/ui/components';
import { colors, shadow } from '@/ui/theme';

function icon(name: IconName, active: IconName) {
  return function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? active : name} color={color as string} size={size - 2} />;
  };
}

/** Raised center button: opens the new-habit sheet instead of switching tabs. */
function AddButton() {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Pressable
        onPress={() => router.push('/habit/new')}
        accessibilityRole="button"
        accessibilityLabel="New habit"
        style={({ pressed }) => [
          {
            width: 52,
            height: 52,
            borderRadius: 26,
            marginTop: -14,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 4,
            borderColor: colors.card,
            opacity: pressed ? 0.85 : 1,
          },
          shadow,
        ]}>
        <Ionicons name="add" size={26} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false, tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="habits" options={{ title: 'Habits', tabBarIcon: icon('checkmark-circle-outline', 'checkmark-circle') }} />
      <Tabs.Screen name="add" options={{ title: 'New habit', tabBarButton: () => <AddButton /> }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarIcon: icon('stats-chart-outline', 'stats-chart') }} />
      <Tabs.Screen name="shop" options={{ title: 'Shop', tabBarIcon: icon('bag-handle-outline', 'bag-handle') }} />
      <Tabs.Screen name="me" options={{ title: 'Profile', tabBarIcon: icon('person-outline', 'person') }} />
    </Tabs>
  );
}
