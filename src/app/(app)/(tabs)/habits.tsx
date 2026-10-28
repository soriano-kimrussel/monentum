import { router } from 'expo-router';
import { Text } from 'react-native';

import { useHabitData } from '@/hooks/useHabitData';
import { Button, Card, EmptyState, Loading, Screen, SectionTitle } from '@/ui/components';
import { HabitRow } from '@/ui/HabitRow';
import { colors, type } from '@/ui/theme';

export default function Habits() {
  const { data, derived, loading, reload } = useHabitData();
  if (loading || !data || !derived) return <Loading />;
  const active = derived.withStats.filter((x) => !x.habit.archived);
  const archived = derived.withStats.filter((x) => x.habit.archived);
  const limit = data.status.limits.habits;

  return (
    <Screen onRefresh={reload}>
      <Button title="New habit" icon="add" onPress={() => router.push('/habit/new')} disabled={active.length >= limit} />
      {!data.status.premium && (
        <Card style={{ marginTop: 12, backgroundColor: colors.primarySoft }} onPress={() => router.push('/premium')}>
          <Text style={type.subtitle}>
            {active.length}/{limit} habits on the Free plan
          </Text>
          <Text style={type.small}>Premium unlocks up to 50 habits and 90-day insights. Tap to see plans.</Text>
        </Card>
      )}
      <SectionTitle title={`Active (${active.length})`} />
      {active.length === 0 ? (
        <EmptyState icon="checkmark-done-circle" title="No habits yet" body="Start small: one habit you can do in two minutes." />
      ) : (
        active.map(({ habit, stats }) => <HabitRow key={habit.id} habit={habit} stats={stats} onPress={() => router.push(`/habit/${habit.id}`)} />)
      )}
      {archived.length > 0 && (
        <>
          <SectionTitle title={`Archived (${archived.length})`} />
          {archived.map(({ habit, stats }) => (
            <HabitRow key={habit.id} habit={habit} stats={stats} onPress={() => router.push(`/habit/${habit.id}`)} />
          ))}
        </>
      )}
    </Screen>
  );
}
