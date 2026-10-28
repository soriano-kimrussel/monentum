import * as ExpoCrypto from 'expo-crypto';
import { router } from 'expo-router';

import { createBackend, type Backend } from '../backend';
import { seedIfNeeded } from '../backend/seed';
import type { DocStore } from '../data/DocStore';
import { randomId, setRandomSource } from '../lib/crypto';
import { useSession } from '../stores/session';
import { openStore, wipeStore } from './openStore';

let backend: Backend | null = null;
let store: DocStore | null = null;
let booting: Promise<void> | null = null;

export function api(): Backend {
  if (!backend) throw new Error('Backend not ready');
  return backend;
}

// Client-side device state lives in its own collection, separate from backend data.
const DEVICE = 'device';

export function boot(): Promise<void> {
  booting ??= (async () => {
    try {
      setRandomSource((n) => ExpoCrypto.getRandomBytes(n));
      store = await openStore();
      backend = createBackend(store);
      await backend.init();
      await seedIfNeeded(backend.core);
      backend.subscribe(() => useSession.getState().bump());

      let device = await store.get<{ id: string; deviceId: string; token: string | null }>(DEVICE, 'state');
      if (!device) {
        device = { id: 'state', deviceId: randomId('dev_'), token: null };
        await store.put(DEVICE, 'state', device);
      }
      let user = null;
      if (device.token) {
        try {
          user = await backend.auth.me(device.token);
        } catch {
          device.token = null;
          await store.put(DEVICE, 'state', device);
        }
      }
      useSession.getState().setBooted(device.deviceId, device.token, user);
    } catch (e) {
      booting = null;
      useSession.getState().setBootError(e instanceof Error ? e.message : String(e));
    }
  })();
  return booting;
}

export async function persistToken(token: string | null) {
  if (!store) return;
  const device = await store.get<{ id: string; deviceId: string; token: string | null }>(DEVICE, 'state');
  await store.put(DEVICE, 'state', { ...device!, token });
}

/**
 * Sign out and drop the signed-in navigation stack in the same tick. Replacing the route (instead
 * of letting the (app) layout redirect) makes the root stack discard the old (app) state, so the
 * next sign-in, possibly as a different user, starts from a fresh Today screen.
 */
export async function signOut() {
  const { token } = useSession.getState();
  if (token && backend) await backend.auth.signOut(token).catch(() => undefined);
  await persistToken(null);
  useSession.getState().clear();
  router.replace('/sign-in');
}

/** Demo reset: wipe all local data and re-seed. */
export async function resetDemoData() {
  if (!store) return;
  await wipeStore(store);
  backend = null;
  booting = null;
  useSession.setState({ status: 'booting', token: null, user: null });
  await boot();
}
