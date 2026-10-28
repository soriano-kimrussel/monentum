// Habits, check-ins, goals, mood and journal. Every read is scoped to the caller and every
// write re-checks ownership (the equivalent of `request.auth.uid == resource.data.userId`).
import { addDays, toDayKey } from '../../domain/dates';
import { isPremium, limitsFor, type Subscription } from '../../domain/subscription';
import type { CheckIn, Goal, Habit, JournalEntry, MoodEntry, MoodScore, User, Weekday } from '../../domain/types';
import { randomId } from '../../lib/crypto';
import { ApiError, Core } from '../core';
import { goalInputSchema, habitInputSchema, journalInputSchema, moodInputSchema, parse } from '../schemas';
import { maybeRewardOnFirstCheckIn } from './referrals';

/** How far back a check-in may be back-filled. */
export const BACKFILL_DAYS = 7;

export async function premiumFor(core: Core, userId: string): Promise<boolean> {
  const sub = await core.store.get<Subscription>('subscriptions', userId);
  return !!sub && isPremium(sub, core.clock.now());
}

const byNewest = <T extends { createdAt: string }>(a: T, b: T) => (a.createdAt < b.createdAt ? 1 : -1);

export function contentApi(core: Core) {
  const today = () => toDayKey(new Date(core.clock.nowMs()));

  return {
    today,

    // ---------- habits ----------
    async habits(token: string) {
      const user = await core.authenticate(token);
      const habits = await core.store.list<Habit>('habits', { userId: user.id });
      return habits.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    },

    async checkIns(token: string) {
      const user = await core.authenticate(token);
      return core.store.list<CheckIn>('checkIns', { userId: user.id });
    },

    async createHabit(token: string, raw: unknown): Promise<Habit> {
      const input = parse(habitInputSchema, raw);
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        const active = (await core.store.list<Habit>('habits', { userId: user.id })).filter((h) => !h.archived);
        const limit = limitsFor(await premiumFor(core, user.id)).habits;
        if (active.length >= limit) throw new ApiError('limit_reached', `Your plan allows ${limit} active habits. Upgrade to Premium for more.`);
        const now = core.clock.now();
        const habit: Habit = {
          id: randomId('hab_'),
          userId: user.id,
          name: input.name,
          icon: input.icon,
          color: input.color,
          days: [...new Set(input.days)].sort() as Weekday[],
          reminderTime: input.reminderTime || undefined,
          archived: false,
          createdAt: now,
          updatedAt: now,
        };
        await core.writeSynced('habits', habit.id, habit);
        return habit;
      });
    },

    async updateHabit(token: string, id: string, raw: unknown): Promise<Habit> {
      const input = parse(habitInputSchema, raw);
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        const habit = await core.owned<Habit>('habits', id, user);
        const next: Habit = { ...habit, ...input, days: [...new Set(input.days)].sort() as Weekday[], reminderTime: input.reminderTime || undefined, updatedAt: core.clock.now() };
        await core.writeSynced('habits', id, next);
        return next;
      });
    },

    async setArchived(token: string, id: string, archived: boolean) {
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        const habit = await core.owned<Habit>('habits', id, user);
        if (!archived) {
          const active = (await core.store.list<Habit>('habits', { userId: user.id })).filter((h) => !h.archived);
          const limit = limitsFor(await premiumFor(core, user.id)).habits;
          if (active.length >= limit) throw new ApiError('limit_reached', `Your plan allows ${limit} active habits.`);
        }
        await core.writeSynced('habits', id, { ...habit, archived, updatedAt: core.clock.now() });
      });
    },

    async deleteHabit(token: string, id: string) {
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        await core.owned<Habit>('habits', id, user);
        for (const c of await core.store.list<CheckIn>('checkIns', { habitId: id })) await core.deleteSynced('checkIns', c.id);
        await core.deleteSynced('habits', id);
      });
    },

    /** Toggle completion for a day. Future days and days older than the back-fill window are rejected. */
    async toggleCheckIn(token: string, habitId: string, day: string): Promise<boolean> {
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        const habit = await core.owned<Habit>('habits', habitId, user);
        if (habit.archived) throw new ApiError('archived', 'This habit is archived.');
        const t = today();
        if (day > t) throw new ApiError('future_day', 'You can’t check in for a future day.');
        if (day < addDays(t, -BACKFILL_DAYS)) throw new ApiError('too_old', `Check-ins can be back-filled up to ${BACKFILL_DAYS} days.`);
        // Deterministic id makes "one check-in per habit per day" a storage-level invariant.
        const id = `${habitId}_${day}`;
        const existing = await core.store.get<CheckIn>('checkIns', id);
        if (existing) {
          await core.deleteSynced('checkIns', id);
          return false;
        }
        const isFirst = (await core.store.list<CheckIn>('checkIns', { userId: user.id })).length === 0;
        await core.writeSynced('checkIns', id, { id, userId: user.id, habitId, day, createdAt: core.clock.now() } satisfies CheckIn);
        await core.track('checkin', { deviceId: user.deviceId });
        if (isFirst) await maybeRewardOnFirstCheckIn(core, user.id);
        return true;
      });
    },

    // ---------- goals ----------
    async goals(token: string) {
      const user = await core.authenticate(token);
      return (await core.store.list<Goal>('goals', { userId: user.id })).sort(byNewest);
    },

    async createGoal(token: string, raw: unknown): Promise<Goal> {
      const input = parse(goalInputSchema, raw);
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        const active = (await core.store.list<Goal>('goals', { userId: user.id })).filter((g) => g.status === 'active');
        const limit = limitsFor(await premiumFor(core, user.id)).goals;
        if (active.length >= limit) throw new ApiError('limit_reached', `Your plan allows ${limit} active goal${limit === 1 ? '' : 's'}. Upgrade to Premium for more.`);
        await assertOwnHabits(core, user, input.habitIds);
        const now = core.clock.now();
        const goal: Goal = {
          id: randomId('gol_'),
          userId: user.id,
          title: input.title,
          description: input.description,
          targetDate: input.targetDate || undefined,
          milestones: input.milestones.map((title) => ({ id: randomId('mil_'), title, done: false })),
          habitIds: input.habitIds,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        };
        await core.writeSynced('goals', goal.id, goal);
        return goal;
      });
    },

    async toggleMilestone(token: string, goalId: string, milestoneId: string): Promise<Goal> {
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        const goal = await core.owned<Goal>('goals', goalId, user);
        const now = core.clock.now();
        const milestones = goal.milestones.map((m) => (m.id === milestoneId ? { ...m, done: !m.done, doneAt: m.done ? undefined : now } : m));
        if (!milestones.some((m) => m.id === milestoneId)) throw new ApiError('not_found', 'Milestone not found.');
        const allDone = milestones.length > 0 && milestones.every((m) => m.done);
        const next: Goal = { ...goal, milestones, status: allDone ? 'completed' : goal.status === 'completed' ? 'active' : goal.status, updatedAt: now };
        await core.writeSynced('goals', goalId, next);
        return next;
      });
    },

    async addMilestone(token: string, goalId: string, title: string): Promise<Goal> {
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        const goal = await core.owned<Goal>('goals', goalId, user);
        const clean = title.trim().slice(0, 120);
        if (!clean) throw new ApiError('invalid_input', 'Milestone needs a title.');
        if (goal.milestones.length >= 50) throw new ApiError('limit_reached', 'Too many milestones.');
        const next: Goal = { ...goal, milestones: [...goal.milestones, { id: randomId('mil_'), title: clean, done: false }], status: 'active', updatedAt: core.clock.now() };
        await core.writeSynced('goals', goalId, next);
        return next;
      });
    },

    async deleteGoal(token: string, id: string) {
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        await core.owned<Goal>('goals', id, user);
        await core.deleteSynced('goals', id);
      });
    },

    // ---------- mood ----------
    async moods(token: string) {
      const user = await core.authenticate(token);
      return (await core.store.list<MoodEntry>('moods', { userId: user.id })).sort((a, b) => (a.day < b.day ? 1 : -1));
    },

    /** One mood entry per day; logging again updates today's entry. */
    async logMood(token: string, raw: unknown): Promise<MoodEntry> {
      const input = parse(moodInputSchema, raw);
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        const day = today();
        const id = `${user.id}_${day}`;
        const entry: MoodEntry = { id, userId: user.id, day, score: input.score as MoodScore, tags: input.tags, note: input.note, createdAt: core.clock.now() };
        await core.writeSynced('moods', id, entry);
        return entry;
      });
    },

    // ---------- journal ----------
    async journal(token: string) {
      const user = await core.authenticate(token);
      return (await core.store.list<JournalEntry>('journal', { userId: user.id })).sort(byNewest);
    },

    async saveJournal(token: string, raw: unknown, id?: string): Promise<JournalEntry> {
      const input = parse(journalInputSchema, raw);
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        const now = core.clock.now();
        const prev = id ? await core.owned<JournalEntry>('journal', id, user) : null;
        const entry: JournalEntry = {
          id: prev?.id ?? randomId('jrn_'),
          userId: user.id,
          title: input.title || input.body.slice(0, 40),
          body: input.body,
          prompt: input.prompt,
          mood: input.mood as MoodScore | undefined,
          createdAt: prev?.createdAt ?? now,
          updatedAt: now,
        };
        await core.writeSynced('journal', entry.id, entry);
        return entry;
      });
    },

    async deleteJournal(token: string, id: string) {
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        await core.owned<JournalEntry>('journal', id, user);
        await core.deleteSynced('journal', id);
      });
    },
  };
}

async function assertOwnHabits(core: Core, user: User, ids: string[]) {
  for (const id of ids) await core.owned<Habit>('habits', id, user);
}
