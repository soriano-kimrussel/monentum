import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PAYMENT_METHODS, PLANS, TRIAL_DAYS, formatCents, type PaidPlanId, type PaymentMethodId } from '@/domain/subscription';
import { notify, useAction, useQuery } from '@/hooks/useApi';
import { Button, Card, Loading, Pill, Screen, SectionTitle, SimBanner } from '@/ui/components';
import { colors, radius, space, type } from '@/ui/theme';

const FEATURES = [
  ['infinite', 'Up to 50 habits & 25 goals', 'Free: 3 habits, 1 goal'],
  ['stats-chart', '90-day insights & mood correlation', 'Free: 7 days'],
  ['cloud-upload', 'Priority sync (simulated)', ''],
  ['sparkles', 'Support an indie demo app', ''],
] as const;

export default function Paywall() {
  const { data, loading } = useQuery((b, t) => b.billing.status(t));
  const { run, busy } = useAction();
  const [plan, setPlan] = useState<PaidPlanId>('premium_annual');
  const [checkout, setCheckout] = useState(false);

  if (loading || !data) return <Loading />;
  const { sub, premium } = data;
  const monthlyEquivalent = Math.round(PLANS.premium_annual.priceCents / 12);
  const savings = Math.round((1 - PLANS.premium_annual.priceCents / (PLANS.premium_monthly.priceCents * 12)) * 100);

  if (premium && sub.status !== 'trialing') {
    return (
      <Screen>
        <Card style={{ alignItems: 'center' }}>
          <Ionicons name="sparkles" size={36} color={colors.primary} />
          <Text style={[type.title, { marginTop: space.sm }]}>You’re on Premium</Text>
          <Button title="Manage subscription" onPress={() => router.replace('/premium/manage')} style={{ marginTop: space.lg, alignSelf: 'stretch' }} />
        </Card>
      </Screen>
    );
  }

  const done = (msg: string) => {
    notify('Success (simulated)', msg);
    router.replace('/premium/manage');
  };

  return (
    <Screen>
      <SimBanner />
      <View style={{ alignItems: 'center', marginVertical: space.md }}>
        <Text style={type.hero}>Build momentum faster</Text>
        <Text style={[type.small, { marginTop: 4 }]}>Everything in Free, plus:</Text>
      </View>
      <Card>
        {FEATURES.map(([icon, title, sub2]) => (
          <View key={title} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
            <Ionicons name={icon} size={20} color={colors.primary} />
            <View style={{ marginLeft: space.md }}>
              <Text style={type.body}>{title}</Text>
              {!!sub2 && <Text style={type.small}>{sub2}</Text>}
            </View>
          </View>
        ))}
      </Card>

      <SectionTitle title="Choose a plan" />
      {(['premium_annual', 'premium_monthly'] as const).map((id) => {
        const selected = plan === id;
        return (
          <Pressable
            key={id}
            onPress={() => setPlan(id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            style={{ borderWidth: 2, borderColor: selected ? colors.primary : colors.border, backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, marginBottom: space.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={type.subtitle}>{PLANS[id].label}</Text>
              {id === 'premium_annual' && <Pill tone="success" label={`Save ${savings}%`} />}
            </View>
            <Text style={[type.title, { marginTop: 4 }]}>
              {formatCents(PLANS[id].priceCents)}
              <Text style={type.small}> / {id === 'premium_annual' ? 'year' : 'month'}</Text>
            </Text>
            {id === 'premium_annual' && <Text style={type.small}>{formatCents(monthlyEquivalent)}/month billed yearly</Text>}
          </Pressable>
        );
      })}

      {!sub.trialUsed && (
        <Button
          title={`Start ${TRIAL_DAYS}-day free trial`}
          icon="gift-outline"
          loading={busy === 'trial'}
          onPress={async () => {
            if (await run('trial', (b, t) => b.billing.startTrial(t, plan))) done(`Your ${TRIAL_DAYS}-day trial has started. Cancel any time before it ends and you won’t be charged (simulated).`);
          }}
          style={{ marginTop: space.sm }}
        />
      )}
      <Button
        title={sub.status === 'trialing' ? 'Subscribe now (end trial)' : 'Subscribe'}
        variant={sub.trialUsed ? 'primary' : 'ghost'}
        onPress={() => setCheckout(true)}
        style={{ marginTop: space.sm }}
      />

      {checkout && (
        <Card style={{ marginTop: space.lg, borderWidth: 1, borderColor: colors.sim }}>
          <Text style={type.subtitle}>Simulated checkout</Text>
          <Text style={[type.small, { marginVertical: 6 }]}>
            Choose a demo payment method. These are test switches. No card number, CVV or bank details are ever collected.
          </Text>
          {(Object.keys(PAYMENT_METHODS) as PaymentMethodId[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => run('pm', (b, t) => b.billing.setPaymentMethod(t, m))}
              accessibilityRole="radio"
              accessibilityState={{ checked: sub.paymentMethod === m }}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
              <Ionicons name={sub.paymentMethod === m ? 'radio-button-on' : 'radio-button-off'} size={20} color={colors.sim} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={type.body}>{PAYMENT_METHODS[m].label}</Text>
                <Text style={type.small}>{PAYMENT_METHODS[m].description}</Text>
              </View>
            </Pressable>
          ))}
          <Button
            title={`Pay ${formatCents(PLANS[plan].priceCents)} (simulated)`}
            loading={busy === 'buy'}
            onPress={async () => {
              if (await run('buy', (b, t) => b.billing.purchase(t, plan))) done(`${PLANS[plan].label} is active. No real money was charged.`);
            }}
            style={{ marginTop: space.sm }}
          />
        </Card>
      )}

      <Button title="Restore purchases" variant="ghost" small onPress={async () => {
        const r = await run('restore', (b, t) => b.billing.restore(t));
        if (r) notify(r.restored ? 'Purchases restored' : 'Nothing to restore', 'Checked the local demo ledger. This does not contact any app store.');
      }} style={{ marginTop: space.lg }} />
      <Text style={[type.small, { textAlign: 'center', marginTop: space.md }]}>
        Prices are illustrative. Renewals, trials and failures run on a local test clock (You → Demo controls).
      </Text>
    </Screen>
  );
}
