import { useState } from 'react';
import { Text, View } from 'react-native';

import { useQuery } from '@/hooks/useApi';
import { Card, Chip, Divider, Loading, Pill, Screen } from '@/ui/components';
import { space, type } from '@/ui/theme';

type Filter = 'all' | 'denied' | 'billing' | 'auth' | 'admin';

export default function AdminAudit() {
  const { data, loading, reload } = useQuery((b, t) => b.admin.audit(t));
  const [filter, setFilter] = useState<Filter>('all');
  if (loading || !data) return <Loading />;
  const rows = data.filter((e) => filter === 'all' || (filter === 'denied' ? e.outcome !== 'allowed' : e.action.startsWith(filter)));

  return (
    <Screen onRefresh={reload}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm }}>
        {(['all', 'denied', 'billing', 'auth', 'admin'] as Filter[]).map((f) => (
          <Chip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>
      <Card>
        {rows.length === 0 && <Text style={type.small}>No entries.</Text>}
        {rows.map((e, i) => (
          <View key={e.id}>
            {i > 0 && <Divider />}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[type.body, { fontWeight: '600', flex: 1 }]}>{e.action}</Text>
              <Pill tone={e.outcome === 'allowed' ? 'success' : 'danger'} label={e.outcome} />
            </View>
            <Text style={type.small}>
              {new Date(e.at).toLocaleString()} · actor {e.actorId ? e.actorId.slice(-6) : 'system'}
              {e.target ? ` · ${e.target}` : ''}
            </Text>
            {e.detail && <Text style={[type.small, { fontFamily: 'monospace' }]}>{JSON.stringify(e.detail)}</Text>}
          </View>
        ))}
      </Card>
    </Screen>
  );
}
