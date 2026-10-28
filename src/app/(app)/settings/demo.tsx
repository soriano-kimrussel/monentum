import { Text, View } from 'react-native';

import { confirm, notify, useAction, useQuery } from '@/hooks/useApi';
import { resetDemoData } from '@/services/app';
import { Button, Card, Screen, SectionTitle, SimBanner } from '@/ui/components';
import { space, type } from '@/ui/theme';

export default function DemoControls() {
  const { data } = useQuery((b, t) => b.billing.status(t));
  const { run, busy } = useAction();
  const offsetDays = data ? Math.round(data.clockOffsetMs / 86_400_000) : 0;

  const advance = async (days: number) => {
    const now = await run(`adv${days}`, (b, t) => b.billing.advanceClock(t, days));
    if (now) notify('Test clock moved', `It is now ${new Date(now).toDateString()} in the demo. Due trials, renewals and expiries were processed.`);
  };

  return (
    <Screen>
      <SimBanner text="Presenter tools. These exist only in the demo build and would not ship in production." />
      <Card>
        <Text style={type.subtitle}>Test clock</Text>
        <Text style={[type.small, { marginVertical: 6 }]}>
          Demo time is {offsetDays === 0 ? 'in sync with real time' : `${offsetDays} days ahead`}{data ? ` (${new Date(data.now).toDateString()})` : ''}. Moving it forward triggers trial
          conversions, renewals, failed payments and expirations.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {[1, 3, 8, 30, 365].map((d) => (
            <Button key={d} title={`+${d}d`} small variant="secondary" loading={busy === `adv${d}`} onPress={() => advance(d)} />
          ))}
          <Button title="Reset clock" small variant="ghost" onPress={() => advance(0)} />
        </View>
      </Card>

      <SectionTitle title="Try these flows" />
      <Card>
        <Text style={type.body}>1. Start a trial → +8d → trial converts (simulated charge).</Text>
        <Text style={type.body}>2. Pick “fails on renewal” card → subscribe → +30d → past due → retry.</Text>
        <Text style={type.body}>3. Cancel → +30d → expires at period end.</Text>
        <Text style={type.body}>4. Request a refund → sign in as admin → approve.</Text>
      </Card>

      <SectionTitle title="Reset" />
      <Card>
        <Text style={[type.small, { marginBottom: space.md }]}>Deletes all local data on this device and re-creates the sample accounts.</Text>
        <Button
          title="Reset demo data"
          variant="danger"
          icon="refresh"
          onPress={async () => {
            if (await confirm('Reset all demo data?', 'Every account, habit and order on this device will be replaced with fresh sample data.', 'Reset', true)) await resetDemoData();
          }}
        />
      </Card>
    </Screen>
  );
}
