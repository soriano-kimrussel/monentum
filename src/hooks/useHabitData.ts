import { useMemo } from 'react';

import { computeStreak, isScheduled } from '../domain/streaks';
import { useQuery } from './useApi';

/** Habits, check-ins and subscription status in one fetch, with streaks precomputed. */
export function useHabitData() {
  const q = useQuery(async (b, token) => {
    const [habits, checkIns, status, moods] = await Promise.all([b.content.habits(token), b.content.checkIns(token), b.billing.status(token), b.content.moods(token)]);
    return { habits, checkIns, status, moods, today: b.content.today() };
  });

  const derived = useMemo(() => {
    if (!q.data) return null;
    const { habits, checkIns, today } = q.data;
    const byHabit = new Map<string, typeof checkIns>();
    for (const c of checkIns) {
      if (!byHabit.has(c.habitId)) byHabit.set(c.habitId, []);
      byHabit.get(c.habitId)!.push(c);
    }
    const active = habits.filter((h) => !h.archived);
    const withStats = habits.map((h) => ({ habit: h, stats: computeStreak(h, byHabit.get(h.id) ?? [], today) }));
    const dueToday = withStats.filter((x) => !x.habit.archived && isScheduled(x.habit, today));
    return { active, withStats, dueToday, doneToday: dueToday.filter((x) => x.stats.doneToday).length };
  }, [q.data]);

  return { ...q, derived };
}
