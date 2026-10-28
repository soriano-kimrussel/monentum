import { addDays } from '../../domain/dates';
import { MemoryStore } from '../../data/MemoryStore';
import { createBackend } from '../index';
import { HABIT, makeBackend, signUp } from '../testUtils';

describe('habits, check-ins and streaks', () => {
  it('supports full CRUD and archiving', async () => {
    const { backend } = makeBackend();
    const { token } = await signUp(backend);
    const h = await backend.content.createHabit(token, HABIT);
    const updated = await backend.content.updateHabit(token, h.id, { ...HABIT, name: 'Long walk', days: [1, 3, 1] });
    expect(updated).toMatchObject({ name: 'Long walk', days: [1, 3] });
    await backend.content.setArchived(token, h.id, true);
    expect((await backend.content.habits(token))[0].archived).toBe(true);
    await backend.content.deleteHabit(token, h.id);
    expect(await backend.content.habits(token)).toHaveLength(0);
  });

  it('toggles check-ins idempotently per day and blocks future / too-old days', async () => {
    const { backend } = makeBackend();
    const { token } = await signUp(backend);
    const h = await backend.content.createHabit(token, HABIT);
    const today = backend.content.today();
    expect(await backend.content.toggleCheckIn(token, h.id, today)).toBe(true);
    expect(await backend.content.checkIns(token)).toHaveLength(1);
    expect(await backend.content.toggleCheckIn(token, h.id, today)).toBe(false);
    expect(await backend.content.checkIns(token)).toHaveLength(0);
    await expect(backend.content.toggleCheckIn(token, h.id, addDays(today, 1))).rejects.toMatchObject({ code: 'future_day' });
    await expect(backend.content.toggleCheckIn(token, h.id, addDays(today, -8))).rejects.toMatchObject({ code: 'too_old' });
    await backend.content.toggleCheckIn(token, h.id, addDays(today, -7));
  });

  it('serializes concurrent taps so a double tap never creates two check-ins', async () => {
    const { backend } = makeBackend();
    const { token } = await signUp(backend);
    const h = await backend.content.createHabit(token, HABIT);
    const today = backend.content.today();
    const results = await Promise.all([backend.content.toggleCheckIn(token, h.id, today), backend.content.toggleCheckIn(token, h.id, today), backend.content.toggleCheckIn(token, h.id, today)]);
    expect(results).toEqual([true, false, true]);
    expect(await backend.content.checkIns(token)).toHaveLength(1);
  });

  it('enforces the free-plan habit and goal limits on the backend', async () => {
    const { backend } = makeBackend();
    const { token } = await signUp(backend);
    for (let i = 0; i < 3; i++) await backend.content.createHabit(token, { ...HABIT, name: `H${i}` });
    await expect(backend.content.createHabit(token, HABIT)).rejects.toMatchObject({ code: 'limit_reached' });
    await backend.content.createGoal(token, { title: 'G', description: '', milestones: ['a'], habitIds: [] });
    await expect(backend.content.createGoal(token, { title: 'G2', description: '', milestones: [], habitIds: [] })).rejects.toMatchObject({ code: 'limit_reached' });
    await backend.billing.startTrial(token, 'premium_monthly');
    await backend.content.createHabit(token, HABIT);
  });

  it('completes a goal when every milestone is done', async () => {
    const { backend } = makeBackend();
    const { token } = await signUp(backend);
    const g = await backend.content.createGoal(token, { title: '10K', description: '', milestones: ['3K', '5K'], habitIds: [] });
    await backend.content.toggleMilestone(token, g.id, g.milestones[0].id);
    const done = await backend.content.toggleMilestone(token, g.id, g.milestones[1].id);
    expect(done.status).toBe('completed');
    const reopened = await backend.content.toggleMilestone(token, g.id, g.milestones[1].id);
    expect(reopened.status).toBe('active');
  });

  it('keeps one mood entry per day and saves journal entries', async () => {
    const { backend } = makeBackend();
    const { token } = await signUp(backend);
    await backend.content.logMood(token, { score: 2, tags: ['work'], note: '' });
    await backend.content.logMood(token, { score: 4, tags: [], note: 'better' });
    const moods = await backend.content.moods(token);
    expect(moods).toHaveLength(1);
    expect(moods[0].score).toBe(4);
    const j = await backend.content.saveJournal(token, { title: '', body: 'Felt focused today.' });
    expect(j.title).toBe('Felt focused today.');
  });
});

