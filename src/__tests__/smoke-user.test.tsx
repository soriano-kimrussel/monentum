// UI smoke test over the real route tree: boot → seed → sign in → every user-facing screen.
import '@/testing/smokeSetup';

import { router } from 'expo-router';
import { act, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { signInAs, visitAll } from '@/testing/smoke';

it('boots, seeds demo data, signs in the demo user and renders every user screen', async () => {
  await renderRouter('./src/app', { initialUrl: '/' });

  // Signed out → sent to sign-in once the local backend has booted and seeded.
  await signInAs('Demo user');
  expect(screen.getByText('Morning walk')).toBeTruthy();
  expect(screen.getByText('How are you feeling?')).toBeTruthy();

  // The UI guard bounces normal users away from admin routes (the backend also denies them).
  await act(() => router.push('/admin'));
  await waitFor(() => expect(screen).toHavePathname('/'));
  expect(screen.queryByText('Subscriptions by status')).toBeNull();

  await visitAll([
    ['/habits', /Active \(\d+\)/],
    ['/insights', 'What we noticed'],
    ['/shop', /Demo marketplace/],
    ['/me', 'Your stuff'],
    ['/premium', 'Choose a plan'],
    ['/premium/manage', 'Transaction history'],
    ['/goals', 'Run a 10K'],
    ['/journal', 'A good week'],
    ['/referrals', 'Your invite code'],
    ['/shop/orders', /No orders yet|Paid/],
    ['/settings/backup', 'Export your data'],
    ['/settings/sync', /Online|Offline/],
    ['/settings/demo', 'Test clock'],
    ['/habit/new', 'Habit name'],
  ]);
});
