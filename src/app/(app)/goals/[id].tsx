import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { confirm, useAction, useQuery } from '@/hooks/useApi';
import { Ring } from '@/ui/charts';
import { Button, Card, Chip, ErrorText, Loading, Pill, Screen, SectionTitle, TextField } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { run, busy } = useAction();
  const [title, setTitle] = useState('');
  const { data, loading } = useQuery(
    async (b, t) => {
      const [goals, habits] = await Promise.all([b.content.goals(t), b.content.habits(t)]);
      return { goal: goals.find((g) => g.id === id), habits };
    },
    [id],
  );
  if (loading) return <Loading />;
  const goal = data?.goal;
  if (!goal) return <Screen><ErrorText error="Goal not found." /></Screen>;
  const done = goal.milestones.filter((m) => m.done).length;

  return (
    <Screen>
      <Card style={{ alignItems: 'center' }}>
        <Ring value={goal.milestones.length ? done / goal.milestones.length : 0} size={96} stroke={9} color={goal.status === 'completed' ? colors.success : colors.primary} />
        <Text style={[type.title, { marginTop: space.md, textAlign: 'center' }]}>{goal.title}</Text>
        {!!goal.description && <Text style={[type.small, { textAlign: 'center', marginTop: 4 }]}>{goal.description}</Text>}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: space.sm }}>
          {goal.targetDate && <Pill label={`Target ${goal.targetDate}`} />}
          {goal.status === 'completed' && <Pill tone="success" label="Completed 🎉" />}
        </View>
      </Card>

      <SectionTitle title="Milestones" />
      <Card>
        {goal.milestones.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => run(m.id, (b, t) => b.content.toggleMilestone(t, goal.id, m.id))}
            disabled={busy === m.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: m.done }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
            <Ionicons name={m.done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={m.done ? colors.success : colors.faint} />
            <Text style={[type.body, { marginLeft: 10, flex: 1, textDecorationLine: m.done ? 'line-through' : 'none', color: m.done ? colors.muted : colors.text }]}>{m.title}</Text>
          </Pressable>
        ))}
        <TextField
          placeholder="Add milestone…"
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={async () => {
            if (!title.trim()) return;
            await run('add', (b, t) => b.content.addMilestone(t, goal.id, title));
            setTitle('');
          }}
        />
      </Card>

      {goal.habitIds.length > 0 && (
        <>
          <SectionTitle title="Supporting habits" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {goal.habitIds.map((hid) => {
              const h = data?.habits.find((x) => x.id === hid);
              return h ? <Chip key={hid} label={h.name} color={h.color} selected onPress={() => router.push(`/habit/${h.id}`)} /> : null;
            })}
          </View>
        </>
      )}

      <Button
        title="Delete goal"
        variant="danger"
        icon="trash-outline"
        style={{ marginTop: space.lg }}
        onPress={async () => {
          if (!(await confirm('Delete goal?', 'This can’t be undone.', 'Delete', true))) return;
          if (await run('del', (b, t) => b.content.deleteGoal(t, goal.id).then(() => true))) router.back();
        }}
      />
    </Screen>
  );
}
