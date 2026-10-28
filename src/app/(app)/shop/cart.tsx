import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { formatCents } from '@/domain/subscription';
import { notify, useAction, useQuery } from '@/hooks/useApi';
import { randomId } from '@/lib/crypto';
import { useCart } from '@/stores/cart';
import { Button, Card, Divider, EmptyState, Loading, Screen, SimBanner } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

export default function Cart() {
  const { lines, setQty, clear } = useCart();
  const { data, loading } = useQuery((b, t) => b.market.listings(t));
  const { run, busy } = useAction();
  const [lastReplay, setLastReplay] = useState(false);
  // One idempotency key per checkout attempt: a double tap or retry reuses it.
  const key = useRef(randomId('chk_'));

  const priced = useMemo(() => {
    const map = new Map((data ?? []).map((l) => [l.id, l]));
    return lines.map((l) => ({ ...l, listing: map.get(l.listingId) })).filter((l) => l.listing);
  }, [lines, data]);
  const total = priced.reduce((s, l) => s + l.qty * l.listing!.priceCents, 0);

  if (loading) return <Loading />;
  if (priced.length === 0) {
    return (
      <Screen>
        <EmptyState icon="cart-outline" title="Your cart is empty" action="Browse the shop" onAction={() => router.back()} />
      </Screen>
    );
  }

  const checkout = async () => {
    // Only check out what is shown: lines for listings that were since removed are dropped.
    const shown = priced.map(({ listingId, qty }) => ({ listingId, qty }));
    const r = await run('checkout', (b, t) => b.market.checkout(t, shown, key.current));
    if (!r) return;
    setLastReplay(r.replayed);
    clear();
    key.current = randomId('chk_');
    notify(r.replayed ? 'Order already placed' : 'Order placed (simulated)', `Order ${r.order.id.slice(-6).toUpperCase()} · ${formatCents(r.order.totalCents)}. No real payment was taken.`);
    router.replace('/shop/orders');
  };

  return (
    <Screen>
      <SimBanner />
      <Card>
        {priced.map((l, i) => (
          <View key={l.listingId}>
            {i > 0 && <Divider />}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>{l.listing!.title}</Text>
                <Text style={type.small}>{formatCents(l.listing!.priceCents)} each</Text>
              </View>
              <Button title="−" small variant="ghost" onPress={() => setQty(l.listingId, l.qty - 1)} />
              <Text style={{ width: 30, textAlign: 'center', fontWeight: '700' }}>{l.qty}</Text>
              <Button title="+" small variant="ghost" disabled={l.qty >= Math.min(10, l.listing!.inventory)} onPress={() => setQty(l.listingId, l.qty + 1)} />
            </View>
          </View>
        ))}
        <Divider />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }}>
          <Text style={type.subtitle}>Total</Text>
          <Text style={[type.title, { color: colors.primary }]}>{formatCents(total)}</Text>
        </View>
        <Text style={[type.small, { marginTop: 4 }]}>Final price and stock are re-checked by the backend.</Text>
      </Card>
      <Button title={`Place order · ${formatCents(total)} (simulated)`} onPress={checkout} loading={busy === 'checkout'} />
      {lastReplay && <Text style={type.small}>Duplicate submission detected; returned the original order.</Text>}
    </Screen>
  );
}
