// Simulated subscription state machine. Pure functions: every transition takes `now`
// explicitly so a test clock can drive trials, renewals and expirations deterministically.
// No real money moves anywhere in this module.

import { DAY_MS, addMs } from './dates';

export type PaidPlanId = 'premium_monthly' | 'premium_annual';

export interface PlanInfo {
  id: PaidPlanId;
  label: string;
  priceCents: number;
  periodDays: number;
}

export const PLANS: Record<PaidPlanId, PlanInfo> = {
  premium_monthly: { id: 'premium_monthly', label: 'Premium Monthly', priceCents: 499, periodDays: 30 },
  premium_annual: { id: 'premium_annual', label: 'Premium Annual', priceCents: 3999, periodDays: 365 },
};

export const TRIAL_DAYS = 7;
export const GRACE_DAYS = 3;
export const REFUND_WINDOW_DAYS = 14;

/** Simulated payment methods. No card data is ever collected. */
export type PaymentMethodId = 'sim_success' | 'sim_decline' | 'sim_fail_on_renewal';

export const PAYMENT_METHODS: Record<PaymentMethodId, { label: string; description: string }> = {
  sim_success: { label: 'Demo card · always approves', description: 'Every simulated charge succeeds.' },
  sim_decline: { label: 'Demo card · always declines', description: 'Every simulated charge fails.' },
  sim_fail_on_renewal: {
    label: 'Demo card · fails on renewal',
    description: 'First charge succeeds; renewals and trial conversions fail.',
  },
};

export type SubStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'expired' | 'refunded';

export interface Subscription {
  userId: string;
  plan: PaidPlanId | null;
  status: SubStatus;
  trialUsed: boolean;
  trialEndsAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  /** Downgrade scheduled for the next renewal. */
  pendingPlan?: PaidPlanId;
  graceEndsAt?: string;
  paymentMethod: PaymentMethodId;
  /** Premium granted by referral rewards, independent of paid status. */
  bonusPremiumUntil?: string;
  updatedAt: string;
}

export type TxnType = 'trial_start' | 'purchase' | 'renewal' | 'trial_conversion' | 'upgrade' | 'refund';

export interface Transaction {
  id: string;
  userId: string;
  type: TxnType;
  plan: PaidPlanId;
  amountCents: number;
  status: 'succeeded' | 'failed' | 'refunded';
  periodStart?: string;
  periodEnd?: string;
  createdAt: string;
  /** For refunds: the transaction that was refunded. */
  refundOf?: string;
}

export interface RefundRequest {
  id: string;
  userId: string;
  transactionId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
}

export class SubscriptionError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

export function newSubscription(userId: string, now: string): Subscription {
  return { userId, plan: null, status: 'none', trialUsed: false, cancelAtPeriodEnd: false, paymentMethod: 'sim_success', updatedAt: now };
}

export function simulateCharge(method: PaymentMethodId, kind: 'initial' | 'renewal'): boolean {
  if (method === 'sim_decline') return false;
  if (method === 'sim_fail_on_renewal') return kind === 'initial';
  return true;
}

const periodEnd = (start: string, plan: PaidPlanId) => addMs(start, PLANS[plan].periodDays * DAY_MS);

/** Whether paid features are unlocked at `now`. Grace period keeps access (industry norm). */
export function isPremium(sub: Subscription, now: string): boolean {
  if (sub.bonusPremiumUntil && now < sub.bonusPremiumUntil) return true;
  switch (sub.status) {
    case 'trialing':
      return !!sub.trialEndsAt && now < sub.trialEndsAt;
    case 'active':
      return !!sub.currentPeriodEnd && now < sub.currentPeriodEnd;
    case 'past_due':
      return !!sub.graceEndsAt && now < sub.graceEndsAt;
    default:
      return false;
  }
}

export interface Transition {
  sub: Subscription;
  txns: Omit<Transaction, 'id' | 'userId'>[];
}

export function startTrial(sub: Subscription, plan: PaidPlanId, now: string): Transition {
  if (sub.trialUsed) throw new SubscriptionError('trial_used', 'The free trial has already been used on this account.');
  if (isPaidAccess(sub, now)) throw new SubscriptionError('already_subscribed', 'You already have Premium.');
  const trialEndsAt = addMs(now, TRIAL_DAYS * DAY_MS);
  return {
    sub: { ...sub, plan, status: 'trialing', trialUsed: true, trialEndsAt, cancelAtPeriodEnd: false, pendingPlan: undefined, graceEndsAt: undefined, updatedAt: now },
    txns: [{ type: 'trial_start', plan, amountCents: 0, status: 'succeeded', periodStart: now, periodEnd: trialEndsAt, createdAt: now }],
  };
}

