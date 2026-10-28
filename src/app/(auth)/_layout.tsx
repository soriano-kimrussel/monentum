import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/stores/session';

export default function AuthLayout() {
  const signedIn = useSession((s) => !!s.token);
  if (signedIn) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