describe('offline persistence', () => {
  it('survives an app restart: a new backend over the same persisted data sees everything', async () => {
    let saved: Record<string, Record<string, unknown>> = {};
    const store = new MemoryStore(undefined, (snap) => (saved = snap));
    const first = createBackend(store);
    const { token } = await signUp(first);
    await first.content.createHabit(token, HABIT);
    await new Promise((r) => setTimeout(r, 300)); // debounced persist
    const second = createBackend(new MemoryStore(saved));
    expect(await second.content.habits(token)).toHaveLength(1);
  });

  it('rolls back every write in a failed mutation', async () => {
    const { backend, store } = makeBackend();
    const { token } = await signUp(backend);
    await expect(
      backend.core.mutate(async () => {
        await store.put('habits', 'temp', { id: 'temp' });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await store.get('habits', 'temp')).toBeNull();
    // The queue keeps working after a failure.
    await backend.content.createHabit(token, HABIT);
  });
});

describe('simulated cloud sync', () => {
  it('queues writes while offline and flushes them when back online', async () => {
    const { backend } = makeBackend();
    const { token } = await signUp(backend);
    await backend.sync.setOptions(token, { online: false });
    await backend.content.createHabit(token, HABIT);
    expect((await backend.sync.status(token)).pending).toBe(1);
    await expect(backend.sync.run(token)).rejects.toMatchObject({ code: 'offline' });
    await backend.sync.setOptions(token, { online: true });
    expect(await backend.sync.run(token)).toMatchObject({ pushed: 1 });
    expect((await backend.sync.status(token)).pending).toBe(0);
  });

  it('keeps the queue intact when a simulated network error happens', async () => {
    const { backend } = makeBackend(() => 0); // random() = 0 < failureRate → always fail
    const { token } = await signUp(backend);
    await backend.content.createHabit(token, HABIT);
    await backend.sync.setOptions(token, { failureRate: 1 });
    await expect(backend.sync.run(token)).rejects.toMatchObject({ code: 'sync_failed' });
    expect((await backend.sync.status(token)).pending).toBe(1);
  });

  it('pulls edits made on another device', async () => {
    const { backend } = makeBackend();
    const { token } = await signUp(backend);
    await backend.content.createHabit(token, HABIT);
    await backend.sync.run(token);
    const name = await backend.sync.simulateRemoteEdit(token);
    expect((await backend.sync.run(token)).pulled).toBe(1);
    expect((await backend.content.habits(token))[0].name).toBe(name);
  });

  it('never syncs one user’s outbox into another user’s cloud data', async () => {
    const { backend, store } = makeBackend();
    const a = await signUp(backend);
    const b = await signUp(backend);
    await backend.content.createHabit(a.token, HABIT);
    await backend.sync.run(b.token);
    expect(await store.list('cloud:habits')).toHaveLength(0);
    expect((await backend.sync.status(a.token)).pending).toBe(1);
  });
});

describe('backup and restore', () => {
  it('round-trips an export into a fresh account (merge)', async () => {
    const { backend } = makeBackend();
    const a = await signUp(backend);
    const h = await backend.content.createHabit(a.token, HABIT);
    await backend.content.toggleCheckIn(a.token, h.id, backend.content.today());
    const file = JSON.stringify(await backend.backup.export(a.token));

    const b = await signUp(backend);
    const preview = await backend.backup.preview(b.token, file, 'merge');
    expect(preview).toMatchObject({ fromOtherAccount: true, counts: { habits: 1, checkIns: 1 } });
    await backend.backup.restore(b.token, file, 'merge');
    const restored = await backend.content.habits(b.token);
    expect(restored).toHaveLength(1);
    // Importer gets fresh ids, so the original account is untouched.
    expect(restored[0].id).not.toBe(h.id);
    expect(await backend.content.habits(a.token)).toHaveLength(1);
    expect(await backend.content.checkIns(b.token)).toHaveLength(1);
  });

  it('requires typed confirmation to replace, and can undo a restore', async () => {
    const { backend } = makeBackend();
    const { token } = await signUp(backend);
    await backend.content.createHabit(token, { ...HABIT, name: 'Keep me' });
    const empty = JSON.stringify(await backend.backup.export(token));
    await backend.content.createHabit(token, { ...HABIT, name: 'Second' });

    await expect(backend.backup.restore(token, empty, 'replace')).rejects.toMatchObject({ code: 'confirmation_required' });
    await backend.backup.restore(token, empty, 'replace', 'REPLACE');
    expect((await backend.content.habits(token)).map((h) => h.name)).toEqual(['Keep me']);

    await backend.backup.undoRestore(token);
    expect((await backend.content.habits(token)).map((h) => h.name).sort()).toEqual(['Keep me', 'Second']);
  });

  it('rejects malformed files without touching data', async () => {
    const { backend } = makeBackend();
    const { token } = await signUp(backend);
    await backend.content.createHabit(token, HABIT);
    for (const bad of ['', '{', '[]', JSON.stringify({ format: 'momentum-backup', version: 99 })]) {
      await expect(backend.backup.restore(token, bad, 'replace', 'REPLACE')).rejects.toMatchObject({ code: 'invalid_backup' });
    }
    expect(await backend.content.habits(token)).toHaveLength(1);
  });
});
