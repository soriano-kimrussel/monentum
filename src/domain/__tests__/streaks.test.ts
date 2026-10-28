import { addDays, dayRange, isValidDayKey } from '../dates';
import { computeStreak } from '../streaks';
import type { Weekday } from '../types';

const DAILY: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const habit = (days: Weekday[] = DAILY, createdAt = '2026-01-01T08:00:00.000Z') => ({ days, createdAt });
const ins = (...days: string[]) => days.map((day) => ({ day }));

describe('dates', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(dayRange('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
  });

  it('validates day keys strictly', () => {
    expect(isValidDayKey('2026-02-28')).toBe(true);
    expect(isValidDayKey('2026-02-30')).toBe(false);
    expect(isValidDayKey('2026-2-3')).toBe(false);
  });
});

describe('computeStreak', () => {
  const today = '2026-03-10'; // a Tuesday

  it('counts consecutive completed days including today', () => {
    const s = computeStreak(habit(), ins('2026-03-08', '2026-03-09', '2026-03-10'), today);
    expect(s.current).toBe(3);
    expect(s.doneToday).toBe(true);
  });

  it('keeps the streak alive when today is not done yet', () => {
    const s = computeStreak(habit(), ins('2026-03-08', '2026-03-09'), today);
    expect(s.current).toBe(2);
    expect(s.doneToday).toBe(false);
  });

  it('breaks on a missed scheduled day', () => {
    const s = computeStreak(habit(), ins('2026-03-06', '2026-03-07', '2026-03-09', '2026-03-10'), today);
    expect(s.current).toBe(2);
    expect(s.longest).toBe(2);
  });

  it('ignores unscheduled days for weekday-only habits', () => {
    // Mon-Fri habit; the weekend of Mar 7-8 is unscheduled.
    const weekdays: Weekday[] = [1, 2, 3, 4, 5];
    const s = computeStreak(habit(weekdays), ins('2026-03-05', '2026-03-06', '2026-03-09', '2026-03-10'), today);
    expect(s.current).toBe(4);
  });

  it('tracks the longest historical streak', () => {
    const run = dayRange('2026-02-01', '2026-02-10');
    const s = computeStreak(habit(), ins(...run, '2026-03-10'), today);
    expect(s.longest).toBe(10);
    expect(s.current).toBe(1);
  });

  it('computes completion rate only over finished scheduled days since creation', () => {
    const s = computeStreak(habit(DAILY, '2026-03-06T08:00:00.000Z'), ins('2026-03-06', '2026-03-08'), today);
    // Mar 6..9 are finished (4 days), 2 done; today (not done) excluded.
    expect(s.rate).toBeCloseTo(0.5);
  });

  it('returns zeros for a habit with no scheduled days', () => {
    expect(computeStreak(habit([]), [], today)).toMatchObject({ current: 0, longest: 0, rate: 0 });
  });
});
