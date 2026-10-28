import type { DocStore } from '../data/DocStore';
import { Core, DEFAULT_CONFIG, type BackendConfig } from './core';
import { adminApi } from './modules/admin';
import { authApi } from './modules/auth';
import { backupApi } from './modules/backup';
import { billingApi } from './modules/billing';
import { contentApi } from './modules/content';
import { growthApi } from './modules/growth';
import { marketApi } from './modules/market';
import { referralsApi } from './modules/referrals';
import { syncApi } from './modules/sync';

export { ApiError } from './core';

/**
 * The app's only gateway to data. Screens call `backend.<area>.<action>(token, ...)` the same
 * way they would call Cloud Functions; a Firebase implementation can replace this object later.
 */
export function createBackend(store: DocStore, config: BackendConfig = DEFAULT_CONFIG, random?: () => number) {
  const core = new Core(store, config);
  return {
    core,
    init: () => core.init(),
    subscribe: (fn: () => void) => core.subscribe(fn),
    auth: authApi(core),
    content: contentApi(core),
    billing: billingApi(core),
    referrals: referralsApi(core),
    growth: growthApi(core),
    market: marketApi(core),
    admin: adminApi(core),
    backup: backupApi(core),
    sync: syncApi(core, random),
  };
}

export type Backend = ReturnType<typeof createBackend>;
