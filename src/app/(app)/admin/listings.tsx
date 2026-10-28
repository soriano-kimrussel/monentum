import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Switch, Text, View } from 'react-native';
import { z } from 'zod';

import { CATEGORIES, type Listing } from '@/domain/marketplace';
import { formatCents } from '@/domain/subscription';
import { useAction, useQuery } from '@/hooks/useApi';
import { Button, Card, Chip, Loading, Pill, Screen, SectionTitle, TextField } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

// Form works in dollars / strings; converted to integer cents before the backend validates again.
const formSchema = z.object({
  title: z.string().trim().min(1, 'Required').max(80),
  description: z.string().max(500),
  category: z.enum(CATEGORIES),
  price: z.string().regex(/^\d{1,4}(\.\d{1,2})?$/, 'e.g. 4.99'),
  inventory: z.string().regex(/^\d{1,6}$/, 'Whole number'),
  icon: z.string().min(1),
  active: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

function ListingForm({ initial, onDone }: { initial?: Listing; onDone: () => void }) {
  const { run } = useAction();
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initial
      ? { ...initial, price: (initial.priceCents / 100).toFixed(2), inventory: String(initial.inventory) }
      : { title: '', description: '', category: 'Templates', price: '', inventory: '10', icon: 'pricetag', active: true },
  });
  const submit = handleSubmit(async (v) => {
    const payload = { title: v.title, description: v.description, category: v.category, icon: v.icon, active: v.active, priceCents: Math.round(Number(v.price) * 100), inventory: Number(v.inventory) };
    if (await run('save', (b, t) => b.market.saveListing(t, payload, initial?.id))) onDone();
  });
  return (
    <Card style={{ borderWidth: 1, borderColor: colors.primary }}>
      <Controller control={control} name="title" render={({ field }) => <TextField label="Title" value={field.value} onChangeText={field.onChange} error={formState.errors.title?.message} />} />
      <Controller control={control} name="description" render={({ field }) => <TextField label="Description" value={field.value} onChangeText={field.onChange} multiline />} />
      <Controller
        control={control}
        name="category"
        render={({ field }) => (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm }}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={c} selected={field.value === c} onPress={() => field.onChange(c)} />
            ))}
          </View>
        )}
      />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Controller control={control} name="price" render={({ field }) => <TextField label="Price ($)" keyboardType="decimal-pad" value={field.value} onChangeText={field.onChange} error={formState.errors.price?.message} />} />
        </View>
        <View style={{ flex: 1 }}>
          <Controller control={control} name="inventory" render={({ field }) => <TextField label="Stock" keyboardType="number-pad" value={field.value} onChangeText={field.onChange} error={formState.errors.inventory?.message} />} />
        </View>
      </View>
      <Controller
        control={control}
        name="active"
        render={({ field }) => (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md }}>
            <Text style={type.body}>Visible to shoppers</Text>
            <Switch value={field.value} onValueChange={field.onChange} />
          </View>
        )}
      />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button title={initial ? 'Save' : 'Create listing'} onPress={submit} loading={formState.isSubmitting} style={{ flex: 1 }} />
        <Button title="Cancel" variant="ghost" onPress={onDone} />
      </View>
    </Card>
  );
}

export default function AdminListings() {
  const { data, loading } = useQuery(async (b, t) => {
    const [listings, orders] = await Promise.all([b.market.listings(t, true), b.market.allOrders(t)]);
    return { listings, orders };
  });
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  if (loading || !data) return <Loading />;

  return (
    <Screen>
      {editing === 'new' ? <ListingForm onDone={() => setEditing(null)} /> : <Button title="New listing" icon="add" onPress={() => setEditing('new')} />}
      <SectionTitle title={`Listings (${data.listings.length})`} />
      {data.listings.map((l) =>
        editing === l.id ? (
          <ListingForm key={l.id} initial={l} onDone={() => setEditing(null)} />
        ) : (
          <Card key={l.id} onPress={() => setEditing(l.id)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[type.subtitle, { flex: 1 }]} numberOfLines={1}>
                {l.title}
              </Text>
              <Text style={{ fontWeight: '700' }}>{formatCents(l.priceCents)}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              <Pill label={l.category} />
              <Pill tone={l.inventory === 0 ? 'danger' : l.inventory < 5 ? 'warning' : 'success'} label={`${l.inventory} in stock`} />
              {!l.active && <Pill tone="danger" label="hidden" />}
            </View>
          </Card>
        ),
      )}
      <SectionTitle title={`Recent orders (${data.orders.length})`} />
      {data.orders.slice(0, 15).map((o) => (
        <Card key={o.id}>
          <Text style={type.body}>
            #{o.id.slice(-6).toUpperCase()} · {formatCents(o.totalCents)} · {o.status.replace('_', ' ')}
          </Text>
          <Text style={type.small}>
            {o.email} · {o.lines.map((l) => `${l.qty}× ${l.title}`).join(', ')}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
