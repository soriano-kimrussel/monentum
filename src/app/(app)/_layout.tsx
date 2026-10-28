import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/stores/session';
import { colors } from '@/ui/theme';

export const unstable_settings = { anchor: '(tabs)' };

export default function AppLayout() {
  const signedIn = useSession((s) => !!s.token);
  // UI-level gate only. Every admin endpoint is independently enforced by the backend.
  const isAdmin = useSession((s) => s.user?.role === 'admin');
  if (!signedIn) return <Redirect href="/sign-in" />;
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="habit/new" options={{ title: 'New habit', presentation: 'modal' }} />
      <Stack.Screen name="habit/[id]" options={{ title: 'Habit' }} />
      <Stack.Screen name="goals/index" options={{ title: 'Goals' }} />
      <Stack.Screen name="goals/new" options={{ title: 'New goal', presentation: 'modal' }} />
      <Stack.Screen name="goals/[id]" options={{ title: 'Goal' }} />
      <Stack.Screen name="journal/index" options={{ title: 'Journal' }} />
      <Stack.Screen name="journal/edit" options={{ title: 'Journal entry', presentation: 'modal' }} />
      <Stack.Screen name="premium/index" options={{ title: 'Momentum Premium', presentation: 'modal' }} />
      <Stack.Screen name="premium/manage" options={{ title: 'Subscription' }} />
      <Stack.Screen name="referrals" options={{ title: 'Invite friends' }} />
      <Stack.Screen name="shop/[id]" options={{ title: '' }} />
      <Stack.Screen name="shop/cart" options={{ title: 'Cart' }} />
      <Stack.Screen name="shop/orders" options={{ title: 'Orders' }} />
      <Stack.Screen name="settings/backup" options={{ title: 'Backup & restore' }} />
      <Stack.Screen name="settings/sync" options={{ title: 'Sync (simulated)' }} />
      <Stack.Screen name="settings/reminders" options={{ title: 'Reminders' }} />
      <Stack.Screen name="settings/demo" options={{ title: 'Demo controls' }} />
      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="admin" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
