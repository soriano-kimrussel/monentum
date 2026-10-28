import { addDays, dayRange, parseDayKey, toDayKey } from './dates';
import { isScheduled } from './streaks';
import type { CheckIn, Habit, MoodEntry } from './types';

export interface DayStat {
  day: string;
  scheduled: number;
  done: number;
}

/** Per-day scheduled vs completed counts across active habits. */
export function dailyCompletion(habits: Habit[], checkIns: CheckIn[], today: string, days: number): DayStat[] {
  const doneByDay = new Map<string, Set<string>>();
  for (const c of checkIns) {
    if (!doneByDay.has(c.day)) doneByDay.set(c.day, new Set());
    doneByDay.get(c.day)!.add(c.habitId);
  }
  return dayRange(addDays(today, -(days - 1)), today).map((day) => {
    const live = habits.filter((h) => !h.archived && toDayKey(new Date(h.createdAt)) <= day && isScheduled(h, day));
    const done = doneByDay.get(day);
    return { day, scheduled: live.length, done: live.filter((h) => done?.has(h.id)).length };
  });
}

export function overallRate(stats: DayStat[]): number {
  const s = stats.reduce((a, d) => a + d.scheduled, 0);
  return s ? stats.reduce((a, d) => a + d.done, 0) / s : 0;
}

export interface WeekBar {
  label: string;
  rate: number;
}

/** Group daily stats into ISO-ish weeks for a compact bar chart. */
export function weeklyBars(stats: DayStat[]): WeekBar[] {
  const out: WeekBar[] = [];
  for (let i = 0; i < stats.length; i += 7) {
    const chunk = stats.slice(i, i + 7);
    const d = parseDayKey(chunk[0].day);
    out.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, rate: overallRate(chunk) });
  }
  return out;
}

export function moodSeries(moods: MoodEntry[], today: string, days: number): { day: string; score: number | null }[] {
  const byDay = new Map<string, number[]>();
  for (const m of moods) {
    if (!byDay.has(m.day)) byDay.set(m.day, []);
    byDay.get(m.day)!.push(m.score);
  }
  return dayRange(addDays(today, -(days - 1)), today).map((day) => {
    const xs = byDay.get(day);
    return { day, score: xs ? xs.reduce((a, b) => a + b, 0) / xs.length : null };
  });
}

/** Average completion rate on days with good (4-5) vs low (1-2) mood: the "mood correlation" insight. */
export function moodCorrelation(stats: DayStat[], moods: MoodEntry[]): { good: number | null; low: number | null } {
  const byDay = new Map(stats.map((s) => [s.day, s]));
  const bucket = (pred: (n: number) => boolean) => {
    const days = moods.filter((m) => pred(m.score)).map((m) => byDay.get(m.day)).filter((d): d is DayStat => !!d && d.scheduled > 0);
    return days.length ? overallRate(days) : null;
  };
  return { good: bucket((n) => n >= 4), low: bucket((n) => n <= 2) };
}

export function bestWeekday(stats: DayStat[]): { weekday: number; rate: number } | null {
  const agg = Array.from({ length: 7 }, () => ({ s: 0, d: 0 }));
  for (const s of stats) {
    const w = parseDayKey(s.day).getDay();
    agg[w].s += s.scheduled;
    agg[w].d += s.done;
  }
  let best: { weekday: number; rate: number } | null = null;
  agg.forEach((a, weekday) => {
    if (!a.s) return;
    const rate = a.d / a.s;
    if (!best || rate > best.rate) best = { weekday, rate };
  });
  return best;
}
