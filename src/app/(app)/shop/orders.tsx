import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { formatCents } from '@/domain/subscription';
import { notify, useAction, useQuery } from '@/hooks/useApi';
import { useCart } from '@/stores/cart';
import { Button, Card, EmptyState, Loading, Pill, Screen, SimBanner, TextField } from '@/ui/components';
import { space, type } from '@/ui/theme';

export default function Orders() {
  const { data, loading, reload } = useQuery((b, t) => b.market.orders(t));
  const { run, busy } = useAction();
  const replace = useCart((s) => s.replace);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  if (loading || !data) return <Loading />;
  return (
    <Screen onRefresh={reload}>
      <SimBanner text="Demo orders. Nothing was charged or shipped." />
      {data.length === 0 && <EmptyState icon="receipt-outline" title="No orders yet" action="Visit the shop" onAction={() => router.back()} />}
      {data.map((o) => (
        <Card key={o.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={type.subtitle}>#{o.id.slice(-6).toUpperCase()}</Text>
            <Pill tone={o.status === 'paid' ? 'success' : o.status === 'refunded' ? 'neutral' : 'warning'} label={o.status === 'paid' ? 'Paid (simulated)' : o.status.replace('_', ' ')} />
          </View>
          <Text style={type.small}>{new Date(o.createdAt).toLocaleString()}</Text>
          {o.lines.map((l) => (
            <Text key={l.listingId} style={[type.body, { marginTop: 4 }]}>
              {l.qty} × {l.title} <Text style={type.small}>({formatCents(l.unitCents)})</Text>
            </Text>
          ))}
          <Text style={[type.subtitle, { marginTop: space.sm }]}>{formatCents(o.totalCents)}</Text>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
            <Button
              title="Buy again"
              small
              variant="secondary"
              icon="repeat"
              onPress={() => {
                replace(o.lines.map((l) => ({ listingId: l.listingId, qty: l.qty })));
                router.push('/shop/cart');
              }}
            />
            {o.status === 'paid' && refunding !== o.id && <Button title="Request refund" small variant="ghost" onPress={() => setRefunding(o.id)} />}
          </View>
          {refunding === o.id && (
            <View style={{ marginTop: space.sm }}>
              <TextField placeholder="Reason for refund" value={reason} onChangeText={setReason} />
              <Button
                title="Submit request"
                small
                loading={busy === o.id}
                onPress={async () => {
                  const ok = await run(o.id, (b, t) => b.market.requestOrderRefund(t, o.id, reason).then(() => true));
                  if (ok) {
                    setRefunding(null);
                    setReason('');
                    notify('Refund requested', 'An admin will review it.');
                  }
                }}
              />
            </View>
          )}
        </Card>
      ))}
    </Screen>
  );
}
