import { Switch, Text, View } from 'react-native';

import { notify, useAction, useQuery } from '@/hooks/useApi';
import { Button, Card, Chip, Screen, SectionTitle, SimBanner, Stat } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

export default function Sync() {
  const { data } = useQuery((b, t) => b.sync.status(t));
  const { run, busy } = useAction();
  if (!data) return null;

  return (
    <Screen>
      <SimBanner text="Simulated cloud. The “cloud” is a separate area of the on-device database. No server or network is used." />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={type.subtitle}>{data.online ? 'Online' : 'Offline'} (simulated)</Text>
            <Text style={type.small}>Toggle to see writes queue up offline.</Text>
          </View>
          <Switch value={data.online} onValueChange={(online) => run('online', (b, t) => b.sync.setOptions(t, { online }))} trackColor={{ true: colors.success }} accessibilityLabel="Simulated network online" />
        </View>
      </Card>
      <Card style={{ flexDirection: 'row' }}>
        <Stat label="Pending" value={String(data.pending)} tone={data.pending ? colors.warning : colors.success} />
        <Stat label="Pushed" value={String(data.pushed)} />
        <Stat label="Pulled" value={String(data.pulled)} />
        <Stat label="Conflicts" value={String(data.conflicts)} />
      </Card>
      <Text style={[type.small, { marginBottom: space.md }]}>
        Last sync: {data.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString() : 'never'}
        {data.lastError ? ` · last error: ${data.lastError}` : ''}
      </Text>
      <Button
        title="Sync now"
        icon="sync"
        loading={busy === 'sync'}
        onPress={async () => {
          const r = await run('sync', (b, t) => b.sync.run(t));
          if (r) notify('Sync complete', `Pushed ${r.pushed}, pulled ${r.pulled}, conflicts ${r.conflicts}.`);
        }}
      />

      <SectionTitle title="Failure injection" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {[0, 0.3, 0.7, 1].map((r) => (
          <Chip key={r} label={r === 0 ? 'Reliable' : `${r * 100}% fail`} selected={data.failureRate === r} onPress={() => run('rate', (b, t) => b.sync.setOptions(t, { failureRate: r }))} />
        ))}
      </View>
      <Text style={type.small}>Failed syncs keep the queue intact so nothing is lost.</Text>

      <SectionTitle title="Multi-device demo" />
      <Card>
        <Text style={type.small}>Pretend you renamed a habit on your tablet. The next sync pulls the newer version (last write wins).</Text>
        <Button
          title="Simulate edit on another device"
          variant="secondary"
          style={{ marginTop: space.md }}
          loading={busy === 'remote'}
          onPress={async () => {
            const name = await run('remote', (b, t) => b.sync.simulateRemoteEdit(t));
            if (name) notify('Edited in the cloud', `Renamed to “${name}”. Tap Sync now to pull it.`);
          }}
        />
      </Card>
    </Screen>
  );
}
