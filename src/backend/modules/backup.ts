// LOCAL export / restore. Files stay on the device unless the user shares them.
// This is NOT an automated cloud backup.
import { buildBackup, parseBackup, planRestore, type BackupData, type BackupFile, type RestoreMode } from '../../domain/backup';
import type { User } from '../../domain/types';
import { randomId } from '../../lib/crypto';
import { ApiError, Core, type SyncedCollection } from '../core';

const KEYS = ['habits', 'checkIns', 'goals', 'moods', 'journal'] as const satisfies readonly (keyof BackupData & SyncedCollection)[];
export const REPLACE_CONFIRMATION = 'REPLACE';

async function userData(core: Core, userId: string): Promise<BackupData> {
  const entries = await Promise.all(KEYS.map(async (k) => [k, await core.store.list(k, { userId })] as const));
  return Object.fromEntries(entries) as unknown as BackupData;
}

async function writeData(core: Core, user: User, data: BackupData, mode: RestoreMode) {
  if (mode === 'replace') {
    const current = await userData(core, user.id);
    for (const k of KEYS) for (const doc of current[k] as { id: string }[]) await core.deleteSynced(k, doc.id);
  }
  for (const k of KEYS) {
    for (const doc of data[k] as { id: string; userId: string }[]) {
      const existing = await core.store.get<{ userId: string }>(k, doc.id);
      // Never overwrite a record that belongs to someone else, even with a crafted file.
      if (existing && existing.userId !== user.id) continue;
      // Merge mode keeps local copies of records that already exist.
      if (existing && mode === 'merge') continue;
      await core.writeSynced(k, doc.id, doc);
    }
  }
}

export function backupApi(core: Core) {
  return {
    async export(token: string): Promise<BackupFile> {
      const user = await core.authenticate(token);
      const backup = buildBackup(user.id, await userData(core, user.id), core.clock.now());
      await core.audit(user.id, 'backup.export', user.id);
      return backup;
    },

    /** Validate and describe what a restore would do, without changing anything. */
    async preview(token: string, raw: string, mode: RestoreMode) {
      const user = await core.authenticate(token);
      const parsed = parseBackup(raw);
      if (!parsed.ok) throw new ApiError('invalid_backup', parsed.error);
      const plan = planRestore(parsed.backup, user.id, await userData(core, user.id), mode);
      return { counts: plan.counts, conflicts: plan.conflicts, exportedAt: parsed.backup.exportedAt, fromOtherAccount: parsed.backup.userId !== user.id };
    },

    /**
     * Restore. A safety snapshot of current data is always taken first, so even a
     * mistaken "replace" can be undone. Replace additionally requires typed confirmation.
     */
    async restore(token: string, raw: string, mode: RestoreMode, confirmation?: string) {
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        if (mode === 'replace' && confirmation !== REPLACE_CONFIRMATION) {
          throw new ApiError('confirmation_required', `Type ${REPLACE_CONFIRMATION} to confirm overwriting your data.`);
        }
        const parsed = parseBackup(raw);
        if (!parsed.ok) {
          await core.audit(user.id, 'backup.restore', undefined, 'denied', { reason: parsed.error });
          throw new ApiError('invalid_backup', parsed.error);
        }
        const current = await userData(core, user.id);
        const plan = planRestore(parsed.backup, user.id, current, mode, () => randomId('imp_'));
        await core.store.put('snapshots', user.id, buildBackup(user.id, current, core.clock.now()));
        await writeData(core, user, plan.data, mode);
        await core.audit(user.id, 'backup.restore', user.id, 'allowed', { mode, ...plan.counts });
        return plan.counts;
      });
    },

    async snapshotInfo(token: string) {
      const user = await core.authenticate(token);
      const snap = await core.store.get<BackupFile>('snapshots', user.id);
      return snap ? { exportedAt: snap.exportedAt, habits: snap.data.habits.length, checkIns: snap.data.checkIns.length } : null;
    },

    /** Recovery: put back the snapshot taken before the last restore. */
    async undoRestore(token: string) {
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        const snap = await core.store.get<BackupFile>('snapshots', user.id);
        if (!snap) throw new ApiError('no_snapshot', 'There is no restore to undo.');
        await writeData(core, user, snap.data, 'replace');
        await core.store.remove('snapshots', user.id);
        await core.audit(user.id, 'backup.undo_restore', user.id);
      });
    },
  };
}
