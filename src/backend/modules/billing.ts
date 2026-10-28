// SIMULATED subscriptions and payments. No payment provider is contacted, no card data is
// collected and no money moves. Provider-style webhooks are signed with a MOCK secret.
import {
  PAYMENT_METHODS,
  advance,
  applyRefund,
  cancel,
  changePlan,
  isPremium,
  limitsFor,
  newSubscription,
  purchase,
  refundEligibility,
  restoreFromLedger,
  resume,
  retryPayment,
  startTrial,
  type PaidPlanId,
  type PaymentMethodId,
  type RefundRequest,
  type Subscription,
  type Transaction,
  type Transition,
} from '../../domain/subscription';
import type { User } from '../../domain/types';
import { signPayload, verifyWebhook, type WebhookEvent } from '../../domain/webhooks';
import { randomId } from '../../lib/crypto';
import { ApiError, Core } from '../core';
import { parse, reasonSchema } from '../schemas';
import { recordCommission, reverseCommission } from './growth';

const PLAN_IDS: PaidPlanId[] = ['premium_monthly', 'premium_annual'];

function assertPlan(plan: string): asserts plan is PaidPlanId {
  if (!PLAN_IDS.includes(plan as PaidPlanId)) throw new ApiError('invalid_input', 'Unknown plan.');
}

/** Persist a transition: subscription, ledger entries, analytics and affiliate commissions. */
async function commit(core: Core, user: User, t: Transition): Promise<Transaction[]> {
  await core.store.put('subscriptions', user.id, t.sub);
  const saved: Transaction[] = [];
  for (const partial of t.txns) {
    const txn: Transaction = { ...partial, id: randomId('txn_'), userId: user.id };
    await core.store.put('transactions', txn.id, txn);
    saved.push(txn);
    if (txn.status !== 'succeeded') continue;
    if (txn.type === 'trial_start') await core.track('trial_start', { deviceId: user.deviceId, at: txn.createdAt });
    if (txn.amountCents > 0) {
      await core.track('purchase', { deviceId: user.deviceId, valueCents: txn.amountCents, at: txn.createdAt, props: { plan: txn.plan, kind: txn.type } });
      await recordCommission(core, user, txn.id, txn.amountCents);
    }
  }
  return saved;
}

/** Load the subscription and apply any time-based events that are due (renewals, expiries). */
async function reconcile(core: Core, user: User): Promise<Subscription> {
  const sub = (await core.store.get<Subscription>('subscriptions', user.id)) ?? newSubscription(user.id, core.clock.now());
  const t = advance(sub, core.clock.now());
  if (t.txns.length || t.sub !== sub) await commit(core, user, t);
  return t.sub;
}

function failedCharge(txns: Transaction[]) {
  if (txns.some((t) => t.status === 'failed')) {
    throw new ApiError('payment_declined', 'The simulated payment was declined. Switch the demo card and try again.');
  }
}

