import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { CATEGORIES, searchListings, type Category } from '@/domain/marketplace';
import { formatCents } from '@/domain/subscription';
import { useQuery } from '@/hooks/useApi';
import { useCart } from '@/stores/cart';
import { Card, Chip, EmptyState, Loading, Screen, SimBanner, TextField, type IconName } from '@/ui/components';
import { colors, radius, space, type } from '@/ui/theme';

export default function Shop() {
  const { data, loading, reload } = useQuery((b, t) => b.market.listings(t));
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category | null>(null);
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.qty, 0));
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 18, marginRight: 16 }}>
          <Pressable onPress={() => router.push('/shop/orders')} accessibilityLabel="Order history" hitSlop={8}>
            <Ionicons name="receipt-outline" size={22} color={colors.primary} />
          </Pressable>
          <Pressable onPress={() => router.push('/shop/cart')} accessibilityLabel={`Cart, ${count} items`} hitSlop={8}>
            <Ionicons name="cart-outline" size={24} color={colors.primary} />
            {count > 0 && (
              <View style={{ position: 'absolute', right: -8, top: -6, backgroundColor: colors.danger, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{count}</Text>
              </View>
            )}
          </Pressable>
        </View>
      ),
    });
  }, [navigation, count]);

  const results = useMemo(() => searchListings(data ?? [], q, cat), [data, q, cat]);
  if (loading || !data) return <Loading />;

  return (
    <Screen onRefresh={reload}>
      <SimBanner text="Demo marketplace: listings, stock and orders are simulated. Nothing is charged or shipped." />
      <TextField placeholder="Search templates, journals, audio…" value={q} onChangeText={setQ} accessibilityLabel="Search listings" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.sm }}>
        <Chip label="All" selected={!cat} onPress={() => setCat(null)} />
        {CATEGORIES.map((c) => (
          <Chip key={c} label={c} selected={cat === c} onPress={() => setCat(cat === c ? null : c)} />
        ))}
      </ScrollView>
      {results.length === 0 ? (
        <EmptyState icon="search" title="No matches" body="Try a different search or category." />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {results.map((l) => (
            <Card key={l.id} style={{ width: '48.5%', padding: space.md }} onPress={() => router.push(`/shop/${l.id}`)}>
              <View style={{ height: 76, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm }}>
                <Ionicons name={l.icon as IconName} size={30} color={colors.primary} />
              </View>
              <Text style={[type.body, { fontWeight: '600' }]} numberOfLines={2}>
                {l.title}
              </Text>
              <Text style={type.small}>{l.category}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, alignItems: 'center' }}>
                <Text style={{ fontWeight: '800', color: colors.text }}>{formatCents(l.priceCents)}</Text>
                <Text style={{ fontSize: 11, color: l.inventory === 0 ? colors.danger : l.inventory < 10 ? colors.warning : colors.faint }}>
                  {l.inventory === 0 ? 'Sold out' : l.inventory < 10 ? `${l.inventory} left` : 'In stock'}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
