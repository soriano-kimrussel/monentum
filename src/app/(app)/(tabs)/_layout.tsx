import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import type { IconName } from '@/ui/components';
import { colors } from '@/ui/theme';

function icon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', color: colors.text },
        tabBarStyle: { borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('sunny') }} />
      <Tabs.Screen name="habits" options={{ title: 'Habits', tabBarIcon: icon('checkmark-done-circle') }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarIcon: icon('stats-chart') }} />
      <Tabs.Screen name="shop" options={{ title: 'Shop', tabBarIcon: icon('bag-handle') }} />
      <Tabs.Screen name="me" options={{ title: 'You', tabBarIcon: icon('person-circle') }} />
    </Tabs>
  );
}
