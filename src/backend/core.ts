// Core of the MockBackend. It plays the role of a server (Cloud Functions + Firestore rules):
// every call is authenticated with a session token and authorized here, never in the UI.
// IMPORTANT: it runs on the same device as the UI, so it demonstrates the authorization
// design but is not a real security boundary. See docs/THREAT_MODEL.md.

import type { DocStore } from '../data/DocStore';
import { DEFAULT_REFERRAL_CONFIG, sanitizeProps, type AnalyticsEvent, type AnalyticsEventName, type ReferralConfig } from '../domain/growth';
import type { AuditEntry, PublicUser, Role, Session, User } from '../domain/types';
import { randomId, sha256Hex } from '../lib/crypto';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface BackendConfig {
  /** MOCK secret for signing simulated payment webhooks. Not a real credential. */
  webhookSecret: string;
  /** Salt for hashing device ids in analytics events. */
  analyticsSalt: string;
}

export const DEFAULT_CONFIG: BackendConfig = {
  webhookSecret: 'whsec_mock_local_demo_only',
  analyticsSalt: 'momentum-demo-salt',
};

/** User-content collections mirrored to the simulated cloud by the sync engine. */
export const SYNCED_COLLECTIONS = ['habits', 'checkIns', 'goals', 'moods', 'journal'] as const;
export type SyncedCollection = (typeof SYNCED_COLLECTIONS)[number];

export interface OutboxEntry {
  id: string;
  collection: SyncedCollection;
  docId: string;
  userId: string;
  op: 'put' | 'delete';
  doc?: Record<string, unknown>;
  at: string;
}

const SESSION_DAYS = 30;

/** Test clock: real time plus a persisted offset so trials and renewals can be demoed. */
export class Clock {
  offsetMs = 0;
  nowMs(): number {
    return Date.now() + this.offsetMs;
  }
  now(): string {
    return new Date(this.nowMs()).toISOString();
  }
}

export class Core {
  readonly clock = new Clock();
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  private sticky: { collection: string; id: string; doc: object }[] = [];

  /** Write that is kept even if the surrounding mutation fails. */
  async putSticky(collection: string, id: string, doc: object) {
    this.sticky.push({ collection, id, doc });
    await this.store.put(collection, id, doc);
  }

  /** Real time. Sessions and rate limits ignore the demo test clock. */
  realNowMs(): number {
    return Date.now();
  }

  /** Set by any write; lets mutate() skip change events for read-only calls. */
  private dirty = false;
  readonly store: DocStore;

  constructor(
    store: DocStore,
    readonly config: BackendConfig = DEFAULT_CONFIG,
  ) {
    const mark = () => {
      this.dirty = true;
    };
    this.store = {
      get: (collection, id) => store.get(collection, id),
      list: (collection, where) => store.list(collection, where),
      put: (collection, id, doc) => (mark(), store.put(collection, id, doc)),
      remove: (collection, id) => (mark(), store.remove(collection, id)),
      transaction: (fn) => store.transaction(fn),
      clear: (collection) => (mark(), store.clear(collection)),
    };
  }