function isPaidAccess(sub: Subscription, now: string) {
  return (sub.status === 'active' || sub.status === 'past_due') && isPremium({ ...sub, bonusPremiumUntil: undefined }, now);
}

/** Immediate purchase (also converts a trial early). */
export function purchase(sub: Subscription, plan: PaidPlanId, now: string): Transition {
  if (isPaidAccess(sub, now)) throw new SubscriptionError('already_subscribed', 'Use change plan instead.');
  const ok = simulateCharge(sub.paymentMethod, 'initial');
  const amountCents = PLANS[plan].priceCents;
  if (!ok) {
    return { sub: { ...sub, updatedAt: now }, txns: [{ type: 'purchase', plan, amountCents, status: 'failed', createdAt: now }] };
  }
  const end = periodEnd(now, plan);
  return {
    sub: { ...sub, plan, status: 'active', currentPeriodStart: now, currentPeriodEnd: end, trialEndsAt: undefined, cancelAtPeriodEnd: false, pendingPlan: undefined, graceEndsAt: undefined, updatedAt: now },
    txns: [{ type: 'purchase', plan, amountCents, status: 'succeeded', periodStart: now, periodEnd: end, createdAt: now }],
  };
}

/**
 * Upgrade (monthly → annual) applies immediately with a prorated credit for unused time.
 * Downgrade (annual → monthly) is scheduled for the next renewal.
 */
export function changePlan(sub: Subscription, plan: PaidPlanId, now: string): Transition {
  if (sub.status !== 'active' || !sub.plan || !sub.currentPeriodStart || !sub.currentPeriodEnd) {
    throw new SubscriptionError('not_active', 'Only an active paid subscription can change plans.');
  }
  if (sub.plan === plan) {
    // Re-selecting the current plan cancels a scheduled downgrade.
    return { sub: { ...sub, pendingPlan: undefined, updatedAt: now }, txns: [] };
  }
  if (PLANS[plan].priceCents < PLANS[sub.plan].priceCents) {
    return { sub: { ...sub, pendingPlan: plan, updatedAt: now }, txns: [] };
  }
  const total = new Date(sub.currentPeriodEnd).getTime() - new Date(sub.currentPeriodStart).getTime();
  const left = Math.max(0, new Date(sub.currentPeriodEnd).getTime() - new Date(now).getTime());
  const credit = Math.round((PLANS[sub.plan].priceCents * left) / total);
  const amountCents = Math.max(0, PLANS[plan].priceCents - credit);
  if (!simulateCharge(sub.paymentMethod, 'initial')) {
    return { sub: { ...sub, updatedAt: now }, txns: [{ type: 'upgrade', plan, amountCents, status: 'failed', createdAt: now }] };
  }
  const end = periodEnd(now, plan);
  return {
    sub: { ...sub, plan, currentPeriodStart: now, currentPeriodEnd: end, pendingPlan: undefined, cancelAtPeriodEnd: false, updatedAt: now },
    txns: [{ type: 'upgrade', plan, amountCents, status: 'succeeded', periodStart: now, periodEnd: end, createdAt: now }],
  };
}

export function cancel(sub: Subscription, now: string): Transition {
  if (sub.status !== 'active' && sub.status !== 'trialing' && sub.status !== 'past_due') {
    throw new SubscriptionError('nothing_to_cancel', 'There is no subscription to cancel.');
  }
  if (sub.status === 'past_due') {
    // No paid period left to honour: end immediately.
    return { sub: { ...sub, status: 'expired', graceEndsAt: undefined, cancelAtPeriodEnd: false, updatedAt: now }, txns: [] };
  }
  return { sub: { ...sub, cancelAtPeriodEnd: true, updatedAt: now }, txns: [] };
}

export function resume(sub: Subscription, now: string): Transition {
  if (!sub.cancelAtPeriodEnd || !isPremium({ ...sub, bonusPremiumUntil: undefined }, now)) {
    throw new SubscriptionError('cannot_resume', 'Nothing to resume.');
  }
  return { sub: { ...sub, cancelAtPeriodEnd: false, updatedAt: now }, txns: [] };
}

