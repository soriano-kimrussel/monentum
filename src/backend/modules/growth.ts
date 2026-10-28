// Affiliates, campaigns and the advertising-attribution simulator. All local; no ad SDKs.
import { DAY_MS } from '../../domain/dates';
import {
  ATTRIBUTION_WINDOW_DAYS,
  attributionReport,
  canTransitionCommission,
  commissionFor,
  type Affiliate,
  type AnalyticsEvent,
  type Campaign,
  type Commission,
  type CommissionStatus,
} from '../../domain/growth';
import type { User } from '../../domain/types';
import { randomId } from '../../lib/crypto';
import { ApiError, Core } from '../core';

/** Create a pending commission if the buyer was attributed to an affiliate campaign. */
export async function recordCommission(core: Core, user: User, sourceId: string, saleCents: number) {
  if (!user.attribution || saleCents <= 0) return;
  if (core.clock.nowMs() - new Date(user.attribution.at).getTime() > ATTRIBUTION_WINDOW_DAYS * DAY_MS) return;
  const campaign = await core.store.get<Campaign>('campaigns', user.attribution.campaignId);
  if (!campaign?.affiliateId) return;
  const affiliate = await core.store.get<Affiliate>('affiliates', campaign.affiliateId);
  if (!affiliate) return;
  // One commission per source transaction/order, even if this is called twice.
  const id = `com_${sourceId}`;
  if (await core.store.get('commissions', id)) return;
  const now = core.clock.now();
  const commission: Commission = {
    id,
    affiliateId: affiliate.id,
    campaignId: campaign.id,
    sourceId,
    saleCents,
    amountCents: commissionFor(saleCents, affiliate.commissionBps),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  await core.store.put('commissions', id, commission);
}

/** Reverse the commission tied to a refunded sale (unless already paid out). */
export async function reverseCommission(core: Core, sourceId: string) {
  const c = await core.store.get<Commission>('commissions', `com_${sourceId}`);
  if (c && canTransitionCommission(c.status, 'reversed')) {
    await core.store.put('commissions', c.id, { ...c, status: 'reversed', updatedAt: core.clock.now() });
  }
}

export function growthApi(core: Core) {
  return {
    /** Public: a simulated ad / affiliate link was opened on this device. */
    async campaignClick(code: string, deviceId: string): Promise<Campaign> {
      return core.mutate(async () => {
        if (!(await core.hit(`adclick:${deviceId}`, 30, 60 * 60 * 1000))) throw new ApiError('rate_limited', 'Too many clicks.');
        const campaign = (await core.store.list<Campaign>('campaigns', { code }))[0];
        if (!campaign) throw new ApiError('not_found', 'Unknown campaign.');
        await core.track('campaign_click', { deviceId, campaignId: campaign.id });
        return campaign;
      });
    },

    async affiliates(token: string) {
      await core.requireRole(token, 'admin');
      const [affiliates, campaigns, commissions] = await Promise.all([
        core.store.list<Affiliate>('affiliates'),
        core.store.list<Campaign>('campaigns'),
        core.store.list<Commission>('commissions'),
      ]);
      return {
        affiliates: affiliates.map((a) => {
          const mine = commissions.filter((c) => c.affiliateId === a.id);
          const sum = (s: CommissionStatus) => mine.filter((c) => c.status === s).reduce((t, c) => t + c.amountCents, 0);
          return { ...a, pending: sum('pending'), approved: sum('approved'), paid: sum('paid'), reversed: sum('reversed') };
        }),
        campaigns,
        commissions: commissions.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      };
    },

    async createAffiliate(token: string, name: string, commissionBps: number) {
      return core.mutate(async () => {
        const admin = await core.requireRole(token, 'admin');
        const clean = name.trim().slice(0, 60);
        if (!clean) throw new ApiError('invalid_input', 'Name required.');
        if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 5000) throw new ApiError('invalid_input', 'Commission must be 0–50%.');
        const a: Affiliate = { id: randomId('aff_'), name: clean, commissionBps, createdAt: core.clock.now() };
        await core.store.put('affiliates', a.id, a);
        const campaign: Campaign = { id: randomId('cmp_'), affiliateId: a.id, name: `${clean} link`, channel: 'influencer', code: `AFF-${a.id.slice(-6).toUpperCase()}`, createdAt: a.createdAt };
        await core.store.put('campaigns', campaign.id, campaign);
        await core.audit(admin.id, 'affiliate.create', a.id);
        return a;
      });
    },

    async setCommissionStatus(token: string, id: string, to: CommissionStatus) {
      return core.mutate(async () => {
        const admin = await core.requireRole(token, 'admin');
        const c = await core.store.get<Commission>('commissions', id);
        if (!c) throw new ApiError('not_found', 'Commission not found.');
        if (!canTransitionCommission(c.status, to)) throw new ApiError('bad_transition', `Can’t move a ${c.status} commission to ${to}.`);
        await core.store.put('commissions', id, { ...c, status: to, updatedAt: core.clock.now() });
        await core.audit(admin.id, `commission.${to}`, id, 'allowed', { amountCents: c.amountCents });
      });
    },

    async events(token: string, limit = 200): Promise<AnalyticsEvent[]> {
      await core.requireRole(token, 'admin');
      return (await core.store.list<AnalyticsEvent>('events')).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
    },

    async attribution(token: string) {
      await core.requireRole(token, 'admin');
      const [events, campaigns] = await Promise.all([core.store.list<AnalyticsEvent>('events'), core.store.list<Campaign>('campaigns')]);
      const report = attributionReport(events, campaigns.map((c) => c.id));
      return report.map((r) => ({ ...r, campaign: campaigns.find((c) => c.id === r.campaignId)! }));
    },

    /** Generate synthetic campaign traffic so attribution reports have something to show. */
    async simulateTraffic(token: string, clicks = 40) {
      return core.mutate(async () => {
        const admin = await core.requireRole(token, 'admin');
        const campaigns = await core.store.list<Campaign>('campaigns');
        if (!campaigns.length) throw new ApiError('no_campaigns', 'Create a campaign first.');
        const n = Math.min(Math.max(1, clicks), 200);
        for (let i = 0; i < n; i++) {
          const campaign = campaigns[i % campaigns.length];
          const deviceId = randomId('simdev_');
          const t0 = core.clock.nowMs() - Math.floor(Math.random() * 20) * DAY_MS;
          await core.track('campaign_click', { deviceId, campaignId: campaign.id, at: new Date(t0).toISOString() });
          if (Math.random() < 0.35) {
            await core.track('signup', { deviceId, at: new Date(t0 + 3_600_000).toISOString() });
            if (Math.random() < 0.3) {
              await core.track('purchase', { deviceId, valueCents: Math.random() < 0.5 ? 499 : 3999, at: new Date(t0 + 2 * DAY_MS).toISOString(), props: { simulated: true } });
            }
          }
        }
        await core.audit(admin.id, 'analytics.simulate', undefined, 'allowed', { clicks: n });
        return n;
      });
    },
  };
}
