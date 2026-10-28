import { useState } from 'react';
import { Text, View } from 'react-native';

import type { ReferralConfig } from '@/domain/growth';
import { formatCents } from '@/domain/subscription';
import { notify, useAction, useQuery } from '@/hooks/useApi';
import { BarChart } from '@/ui/charts';
import { Button, Card, Chip, Divider, Loading, Pill, Screen, Segmented, SectionTitle, SimBanner } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

type Tab = 'attribution' | 'events' | 'referrals';

export default function AdminAnalytics() {
  const [tab, setTab] = useState<Tab>('attribution');
  const { data, loading } = useQuery(async (b, t) => {
    const [report, events, referrals, cfg] = await Promise.all([b.growth.attribution(t), b.growth.events(t, 100), b.referrals.all(t), b.referrals.mine(t)]);
    return { report, events, referrals, config: cfg.config };
  });
  const { run, busy } = useAction();
  if (loading || !data) return <Loading />;

  const setConfig = (patch: Partial<ReferralConfig>) => run('cfg', (b, t) => b.referrals.setConfig(t, { ...data.config, ...patch }));

  return (
    <Screen>
      <SimBanner text="Local analytics only. Events contain hashed device ids, never emails, names or user ids, and are never sent to an ad network." />
      <Segmented<Tab>
        options={[
          { value: 'attribution', label: 'Attribution' },
          { value: 'events', label: 'Events' },
          { value: 'referrals', label: 'Referrals' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'attribution' && (
        <>
          <Card>
            <Text style={type.subtitle}>Clicks by campaign</Text>
            <BarChart data={data.report.map((r) => ({ label: r.campaign.code.slice(0, 8), value: r.clicks }))} format={(v) => String(v)} />
          </Card>
          {data.report.map((r) => (
            <Card key={r.campaignId}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={type.subtitle}>{r.campaign.name}</Text>
                <Pill tone={r.campaign.affiliateId ? 'success' : 'primary'} label={r.campaign.channel} />
              </View>
              <Text style={type.small}>
                {r.clicks} clicks → {r.signups} sign-ups ({Math.round(r.conversionRate * 100)}%) → {r.purchases} purchases · {formatCents(r.revenueCents)}
              </Text>
            </Card>
          ))}
          <Button
            title="Simulate 40 campaign clicks"
            variant="secondary"
            icon="flash"
            loading={busy === 'sim'}
            onPress={async () => {
              const n = await run('sim', (b, t) => b.growth.simulateTraffic(t, 40));
              if (n) notify('Traffic simulated', `${n} synthetic clicks with randomized sign-ups and purchases.`);
            }}
          />
          <Text style={[type.small, { marginTop: space.sm }]}>Model: last click within 30 days.</Text>
        </>
      )}

      {tab === 'events' && (
        <Card>
          {data.events.map((e, i) => (
            <View key={e.id}>
              {i > 0 && <Divider />}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[type.body, { fontWeight: '600' }]}>{e.name}</Text>
                <Text style={type.small}>{new Date(e.at).toLocaleString()}</Text>
              </View>
              <Text style={[type.small, { fontFamily: 'monospace' }]}>
                subject={e.subject ?? '—'} {e.campaignId ? `campaign=${e.campaignId} ` : ''}
                {e.valueCents !== undefined ? `value=${e.valueCents} ` : ''}
                {Object.entries(e.props)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(' ')}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {tab === 'referrals' && (
        <>
          <Card>
            <Text style={type.subtitle}>Reward rules</Text>
            <Text style={[type.small, { marginTop: space.sm }]}>Reward when the friend…</Text>
            <View style={{ flexDirection: 'row' }}>
              <Chip label="signs up" selected={data.config.trigger === 'signup'} onPress={() => setConfig({ trigger: 'signup' })} />
              <Chip label="first check-in" selected={data.config.trigger === 'first_checkin'} onPress={() => setConfig({ trigger: 'first_checkin' })} />
            </View>
            <Text style={type.small}>Reward size</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {[3, 7, 14, 30].map((d) => (
                <Chip key={d} label={`${d} days`} selected={data.config.rewardDays === d} onPress={() => setConfig({ rewardDays: d })} />
              ))}
            </View>
            <Text style={type.small}>Max rewards per referrer</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {[3, 10, 25].map((d) => (
                <Chip key={d} label={String(d)} selected={data.config.maxRewardsPerReferrer === d} onPress={() => setConfig({ maxRewardsPerReferrer: d })} />
              ))}
            </View>
          </Card>
          <SectionTitle title={`Referral records (${data.referrals.length})`} />
          <Card>
            {data.referrals.length === 0 && <Text style={type.small}>No referrals yet.</Text>}
            {data.referrals.map((r, i) => (
              <View key={r.id}>
                {i > 0 && <Divider />}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={type.body}>{r.code}</Text>
                  <Pill tone={r.status === 'rewarded' ? 'success' : r.status === 'blocked' ? 'danger' : 'warning'} label={r.blockReason ?? r.status} />
                </View>
                <Text style={[type.small, { color: colors.faint }]}>{new Date(r.createdAt).toLocaleString()}</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
