// SIMULATED cloud sync. The "cloud" is a separate namespace in the same on-device database
// (`cloud:<collection>`). It demonstrates an offline-first outbox, push/pull and
// last-write-wins conflict handling without any network or hosted service.
import type { User } from '../../domain/types';
import { ApiError, Core, SYNCED_COLLECTIONS, type OutboxEntry, type SyncedCollection } from '../core';

interface SyncMeta {
  online: boolean;
  /** 0..1 probability that a push batch fails, to demonstrate retries. */
  failureRate: number;
  lastSyncAt?: string;
  lastPulledAt?: string;
  lastError?: string;
  conflicts: number;
  pushed: number;
  pulled: number;
}

const DEFAULT_META: SyncMeta = { online: true, failureRate: 0, conflicts: 0, pushed: 0, pulled: 0 };
const cloud = (c: SyncedCollection) => `cloud:${c}`;
type Doc = { id: string; userId: string; updatedAt?: string; createdAt?: string; deleted?: boolean; syncedAt?: string };
const stamp = (d: Doc) => d.updatedAt ?? d.createdAt ?? '';

export function syncApi(core: Core, random: () => number = Math.random) {
  const metaKey = (userId: string) => `sync:${userId}`;
  const getMeta = async (userId: string) => ({ ...DEFAULT_META, ...((await core.store.get<SyncMeta>('meta', metaKey(userId))) ?? {}) });

  return {
    async status(token: string) {
      const user = await core.authenticate(token);
      const meta = await getMeta(user.id);
      const queue = await ownOutbox(core, user);
      return { ...meta, pending: queue.length };
    },

    async setOptions(token: string, opts: Partial<Pick<SyncMeta, 'online' | 'failureRate'>>) {
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        const meta = await getMeta(user.id);
        const failureRate = opts.failureRate === undefined ? meta.failureRate : Math.min(1, Math.max(0, opts.failureRate));
        await core.store.put('meta', metaKey(user.id), { ...meta, online: opts.online ?? meta.online, failureRate });
      });
    },

    /** Push the outbox, then pull newer cloud changes. Last write wins by `updatedAt`. */
    async run(token: string) {
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        const meta = await getMeta(user.id);
        if (!meta.online) throw new ApiError('offline', 'You’re offline (simulated). Changes are saved locally and will sync later.');
        if (random() < meta.failureRate) {
          await core.store.put('meta', metaKey(user.id), { ...meta, lastError: 'Simulated network error' });
          throw new ApiError('sync_failed', 'Simulated network error. Your changes are still queued.');
        }
        const now = core.clock.now();
        let pushed = 0;
        let conflicts = 0;
        for (const entry of (await ownOutbox(core, user)).sort((a, b) => (a.id < b.id ? -1 : 1))) {
          const remote = await core.store.get<Doc>(cloud(entry.collection), entry.docId);
          if (remote && remote.userId !== user.id) {
            // Cloud-side ownership rule: never let one user overwrite another's document.
            conflicts++;
          } else if (entry.op === 'delete') {
            await core.store.put(cloud(entry.collection), entry.docId, { ...(remote ?? { id: entry.docId, userId: user.id }), deleted: true, updatedAt: entry.at, syncedAt: now });
            pushed++;
          } else {
            const local = entry.doc as Doc;
            if (remote && stamp(remote) > stamp(local) && remote.syncedAt && meta.lastPulledAt && remote.syncedAt > meta.lastPulledAt) {
              conflicts++; // A newer edit from another device wins; it will be pulled below.
            } else {
              await core.store.put(cloud(entry.collection), entry.docId, { ...local, syncedAt: now });
              pushed++;
            }
          }
          await core.store.remove('outbox', entry.id);
        }

        let pulled = 0;
        for (const col of SYNCED_COLLECTIONS) {
          for (const remote of await core.store.list<Doc>(cloud(col), { userId: user.id })) {
            if (!remote.syncedAt || (meta.lastPulledAt && remote.syncedAt <= meta.lastPulledAt)) continue;
            const local = await core.store.get<Doc>(col, remote.id);
            if (remote.deleted) {
              if (local) {
                await core.store.remove(col, remote.id);
                pulled++;
              }
            } else if (!local || stamp(remote) > stamp(local)) {
              const { syncedAt, deleted, ...doc } = remote;
              await core.store.put(col, remote.id, doc);
              pulled++;
            }
          }
        }
        const next: SyncMeta = { ...meta, lastSyncAt: now, lastPulledAt: now, lastError: undefined, conflicts: meta.conflicts + conflicts, pushed: meta.pushed + pushed, pulled: meta.pulled + pulled };
        await core.store.put('meta', metaKey(user.id), next);
        return { pushed, pulled, conflicts };
      });
    },

    /** Demo helper: pretend the user renamed a habit on another device (writes to the cloud only). */
    async simulateRemoteEdit(token: string) {
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        const habits = await core.store.list<Doc & { name: string }>(cloud('habits'), { userId: user.id });
        const target = habits.find((h) => !h.deleted);
        if (!target) throw new ApiError('nothing_synced', 'Sync at least once so the cloud has a habit to edit.');
        const now = new Date(core.clock.nowMs() + 1000).toISOString();
        const name = target.name.replace(/ \(edited on tablet\)$/, '') + ' (edited on tablet)';
        await core.store.put(cloud('habits'), target.id, { ...target, name, updatedAt: now, syncedAt: now });
        return name;
      });
    },
  };
}

async function ownOutbox(core: Core, user: User): Promise<OutboxEntry[]> {
  return core.store.list<OutboxEntry>('outbox', { userId: user.id });
}
