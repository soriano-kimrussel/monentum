import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { PLANS } from '@/domain/subscription';
import { confirm, useQuery } from '@/hooks/useApi';
import { signOut as endSession } from '@/services/app';
import { useSession } from '@/stores/session';
import { Button, Card, Divider, ListRow, Pill, Screen, SectionTitle } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

const STATUS_LABEL: Record<string, string> = {
  none: 'Free plan',
  trialing: 'Premium trial',
  active: 'Premium',
  past_due: 'Payment issue',
  expired: 'Free plan (expired)',
  refunded: 'Free plan (refunded)',
};

export default function Me() {
  const user = useSession((s) => s.user);
  const { data } = useQuery((b, t) => b.billing.status(t));

  const signOut = async () => {
    if (!(await confirm('Sign out?', 'Your data stays on this device.', 'Sign out'))) return;
    await endSession();
  };

  const bonus = data?.sub.bonusPremiumUntil && data.sub.bonusPremiumUntil > data.now;

  return (
    <Screen>
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 20 }}>{user?.displayName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ marginLeft: space.md, flex: 1 }}>
          <Text style={type.subtitle}>{user?.displayName}</Text>
          <Text style={type.small}>{user?.email}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
            {data && <Pill tone={data.premium ? 'primary' : 'neutral'} label={STATUS_LABEL[data.sub.status]} />}
            {bonus && <Pill tone="success" label="Referral bonus" />}
            {user?.role === 'admin' && <Pill tone="warning" label="Admin" />}
          </View>
        </View>
      </Card>

      <Card onPress={() => router.push(data?.premium || data?.sub.status === 'past_due' ? '/premium/manage' : '/premium')} style={{ backgroundColor: colors.primarySoft }}>
        <Text style={type.subtitle}>{data?.sub.plan && data.premium ? PLANS[data.sub.plan].label : 'Upgrade to Premium'}</Text>
        <Text style={type.small}>{data?.premium ? 'Manage plan, transactions and refunds' : 'Unlimited habits, 90-day insights. 7-day free trial (simulated).'}</Text>
      </Card>

      <SectionTitle title="Your stuff" />
      <Card>
        <ListRow icon="flag" title="Goals & milestones" onPress={() => router.push('/goals')} />
        <ListRow icon="journal" tint={colors.sim} title="Journal" onPress={() => router.push('/journal')} />
        <ListRow icon="gift" tint={colors.success} title="Invite friends" subtitle="Earn free Premium days" onPress={() => router.push('/referrals')} />
        <ListRow icon="receipt" title="Shop orders" onPress={() => router.push('/shop/orders')} />
        <ListRow icon="card" title="Subscription & billing" onPress={() => router.push('/premium/manage')} />
      </Card>

      <SectionTitle title="Settings" />
      <Card>
        <ListRow icon="notifications" tint={colors.warning} title="Reminders" onPress={() => router.push('/settings/reminders')} />
        <ListRow icon="cloud-upload" title="Sync (simulated)" onPress={() => router.push('/settings/sync')} />
        <ListRow icon="archive" title="Backup & restore" onPress={() => router.push('/settings/backup')} />
        <ListRow icon="flask" tint={colors.sim} title="Demo controls" subtitle="Test clock, reset demo data" onPress={() => router.push('/settings/demo')} />
        {user?.role === 'admin' && (
          <>
            <Divider />
            <ListRow icon="shield-checkmark" tint={colors.danger} title="Admin dashboard" onPress={() => router.push('/admin')} />
          </>
        )}
      </Card>

      <Button title="Sign out" variant="ghost" icon="log-out-outline" onPress={signOut} style={{ marginTop: space.md }} />
      <Text style={[type.small, { textAlign: 'center', marginTop: space.lg }]}>Momentum demo · runs fully offline · no real payments</Text>
    </Screen>
  );
}
