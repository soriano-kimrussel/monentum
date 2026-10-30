import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { boot } from '@/services/app';
import { useSession } from '@/stores/session';
import { Button } from '@/ui/components';
import { colors, type } from '@/ui/theme';

export default function RootLayout() {
  const status = useSession((s) => s.status);
  const bootError = useSession((s) => s.bootError);

  useEffect(() => {
    boot();
  }, []);

  if (status !== 'ready') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, padding: 24 }}>
        <Text style={[type.hero, { color: colors.onPrimary, fontSize: 34 }]}>Momentum</Text>
        {status === 'error' ? (
          <>
            <Text style={{ color: colors.onPrimary, marginVertical: 16, textAlign: 'center' }}>Couldn’t start: {bootError}</Text>
            <Button title="Try again" variant="secondary" onPress={() => boot()} />
          </>
        ) : (
          <>
            <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
            <Text style={{ color: colors.onPrimaryMuted, marginTop: 10, fontSize: 13 }}>Preparing your local demo data…</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {/* Auth gating happens at render time inside each group's layout ((app) → /sign-in when
          signed out, (auth) → / when signed in). Stack.Protected left users stranded on /sign-in
          after a sign-out → sign-in within one session, so it is not used for auth here. */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="invite/[code]" />
        <Stack.Screen name="c/[code]" />
      </Stack>
    </SafeAreaProvider>
  );
}
