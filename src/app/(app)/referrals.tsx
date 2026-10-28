import { useState } from 'react';
import { Share, Text, View } from 'react-native';

import { notify, useQuery } from '@/hooks/useApi';
import { api } from '@/services/app';
import { useSession } from '@/stores/session';
import { Button, Card, Divider, Loading, Pill, Screen, SectionTitle, SimBanner, Stat, TextField } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

const BLOCK_REASON: Record<string, string> = {
  self_referral: 'Self-referral',
  same_device: 'Same device as you',
  already_referred: 'Already referred',
  unknown_code: 'Unknown code',
};

export default function Referrals() {
  const { data, loading } = useQuery((b, t) => b.referrals.mine(t));
  const [testDevice, setTestDevice] = useState('');
  if (loading || !data) return <Loading />;

  return (
    <Screen>
      <SimBanner text="Demo referral program. Links open inside this app only; rewards are free Premium days in the local demo." />
      <Card style={{ alignItems: 'center', backgroundColor: colors.successSoft }}>
        <Text style={type.small}>Your invite code</Text>
        <Text selectable style={{ fontSize: 30, fontWeight: '800', letterSpacing: 2, color: colors.success, marginVertical: 6 }}>
          {data.code}
        </Text>
        <Text selectable style={type.small}>{data.link}</Text>
        <Button title="Share invite" icon="share-outline" style={{ marginTop: space.md, alignSelf: 'stretch' }} onPress={() => Share.share({ message: `Join me on Momentum (demo)! Use code ${data.code} or open ${data.link}` })} />
      </Card>

      <Card style={{ flexDirection: 'row' }}>
        <Stat label="Clicks" value={String(data.clicks)} />
        <Stat label="Sign-ups" value={String(data.signups)} />
        <Stat label="Rewarded" value={String(data.rewarded)} tone={colors.success} />
      </Card>
      <Text style={[type.small, { marginBottom: space.md }]}>
        You earn {data.config.rewardDays} Premium days when a friend {data.config.trigger === 'signup' ? 'signs up' : 'completes their first check-in'} (max {data.config.maxRewardsPerReferrer} rewards). Self-referrals and duplicate
        sign-ups are blocked.
      </Text>

      <SectionTitle title="Simulate a link click" />
      <Card>
        <Text style={type.small}>Records a click as if someone opened your invite link on another device.</Text>
        <TextField placeholder="Device label (e.g. friend-phone)" value={testDevice} onChangeText={setTestDevice} style={{ marginTop: space.sm }} />
        <Button
          title="Record click"
          variant="secondary"
          small
          onPress={async () => {
            try {
              await api().referrals.recordClick(data.code, testDevice.trim() || `sim-${Date.now()}`);
              useSession.getState().bump();
            } catch (e) {
              notify('Click not recorded', e instanceof Error ? e.message : String(e));
            }
          }}
        />
      </Card>

      <SectionTitle title="Your referrals" />
      <Card>
        {data.records.length === 0 && <Text style={type.small}>No referrals yet. Sign up a second demo account with your code to try it.</Text>}
        {data.records.map((r, i) => (
          <View key={r.id}>
            {i > 0 && <Divider />}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={type.body}>Friend #{data.records.length - i}</Text>
              <Pill tone={r.status === 'rewarded' ? 'success' : r.status === 'blocked' ? 'danger' : 'warning'} label={r.status === 'blocked' ? `Blocked: ${BLOCK_REASON[r.blockReason ?? ''] ?? r.blockReason}` : r.status === 'rewarded' ? 'Rewarded' : 'Awaiting first check-in'} />
            </View>
            <Text style={type.small}>{new Date(r.createdAt).toLocaleDateString()}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
