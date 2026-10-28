import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { parseDayKey } from '@/domain/dates';
import { useAction, useQuery } from '@/hooks/useApi';
import { useHabitData } from '@/hooks/useHabitData';
import { useSession } from '@/stores/session';
import { Ring } from '@/ui/charts';
import { Button, Card, Chip, EmptyState, ListRow, Loading, Pill, Screen, SectionTitle } from '@/ui/components';
import { HabitRow } from '@/ui/HabitRow';
import { MOOD_COLORS, MOOD_FACES, colors, space, type } from '@/ui/theme';

const MOOD_TAGS = ['work', 'sleep', 'exercise', 'family', 'social', 'stress', 'health'];

export default function Today() {
  const user = useSession((s) => s.user);
  const { data, derived, loading, reload } = useHabitData();
  const goals = useQuery((b, t) => b.content.goals(t));
  const { run, busy } = useAction();
  const [tags, setTags] = useState<string[]>([]);

  if (loading || !data || !derived) return <Loading />;
  const { status, today, moods } = data;
  const todayMood = moods.find((m) => m.day === today);
  const progress = derived.dueToday.length ? derived.doneToday / derived.dueToday.length : 0;
  const date = parseDayKey(today).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const activeGoal = goals.data?.find((g) => g.status === 'active');
  const daysLeft = (iso?: string) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - new Date(status.now).getTime()) / 86_400_000)) : 0);

  return (
    <Screen onRefresh={reload}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#D9D3FF', fontSize: 13 }}>{date}</Text>
          <Text style={[type.title, { color: '#fff', marginTop: 2 }]}>Hi {user?.displayName.split(' ')[0]} 👋</Text>
          <Text style={{ color: '#E8E4FF', marginTop: 6 }}>
            {derived.dueToday.length === 0
              ? 'Nothing scheduled today.'
              : derived.doneToday === derived.dueToday.length
                ? 'All done today. Great work!'
                : `${derived.dueToday.length - derived.doneToday} habit${derived.dueToday.length - derived.doneToday === 1 ? '' : 's'} left today`}
          </Text>
        </View>
        <View style={{ backgroundColor: '#fff', borderRadius: 40, padding: 4 }}>
          <Ring value={progress} size={70} />
        </View>
      </Card>

      {status.sub.status === 'trialing' && (
        <Card onPress={() => router.push('/premium/manage')} style={{ backgroundColor: colors.simSoft }}>
          <Text style={type.subtitle}>Premium trial · {daysLeft(status.sub.trialEndsAt)} days left</Text>
          <Text style={type.small}>{status.sub.cancelAtPeriodEnd ? 'Trial will end without charge.' : 'Converts to a simulated paid plan when the trial ends.'}</Text>
        </Card>
      )}
      {status.sub.status === 'past_due' && (
        <Card onPress={() => router.push('/premium/manage')} style={{ backgroundColor: colors.warningSoft }}>
          <Text style={[type.subtitle, { color: colors.warning }]}>Payment failed (simulated)</Text>
          <Text style={type.small}>Update your demo card within {daysLeft(status.sub.graceEndsAt)} days to keep Premium.</Text>
        </Card>
      )}

      <SectionTitle title="Today’s habits" action="Add" onAction={() => router.push('/habit/new')} />
      {derived.dueToday.length === 0 ? (
        <EmptyState icon="leaf" title="No habits due today" body="Create a habit to start building momentum." action="Create habit" onAction={() => router.push('/habit/new')} />
      ) : (
        derived.dueToday.map(({ habit, stats }) => (
          <HabitRow
            key={habit.id}
            habit={habit}
            stats={stats}
            busy={busy === habit.id}
            onPress={() => router.push(`/habit/${habit.id}`)}
            onToggle={() => run(habit.id, (b, t) => b.content.toggleCheckIn(t, habit.id, today))}
          />
        ))
      )}

      <SectionTitle title="How are you feeling?" />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {[1, 2, 3, 4, 5].map((score) => {
            const selected = todayMood?.score === score;
            return (
              <Pressable
                key={score}
                onPress={() => run('mood', (b, t) => b.content.logMood(t, { score, tags, note: todayMood?.note ?? '' }))}
                accessibilityRole="button"
                accessibilityLabel={`Mood ${score} of 5`}
                accessibilityState={{ selected }}
                style={{ width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? MOOD_COLORS[score] + '33' : colors.bg, borderWidth: 2, borderColor: selected ? MOOD_COLORS[score] : 'transparent' }}>
                <Text style={{ fontSize: 26 }}>{MOOD_FACES[score]}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md }}>
          {MOOD_TAGS.map((t) => (
            <Chip key={t} label={t} selected={tags.includes(t) || (!!todayMood?.tags.includes(t) && tags.length === 0)} onPress={() => setTags((xs) => (xs.includes(t) ? xs.filter((x) => x !== t) : [...xs, t]))} />
          ))}
        </View>
        <Text style={type.small}>{todayMood ? `Logged today: ${MOOD_FACES[todayMood.score]}  Tap a face to update.` : 'Tap a face to log today’s mood.'}</Text>
      </Card>

      <SectionTitle title="Keep going" />
      <Card>
        {activeGoal && (
          <ListRow
            icon="flag"
            title={activeGoal.title}
            subtitle={`${activeGoal.milestones.filter((m) => m.done).length}/${activeGoal.milestones.length} milestones${activeGoal.targetDate ? ` · by ${activeGoal.targetDate}` : ''}`}
            onPress={() => router.push(`/goals/${activeGoal.id}`)}
          />
        )}
        <ListRow icon="journal" tint={colors.sim} title="Write in your journal" subtitle="A two-minute reflection" onPress={() => router.push('/journal/edit')} />
        {!status.premium && <ListRow icon="sparkles" tint={colors.warning} title="Try Premium free for 7 days" subtitle="Simulated trial, no payment" onPress={() => router.push('/premium')} right={<Pill tone="sim" label="DEMO" />} />}
      </Card>
      {!activeGoal && <Button title="Set a goal" variant="ghost" icon="flag" onPress={() => router.push('/goals/new')} />}
    </Screen>
  );
}
