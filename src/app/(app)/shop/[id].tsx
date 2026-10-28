import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { formatCents } from '@/domain/subscription';
import { useQuery } from '@/hooks/useApi';
import { useCart } from '@/stores/cart';
import { Button, Card, ErrorText, Loading, Pill, Screen, SimBanner, type IconName } from '@/ui/components';
import { colors, radius, space, type } from '@/ui/theme';

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading } = useQuery((b, t) => b.market.listing(t, id), [id]);
  const inCart = useCart((s) => s.lines.find((l) => l.listingId === id)?.qty ?? 0);
  const add = useCart((s) => s.add);

  if (loading) return <Loading />;
  if (!data) return <Screen><ErrorText error={error ?? 'Not found'} /></Screen>;
  const soldOut = data.inventory === 0;

  return (
    <Screen>
      <View style={{ height: 180, borderRadius: radius.xl, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg }}>
        <Ionicons name={data.icon as IconName} size={72} color={colors.primary} />
      </View>
      <Pill label={data.category} tone="primary" />
      <Text style={[type.hero, { marginTop: space.sm }]}>{data.title}</Text>
      <Text style={[type.title, { color: colors.primary, marginTop: 4 }]}>{formatCents(data.priceCents)}</Text>
      <Text style={[type.body, { color: colors.muted, marginTop: space.md, lineHeight: 22 }]}>{data.description}</Text>
      <Card style={{ marginTop: space.lg, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={type.body}>Stock</Text>
        <Text style={{ fontWeight: '700', color: soldOut ? colors.danger : data.inventory < 10 ? colors.warning : colors.success }}>{soldOut ? 'Sold out' : `${data.inventory} available`}</Text>
      </Card>
      <SimBanner text="Demo item. Checkout is simulated and nothing is delivered." />
      <Button
        title={soldOut ? 'Sold out' : inCart ? `Add another (${inCart} in cart)` : 'Add to cart'}
        icon="cart-outline"
        disabled={soldOut || inCart >= Math.min(10, data.inventory)}
        onPress={() => add(data.id)}
      />
      {inCart > 0 && <Button title="Go to cart" variant="secondary" onPress={() => router.push('/shop/cart')} style={{ marginTop: space.sm }} />}
    </Screen>
  );
}