/** Process every time-based event that is due at `now` (trial end, renewals, grace expiry). */
export function advance(sub: Subscription, now: string): Transition {
  let s = sub;
  const txns: Transition['txns'] = [];
  for (let guard = 0; guard < 500; guard++) {
    if (s.status === 'trialing' && s.trialEndsAt && now >= s.trialEndsAt && s.plan) {
      const at = s.trialEndsAt;
      if (s.cancelAtPeriodEnd) {
        s = { ...s, status: 'expired', cancelAtPeriodEnd: false, updatedAt: at };
        continue;
      }
      s = chargeRenewal(s, s.plan, at, 'trial_conversion', txns);
      continue;
    }
    if (s.status === 'active' && s.currentPeriodEnd && now >= s.currentPeriodEnd && s.plan) {
      const at = s.currentPeriodEnd;
      if (s.cancelAtPeriodEnd) {
        s = { ...s, status: 'expired', cancelAtPeriodEnd: false, pendingPlan: undefined, updatedAt: at };
        continue;
      }
      s = chargeRenewal(s, s.pendingPlan ?? s.plan, at, 'renewal', txns);
      continue;
    }
    if (s.status === 'past_due' && s.graceEndsAt && now >= s.graceEndsAt) {
      s = { ...s, status: 'expired', graceEndsAt: undefined, updatedAt: s.graceEndsAt };
      continue;
    }
    break;
  }
  return { sub: s, txns };
}

function chargeRenewal(s: Subscription, plan: PaidPlanId, at: string, type: TxnType, txns: Transition['txns']): Subscription {
  const amountCents = PLANS[plan].priceCents;
  if (simulateCharge(s.paymentMethod, 'renewal')) {
    const end = periodEnd(at, plan);
    txns.push({ type, plan, amountCents, status: 'succeeded', periodStart: at, periodEnd: end, createdAt: at });
    return { ...s, plan, status: 'active', currentPeriodStart: at, currentPeriodEnd: end, pendingPlan: undefined, trialEndsAt: undefined, updatedAt: at };
  }
  txns.push({ type, plan, amountCents, status: 'failed', createdAt: at });
  return { ...s, plan, status: 'past_due', graceEndsAt: addMs(at, GRACE_DAYS * DAY_MS), updatedAt: at };
}

/** Retry a failed payment during the grace period (e.g. after switching demo card). */
export function retryPayment(sub: Subscription, now: string): Transition {
  if (sub.status !== 'past_due' || !sub.plan) throw new SubscriptionError('not_past_due', 'No failed payment to retry.');
  const txns: Transition['txns'] = [];
  const next = chargeRenewal({ ...sub, graceEndsAt: undefined }, sub.plan, now, 'renewal', txns);
  // A failed retry keeps the ORIGINAL grace deadline.
  return { sub: next.status === 'past_due' ? { ...next, graceEndsAt: sub.graceEndsAt } : next, txns };
}

export function refundEligibility(txn: Transaction, existing: RefundRequest[], userId: string, now: string): string | null {
  if (txn.userId !== userId) return 'not_owner';
  if (txn.type === 'refund' || txn.type === 'trial_start') return 'not_refundable';
  if (txn.status !== 'succeeded' || txn.amountCents <= 0) return 'not_refundable';
  if (new Date(now).getTime() - new Date(txn.createdAt).getTime() > REFUND_WINDOW_DAYS * DAY_MS) return 'window_closed';
  if (existing.some((r) => r.transactionId === txn.id && r.status !== 'rejected')) return 'duplicate_request';
  return null;
}

/** Apply an approved refund. Refunding the charge that funds the current period revokes access. */
export function applyRefund(sub: Subscription, txn: Transaction, now: string): Transition {
  const fundsCurrentPeriod = txn.periodEnd !== undefined && txn.periodEnd === sub.currentPeriodEnd && sub.status === 'active';
  const next: Subscription = fundsCurrentPeriod
    ? { ...sub, status: 'refunded', currentPeriodEnd: now, cancelAtPeriodEnd: false, pendingPlan: undefined, updatedAt: now }
    : { ...sub, updatedAt: now };
  return {
    sub: next,
    txns: [{ type: 'refund', plan: txn.plan, amountCents: -txn.amountCents, status: 'succeeded', createdAt: now, refundOf: txn.id }],
  };
}

/**
 * "Restore purchases": rebuild entitlement from the transaction ledger, the way a store
 * receipt refresh would. Here the ledger is local, so this does NOT prove a real store purchase.
 */
export function restoreFromLedger(sub: Subscription, ledger: Transaction[], now: string): Subscription {
  const live = ledger
    .filter((t) => t.status === 'succeeded' && t.type !== 'refund' && t.type !== 'trial_start' && t.periodEnd && t.periodEnd > now)
    .sort((a, b) => (a.periodEnd! < b.periodEnd! ? 1 : -1))[0];
  if (!live) return sub;
  return { ...sub, plan: live.plan, status: 'active', currentPeriodStart: live.periodStart, currentPeriodEnd: live.periodEnd, updatedAt: now };
}

export const FREE_LIMITS = { habits: 3, goals: 1, analyticsDays: 7 } as const;
export const PREMIUM_LIMITS = { habits: 50, goals: 25, analyticsDays: 90 } as const;

export function limitsFor(premium: boolean) {
  return premium ? PREMIUM_LIMITS : FREE_LIMITS;
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}