  async init() {
    const meta = await this.store.get<{ offsetMs: number }>('meta', 'clock');
    this.clock.offsetMs = meta?.offsetMs ?? 0;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Serialize every mutation through one queue and run it in a store transaction.
   * This is what makes check-then-write sequences (inventory, idempotency keys,
   * duplicate-reward checks) safe against concurrent taps.
   */
  mutate<R>(fn: () => Promise<R>): Promise<R> {
    let changed = false;
    const run = this.queue.then(async () => {
      this.sticky = [];
      this.dirty = false;
      try {
        const result = await this.store.transaction(fn);
        changed = this.dirty;
        return result;
      } catch (e) {
        // The transaction rolled back, but security records about the failed attempt
        // (rate-limit counters, denied-access audit entries) must survive it.
        for (const w of this.sticky) await this.store.put(w.collection, w.id, w.doc);
        throw e;
      } finally {
        this.sticky = [];
      }
    });
    this.queue = run.catch(() => undefined);
    return run.then((r) => {
      // Only announce real changes. Read-style calls that go through the mutex (e.g. billing
      // status reconciling nothing) would otherwise trigger refetch → mutate → refetch forever.
      if (changed) this.listeners.forEach((l) => l());
      return r;
    });
  }

  // ---------- auth ----------

  async authenticate(token: string | null | undefined): Promise<User> {
    if (!token) throw new ApiError('unauthenticated', 'Please sign in.');
    const sessions = await this.store.list<Session>('sessions', { token });
    const session = sessions[0];
    if (!session || session.expiresAt <= new Date(this.realNowMs()).toISOString()) throw new ApiError('unauthenticated', 'Your session has expired. Please sign in again.');
    const user = await this.store.get<User>('users', session.userId);
    if (!user || user.disabled) throw new ApiError('unauthenticated', 'This account is unavailable.');
    return user;
  }

  async requireRole(token: string | null | undefined, role: Role): Promise<User> {
    const user = await this.authenticate(token);
    if (user.role !== role) {
      await this.audit(user.id, 'authz.denied', undefined, 'denied', { required: role });
      throw new ApiError('forbidden', 'You do not have permission to do that.');
    }
    return user;
  }

  /** Load a user-owned document and enforce ownership (the Firestore-rule equivalent). */
  async owned<T extends { userId: string }>(collection: string, id: string, user: User): Promise<T> {
    const doc = await this.store.get<T>(collection, id);
    if (!doc) throw new ApiError('not_found', 'Not found.');
    if (doc.userId !== user.id) {
      await this.audit(user.id, 'authz.denied', `${collection}/${id}`, 'denied', { reason: 'not_owner' });
      // Same message as not-found so ids of other users' records can't be probed.
      throw new ApiError('not_found', 'Not found.');
    }
    return doc;
  }

  async createSession(userId: string): Promise<Session> {
    const now = this.clock.now();
    const session: Session = {
      id: randomId('ses_'),
      token: randomId('tok_') + randomId(),
      userId,
      createdAt: now,
      expiresAt: new Date(this.realNowMs() + SESSION_DAYS * 86_400_000).toISOString(),
    };
    await this.store.put('sessions', session.id, session);
    return session;
  }

  // ---------- rate limiting (simulated) ----------

  /** Sliding-window limiter. Returns false when the caller should be throttled. */
  async hit(key: string, max: number, windowMs: number): Promise<boolean> {
    const now = this.realNowMs();
    const rec = (await this.store.get<{ hits: number[] }>('rateLimits', key)) ?? { hits: [] };
    const hits = rec.hits.filter((t) => now - t < windowMs);
    if (hits.length >= max) {
      await this.putSticky('rateLimits', key, { hits });
      return false;
    }
    hits.push(now);
    await this.putSticky('rateLimits', key, { hits });
    return true;
  }

  async resetLimit(key: string) {
    await this.store.remove('rateLimits', key);
  }

  // ---------- audit + analytics ----------

  async audit(actorId: string | null, action: string, target?: string, outcome: AuditEntry['outcome'] = 'allowed', detail?: Record<string, unknown>) {
    const entry: AuditEntry = { id: randomId('aud_'), at: this.clock.now(), actorId, action, target, outcome, detail };
    if (outcome === 'allowed') await this.store.put('audit', entry.id, entry);
    else await this.putSticky('audit', entry.id, entry);
  }

  subjectFor(deviceId: string | undefined): string | undefined {
    return deviceId ? sha256Hex(`${this.config.analyticsSalt}:${deviceId}`).slice(0, 16) : undefined;
  }

  async track(name: AnalyticsEventName, opts: { deviceId?: string; campaignId?: string; valueCents?: number; props?: Record<string, unknown>; at?: string } = {}) {
    const event: AnalyticsEvent = {
      id: randomId('evt_'),
      name,
      at: opts.at ?? this.clock.now(),
      campaignId: opts.campaignId,
      subject: this.subjectFor(opts.deviceId),
      valueCents: opts.valueCents,
      props: sanitizeProps(opts.props ?? {}),
    };
    await this.store.put('events', event.id, event);
  }

  async referralConfig(): Promise<ReferralConfig> {
    return (await this.store.get<ReferralConfig>('meta', 'referralConfig')) ?? DEFAULT_REFERRAL_CONFIG;
  }

  // ---------- synced writes ----------

  /** Write user content and queue it for the simulated cloud sync. */
  async writeSynced<T extends { userId: string }>(collection: SyncedCollection, id: string, doc: T) {
    await this.store.put(collection, id, doc);
    await this.enqueue({ id: '', collection, docId: id, userId: doc.userId, op: 'put', doc: doc as unknown as Record<string, unknown>, at: this.clock.now() });
  }

  async deleteSynced(collection: SyncedCollection, id: string) {
    const doc = await this.store.get<{ userId: string }>(collection, id);
    if (!doc) return;
    await this.store.remove(collection, id);
    await this.enqueue({ id: '', collection, docId: id, userId: doc.userId, op: 'delete', at: this.clock.now() });
  }

  private seq = 0;

  private async enqueue(entry: OutboxEntry) {
    // Outbox keys sort by (time, sequence) so the sync engine replays writes in order.
    const key = `${String(this.clock.nowMs()).padStart(15, '0')}_${String(this.seq++ % 1e6).padStart(6, '0')}`;
    await this.store.put('outbox', key, { ...entry, id: key });
  }
}

export function toPublic(user: User): PublicUser {
  const { passwordHash, passwordSalt, ...rest } = user;
  return rest;
}
