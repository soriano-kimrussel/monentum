import { DAY_MS } from '../dates';
import {
  GRACE_DAYS,
  PLANS,
  TRIAL_DAYS,
  advance,
  applyRefund,
  cancel,
  changePlan,
  isPremium,
  newSubscription,
  purchase,
  refundEligibility,
  restoreFromLedger,
  resume,
  retryPayment,
  startTrial,
  type Subscription,
  type Transaction,
} from '../subscription';

const T0 = '2026-01-01T00:00:00.000Z';
const at = (days: number) => new Date(new Date(T0).getTime() + days * DAY_MS).toISOString();
const fresh = (over: Partial<Subscription> = {}) => ({ ...newSubscription('u1', T0), ...over });

describe('trial', () => {
  it('starts a 7-day trial once and grants premium', () => {
    const { sub, txns } = startTrial(fresh(), 'premium_monthly', T0);
    expect(sub.status).toBe('trialing');
    expect(isPremium(sub, at(TRIAL_DAYS - 0.01))).toBe(true);
    expect(txns[0]).toMatchObject({ type: 'trial_start', amountCents: 0 });
    expect(() => startTrial(sub, 'premium_monthly', T0)).toThrow(/already been used/);
  });

  it('converts to paid at trial end when the card works', () => {
    const { sub } = startTrial(fresh(), 'premium_monthly', T0);
    const r = advance(sub, at(TRIAL_DAYS));
    expect(r.sub.status).toBe('active');
    expect(r.txns).toEqual([expect.objectContaining({ type: 'trial_conversion', amountCents: PLANS.premium_monthly.priceCents, status: 'succeeded' })]);
  });

  it('expires at trial end when canceled during the trial (no charge)', () => {
    const trial = startTrial(fresh(), 'premium_monthly', T0).sub;
    const canceled = cancel(trial, at(2)).sub;
    expect(isPremium(canceled, at(3))).toBe(true); // still has access until trial end
    const r = advance(canceled, at(TRIAL_DAYS + 1));
    expect(r.sub.status).toBe('expired');
    expect(r.txns).toHaveLength(0);
    expect(isPremium(r.sub, at(TRIAL_DAYS + 1))).toBe(false);
  });

  it('goes past_due with a grace period when the conversion charge fails, then expires', () => {
    const trial = startTrial(fresh({ paymentMethod: 'sim_fail_on_renewal' }), 'premium_monthly', T0).sub;
    const failed = advance(trial, at(TRIAL_DAYS));
    expect(failed.sub.status).toBe('past_due');
    expect(failed.txns[0].status).toBe('failed');
    expect(isPremium(failed.sub, at(TRIAL_DAYS + 1))).toBe(true); // grace keeps access
    expect(advance(failed.sub, at(TRIAL_DAYS + GRACE_DAYS)).sub.status).toBe('expired');
  });
});

describe('purchase, renewal, plan changes', () => {
  it('declines with the declining demo card and records a failed transaction', () => {
    const r = purchase(fresh({ paymentMethod: 'sim_decline' }), 'premium_monthly', T0);
    expect(r.sub.status).toBe('none');
    expect(r.txns[0].status).toBe('failed');
  });

  it('renews repeatedly when the clock jumps several periods', () => {
    const active = purchase(fresh(), 'premium_monthly', T0).sub;
    const r = advance(active, at(95));
    expect(r.txns.filter((t) => t.type === 'renewal')).toHaveLength(3);
    expect(r.sub.status).toBe('active');
  });

  it('cancel at period end, resume, and expire', () => {
    const active = purchase(fresh(), 'premium_monthly', T0).sub;
    const canceled = cancel(active, at(5)).sub;
    expect(canceled.cancelAtPeriodEnd).toBe(true);
    expect(resume(canceled, at(6)).sub.cancelAtPeriodEnd).toBe(false);
    expect(advance(canceled, at(31)).sub.status).toBe('expired');
  });

  it('upgrades immediately with proration credit', () => {
    const monthly = purchase(fresh(), 'premium_monthly', T0).sub;
    const r = changePlan(monthly, 'premium_annual', at(15));
    expect(r.sub.plan).toBe('premium_annual');
    const credit = Math.round(PLANS.premium_monthly.priceCents / 2);
    expect(r.txns[0].amountCents).toBe(PLANS.premium_annual.priceCents - credit);
  });

  it('schedules downgrades for the next renewal', () => {
    const annual = purchase(fresh(), 'premium_annual', T0).sub;
    const r = changePlan(annual, 'premium_monthly', at(10));
    expect(r.sub.plan).toBe('premium_annual');
    expect(r.sub.pendingPlan).toBe('premium_monthly');
    const renewed = advance(r.sub, at(366));
    expect(renewed.sub.plan).toBe('premium_monthly');
    expect(renewed.txns[0].amountCents).toBe(PLANS.premium_monthly.priceCents);
  });

  it('recovers from past_due when payment is retried with a working card', () => {
    const active = purchase(fresh({ paymentMethod: 'sim_fail_on_renewal' }), 'premium_monthly', T0).sub;
    const pastDue = advance(active, at(30)).sub;
    expect(pastDue.status).toBe('past_due');
    const stillFailing = retryPayment(pastDue, at(31));
    expect(stillFailing.sub.graceEndsAt).toBe(pastDue.graceEndsAt);
    const fixed = retryPayment({ ...pastDue, paymentMethod: 'sim_success' }, at(31));
    expect(fixed.sub.status).toBe('active');
  });
});

describe('refunds and restore', () => {
  const txn = (over: Partial<Transaction> = {}): Transaction => ({
    id: 't1', userId: 'u1', type: 'purchase', plan: 'premium_monthly', amountCents: 499, status: 'succeeded', createdAt: T0, periodStart: T0, periodEnd: at(30), ...over,
  });

  it('enforces refund eligibility rules', () => {
    expect(refundEligibility(txn(), [], 'u1', at(1))).toBeNull();
    expect(refundEligibility(txn(), [], 'u2', at(1))).toBe('not_owner');
    expect(refundEligibility(txn(), [], 'u1', at(15))).toBe('window_closed');
    expect(refundEligibility(txn({ type: 'trial_start', amountCents: 0 }), [], 'u1', at(1))).toBe('not_refundable');
    expect(refundEligibility(txn(), [{ id: 'r', userId: 'u1', transactionId: 't1', reason: 'x', status: 'pending', createdAt: T0 }], 'u1', at(1))).toBe('duplicate_request');
  });

  it('revokes access when refunding the charge that funds the current period', () => {
    const active = purchase(fresh(), 'premium_monthly', T0).sub;
    const r = applyRefund(active, txn({ periodEnd: active.currentPeriodEnd }), at(2));
    expect(r.sub.status).toBe('refunded');
    expect(isPremium(r.sub, at(2))).toBe(false);
    expect(r.txns[0]).toMatchObject({ type: 'refund', amountCents: -499 });
  });

  it('restores entitlement from the ledger', () => {
    const restored = restoreFromLedger(fresh(), [txn()], at(3));
    expect(restored.status).toBe('active');
    expect(restoreFromLedger(fresh(), [txn({ status: 'refunded' })], at(3)).status).toBe('none');
  });
});
