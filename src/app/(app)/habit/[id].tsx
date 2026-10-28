import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { BACKFILL_DAYS } from '@/backend/modules/content';
import { addDays, parseDayKey } from '@/domain/dates';
import { computeStreak, isScheduled } from '@/domain/streaks';
import { confirm, notify, useAction, useQuery } from '@/hooks/useApi';
import { api } from '@/services/app';
import { syncReminders } from '@/services/notifications';
import { useSession } from '@/stores/session';
import { Button, Card, ErrorText, Loading, Screen, SectionTitle, Stat } from '@/ui/components';
import { HabitForm } from '@/ui/HabitForm';
import { colors, space, type } from '@/ui/theme';

export default function HabitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { run, busy } = useAction();
  const [editing, setEditing] = useState(false);
  const { data, error, loading } = useQuery(
    async (b, t) => {
      const [habits, checkIns] = await Promise.all([b.content.habits(t), b.content.checkIns(t)]);
      return { habit: habits.find((h) => h.id === id), checkIns: checkIns.filter((c) => c.habitId === id), today: b.content.today() };
    },
    [id],
  );

  if (loading) return <Loading />;
  if (error || !data?.habit) return <Screen><ErrorText error={error ?? 'Habit not found.'} /></Screen>;
  const { habit, checkIns, today } = data;
  const stats = computeStreak(habit, checkIns, today);
  const done = new Set(checkIns.map((c) => c.day));
  const recent = Array.from({ length: BACKFILL_DAYS + 1 }, (_, i) => addDays(today, -BACKFILL_DAYS + i));

  const refreshReminders = async () => {
    const token = useSession.getState().token!;
    await syncReminders(await api().content.habits(token)).catch(() => undefined);
  };

  if (editing) {
    return (
      <Screen>
        <HabitForm
          initial={{ ...habit, reminderTime: habit.reminderTime ?? '' }}
          submitLabel="Save changes"
          onSubmit={async (values) => {
            const ok = await run('save', (b, t) => b.content.updateHabit(t, habit.id, values));
            if (ok) {
              await refreshReminders();
              setEditing(false);
            }
          }}
        />
        <Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} style={{ marginTop: space.sm }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Text style={type.title}>{habit.name}</Text>
        <Text style={type.small}>
          {habit.days.length === 7 ? 'Every day' : habit.days.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}
          {habit.reminderTime ? ` · reminder ${habit.reminderTime}` : ''}
          {habit.archived ? ' · archived' : ''}
        </Text>
        <View style={{ flexDirection: 'row', marginTop: space.lg }}>
          <Stat label="Current" value={`${stats.current}🔥`} />
          <Stat label="Longest" value={String(stats.longest)} />
          <Stat label="30-day rate" value={`${Math.round(stats.rate * 100)}%`} tone={colors.success} />
        </View>
      </Card>

      <SectionTitle title="Last 8 days" />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {recent.map((day) => {
            const on = done.has(day);
            const scheduled = isScheduled(habit, day);
            return (
              <Pressable
                key={day}
                disabled={habit.archived || busy === day}
                onPress={() => run(day, (b, t) => b.content.toggleCheckIn(t, habit.id, day))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${day}${scheduled ? '' : ' (not scheduled)'}`}
                style={{ alignItems: 'center' }}>
                <Text style={[type.tiny, { marginBottom: 4 }]}>{parseDayKey(day).toLocaleDateString(undefined, { weekday: 'narrow' })}</Text>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: on ? habit.color : scheduled ? colors.bg : 'transparent', borderWidth: 1, borderColor: on ? habit.color : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: on ? '#fff' : colors.muted, fontWeight: '700', fontSize: 12 }}>{parseDayKey(day).getDate()}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={[type.small, { marginTop: space.md }]}>Tap a day to fix a missed check-in (up to {BACKFILL_DAYS} days back).</Text>
      </Card>

      <Button title="Edit habit" icon="create-outline" variant="secondary" onPress={() => setEditing(true)} style={{ marginTop: space.sm }} />
      <Button
        title={habit.archived ? 'Restore habit' : 'Archive habit'}
        icon="archive-outline"
        variant="ghost"
        style={{ marginTop: space.sm }}
        loading={busy === 'archive'}
        onPress={async () => {
          await run('archive', (b, t) => b.content.setArchived(t, habit.id, !habit.archived));
          await refreshReminders();
        }}
      />
      <Button
        title="Delete habit"
        icon="trash-outline"
        variant="danger"
        style={{ marginTop: space.sm }}
        onPress={async () => {
          if (!(await confirm('Delete habit?', `This removes “${habit.name}” and all ${checkIns.length} check-ins. Consider archiving instead.`, 'Delete', true))) return;
          const ok = await run('delete', (b, t) => b.content.deleteHabit(t, habit.id).then(() => true));
          if (ok) {
            await refreshReminders();
            router.back();
            notify('Habit deleted');
          }
        }}
      />
    </Screen>
  );
}
