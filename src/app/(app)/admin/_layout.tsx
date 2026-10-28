import { Stack } from 'expo-router';

import { colors } from '@/ui/theme';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}>
      <Stack.Screen name="index" options={{ title: 'Admin' }} />
      <Stack.Screen name="users" options={{ title: 'Users & subscriptions' }} />
      <Stack.Screen name="refunds" options={{ title: 'Refund queue' }} />
      <Stack.Screen name="listings" options={{ title: 'Marketplace' }} />
      <Stack.Screen name="affiliates" options={{ title: 'Affiliates' }} />
      <Stack.Screen name="analytics" options={{ title: 'Attribution & events' }} />
      <Stack.Screen name="audit" options={{ title: 'Audit log' }} />
      <Stack.Screen name="webhooks" options={{ title: 'Webhook tester' }} />
    </Stack>
  );
}
