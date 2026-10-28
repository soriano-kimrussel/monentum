// Minimal document store. Every collection holds JSON documents keyed by id.
// The same interface is implemented by SQLite (device), memory (tests/web) and, later,
// could be implemented by Firestore without touching the backend or UI.

export type Where = Record<string, string | number | boolean>;

export interface DocStore {
  get<T>(collection: string, id: string): Promise<T | null>;
  list<T>(collection: string, where?: Where): Promise<T[]>;
  put<T extends object>(collection: string, id: string, doc: T): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
  /** Run writes atomically. Callers are already serialized by the backend's mutex. */
  transaction<R>(fn: () => Promise<R>): Promise<R>;
  /** Wipe one collection, or everything. */
  clear(collection?: string): Promise<void>;
}

export function matches(doc: Record<string, unknown>, where?: Where): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => doc[k] === v);
}
