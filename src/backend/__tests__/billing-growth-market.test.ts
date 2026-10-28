import { PLANS } from '../../domain/subscription';
import { seedIfNeeded, DEMO_ACCOUNTS } from '../seed';
import { DAY, HABIT, makeAdmin, makeBackend, signUp } from '../testUtils';

describe('subscriptions (simulated)', () => {
  it('runs trial → conversion → renewal on the test clock', async () => {
    const { backend } = makeBackend();
    const { token } = await signUp(backend);
    await backend.billing.startTrial(token, 'premium_monthly');
    expect((await backend.billing.status(token)).sub.status).toBe('trialing');
    await backend.billing.advanceClock(token, 8);
    const s = await backend.billing.status(token);
    expect(s.sub.status).toBe('active');
    expect(s.premium).toBe(true);
    await backend.billing.advanceClock(token, 31);
    const txns = await backend.billing.transactions(token);
    expect(txns.map((t) => t.type)).toEqual(['renewal', 'trial_conversion', 'trial_start']);
  });

  it('handles failed renewal → past_due → retry with a working card', async () => {
    const { backend } = makeBackend();
    const { token } = await signUp(backend);
    await backend.billing.setPaymentMethod(token, 'sim_fail_on_renewal');
    await backend.billing.purchase(token, 'premium_monthly');
    await backend.billing.advanceClock(token, 30);
    expect((await backend.billing.status(token)).sub.status).toBe('past_due');
    await expect(backend.billing.retryPayment(token)).rejects.toMatchObject({ code: 'payment_declined' });
    await backend.billing.setPaymentMethod(token, 'sim_success');
    await backend.billing.retryPayment(token);
    expect((await backend.billing.status(token)).sub.status).toBe('active');
  });

  it('rejects unknown plans and payment methods', async () => {
    const { backend } = makeBackend();
    const { token } = await signUp(backend);
    await expect(backend.billing.purchase(token, 'premium_free_forever')).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(backend.billing.setPaymentMethod(token, 'real_visa')).rejects.toMatchObject({ code: 'invalid_input' });
  });

  it('refund flow: request → admin approve → access revoked, duplicates blocked', async () => {
    const { backend } = makeBackend();
    const admin = await makeAdmin(backend);
    const { token } = await signUp(backend);
    const { txns } = await backend.billing.purchase(token, 'premium_annual');
    const req = await backend.billing.requestRefund(token, txns[0].id, 'Changed my mind');
    await expect(backend.billing.requestRefund(token, txns[0].id, 'Again please')).rejects.toMatchObject({ code: 'duplicate_request' });
    await backend.billing.decideRefund(admin, req.id, true);
    await expect(backend.billing.decideRefund(admin, req.id, true)).rejects.toMatchObject({ code: 'already_decided' });
    const s = await backend.billing.status(token);
    expect(s.sub.status).toBe('refunded');
    expect(s.premium).toBe(false);
    const ledger = await backend.billing.transactions(token);
    expect(ledger.find((t) => t.type === 'refund')?.amountCents).toBe(-PLANS.premium_annual.priceCents);
  });

  it('rejected refunds leave the subscription alone; other users can’t refund your charge', async () => {
    const { backend } = makeBackend();
    const admin = await makeAdmin(backend);
    const a = await signUp(backend);
    const b = await signUp(backend);
    const { txns } = await backend.billing.purchase(a.token, 'premium_monthly');
    await expect(backend.billing.requestRefund(b.token, txns[0].id, 'not mine')).rejects.toMatchObject({ code: 'not_owner' });
    const req = await backend.billing.requestRefund(a.token, txns[0].id, 'Please');
    await backend.billing.decideRefund(admin, req.id, false, 'Outside policy');
    expect((await backend.billing.status(a.token)).premium).toBe(true);
  });

  it('restores purchases from the ledger', async () => {
    const { backend, store } = makeBackend();
    const { token, user } = await signUp(backend);
    await backend.billing.purchase(token, 'premium_monthly');
    // Simulate a lost local entitlement (e.g. reinstall).
    const sub = await store.get<Record<string, unknown>>('subscriptions', user.id);
    await store.put('subscriptions', user.id, { ...sub, status: 'none', plan: null });
    const r = await backend.billing.restore(token);
    expect(r.restored).toBe(true);
    expect((await backend.billing.status(token)).premium).toBe(true);
  });
});

