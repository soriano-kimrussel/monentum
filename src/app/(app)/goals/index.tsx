import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { useQuery } from '@/hooks/useApi';
import { Ring } from '@/ui/charts';
import { Button, Card, EmptyState, Loading, Pill, Screen } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

export default function Goals() {
  const { data, loading, reload } = useQuery((b, t) => b.content.goals(t));
  if (loading || !data) return <Loading />;
  return (
    <Screen onRefresh={reload}>
      <Button title="New goal" icon="add" onPress={() => router.push('/goals/new')} />
      <View style={{ height: space.md }} />
      {data.length === 0 && <EmptyState icon="flag" title="No goals yet" body="Break a big ambition into milestones and link the habits that get you there." />}
      {data.map((g) => {
        const done = g.milestones.filter((m) => m.done).length;
        return (
          <Card key={g.id} onPress={() => router.push(`/goals/${g.id}`)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ring value={g.milestones.length ? done / g.milestones.length : 0} size={56} stroke={6} color={g.status === 'completed' ? colors.success : colors.primary} />
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={type.subtitle}>{g.title}</Text>
              <Text style={type.small}>
                {done}/{g.milestones.length} milestones{g.targetDate ? ` · target ${g.targetDate}` : ''}
              </Text>
            </View>
            {g.status === 'completed' && <Pill tone="success" label="Done" />}
          </Card>
        );
      })}
    </Screen>
  );
}
