// Deep link: momentum://c/FITCOACH (simulated ad / affiliate click).
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { api } from '@/services/app';
import { useSession } from '@/stores/session';
import { Loading } from '@/ui/components';

export default function CampaignLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [done, setDone] = useState(false);
  const signedIn = useSession((s) => !!s.token);

  useEffect(() => {
    const clean = String(code ?? '').toUpperCase().slice(0, 32);
    (async () => {
      try {
        await api().growth.campaignClick(clean, useSession.getState().deviceId);
        useSession.getState().setInvite({ campaignCode: clean });
      } catch {
        // Unknown campaign: just continue to the app.
      }
      setDone(true);
    })();
  }, [code]);

  if (!done) return <Loading />;
  return <Redirect href={signedIn ? '/' : '/sign-up'} />;
}
