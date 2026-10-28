import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { formatCents } from '@/domain/subscription';
import { useQuery } from '@/hooks/useApi';
import { BarChart } from '@/ui/charts';
import { Card, ListRow, Loading, Pill, Screen, SectionTitle, SimBanner, Stat } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

export default function AdminHome() {
  const { data, loading, reload } = useQuery(async (b, t) => {
    const [overview, supply] = await Promise.all([b.admin.overview(t), b.market.supplyDemand(t)]);
    return { overview, supply };
  });
  if (loading || !data) return <Loading />;
  const o = data.overview;

  return (
    <Screen onRefresh={reload}>
      <SimBanner text="Admin views of simulated data. Revenue figures are demo values; no money moved." />
      <Card style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md }}>
        <Stat label="Users" value={String(o.users)} sub={`${o.admins} admin`} />
        <Stat label="Premium" value={String(o.premium)} tone={colors.primary} />
        <Stat label="Sim. MRR" value={formatCents(o.mrrCents)} tone={colors.success} />
        <Stat label="30d revenue" value={formatCents(o.revenue30dCents)} />
        <Stat label="Orders" value={String(o.orders)} />
        <Stat label="Refunds due" value={String(o.pendingRefunds)} tone={o.pendingRefunds ? colors.warning : colors.text} />
      </Card>

      <Card>
        <Text style={type.subtitle}>Subscriptions by status</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.sm }}>
          {Object.entries(o.byStatus).map(([k, v]) => (
            <Pill key={k} tone={k === 'active' || k === 'trialing' ? 'primary' : k === 'past_due' ? 'warning' : 'neutral'} label={`${k.replace('_', ' ')}: ${v}`} />
          ))}
        </View>
      </Card>

      <Card>
        <Text style={type.subtitle}>Sign-ups (14 days)</Text>
        <BarChart data={o.signupsByDay.map((d) => ({ label: d.day.slice(8), value: d.count }))} format={(v) => (v ? String(v) : '')} />
      </Card>

      <Card>
        <Text style={type.subtitle}>Marketplace supply vs demand</Text>
        <BarChart
          data={data.supply.flatMap((r) => [
            { label: r.category.slice(0, 5), value: Math.min(r.inStock, 50), color: colors.primarySoft },
            { label: '', value: r.unitsSold, color: colors.success },
          ])}
          format={(v) => (v ? String(Math.round(v)) : '')}
        />
        <Text style={type.small}>Light: units in stock (capped at 50 for scale) · Green: units sold</Text>
      </Card>

      <SectionTitle title="Manage" />
      <Card>
        <ListRow icon="people" title="Users & subscriptions" onPress={() => router.push('/admin/users')} />
        <ListRow icon="cash" tint={colors.warning} title="Refund queue" subtitle={o.pendingRefunds ? `${o.pendingRefunds} waiting` : 'All clear'} onPress={() => router.push('/admin/refunds')} />
        <ListRow icon="storefront" title="Marketplace listings & orders" onPress={() => router.push('/admin/listings')} />
        <ListRow icon="link" tint={colors.success} title="Affiliates & commissions" onPress={() => router.push('/admin/affiliates')} />
        <ListRow icon="analytics" tint={colors.sim} title="Attribution, events & referrals" onPress={() => router.push('/admin/analytics')} />
        <ListRow icon="document-text" title="Audit log" onPress={() => router.push('/admin/audit')} />
        <ListRow icon="key" tint={colors.danger} title="Webhook signature tester" onPress={() => router.push('/admin/webhooks')} />
      </Card>
    </Screen>
  );
}
