import { buildBackup, parseBackup, planRestore } from '../backup';
import {
  attributionReport,
  canReward,
  canTransitionCommission,
  checkReferral,
  commissionFor,
  makeReferralCode,
  isReferralCodeShape,
  sanitizeProps,
  type AnalyticsEvent,
  type ReferralRecord,
} from '../growth';
import { priceCart, supplyDemand, type Listing } from '../marketplace';
import { signPayload, verifyWebhook } from '../webhooks';

describe('referrals', () => {
  const referrer = { id: 'a', email: 'alex@example.com', deviceId: 'dev-a' };

  it('generates well-formed codes', () => {
    expect(isReferralCodeShape(makeReferralCode(new Uint8Array([1, 2, 3, 4, 5, 6])))).toBe(true);
  });

  it('blocks self-referral by account, email alias and device', () => {
    expect(checkReferral({ referrer, referee: { ...referrer }, existing: [] })).toBe('self_referral');
    expect(checkReferral({ referrer, referee: { id: 'b', email: 'Alex+2@example.com' }, existing: [] })).toBe('self_referral');
    expect(checkReferral({ referrer, referee: { id: 'b', email: 'b@example.com', deviceId: 'dev-a' }, existing: [] })).toBe('same_device');
    expect(checkReferral({ referrer, referee: { id: 'b', email: 'b@example.com', deviceId: 'dev-b' }, existing: [] })).toBeNull();
  });

  it('prevents double attribution and duplicate rewards, and enforces the cap', () => {
    const rec = (over: Partial<ReferralRecord>): ReferralRecord => ({ id: 'r1', code: 'MOM-AAAAAA', referrerId: 'a', refereeId: 'b', status: 'signed_up', createdAt: '', ...over });
    expect(checkReferral({ referrer, referee: { id: 'b', email: 'b@x.com' }, existing: [rec({})] })).toBe('already_referred');
    expect(canReward(rec({ status: 'rewarded' }), [], { trigger: 'signup', rewardDays: 7, maxRewardsPerReferrer: 2 })).toBe('already_rewarded');
    const earned = [rec({ id: 'x', status: 'rewarded' }), rec({ id: 'y', status: 'rewarded' })];
    expect(canReward(rec({}), earned, { trigger: 'signup', rewardDays: 7, maxRewardsPerReferrer: 2 })).toBe('reward_cap_reached');
  });
});

describe('affiliates and analytics', () => {
  it('calculates commissions in basis points, rounding down', () => {
    expect(commissionFor(3999, 2000)).toBe(799);
    expect(commissionFor(499, 1500)).toBe(74);
  });

  it('only allows valid commission transitions', () => {
    expect(canTransitionCommission('pending', 'approved')).toBe(true);
    expect(canTransitionCommission('approved', 'paid')).toBe(true);
    expect(canTransitionCommission('paid', 'reversed')).toBe(false);
    expect(canTransitionCommission('reversed', 'approved')).toBe(false);
  });

  it('strips PII from event properties', () => {
    expect(sanitizeProps({ email: 'a@b.com', displayName: 'Alex', plan: 'annual', ref: 'x@y.co', n: 3, ok: true, obj: {} })).toEqual({ plan: 'annual', n: 3, ok: true });
  });

  it('attributes conversions to the last click within the window', () => {
    const e = (name: AnalyticsEvent['name'], at: string, subject: string, campaignId?: string, valueCents?: number): AnalyticsEvent => ({ id: at + name, name, at, subject, campaignId, valueCents, props: {} });
    const report = attributionReport(
      [
        e('campaign_click', '2026-01-01T00:00:00Z', 's1', 'A'),
        e('campaign_click', '2026-01-02T00:00:00Z', 's1', 'B'),
        e('signup', '2026-01-02T01:00:00Z', 's1'),
        e('purchase', '2026-01-03T00:00:00Z', 's1', undefined, 499),
        e('campaign_click', '2026-01-01T00:00:00Z', 's2', 'A'),
        e('signup', '2026-03-01T00:00:00Z', 's2'), // outside 30-day window
      ],
      ['A', 'B'],
    );
    expect(report.find((r) => r.campaignId === 'A')).toMatchObject({ clicks: 2, signups: 0 });
    expect(report.find((r) => r.campaignId === 'B')).toMatchObject({ clicks: 1, signups: 1, purchases: 1, revenueCents: 499, conversionRate: 1 });
  });
});

