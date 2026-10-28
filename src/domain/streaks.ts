import { addDays, dayRange, weekdayOf } from './dates';
import type { CheckIn, Habit } from './types';

export interface StreakSummary {
  current: number;
  longest: number;
  /** Completion rate over scheduled days in the window, 0..1. */
  rate: number;
  doneToday: boolean;
}

export function isScheduled(habit: Pick<Habit, 'days'>, day: string): boolean {
  return habit.days.includes(weekdayOf(day) as Habit['days'][number]);
}

/**
 * Streaks count consecutive *scheduled* days that were completed.
 * Unscheduled days neither extend nor break a streak.
 * If today is scheduled but not yet done, the streak is still alive (counted up to yesterday).
 */
export function computeStreak(
  habit: Pick<Habit, 'days' | 'createdAt'>,
  checkIns: Pick<CheckIn, 'day'>[],
  today: string,
  windowDays = 30,
): StreakSummary {
  const done = new Set(checkIns.map((c) => c.day));
  const doneToday = done.has(today);
  if (habit.days.length === 0) return { current: 0, longest: 0, rate: 0, doneToday };

  const created = habit.createdAt.slice(0, 10);
  const earliestCheckIn = checkIns.reduce((min, c) => (c.day < min ? c.day : min), today);
  const start = created < earliestCheckIn ? created : earliestCheckIn;

  // Current streak: walk back from today (or yesterday if today is still open).
  let current = 0;
  let cursor = doneToday || !isScheduled(habit, today) ? today : addDays(today, -1);
  while (cursor >= start) {
    if (isScheduled(habit, cursor)) {
      if (!done.has(cursor)) break;
      current++;
    }
    cursor = addDays(cursor, -1);
  }

  // Longest streak across full history.
  let longest = 0;
  let run = 0;
  for (const day of dayRange(start, today)) {
    if (!isScheduled(habit, day)) continue;
    if (done.has(day)) {
      run++;
      longest = Math.max(longest, run);
    } else if (day !== today) {
      run = 0;
    }
  }

  // Rate over the trailing window, only counting days since the habit existed.
  const windowStart = addDays(today, -(windowDays - 1));
  const from = windowStart > created ? windowStart : created;
  let scheduled = 0;
  let completed = 0;
  for (const day of dayRange(from, today)) {
    if (!isScheduled(habit, day)) continue;
    if (day === today && !doneToday) continue; // today not yet over
    scheduled++;
    if (done.has(day)) completed++;
  }

  return { current, longest, rate: scheduled ? completed / scheduled : 0, doneToday };
}
