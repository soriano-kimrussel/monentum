import { Text, View } from 'react-native';

import { PLANS, formatCents } from '@/domain/subscription';
import { useAction, useQuery } from '@/hooks/useApi';
import { Button, Card, Loading, Pill, Screen, SectionTitle, SimBanner } from '@/ui/components';
import { space, type } from '@/ui/theme';

export default function AdminRefunds() {
  const { data, loading } = useQuery(async (b, t) => {
    const [subs, orders] = await Promise.all([b.billing.allRefunds(t), b.market.allOrders(t)]);
    return { subs, orders: orders.filter((o) => o.status !== 'paid') };
  });
  const { run, busy } = useAction();
  if (loading || !data) return <Loading />;

  return (
    <Screen>
      <SimBanner text="Approving a refund here reverses the simulated charge, revokes entitlement when needed, and reverses affiliate commission." />
      <SectionTitle title="Subscription refunds" />
      {data.subs.length === 0 && <Text style={type.small}>No requests.</Text>}
      {data.subs.map((r) => (
        <Card key={r.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={type.subtitle}>{r.txn ? formatCents(r.txn.amountCents) : '—'}</Text>
            <Pill tone={r.status === 'pending' ? 'warning' : r.status === 'approved' ? 'success' : 'danger'} label={r.status} />
          </View>
          <Text style={type.small}>
            {r.email} · {r.txn ? PLANS[r.txn.plan].label : ''} · {new Date(r.createdAt).toLocaleDateString()}
          </Text>
          <Text style={[type.body, { marginTop: 6 }]}>“{r.reason}”</Text>
          {r.status === 'pending' && (
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
              <Button title="Approve" small loading={busy === `a${r.id}`} onPress={() => run(`a${r.id}`, (b, t) => b.billing.decideRefund(t, r.id, true, 'Approved'))} />
              <Button title="Reject" small variant="danger" loading={busy === `r${r.id}`} onPress={() => run(`r${r.id}`, (b, t) => b.billing.decideRefund(t, r.id, false, 'Outside refund policy'))} />
            </View>
          )}
        </Card>
      ))}

      <SectionTitle title="Marketplace order refunds" />
      {data.orders.length === 0 && <Text style={type.small}>No requests.</Text>}
      {data.orders.map((o) => (
        <Card key={o.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={type.subtitle}>
              #{o.id.slice(-6).toUpperCase()} · {formatCents(o.totalCents)}
            </Text>
            <Pill tone={o.status === 'refunded' ? 'success' : 'warning'} label={o.status.replace('_', ' ')} />
          </View>
          <Text style={type.small}>{o.email}</Text>
          {o.refundReason && <Text style={[type.body, { marginTop: 6 }]}>“{o.refundReason}”</Text>}
          {o.status === 'refund_requested' && (
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
              <Button title="Approve & restock" small loading={busy === `oa${o.id}`} onPress={() => run(`oa${o.id}`, (b, t) => b.market.decideOrderRefund(t, o.id, true))} />
              <Button title="Reject" small variant="danger" onPress={() => run(`or${o.id}`, (b, t) => b.market.decideOrderRefund(t, o.id, false))} />
            </View>
          )}
        </Card>
      ))}
    </Screen>
  );
}
