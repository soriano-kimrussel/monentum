import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { addDays } from '@/domain/dates';
import { bestWeekday, dailyCompletion, moodCorrelation, moodSeries, overallRate, weeklyBars } from '@/domain/insights';
import { useHabitData } from '@/hooks/useHabitData';
import { BarChart, Heatmap, LineChart } from '@/ui/charts';
import { Card, Loading, Pill, Screen, Segmented, Stat } from '@/ui/components';
import { colors, space, type } from '@/ui/theme';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
type Range = '7' | '30' | '90';

export default function Insights() {
  const { data, derived, loading, reload } = useHabitData();
  const [range, setRange] = useState<Range>('30');
  if (loading || !data || !derived) return <Loading />;

  const allowed = data.status.limits.analyticsDays;
  const days = Math.min(Number(range), allowed);
  const locked = Number(range) > allowed;
  const stats = dailyCompletion(data.habits, data.checkIns, data.today, days);
  const rate = overallRate(stats.filter((s) => s.day !== data.today));
  const best = bestWeekday(stats);
  const longest = Math.max(0, ...derived.withStats.map((x) => x.stats.longest));
  const mood = moodSeries(data.moods, data.today, days);
  const corr = moodCorrelation(stats, data.moods);
  const heat = dailyCompletion(data.habits, data.checkIns, data.today, 91).map((s) => ({ day: s.day, value: s.scheduled ? s.done / s.scheduled : null }));
  const totalCheckIns = data.checkIns.filter((c) => c.day >= addDays(data.today, -(days - 1))).length;

  return (
    <Screen onRefresh={reload}>
      <Segmented<Range>
        options={[
          { value: '7', label: '7 days' },
          { value: '30', label: '30 days' },
          { value: '90', label: '90 days' },
        ]}
        value={range}
        onChange={setRange}
      />
      {locked && (
        <Card style={{ backgroundColor: colors.primarySoft }} onPress={() => router.push('/premium')}>
          <Text style={type.subtitle}>Showing your last {allowed} days</Text>
          <Text style={type.small}>Premium unlocks 90-day history. Tap to try it free (simulated).</Text>
        </Card>
      )}

      <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        <Stat label="Completion" value={`${Math.round(rate * 100)}%`} tone={colors.success} />
        <Stat label="Check-ins" value={String(totalCheckIns)} />
        <Stat label="Best streak" value={`${longest}d`} tone={colors.warning} />
      </Card>

      <Card>
        <Text style={type.subtitle}>{days <= 7 ? 'Daily completion' : 'Weekly completion'}</Text>
        <BarChart
          data={
            days <= 7
              ? stats.map((s) => ({ label: WEEKDAYS[new Date(s.day + 'T12:00:00').getDay()].slice(0, 2), value: s.scheduled ? s.done / s.scheduled : 0 }))
              : weeklyBars(stats).map((w) => ({ label: w.label, value: w.rate }))
          }
          max={1}
          color={colors.success}
        />
      </Card>

      <Card>
        <Text style={[type.subtitle, { marginBottom: space.sm }]}>Last 13 weeks</Text>
        <Heatmap cells={heat} />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 }}>
          <Text style={type.small}>Less ░ ▒ ▓ █ More</Text>
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={type.subtitle}>Mood trend</Text>
          <Pill tone="sim" label={`${data.moods.length} entries`} />
        </View>
        {mood.some((m) => m.score !== null) ? <LineChart points={mood.map((m) => m.score)} /> : <Text style={type.small}>Log your mood on the Today tab to see trends.</Text>}
      </Card>

      <Card>
        <Text style={[type.subtitle, { marginBottom: space.sm }]}>What we noticed</Text>
        {best && <Text style={[type.body, { marginBottom: 8 }]}>📅 {WEEKDAYS[best.weekday]} is your strongest day ({Math.round(best.rate * 100)}% completion).</Text>}
        {corr.good !== null && corr.low !== null && (
          <Text style={[type.body, { marginBottom: 8 }]}>
            🙂 On good-mood days you complete {Math.round(corr.good * 100)}% of habits vs {Math.round(corr.low * 100)}% on low days.
          </Text>
        )}
        <Text style={type.small}>Insights are computed on your device from your own data.</Text>
      </Card>

      <Card>
        <Text style={type.subtitle}>By habit (30 days)</Text>
        <BarChart
          data={derived.withStats.filter((x) => !x.habit.archived).map((x) => ({ label: x.habit.name.slice(0, 8), value: x.stats.rate, color: x.habit.color }))}
          max={1}
        />
      </Card>
    </Screen>
  );
}
