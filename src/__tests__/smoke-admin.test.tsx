// UI smoke test over the real route tree: admin sign-in → every admin screen.
import '@/testing/smokeSetup';

import { renderRouter } from 'expo-router/testing-library';

import { useSession } from '@/stores/session';
import { signInAs, visitAll } from '@/testing/smoke';

it('signs in the demo admin and renders every admin screen', async () => {
  await renderRouter('./src/app', { initialUrl: '/' });
  await signInAs('Admin');
  expect(useSession.getState().user?.role).toBe('admin');

  await visitAll([
    ['/admin', 'Subscriptions by status'],
    ['/admin/users', 'Alex Rivera'],
    ['/admin/refunds', /Accidentally bought the wrong plan/],
    ['/admin/listings', /Listings \(\d+\)/],
    ['/admin/affiliates', /FitCoach Jamie/],
    ['/admin/analytics', 'Clicks by campaign'],
    ['/admin/audit', /auth\.login/],
    ['/admin/webhooks', 'Send valid signed event'],
  ]);
});