describe('marketplace', () => {
  const listing = (over: Partial<Listing>): Listing => ({ id: 'l1', title: 'Pack', description: '', category: 'Templates', priceCents: 300, inventory: 5, icon: 'x', active: true, createdAt: '', updatedAt: '', ...over });

  it('prices server-side, merging duplicate lines', () => {
    const r = priceCart([{ listingId: 'l1', qty: 1 }, { listingId: 'l1', qty: 2 }], new Map([['l1', listing({})]]));
    expect(r.totalCents).toBe(900);
    expect(r.lines).toHaveLength(1);
  });

  it('rejects out-of-stock, inactive and invalid quantities', () => {
    const m = new Map([['l1', listing({ inventory: 1 })], ['l2', listing({ id: 'l2', active: false })]]);
    expect(() => priceCart([{ listingId: 'l1', qty: 2 }], m)).toThrow(/Only 1 left/);
    expect(() => priceCart([{ listingId: 'l2', qty: 1 }], m)).toThrow(/no longer available/);
    expect(() => priceCart([{ listingId: 'l1', qty: 0 }], m)).toThrow(/positive/);
    expect(() => priceCart([], m)).toThrow(/empty/);
  });

  it('summarises supply and demand excluding refunded orders', () => {
    const rows = supplyDemand([listing({})], [
      { id: 'o1', userId: 'u', idempotencyKey: 'k', lines: [{ listingId: 'l1', title: '', qty: 2, unitCents: 300 }], totalCents: 600, status: 'paid', createdAt: '', updatedAt: '' },
      { id: 'o2', userId: 'u', idempotencyKey: 'k2', lines: [{ listingId: 'l1', title: '', qty: 9, unitCents: 300 }], totalCents: 2700, status: 'refunded', createdAt: '', updatedAt: '' },
    ]);
    expect(rows.find((r) => r.category === 'Templates')).toEqual({ category: 'Templates', inStock: 5, unitsSold: 2 });
  });
});

describe('webhook signatures (mock secret)', () => {
  const secret = 'whsec_test_only';
  const body = JSON.stringify({ id: 'evt_1', type: 'charge.refunded', createdAt: '', data: {} });

  it('accepts a valid signature', () => {
    expect(verifyWebhook(body, signPayload(body, secret, 1000), secret, 1100).ok).toBe(true);
  });

  it('rejects tampered bodies, wrong secrets, stale and malformed headers', () => {
    const sig = signPayload(body, secret, 1000);
    expect(verifyWebhook(body.replace('refunded', 'succeeded'), sig, secret, 1000)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(verifyWebhook(body, signPayload(body, 'other', 1000), secret, 1000)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(verifyWebhook(body, sig, secret, 1000 + 301)).toEqual({ ok: false, reason: 'stale' });
    expect(verifyWebhook(body, 'garbage', secret, 1000)).toEqual({ ok: false, reason: 'malformed_header' });
  });
});

describe('backup validation', () => {
  const habit = () => ({ id: 'h1', userId: 'u1', name: 'Walk', icon: 'walk', color: '#112233', days: [1, 2], archived: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' });
  const good = () => buildBackup('u1', { habits: [habit() as never], checkIns: [{ id: 'h1_2026-01-02', userId: 'u1', habitId: 'h1', day: '2026-01-02', createdAt: '2026-01-02T00:00:00Z' }], goals: [], moods: [], journal: [] }, '2026-01-03T00:00:00Z');

  it('accepts a valid export', () => {
    expect(parseBackup(JSON.stringify(good())).ok).toBe(true);
  });

  it('rejects malformed files with a helpful message', () => {
    expect(parseBackup('{not json')).toEqual({ ok: false, error: 'File is not valid JSON.' });
    expect(parseBackup(JSON.stringify({ format: 'other' })).ok).toBe(false);
    const bad = good();
    (bad.data.habits[0] as { color: string }).color = 'red';
    expect(parseBackup(JSON.stringify(bad))).toMatchObject({ ok: false, error: expect.stringContaining('data.habits.0.color') });
    const orphan = good();
    orphan.data.checkIns[0].habitId = 'missing';
    expect(parseBackup(JSON.stringify(orphan))).toMatchObject({ ok: false, error: expect.stringContaining('check-ins') });
  });

  it('re-owns and re-keys records from another account', () => {
    let n = 0;
    const plan = planRestore(good(), 'u2', { habits: [], checkIns: [], goals: [], moods: [], journal: [] }, 'merge', () => `new${n++}`);
    expect(plan.data.habits[0]).toMatchObject({ id: 'new0', userId: 'u2' });
    expect(plan.data.checkIns[0]).toMatchObject({ id: 'new0_2026-01-02', habitId: 'new0', userId: 'u2' });
  });
});
