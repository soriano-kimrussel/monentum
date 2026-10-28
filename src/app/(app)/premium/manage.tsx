import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { PAYMENT_METHODS, PLANS, formatCents, type PaymentMethodId, type Transaction } from '@/domain/subscription';
import { confirm, notify, useAction, useQuery } from '@/hooks/useApi';
import { Button, Card, Chip, Divider, Loading, Pill, Screen, SectionTitle, SimBanner, TextField } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const TXN_LABEL: Record<Transaction['type'], string> = {
  trial_start: 'Trial started',
  purchase: 'Purchase',
  renewal: 'Renewal',
  trial_conversion: 'Trial converted',
  upgrade: 'Upgrade (prorated)',
  refund: 'Refund',
};

export default function Manage() {
  const { data, loading } = useQuery(async (b, t) => {
    const [status, txns, refunds] = await Promise.all([b.billing.status(t), b.billing.transactions(t), b.billing.refunds(t)]);
    return { ...status, txns, refunds };
  });
  const { run, busy } = useAction();
  const [refundFor, setRefundFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  if (loading || !data) return <Loading />;
  const { sub, premium, txns, refunds } = data;
  const plan = sub.plan ? PLANS[sub.plan] : null;

  const statusLine = (() => {
    switch (sub.status) {
      case 'trialing':
        return sub.cancelAtPeriodEnd ? `Trial ends ${fmtDate(sub.trialEndsAt)}. You won’t be charged.` : `Trial converts to ${plan?.label} on ${fmtDate(sub.trialEndsAt)}.`;
      case 'active':
        return sub.cancelAtPeriodEnd ? `Canceled. Access until ${fmtDate(sub.currentPeriodEnd)}.` : `Renews ${fmtDate(sub.currentPeriodEnd)} for ${formatCents(PLANS[sub.pendingPlan ?? sub.plan!].priceCents)}.`;
      case 'past_due':
        return `Payment failed. Access continues until ${fmtDate(sub.graceEndsAt)} (grace period).`;
      case 'expired':
        return 'Your subscription has ended.';
      case 'refunded':
        return 'Your last charge was refunded and Premium was removed.';
      default:
        return 'You’re on the Free plan.';
    }
  })();

  return (
    <Screen>
      <SimBanner />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={type.title}>{plan && sub.status !== 'none' ? plan.label : 'Free'}</Text>
          <Pill tone={premium ? 'primary' : sub.status === 'past_due' ? 'warning' : 'neutral'} label={sub.status.replace('_', ' ').toUpperCase()} />
        </View>
        <Text style={[type.small, { marginTop: 6 }]}>{statusLine}</Text>
        {sub.pendingPlan && <Text style={[type.small, { color: colors.warning, marginTop: 4 }]}>Switching to {PLANS[sub.pendingPlan].label} at next renewal.</Text>}
        {sub.bonusPremiumUntil && sub.bonusPremiumUntil > data.now && <Text style={[type.small, { color: colors.success, marginTop: 4 }]}>Referral bonus Premium until {fmtDate(sub.bonusPremiumUntil)}.</Text>}

        <View style={{ gap: space.sm, marginTop: space.lg }}>
          {(sub.status === 'none' || sub.status === 'expired' || sub.status === 'refunded') && <Button title="See plans" onPress={() => router.push('/premium')} />}
          {sub.status === 'trialing' && <Button title="Subscribe now" onPress={() => router.push('/premium')} />}
          {sub.status === 'active' && sub.plan === 'premium_monthly' && (
            <Button title="Upgrade to annual (prorated)" loading={busy === 'up'} onPress={async () => {
              if (await confirm('Upgrade to annual?', 'You’ll be charged the annual price minus unused monthly time (simulated).')) await run('up', (b, t) => b.billing.changePlan(t, 'premium_annual'));
            }} />
          )}
          {sub.status === 'active' && sub.plan === 'premium_annual' && !sub.pendingPlan && (
            <Button title="Switch to monthly at renewal" variant="secondary" loading={busy === 'down'} onPress={() => run('down', (b, t) => b.billing.changePlan(t, 'premium_monthly'))} />
          )}
          {sub.pendingPlan && <Button title="Keep current plan" variant="secondary" onPress={() => run('keep', (b, t) => b.billing.changePlan(t, sub.plan!))} />}
          {sub.status === 'past_due' && <Button title="Retry payment" loading={busy === 'retry'} onPress={async () => {
            if (await run('retry', (b, t) => b.billing.retryPayment(t))) notify('Payment succeeded (simulated)');
          }} />}
          {(sub.status === 'active' || sub.status === 'trialing') && !sub.cancelAtPeriodEnd && (
            <Button title={sub.status === 'trialing' ? 'Cancel trial' : 'Cancel subscription'} variant="danger" loading={busy === 'cancel'} onPress={async () => {
              if (await confirm('Cancel?', 'You keep Premium until the end of the current period. You can resume before then.', 'Cancel plan', true)) await run('cancel', (b, t) => b.billing.cancel(t));
            }} />
          )}
          {sub.status === 'past_due' && <Button title="Cancel subscription" variant="danger" onPress={() => run('cancel', (b, t) => b.billing.cancel(t))} />}
          {sub.cancelAtPeriodEnd && premium && <Button title="Resume subscription" variant="secondary" loading={busy === 'resume'} onPress={() => run('resume', (b, t) => b.billing.resume(t))} />}
        </View>
      </Card>

      <SectionTitle title="Demo payment method" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {(Object.keys(PAYMENT_METHODS) as PaymentMethodId[]).map((m) => (
          <Chip key={m} label={PAYMENT_METHODS[m].label.replace('Demo card · ', '')} selected={sub.paymentMethod === m} color={colors.sim} onPress={() => run('pm', (b, t) => b.billing.setPaymentMethod(t, m))} />
        ))}
      </View>

      <SectionTitle title="Transaction history" action="Restore" onAction={async () => {
        const r = await run('restore', (b, t) => b.billing.restore(t));
        if (r) notify(r.restored ? 'Restored from ledger' : 'Nothing to restore', 'Local demo ledger only. No app store is contacted.');
      }} />
      <Card>
        {txns.length === 0 && <Text style={type.small}>No transactions yet.</Text>}
        {txns.map((t, i) => {
          const req = refunds.find((r) => r.transactionId === t.id);
          const refundable = t.status === 'succeeded' && t.amountCents > 0 && !req && t.type !== 'refund';
          return (
            <View key={t.id}>
              {i > 0 && <Divider />}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={type.body}>{TXN_LABEL[t.type]} · {PLANS[t.plan].label.replace('Premium ', '')}</Text>
                  <Text style={type.small}>{fmtDate(t.createdAt)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontWeight: '700', color: t.amountCents < 0 ? colors.success : colors.text }}>{formatCents(t.amountCents)}</Text>
                  {t.status !== 'succeeded' && <Pill tone={t.status === 'failed' ? 'danger' : 'warning'} label={t.status} />}
                  {req && <Pill tone={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'danger' : 'warning'} label={`refund ${req.status}`} />}
                </View>
              </View>
              {refundable && refundFor !== t.id && <Button title="Request refund" variant="ghost" small onPress={() => setRefundFor(t.id)} style={{ marginTop: 6, alignSelf: 'flex-start' }} />}
              {refundFor === t.id && (
                <View style={{ marginTop: space.sm }}>
                  <TextField placeholder="Why are you requesting a refund?" value={reason} onChangeText={setReason} maxLength={500} />
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <Button title="Submit" small loading={busy === 'refund'} onPress={async () => {
                      if (await run('refund', (b, tk) => b.billing.requestRefund(tk, t.id, reason))) {
                        setRefundFor(null);
                        setReason('');
                        notify('Refund requested', 'An admin will review it. (Sign in as the demo admin to approve or reject.)');
                      }
                    }} />
                    <Button title="Cancel" small variant="ghost" onPress={() => setRefundFor(null)} />
                  </View>
                </View>
              )}
              {req?.note ? <Text style={[type.small, { marginTop: 4 }]}>Admin note: {req.note}</Text> : null}
            </View>
          );
        })}
      </Card>
      <Text style={[type.small, { textAlign: 'center' }]}>Refunds can be requested within 14 days of a charge.</Text>
    </Screen>
  );
}
