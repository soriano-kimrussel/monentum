// Deep link: momentum://invite/MOM-XXXXXX (demo referral link).
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { isReferralCodeShape } from '@/domain/growth';
import { api } from '@/services/app';
import { useSession } from '@/stores/session';
import { Loading } from '@/ui/components';

export default function Invite() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [done, setDone] = useState(false);
  const signedIn = useSession((s) => !!s.token);

  useEffect(() => {
    const clean = String(code ?? '').toUpperCase();
    (async () => {
      if (isReferralCodeShape(clean)) {
        useSession.getState().setInvite({ referralCode: clean });
        await api().referrals.recordClick(clean, useSession.getState().deviceId).catch(() => undefined);
      }
      setDone(true);
    })();
  }, [code]);

  if (!done) return <Loading />;
  return <Redirect href={signedIn ? '/' : '/sign-up'} />;
}