export function billingApi(core: Core) {
  /** Run a user-initiated transition inside the mutex with reconciliation first. */
  const act = (token: string, action: string, fn: (sub: Subscription, now: string) => Transition) =>
    core.mutate(async () => {
      const user = await core.authenticate(token);
      const sub = await reconcile(core, user);
      const t = fn(sub, core.clock.now());
      const txns = await commit(core, user, t);
      await core.audit(user.id, `billing.${action}`, user.id, 'allowed', { status: t.sub.status, plan: t.sub.plan });
      return { sub: t.sub, txns };
    });

  const toApiError = (e: unknown): never => {
    if (e instanceof Error && e.name === 'SubscriptionError') throw new ApiError((e as Error & { code: string }).code, e.message);
    throw e;
  };

  return {
    async status(token: string) {
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        const sub = await reconcile(core, user);
        const premium = isPremium(sub, core.clock.now());
        return { sub, premium, limits: limitsFor(premium), now: core.clock.now(), clockOffsetMs: core.clock.offsetMs };
      });
    },

    async startTrial(token: string, plan: string) {
      assertPlan(plan);
      return act(token, 'trial', (s, now) => startTrial(s, plan, now)).catch(toApiError);
    },

    async purchase(token: string, plan: string) {
      assertPlan(plan);
      const r = await act(token, 'purchase', (s, now) => purchase(s, plan, now)).catch(toApiError);
      failedCharge(r.txns);
      return r;
    },

    async changePlan(token: string, plan: string) {
      assertPlan(plan);
      const r = await act(token, 'change_plan', (s, now) => changePlan(s, plan, now)).catch(toApiError);
      failedCharge(r.txns);
      return r;
    },

    cancel: (token: string) => act(token, 'cancel', cancel).catch(toApiError),
    resume: (token: string) => act(token, 'resume', resume).catch(toApiError),

    async retryPayment(token: string) {
      const r = await act(token, 'retry', retryPayment).catch(toApiError);
      failedCharge(r.txns);
      return r;
    },

    async setPaymentMethod(token: string, method: string) {
      if (!(method in PAYMENT_METHODS)) throw new ApiError('invalid_input', 'Unknown demo payment method.');
      return act(token, 'payment_method', (s, now) => ({ sub: { ...s, paymentMethod: method as PaymentMethodId, updatedAt: now }, txns: [] }));
    },

    /** Simulated "Restore purchases": rebuild entitlement from the local ledger. */
    async restore(token: string) {
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        const sub = await reconcile(core, user);
        const ledger = await core.store.list<Transaction>('transactions', { userId: user.id });
        const next = restoreFromLedger(sub, ledger, core.clock.now());
        await core.store.put('subscriptions', user.id, next);
        await core.audit(user.id, 'billing.restore', user.id, 'allowed', { restored: next !== sub });
        return { sub: next, restored: next !== sub };
      });
    },

    async transactions(token: string) {
      const user = await core.authenticate(token);
      return (await core.store.list<Transaction>('transactions', { userId: user.id })).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },

    async refunds(token: string) {
      const user = await core.authenticate(token);
      return (await core.store.list<RefundRequest>('refunds', { userId: user.id })).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },

    async requestRefund(token: string, transactionId: string, rawReason: unknown) {
      const reason = parse(reasonSchema, rawReason);
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        const txn = await core.store.get<Transaction>('transactions', transactionId);
        const existing = await core.store.list<RefundRequest>('refunds', { transactionId });
        const problem = txn ? refundEligibility(txn, existing, user.id, core.clock.now()) : 'not_found';
        if (problem) {
          await core.audit(user.id, 'billing.refund_request', transactionId, 'denied', { reason: problem });
          const messages: Record<string, string> = {
            not_found: 'Transaction not found.',
            not_owner: 'Transaction not found.',
            not_refundable: 'This transaction can’t be refunded.',
            window_closed: 'Refunds are available within 14 days of a charge.',
            duplicate_request: 'A refund was already requested for this charge.',
          };
          throw new ApiError(problem, messages[problem] ?? 'Not refundable.');
        }
        const req: RefundRequest = { id: randomId('rfd_'), userId: user.id, transactionId, reason, status: 'pending', createdAt: core.clock.now() };
        await core.store.put('refunds', req.id, req);
        await core.audit(user.id, 'billing.refund_request', req.id);
        return req;
      });
    },

    // ---------- admin ----------

    async adminTransactions(token: string, userId: string) {
      await core.requireRole(token, 'admin');
      return (await core.store.list<Transaction>('transactions', { userId })).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },

    async allRefunds(token: string) {
      await core.requireRole(token, 'admin');
      const [refunds, txns, users] = await Promise.all([core.store.list<RefundRequest>('refunds'), core.store.list<Transaction>('transactions'), core.store.list<User>('users')]);
      return refunds
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map((r) => ({ ...r, txn: txns.find((t) => t.id === r.transactionId), email: users.find((u) => u.id === r.userId)?.email }));
    },

    async decideRefund(token: string, refundId: string, approve: boolean, note = '') {
      return core.mutate(async () => {
        const admin = await core.requireRole(token, 'admin');
        const req = await core.store.get<RefundRequest>('refunds', refundId);
        if (!req) throw new ApiError('not_found', 'Refund request not found.');
        if (req.status !== 'pending') throw new ApiError('already_decided', 'This request was already decided.');
        const now = core.clock.now();
        await core.store.put('refunds', req.id, { ...req, status: approve ? 'approved' : 'rejected', decidedAt: now, decidedBy: admin.id, note: note.slice(0, 300) });
        if (approve) await issueRefund(core, req.transactionId);
        await core.audit(admin.id, approve ? 'billing.refund_approve' : 'billing.refund_reject', req.id);
      });
    },

    async adminSetBonus(token: string, userId: string, days: number) {
      return core.mutate(async () => {
        const admin = await core.requireRole(token, 'admin');
        if (!Number.isInteger(days) || days < 0 || days > 365) throw new ApiError('invalid_input', 'Days must be 0–365.');
        const sub = await core.store.get<Subscription>('subscriptions', userId);
        if (!sub) throw new ApiError('not_found', 'User not found.');
        const until = days === 0 ? undefined : new Date(core.clock.nowMs() + days * 86_400_000).toISOString();
        await core.store.put('subscriptions', userId, { ...sub, bonusPremiumUntil: until, updatedAt: core.clock.now() });
        await core.audit(admin.id, 'billing.grant_bonus', userId, 'allowed', { days });
      });
    },

    async adminCancel(token: string, userId: string) {
      return core.mutate(async () => {
        const admin = await core.requireRole(token, 'admin');
        const user = await core.store.get<User>('users', userId);
        if (!user) throw new ApiError('not_found', 'User not found.');
        const sub = await reconcile(core, user);
        let t: Transition;
        try {
          t = cancel(sub, core.clock.now());
        } catch (e) {
          return toApiError(e);
        }
        await commit(core, user, t);
        await core.audit(admin.id, 'billing.admin_cancel', userId);
      });
    },

    // ---------- simulated provider webhooks ----------

    /** Build a correctly signed provider event (what the mock provider would POST). */
    signEvent(type: string, data: Record<string, unknown>) {
      const event: WebhookEvent = { id: randomId('evt_'), type, createdAt: core.clock.now(), data };
      const body = JSON.stringify(event);
      // Signature uses wall-clock time, matching how a real provider signs deliveries.
      return { body, signature: signPayload(body, core.config.webhookSecret, Math.floor(Date.now() / 1000)) };
    },

    /** Webhook endpoint: verify signature + freshness, dedupe by event id, then apply. */
    async receiveWebhook(body: string, signature: string) {
      return core.mutate(async () => {
        const v = verifyWebhook(body, signature, core.config.webhookSecret, Math.floor(Date.now() / 1000));
        if (!v.ok) {
          await core.audit(null, 'webhook.rejected', undefined, 'denied', { reason: v.reason });
          throw new ApiError(`webhook_${v.reason}`, `Webhook rejected: ${v.reason.replace('_', ' ')}.`);
        }
        if (await core.store.get('webhookEvents', v.event.id)) {
          await core.audit(null, 'webhook.duplicate', v.event.id, 'allowed');
          return { status: 'duplicate' as const };
        }
        await core.store.put('webhookEvents', v.event.id, { id: v.event.id, type: v.event.type, at: core.clock.now() });
        if (v.event.type === 'charge.refunded') {
          const txnId = String((v.event.data as { transactionId?: unknown }).transactionId ?? '');
          await issueRefund(core, txnId);
        } else {
          await core.audit(null, 'webhook.ignored', v.event.id, 'allowed', { type: v.event.type });
          return { status: 'ignored' as const };
        }
        await core.audit(null, 'webhook.processed', v.event.id, 'allowed', { type: v.event.type });
        return { status: 'processed' as const };
      });
    },

    // ---------- test clock ----------

    /** Demo-only control (a production backend would not expose this). */
    async advanceClock(token: string, days: number) {
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        if (!Number.isFinite(days) || days < 0 || days > 400) throw new ApiError('invalid_input', 'Advance 0–400 days.');
        core.clock.offsetMs = days === 0 ? 0 : core.clock.offsetMs + days * 86_400_000;
        await core.store.put('meta', 'clock', { offsetMs: core.clock.offsetMs });
        // Process renewals / expiries that became due so the result is visible immediately.
        await reconcile(core, user);
        await core.audit(null, 'clock.advance', undefined, 'allowed', { days, offsetMs: core.clock.offsetMs });
        return core.clock.now();
      });
    },
  };
}

/** Refund a charge: ledger entry, entitlement change, commission reversal. Idempotent. */
async function issueRefund(core: Core, transactionId: string) {
  const txn = await core.store.get<Transaction>('transactions', transactionId);
  if (!txn) throw new ApiError('not_found', 'Transaction not found.');
  if (txn.status === 'refunded') return;
  // Only successful paid charges can be refunded (not trials, failed charges or refunds themselves).
  if (txn.status !== 'succeeded' || txn.type === 'refund' || txn.type === 'trial_start' || txn.amountCents <= 0) {
    throw new ApiError('not_refundable', 'This transaction cannot be refunded.');
  }
  const user = await core.store.get<User>('users', txn.userId);
  const sub = await core.store.get<Subscription>('subscriptions', txn.userId);
  if (!user || !sub) throw new ApiError('not_found', 'Account not found.');
  await core.store.put('transactions', txn.id, { ...txn, status: 'refunded' });
  const t = applyRefund(sub, txn, core.clock.now());
  await commit(core, user, t);
  await core.track('refund', { deviceId: user.deviceId, valueCents: txn.amountCents });
  await reverseCommission(core, txn.id);
  await core.audit(null, 'billing.refund_issued', txn.id, 'allowed', { amountCents: txn.amountCents });
}
