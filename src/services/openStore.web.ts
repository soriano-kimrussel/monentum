// Web preview: in-memory store mirrored to localStorage. (expo-sqlite on web needs WASM and
// cross-origin isolation headers; the browser build is only a convenience preview.)
import type { DocStore } from '../data/DocStore';
import { MemoryStore } from '../data/MemoryStore';

const KEY = 'momentum-demo-db';

export async function openStore(): Promise<DocStore> {
  let initial: Record<string, Record<string, unknown>> | undefined;
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    initial = raw ? JSON.parse(raw) : undefined;
  } catch {
    initial = undefined;
  }
  const store = new MemoryStore(initial, (snap) => {
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(snap));
    } catch {
      // Storage full or blocked: keep working in memory.
    }
  });
  // Writes are debounced; don't lose the last ones on refresh or tab close.
  globalThis.addEventListener?.('pagehide', () => store.flushNow());
  return store;
}

export async function wipeStore(store: DocStore) {
  await store.clear();
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    // ignore
  }
}
