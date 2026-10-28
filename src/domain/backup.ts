// Local JSON export / import. This is a user-initiated file export, NOT an automated cloud backup.
import { z } from 'zod';

import { isValidDayKey } from './dates';
import type { CheckIn, Goal, Habit, JournalEntry, MoodEntry } from './types';

export const BACKUP_FORMAT = 'momentum-backup';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const MAX_ITEMS = 20_000;

const id = z.string().min(1).max(64);
const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid timestamp');
const dayKey = z.string().refine(isValidDayKey, 'invalid day');
const text = (max: number) => z.string().max(max);
const weekday = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]);
const mood = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

const habitSchema = z.object({
  id,
  userId: id,
  name: text(80).min(1),
  icon: text(32),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  days: z.array(weekday).max(7),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  archived: z.boolean(),
  createdAt: iso,
  updatedAt: iso,
});

const checkInSchema = z.object({ id, userId: id, habitId: id, day: dayKey, createdAt: iso });

const goalSchema = z.object({
  id,
  userId: id,
  title: text(120).min(1),
  description: text(2000),
  targetDate: dayKey.optional(),
  milestones: z.array(z.object({ id, title: text(120).min(1), done: z.boolean(), doneAt: iso.optional() })).max(50),
  habitIds: z.array(id).max(50),
  status: z.enum(['active', 'completed', 'archived']),
  createdAt: iso,
  updatedAt: iso,
});

const moodSchema = z.object({ id, userId: id, day: dayKey, score: mood, tags: z.array(text(24)).max(10), note: text(1000), createdAt: iso });

const journalSchema = z.object({
  id,
  userId: id,
  title: text(120),
  body: text(20_000),
  prompt: text(300).optional(),
  mood: mood.optional(),
  createdAt: iso,
  updatedAt: iso,
});

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: iso,
  userId: id,
  data: z.object({
    habits: z.array(habitSchema).max(MAX_ITEMS),
    checkIns: z.array(checkInSchema).max(MAX_ITEMS),
    goals: z.array(goalSchema).max(MAX_ITEMS),
    moods: z.array(moodSchema).max(MAX_ITEMS),
    journal: z.array(journalSchema).max(MAX_ITEMS),
  }),
});

export interface BackupData {
  habits: Habit[];
  checkIns: CheckIn[];
  goals: Goal[];
  moods: MoodEntry[];
  journal: JournalEntry[];
}

export type BackupFile = z.infer<typeof backupSchema>;

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; error: string };

export function parseBackup(raw: string): ParseResult {
  if (raw.length > MAX_BACKUP_BYTES) return { ok: false, error: 'File is larger than 5 MB.' };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  const result = backupSchema.safeParse(json);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, error: `Invalid backup at "${first.path.join('.') || 'root'}": ${first.message}` };
  }
  const habitIds = new Set(result.data.data.habits.map((h) => h.id));
  if (result.data.data.checkIns.some((c) => !habitIds.has(c.habitId))) {
    return { ok: false, error: 'Backup contains check-ins for habits that are not in the file.' };
  }
  return { ok: true, backup: result.data };
}

export function buildBackup(userId: string, data: BackupData, now: string): BackupFile {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now, userId, data };
}

export type RestoreMode = 'merge' | 'replace';

export interface RestorePlan {
  mode: RestoreMode;
  /** Data with ownership rewritten to the importing user. */
  data: BackupData;
  counts: Record<keyof BackupData, number>;
  /** Number of local records that would be overwritten or removed. */
  conflicts: number;
}

/**
 * Re-own every record to the importing user so an import can never write into another account.
 * A backup from a different account gets fresh ids (via `newId`) so its records can't collide
 * with the original owner's. Derived ids (check-in = habit+day, mood = user+day) are always
 * recomputed rather than trusted from the file.
 */
export function planRestore(
  backup: BackupFile,
  userId: string,
  existing: BackupData,
  mode: RestoreMode,
  newId: (oldId: string) => string = (x) => x,
): RestorePlan {
  const foreign = backup.userId !== userId;
  const ids = new Map<string, string>();
  const remap = (old: string) => {
    if (!foreign) return old;
    if (!ids.has(old)) ids.set(old, newId(old));
    return ids.get(old)!;
  };
  const d = backup.data;
  const habits = d.habits.map((h) => ({ ...h, id: remap(h.id), userId })) as Habit[];
  const data: BackupData = {
    habits,
    checkIns: d.checkIns.map((c) => {
      const habitId = remap(c.habitId);
      return { ...c, id: `${habitId}_${c.day}`, habitId, userId };
    }),
    goals: d.goals.map((g) => ({ ...g, id: remap(g.id), habitIds: g.habitIds.map(remap), userId })),
    moods: d.moods.map((m) => ({ ...m, id: `${userId}_${m.day}`, userId })) as MoodEntry[],
    journal: d.journal.map((j) => ({ ...j, id: remap(j.id), userId })) as JournalEntry[],
  };
  const keys = Object.keys(data) as (keyof BackupData)[];
  let conflicts = 0;
  for (const k of keys) {
    const incoming = new Set((data[k] as { id: string }[]).map((x) => x.id));
    const local = existing[k] as { id: string }[];
    conflicts += mode === 'replace' ? local.length : local.filter((x) => incoming.has(x.id)).length;
  }
  const counts = Object.fromEntries(keys.map((k) => [k, data[k].length])) as RestorePlan['counts'];
  return { mode, data, counts, conflicts };
}
