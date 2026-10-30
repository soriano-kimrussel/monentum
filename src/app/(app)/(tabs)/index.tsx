import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { parseDayKey } from '@/domain/dates';
import { useAction, useQuery } from '@/hooks/useApi';
import { useHabitData } from '@/hooks/useHabitData';
import { useSession } from '@/stores/session';
import { Button, Card, Chip, EmptyState, ListRow, Loading, Pill, Screen, SectionTitle, type IconName } from '@/ui/components';
import { HabitRow } from '@/ui/HabitRow';
import { Landscape } from '@/ui/illustrations';
import { MOOD_COLORS, MOOD_FACES, colors, radius, shadow, space, type } from '@/ui/theme';

const MOOD_TAGS = ['work', 'sleep', 'exercise', 'family', 'social', 'stress', 'health'];

function greeting(hour: number) {
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

export default function Today() {
  const user = useSession((s) => s.user);
  const { data, derived, loading, reload } = useHabitData();
  const goals = useQuery((b, t) => b.content.goals(t));
  const { run, busy } = useAction();
  // null = untouched: show and keep the tags already logged today.
  const [tags, setTags] = useState<string[] | null>(null);

  if (loading || !data || !derived) return <Loading />;
  const { status, today, moods } = data;
  const todayMood = moods.find((m) => m.day === today);
  const activeTags = tags ?? todayMood?.tags ?? [];
  const due = derived.dueToday.length;
  const done = derived.doneToday;
  const progress = due ? done / due : 0;
  const nextUp = derived.dueToday.find((x) => !x.stats.doneToday)?.habit;
  const date = parseDayKey(today).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const activeGoal = goals.data?.find((g) => g.status === 'active');
  const goalDone = activeGoal ? activeGoal.milestones.filter((m) => m.done).length : 0;
  const bestStreak = Math.max(0, ...derived.withStats.filter((x) => !x.habit.archived).map((x) => x.stats.current));
  const avgRate = derived.active.length ? derived.withStats.filter((x) => !x.habit.archived).reduce((s, x) => s + x.stats.rate, 0) / derived.active.length : 0;
  const daysLeft = (iso?: string) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - new Date(status.now).getTime()) / 86_400_000)) : 0);

  return (
    <Screen onRefresh={reload} edges={['top']}>
      {/* Greeting header over a calm landscape */}
      <View style={{ minHeight: 150, marginBottom: space.md }}>
        <View style={{ position: 'absolute', right: -space.lg, top: 18 }}>
          <Landscape width={230} height={136} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flexShrink: 1 }}>
            <Text style={[type.small, { color: colors.muted, fontSize: 15 }]}>{greeting(new Date().getHours())}</Text>
            <Text style={[type.hero, { marginTop: 2 }]}>{user?.displayName.split(' ')[0]}</Text>
            <Text style={[type.small, { marginTop: 4 }]}>Small steps. Big dreams.</Text>
            <Text style={[type.tiny, { marginTop: space.md, color: colors.faint }]}>{date.toUpperCase()}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/me')}
            accessibilityRole="button"
            accessibilityLabel="Profile"
            style={[{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, shadow]}>
            <Ionicons name="person" size={20} color={colors.onPrimary} />
          </Pressable>
        </View>
      </View>

      {/* Today's focus */}
      <Pressable
        onPress={() => router.push('/habits')}
        accessibilityRole="button"
        accessibilityLabel={`Today: ${done} of ${due} habits done`}
        style={({ pressed }) => [{ backgroundColor: colors.primary, borderRadius: radius.xl, padding: space.lg, marginBottom: space.lg, opacity: pressed ? 0.92 : 1 }, shadow]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="radio-button-on" size={22} color={colors.onPrimaryMuted} />
          </View>
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Text style={{ color: colors.onPrimaryMuted, fontSize: 13 }}>Today’s focus</Text>
            <Text style={{ color: colors.onPrimary, fontSize: 17, fontWeight: '600', marginTop: 2 }} numberOfLines={1}>
              {due === 0 ? 'Nothing scheduled today' : nextUp ? nextUp.name : 'All done today. Great work!'}
            </Text>
            <Text style={{ color: colors.onPrimaryMuted, fontSize: 13, marginTop: 2 }}>
              {done} / {due} habits {due - done > 0 ? `· ${due - done} left today` : ''}
            </Text>
          </View>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.onPrimary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </View>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.primaryDark, marginTop: space.md, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(progress * 100)}%`, height: 6, borderRadius: 3, backgroundColor: colors.onPrimary }} />
        </View>
      </Pressable>

      {/* Shortcuts */}
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.sm }}>
        <Tile icon="book-outline" tint={colors.warning} bg={colors.tileSand} title="Habit Tracker" body="Build better daily habits" href="/habits" />
        <Tile icon="leaf-outline" tint={colors.success} bg={colors.tileMint} title="Mindful Moments" body="Take a breath, reflect" href="/journal/edit" />
        <Tile icon="flag-outline" tint={colors.sim} bg={colors.tileLavender} title="Goals" body="Plan your big wins" href="/goals" />
      </View>

      {status.sub.status === 'trialing' && (
        <Card onPress={() => router.push('/premium/manage')} style={{ backgroundColor: colors.simSoft, marginTop: space.sm }}>
          <Text style={type.subtitle}>Premium trial · {daysLeft(status.sub.trialEndsAt)} days left</Text>
          <Text style={type.small}>{status.sub.cancelAtPeriodEnd ? 'Trial will end without charge.' : 'Converts to a simulated paid plan when the trial ends.'}</Text>
        </Card>
      )}
      {status.sub.status === 'past_due' && (
        <Card onPress={() => router.push('/premium/manage')} style={{ backgroundColor: colors.warningSoft, marginTop: space.sm }}>
          <Text style={[type.subtitle, { color: colors.warning }]}>Payment failed (simulated)</Text>
          <Text style={type.small}>Update your demo card within {daysLeft(status.sub.graceEndsAt)} days to keep Premium.</Text>
        </Card>
      )}

      <SectionTitle title="Today’s habits" action="Add" onAction={() => router.push('/habit/new')} />
      {due === 0 ? (
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

      <SectionTitle title="Your progress" action="View all" onAction={() => router.push('/insights')} />
      <Card style={{ flexDirection: 'row', flexWrap: 'wrap', paddingVertical: space.sm }}>
        <ProgressStat icon="flame-outline" tint={colors.warning} bg={colors.tileSand} label="Best streak" value={`${bestStreak}`} unit="days" />
        <ProgressStat icon="water-outline" tint="#5B8BA6" bg={colors.tileSky} label="30-day rate" value={`${Math.round(avgRate * 100)}`} unit="%" />
        <ProgressStat icon="checkmark-done-outline" tint={colors.success} bg={colors.tileMint} label="Done today" value={`${done}`} unit={`/ ${due}`} />
        <ProgressStat icon={activeGoal ? 'flag-outline' : 'happy-outline'} tint={colors.sim} bg={colors.tileLavender} label={activeGoal ? 'Goal' : 'Mood today'} value={activeGoal ? `${goalDone}` : todayMood ? MOOD_FACES[todayMood.score] : '–'} unit={activeGoal ? `/ ${activeGoal.milestones.length}` : ''} />
      </Card>

      <SectionTitle title="How are you feeling?" />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {[1, 2, 3, 4, 5].map((score) => {
            const selected = todayMood?.score === score;
            return (
              <Pressable
                key={score}
                onPress={() => run('mood', (b, t) => b.content.logMood(t, { score, tags: activeTags, note: todayMood?.note ?? '' }))}
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
            <Chip key={t} label={t} selected={activeTags.includes(t)} onPress={() => setTags(activeTags.includes(t) ? activeTags.filter((x) => x !== t) : [...activeTags, t])} />
          ))}
        </View>
        <Text style={type.small}>{todayMood ? `Logged today: ${MOOD_FACES[todayMood.score]}  Tap a face to update.` : 'Tap a face to log today’s mood.'}</Text>
      </Card>

      {activeGoal && (
        <Card>
          <ListRow
            icon="flag"
            title={activeGoal.title}
            subtitle={`${goalDone}/${activeGoal.milestones.length} milestones${activeGoal.targetDate ? ` · by ${activeGoal.targetDate}` : ''}`}
            onPress={() => router.push(`/goals/${activeGoal.id}`)}
          />
        </Card>
      )}
      {!status.premium && (
        <Card>
          <ListRow icon="sparkles" tint={colors.warning} title="Try Premium free for 7 days" subtitle="Simulated trial, no payment" onPress={() => router.push('/premium')} right={<Pill tone="sim" label="DEMO" />} />
        </Card>
      )}
      {!activeGoal && <Button title="Set a goal" variant="ghost" icon="flag" onPress={() => router.push('/goals/new')} />}
    </Screen>
  );
}

function Tile({ icon, tint, bg, title, body, href }: { icon: IconName; tint: string; bg: string; title: string; body: string; href: Href }) {
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({ flex: 1, backgroundColor: bg, borderRadius: radius.lg, padding: space.md, minHeight: 128, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginTop: space.sm }} numberOfLines={2}>
        {title}
      </Text>
      <Text style={{ fontSize: 11.5, color: colors.muted, marginTop: 2 }} numberOfLines={2}>
        {body}
      </Text>
      <Ionicons name="arrow-forward" size={15} color={colors.text} style={{ marginTop: 'auto', paddingTop: space.sm }} />
    </Pressable>
  );
}

function ProgressStat({ icon, tint, bg, label, value, unit }: { icon: IconName; tint: string; bg: string; label: string; value: string; unit: string }) {
  return (
    <View style={{ width: '50%', flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={{ marginLeft: space.sm }}>
        <Text style={type.small}>{label}</Text>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>
          {value}
          <Text style={{ fontSize: 12, fontWeight: '500', color: colors.muted }}> {unit}</Text>
        </Text>
      </View>
    </View>
  );
}
