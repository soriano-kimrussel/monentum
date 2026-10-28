import { useState } from 'react';
import { Text, View } from 'react-native';

import type { CommissionStatus } from '@/domain/growth';
import { formatCents } from '@/domain/subscription';
import { notify, useAction, useQuery } from '@/hooks/useApi';
import { Button, Card, Divider, Loading, Pill, Screen, SectionTitle, SimBanner, TextField } from '@/ui/components';
import { space, type } from '@/ui/theme';

const TONE: Record<CommissionStatus, 'warning' | 'primary' | 'success' | 'danger'> = { pending: 'warning', approved: 'primary', paid: 'success', reversed: 'danger' };

export default function AdminAffiliates() {
  const { data, loading } = useQuery((b, t) => b.growth.affiliates(t));
  const { run, busy } = useAction();
  const [name, setName] = useState('');
  const [rate, setRate] = useState('15');
  if (loading || !data) return <Loading />;

  return (
    <Screen>
      <SimBanner text="Demo affiliates and commissions. “Paid” only changes a status; no payout happens." />
      {data.affiliates.map((a) => {
        const campaigns = data.campaigns.filter((c) => c.affiliateId === a.id);
        return (
          <Card key={a.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={type.subtitle}>{a.name}</Text>
              <Pill tone="primary" label={`${a.commissionBps / 100}%`} />
            </View>
            <Text style={type.small}>Links: {campaigns.map((c) => `momentum://c/${c.code}`).join(', ')}</Text>
            <View style={{ flexDirection: 'row', marginTop: space.sm, gap: space.md }}>
              <Text style={type.small}>Pending {formatCents(a.pending)}</Text>
              <Text style={type.small}>Approved {formatCents(a.approved)}</Text>
              <Text style={type.small}>Paid {formatCents(a.paid)}</Text>
              <Text style={type.small}>Reversed {formatCents(a.reversed)}</Text>
            </View>
          </Card>
        );
      })}

      <SectionTitle title="Add affiliate" />
      <Card>
        <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Morning Routine Blog (demo)" />
        <TextField label="Commission %" value={rate} onChangeText={setRate} keyboardType="number-pad" />
        <Button
          title="Create affiliate + link"
          loading={busy === 'create'}
          onPress={async () => {
            if (await run('create', (b, t) => b.growth.createAffiliate(t, name, Math.round(Number(rate) * 100)))) {
              setName('');
              notify('Affiliate created', 'A tracking link was generated. Open it as momentum://c/<code> to simulate a click.');
            }
          }}
        />
      </Card>

      <SectionTitle title={`Commissions (${data.commissions.length})`} />
      <Card>
        {data.commissions.length === 0 && <Text style={type.small}>No commissions yet. Commissions appear when attributed users pay.</Text>}
        {data.commissions.map((c, i) => (
          <View key={c.id}>
            {i > 0 && <Divider />}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={type.body}>
                  {formatCents(c.amountCents)} on {formatCents(c.saleCents)} sale
                </Text>
                <Text style={type.small}>
                  {data.affiliates.find((a) => a.id === c.affiliateId)?.name} · {new Date(c.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Pill tone={TONE[c.status]} label={c.status} />
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: 6 }}>
              {c.status === 'pending' && <Button title="Approve" small variant="secondary" onPress={() => run(c.id, (b, t) => b.growth.setCommissionStatus(t, c.id, 'approved'))} />}
              {c.status === 'approved' && <Button title="Mark paid" small variant="secondary" onPress={() => run(c.id, (b, t) => b.growth.setCommissionStatus(t, c.id, 'paid'))} />}
              {(c.status === 'pending' || c.status === 'approved') && <Button title="Reverse" small variant="danger" onPress={() => run(c.id, (b, t) => b.growth.setCommissionStatus(t, c.id, 'reversed'))} />}
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
