import { useState } from 'react';
import { Text } from 'react-native';

import { formatCents } from '@/domain/subscription';
import { useQuery } from '@/hooks/useApi';
import { api } from '@/services/app';
import { useSession } from '@/stores/session';
import { Button, Card, Chip, Loading, Screen, SectionTitle, SimBanner } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

/** Demonstrates provider-webhook security: HMAC signature, freshness window, replay dedupe. */
export default function WebhookTester() {
  const { data, loading } = useQuery(async (b, t) => (await b.admin.users(t)).filter((u) => u.premium));
  const [txnId, setTxnId] = useState<string | null>(null);
  const [lastSigned, setLastSigned] = useState<{ body: string; signature: string } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  if (loading || !data) return <Loading />;

  const b = api();
  const push = (line: string) => setLog((l) => [`${new Date().toLocaleTimeString()}  ${line}`, ...l].slice(0, 12));
  const send = async (label: string, body: string, signature: string) => {
    try {
      const r = await b.billing.receiveWebhook(body, signature);
      push(`${label}: ✅ ${r.status}`);
    } catch (e) {
      push(`${label}: ⛔ ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const pickTxn = async (userId: string) => {
    const txns = await b.billing.adminTransactions(useSession.getState().token!, userId);
    const charge = txns.find((t) => t.amountCents > 0 && t.status === 'succeeded');
    setTxnId(charge?.id ?? null);
    push(charge ? `Selected charge ${charge.id.slice(-8)} (${formatCents(charge.amountCents)})` : 'That user has no refundable charge');
  };

  return (
    <Screen>
      <SimBanner text="Mock payment-provider webhooks signed with a mock secret (HMAC-SHA256). No external service is involved." />
      <Text style={[type.small, { marginBottom: space.sm }]}>1. Pick a premium user whose latest charge the “provider” will refund:</Text>
      <Card style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {data.map((u) => (
          <Chip key={u.id} label={u.displayName} onPress={() => pickTxn(u.id)} />
        ))}
      </Card>
      <Text style={[type.small, { marginBottom: space.sm }]}>2. Send events:</Text>
      <Button
        title="Send valid signed event"
        disabled={!txnId}
        onPress={() => {
          const signed = b.billing.signEvent('charge.refunded', { transactionId: txnId });
          setLastSigned(signed);
          send('valid', signed.body, signed.signature);
        }}
      />
      <Button title="Replay last event" variant="secondary" disabled={!lastSigned} style={{ marginTop: space.sm }} onPress={() => lastSigned && send('replay', lastSigned.body, lastSigned.signature)} />
      <Button
        title="Send tampered body"
        variant="danger"
        disabled={!txnId}
        style={{ marginTop: space.sm }}
        onPress={() => {
          const signed = b.billing.signEvent('charge.refunded', { transactionId: txnId });
          send('tampered', signed.body.replace('charge.refunded', 'charge.refunded ').replace(txnId!, 'txn_attacker'), signed.signature);
        }}
      />
      <Button title="Send with forged signature" variant="danger" disabled={!txnId} style={{ marginTop: space.sm }} onPress={() => {
        const signed = b.billing.signEvent('charge.refunded', { transactionId: txnId });
        send('forged', signed.body, `t=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}`);
      }} />
      <Button title="Send stale event (10 min old)" variant="danger" disabled={!txnId} style={{ marginTop: space.sm }} onPress={() => {
        // Swapping the timestamp also breaks the HMAC, so this is rejected either way.
        const signed = b.billing.signEvent('charge.refunded', { transactionId: txnId });
        send('stale', signed.body, signed.signature.replace(/t=\d+/, `t=${Math.floor(Date.now() / 1000) - 600}`));
      }} />
      <SectionTitle title="Results" />
      <Card>
        {log.length === 0 && <Text style={type.small}>Nothing sent yet.</Text>}
        {log.map((l, i) => (
          <Text key={i} style={{ fontFamily: 'monospace', fontSize: 12, color: l.includes('⛔') ? colors.danger : colors.success, marginBottom: 4 }}>
            {l}
          </Text>
        ))}
      </Card>
    </Screen>
  );
}
