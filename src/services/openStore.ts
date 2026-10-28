// Native (iOS/Android): durable offline storage in SQLite.
import type { DocStore } from '../data/DocStore';
import { SqliteStore } from '../data/SqliteStore';

export async function openStore(): Promise<DocStore> {
  return SqliteStore.open('momentum.db');
}

export async function wipeStore(store: DocStore) {
  await store.clear();
}