describe('webhooks (mock provider)', () => {
  it('processes a signed refund event once, rejects tampering and dedupes replays', async () => {
    const { backend } = makeBackend();
    const { token } = await signUp(backend);
    const { txns } = await backend.billing.purchase(token, 'premium_monthly');
    const { body, signature } = backend.billing.signEvent('charge.refunded', { transactionId: txns[0].id });

    await expect(backend.billing.receiveWebhook(body.replace(txns[0].id, 'txn_other'), signature)).rejects.toMatchObject({ code: 'webhook_bad_signature' });
    expect(await backend.billing.receiveWebhook(body, signature)).toEqual({ status: 'processed' });
    expect(await backend.billing.receiveWebhook(body, signature)).toEqual({ status: 'duplicate' });
    expect((await backend.billing.status(token)).sub.status).toBe('refunded');
  });
});

describe('referrals', () => {
  it('rewards the referrer once, after the referee’s first check-in', async () => {
    const { backend } = makeBackend();
    const referrer = await signUp(backend);
    const referee = await signUp(backend, { referralCode: referrer.user.referralCode });
    expect((await backend.billing.status(referrer.token)).premium).toBe(false);
    const h = await backend.content.createHabit(referee.token, HABIT);
    await backend.content.toggleCheckIn(referee.token, h.id, backend.content.today());
    await backend.content.toggleCheckIn(referee.token, h.id, backend.content.today());
    await backend.content.toggleCheckIn(referee.token, h.id, backend.content.today());
    const mine = await backend.referrals.mine(referrer.token);
    expect(mine).toMatchObject({ signups: 1, rewarded: 1 });
    const s = await backend.billing.status(referrer.token);
    expect(s.premium).toBe(true);
    const days = (new Date(s.sub.bonusPremiumUntil!).getTime() - Date.now()) / DAY;
    expect(Math.round(days)).toBe(7);
  });

  it('blocks self-referral via email alias and same device, without blocking honest sign-up', async () => {
    const { backend } = makeBackend();
    const referrer = await signUp(backend, { email: 'sam@example.com', deviceId: 'phone-1' });
    // Alias addresses are treated as the same mailbox, so the alias account can't even be created.
    await expect(signUp(backend, { email: 's.a.m+2@example.com', referralCode: referrer.user.referralCode, deviceId: 'phone-9' })).rejects.toMatchObject({ code: 'email_taken' });
    const sameDevice = await signUp(backend, { referralCode: referrer.user.referralCode, deviceId: 'phone-1' });
    expect(sameDevice.token).toBeTruthy();
    const mine = await backend.referrals.mine(referrer.token);
    expect(mine).toMatchObject({ signups: 0, blocked: 1, rewarded: 0 });
    expect(mine.records[0].blockReason).toBe('same_device');
  });

  it('respects the per-referrer reward cap', async () => {
    const { backend } = makeBackend();
    const admin = await makeAdmin(backend);
    await backend.referrals.setConfig(admin, { trigger: 'signup', rewardDays: 3, maxRewardsPerReferrer: 2 });
    const referrer = await signUp(backend);
    for (let i = 0; i < 4; i++) await signUp(backend, { referralCode: referrer.user.referralCode });
    expect(await backend.referrals.mine(referrer.token)).toMatchObject({ signups: 4, rewarded: 2 });
  });
});

describe('affiliates and attribution', () => {
  it('creates a commission for attributed purchases and reverses it on refund', async () => {
    const { backend } = makeBackend();
    const admin = await makeAdmin(backend);
    const aff = await backend.growth.createAffiliate(admin, 'Coach', 2000);
    const { campaigns } = await backend.growth.affiliates(admin);
    const code = campaigns.find((c) => c.affiliateId === aff.id)!.code;
    await backend.growth.campaignClick(code, 'dev-x');
    const buyer = await signUp(backend, { campaignCode: code, deviceId: 'dev-x' });
    const { txns } = await backend.billing.purchase(buyer.token, 'premium_annual');

    let { commissions } = await backend.growth.affiliates(admin);
    expect(commissions).toEqual([expect.objectContaining({ status: 'pending', saleCents: 3999, amountCents: 799 })]);

    const req = await backend.billing.requestRefund(buyer.token, txns[0].id, 'Refund please');
    await backend.billing.decideRefund(admin, req.id, true);
    ({ commissions } = await backend.growth.affiliates(admin));
    expect(commissions[0].status).toBe('reversed');
    await expect(backend.growth.setCommissionStatus(admin, commissions[0].id, 'paid')).rejects.toMatchObject({ code: 'bad_transition' });

    const report = await backend.growth.attribution(admin);
    expect(report.find((r) => r.campaign.code === code)).toMatchObject({ clicks: 1, signups: 1, purchases: 1, revenueCents: 0 });
  });

  it('never stores raw identifiers in analytics events', async () => {
    const { backend } = makeBackend();
    const admin = await makeAdmin(backend);
    const { user, email } = await signUp(backend, { deviceId: 'my-real-device-id' });
    const events = JSON.stringify(await backend.growth.events(admin));
    expect(events).not.toContain(email);
    expect(events).not.toContain(user.id);
    expect(events).not.toContain('my-real-device-id');
  });
});

