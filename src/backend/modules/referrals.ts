import { canReward, extendBonus, inviteLink, type ReferralClick, type ReferralConfig, type ReferralRecord } from '../../domain/growth';
import type { Subscription } from '../../domain/subscription';
import type { User } from '../../domain/types';
import { randomId } from '../../lib/crypto';
import { ApiError, Core } from '../core';

/** Grant the referrer their reward exactly once. Must run inside core.mutate. */
export async function rewardReferral(core: Core, record: ReferralRecord): Promise<boolean> {
  const config = await core.referralConfig();
  const all = await core.store.list<ReferralRecord>('referrals');
  const current = all.find((r) => r.id === record.id) ?? record;
  const blocked = canReward(current, all, config);
  if (blocked) {
    await core.audit(null, 'referral.reward', record.id, 'denied', { reason: blocked });
    return false;
  }
  const now = core.clock.now();
  const sub = await core.store.get<Subscription>('subscriptions', record.referrerId);
  if (sub) {
    await core.store.put('subscriptions', record.referrerId, { ...sub, bonusPremiumUntil: extendBonus(sub.bonusPremiumUntil, now, config.rewardDays), updatedAt: now });
  }
  await core.store.put('referrals', record.id, { ...current, status: 'rewarded', rewardedAt: now });
  await core.audit(null, 'referral.reward', record.id, 'allowed', { days: config.rewardDays });
  return true;
}

/** Called after a user's first check-in when the reward trigger is `first_checkin`. */
export async function maybeRewardOnFirstCheckIn(core: Core, userId: string) {
  if ((await core.referralConfig()).trigger !== 'first_checkin') return;
  const record = (await core.store.list<ReferralRecord>('referrals', { refereeId: userId }))[0];
  if (record && record.status === 'signed_up') await rewardReferral(core, record);
}

export function referralsApi(core: Core) {
  return {
    async mine(token: string) {
      const user = await core.authenticate(token);
      const records = await core.store.list<ReferralRecord>('referrals', { referrerId: user.id });
      const clicks = await core.store.list<ReferralClick>('referralClicks', { code: user.referralCode });
      const config = await core.referralConfig();
      return {
        code: user.referralCode,
        link: inviteLink(user.referralCode),
        clicks: clicks.length,
        signups: records.filter((r) => r.status !== 'blocked').length,
        rewarded: records.filter((r) => r.status === 'rewarded').length,
        blocked: records.filter((r) => r.status === 'blocked').length,
        config,
        records: records.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      };
    },

    /** Public: an invite link was opened. Rate limited per device to blunt click spam. */
    async recordClick(code: string, deviceId: string) {
      return core.mutate(async () => {
        if (!(await core.hit(`refclick:${deviceId}`, 20, 60 * 60 * 1000))) throw new ApiError('rate_limited', 'Too many clicks.');
        const exists = (await core.store.list<User>('users', { referralCode: code })).length > 0;
        if (!exists) throw new ApiError('not_found', 'Unknown invite code.');
        const click: ReferralClick = { id: randomId('rcl_'), code, deviceId, at: core.clock.now() };
        await core.store.put('referralClicks', click.id, click);
      });
    },

    async setConfig(token: string, config: ReferralConfig) {
      return core.mutate(async () => {
        const admin = await core.requireRole(token, 'admin');
        if (!['signup', 'first_checkin'].includes(config.trigger)) throw new ApiError('invalid_input', 'Bad trigger.');
        if (!Number.isInteger(config.rewardDays) || config.rewardDays < 1 || config.rewardDays > 90) throw new ApiError('invalid_input', 'Reward days must be 1–90.');
        if (!Number.isInteger(config.maxRewardsPerReferrer) || config.maxRewardsPerReferrer < 1 || config.maxRewardsPerReferrer > 100) throw new ApiError('invalid_input', 'Cap must be 1–100.');
        await core.store.put('meta', 'referralConfig', config);
        await core.audit(admin.id, 'referral.config', undefined, 'allowed', { ...config });
      });
    },

    async all(token: string) {
      await core.requireRole(token, 'admin');
      return (await core.store.list<ReferralRecord>('referrals')).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
  };
}
