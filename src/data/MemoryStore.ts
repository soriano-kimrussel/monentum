import { matches, type DocStore, type Where } from './DocStore';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

type Snapshot = Record<string, Record<string, unknown>>;

/**
 * In-memory store used by tests and the web build. An optional `persist` hook lets the
 * web build mirror data into localStorage so a page refresh keeps demo data.
 */
export class MemoryStore implements DocStore {
  private data = new Map<string, Map<string, unknown>>();

  constructor(
    initial?: Snapshot,
    private persist?: (snapshot: Snapshot) => void,
  ) {
    if (initial) {
      for (const [col, docs] of Object.entries(initial)) this.data.set(col, new Map(Object.entries(docs)));
    }
  }

  private col(name: string) {
    let c = this.data.get(name);
    if (!c) {
      c = new Map();
      this.data.set(name, c);
    }
    return c;
  }

  async get<T>(collection: string, id: string): Promise<T | null> {
    const doc = this.col(collection).get(id);
    return doc === undefined ? null : (clone(doc) as T);
  }

  async list<T>(collection: string, where?: Where): Promise<T[]> {
    return [...this.col(collection).values()]
      .filter((d) => matches(d as Record<string, unknown>, where))
      .map((d) => clone(d) as T);
  }

  async put<T extends object>(collection: string, id: string, doc: T): Promise<void> {
    this.col(collection).set(id, clone(doc));
    this.flush();
  }

  async remove(collection: string, id: string): Promise<void> {
    this.col(collection).delete(id);
    this.flush();
  }

  async transaction<R>(fn: () => Promise<R>): Promise<R> {
    // Roll back on failure by restoring a snapshot taken before the transaction.
    const before = this.snapshot();
    try {
      return await fn();
    } catch (e) {
      this.data = new Map(Object.entries(before).map(([k, v]) => [k, new Map(Object.entries(v))]));
      this.flush();
      throw e;
    }
  }

  async clear(collection?: string): Promise<void> {
    if (collection) this.data.delete(collection);
    else this.data.clear();
    this.flush();
  }

  snapshot(): Snapshot {
    const out: Snapshot = {};
    for (const [col, docs] of this.data) out[col] = clone(Object.fromEntries(docs));
    return out;
  }

  private pending: ReturnType<typeof setTimeout> | null = null;

  /** Debounced so bulk writes (seeding, restore) don't snapshot once per document. */
  private flush() {
    if (!this.persist || this.pending) return;
    this.pending = setTimeout(() => {
      this.pending = null;
      this.persist?.(this.snapshot());
    }, 250);
  }

  /** Write a pending debounced snapshot right away (e.g. when the page is being closed). */
  flushNow() {
    if (!this.pending) return;
    clearTimeout(this.pending);
    this.pending = null;
    this.persist?.(this.snapshot());
  }
}