describe('marketplace', () => {
  async function setup() {
    const { backend } = makeBackend();
    const admin = await makeAdmin(backend);
    const listing = await backend.market.saveListing(admin, { title: 'Poster', description: '', category: 'Gear', priceCents: 1200, inventory: 3, icon: 'grid', active: true });
    const buyer = await signUp(backend);
    return { backend, admin, listing, buyer };
  }

  it('is idempotent: the same key never charges or decrements twice', async () => {
    const { backend, listing, buyer } = await setup();
    const cart = [{ listingId: listing.id, qty: 2 }];
    const [a, b] = await Promise.all([backend.market.checkout(buyer.token, cart, 'key_12345678'), backend.market.checkout(buyer.token, cart, 'key_12345678')]);
    expect(a.order.id).toBe(b.order.id);
    expect([a.replayed, b.replayed]).toEqual([false, true]);
    expect((await backend.market.listing(buyer.token, listing.id)).inventory).toBe(1);
    expect(await backend.market.orders(buyer.token)).toHaveLength(1);
  });

  it('prices on the server and refuses to oversell', async () => {
    const { backend, listing, buyer } = await setup();
    const r = await backend.market.checkout(buyer.token, [{ listingId: listing.id, qty: 1, priceCents: 1 } as never], 'key_aaaaaaaa');
    expect(r.order.totalCents).toBe(1200);
    await expect(backend.market.checkout(buyer.token, [{ listingId: listing.id, qty: 3 }], 'key_bbbbbbbb')).rejects.toMatchObject({ code: 'out_of_stock' });
  });

  it('supports repeat purchases, refund requests and restocking on approval', async () => {
    const { backend, admin, listing, buyer } = await setup();
    const first = await backend.market.checkout(buyer.token, [{ listingId: listing.id, qty: 1 }], 'key_first001');
    await backend.market.checkout(buyer.token, first.order.lines.map((l) => ({ listingId: l.listingId, qty: l.qty })), 'key_repeat01');
    expect((await backend.market.listing(buyer.token, listing.id)).inventory).toBe(1);
    await backend.market.requestOrderRefund(buyer.token, first.order.id, 'Arrived damaged');
    await backend.market.decideOrderRefund(admin, first.order.id, true);
    expect((await backend.market.listing(buyer.token, listing.id)).inventory).toBe(2);
    const other = await signUp(backend);
    await expect(backend.market.requestOrderRefund(other.token, first.order.id, 'not mine')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('hides inactive listings from shoppers', async () => {
    const { backend, admin, listing, buyer } = await setup();
    await backend.market.saveListing(admin, { title: 'Poster', description: '', category: 'Gear', priceCents: 1200, inventory: 3, icon: 'grid', active: false }, listing.id);
    expect(await backend.market.listings(buyer.token)).toHaveLength(0);
    expect(await backend.market.listings(admin, true)).toHaveLength(1);
    await expect(backend.market.checkout(buyer.token, [{ listingId: listing.id, qty: 1 }], 'key_inactive')).rejects.toMatchObject({ code: 'unavailable' });
  });
});

describe('seed data', () => {
  it('seeds once and the demo accounts can sign in with the right roles', async () => {
    const { backend } = makeBackend();
    expect(await seedIfNeeded(backend.core)).toBe(true);
    expect(await seedIfNeeded(backend.core)).toBe(false);
    const demo = await backend.auth.signIn(DEMO_ACCOUNTS.user);
    const admin = await backend.auth.signIn(DEMO_ACCOUNTS.admin);
    expect(demo.user.role).toBe('user');
    expect(admin.user.role).toBe('admin');
    expect((await backend.content.habits(demo.token)).length).toBeGreaterThan(0);
    const overview = await backend.admin.overview(admin.token);
    expect(overview.users).toBe(10);
    expect(overview.pendingRefunds).toBe(1);
  });
});
