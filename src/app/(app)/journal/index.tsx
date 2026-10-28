import { router } from 'expo-router';
import { Text } from 'react-native';

import { useQuery } from '@/hooks/useApi';
import { Button, Card, EmptyState, Loading, Screen } from '@/ui/components';
import { MOOD_FACES, space, type } from '@/ui/theme';

export default function Journal() {
  const { data, loading, reload } = useQuery((b, t) => b.content.journal(t));
  if (loading || !data) return <Loading />;
  return (
    <Screen onRefresh={reload}>
      <Button title="New entry" icon="create-outline" onPress={() => router.push('/journal/edit')} style={{ marginBottom: space.md }} />
      {data.length === 0 && <EmptyState icon="journal" title="Your journal is empty" body="Reflection turns streaks into self-knowledge." />}
      {data.map((j) => (
        <Card key={j.id} onPress={() => router.push({ pathname: '/journal/edit', params: { id: j.id } })}>
          <Text style={type.tiny}>{new Date(j.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}</Text>
          <Text style={[type.subtitle, { marginTop: 2 }]}>
            {j.mood ? `${MOOD_FACES[j.mood]} ` : ''}
            {j.title}
          </Text>
          <Text style={[type.small, { marginTop: 4 }]} numberOfLines={2}>
            {j.body}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
