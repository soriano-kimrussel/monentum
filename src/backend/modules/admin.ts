import { DAY_MS } from '../../domain/dates';
import { PLANS, isPremium, type RefundRequest, type Subscription, type SubStatus, type Transaction } from '../../domain/subscription';
import type { Order } from '../../domain/marketplace';
import type { AuditEntry, Role, Session, User } from '../../domain/types';
import { ApiError, Core, toPublic } from '../core';

export function adminApi(core: Core) {
  return {
    async overview(token: string) {
      await core.requireRole(token, 'admin');
      const now = core.clock.now();
      const [users, subs, txns, refunds, orders] = await Promise.all([
        core.store.list<User>('users'),
        core.store.list<Subscription>('subscriptions'),
        core.store.list<Transaction>('transactions'),
        core.store.list<RefundRequest>('refunds'),
        core.store.list<Order>('orders'),
      ]);
      const byStatus = subs.reduce<Record<SubStatus, number>>(
        (acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }),
        { none: 0, trialing: 0, active: 0, past_due: 0, expired: 0, refunded: 0 },
      );
      // Simulated MRR: monthly-equivalent price of every paying, non-canceling subscription.
      const mrrCents = subs
        .filter((s) => s.status === 'active' && s.plan && !s.cancelAtPeriodEnd)
        .reduce((sum, s) => sum + (s.plan === 'premium_annual' ? Math.round(PLANS.premium_annual.priceCents / 12) : PLANS.premium_monthly.priceCents), 0);
      const since = new Date(core.clock.nowMs() - 30 * DAY_MS).toISOString();
      const revenue30dCents =
        txns.filter((t) => t.createdAt >= since && (t.status === 'succeeded' || t.status === 'refunded')).reduce((s, t) => s + t.amountCents, 0) +
        orders.filter((o) => o.createdAt >= since && o.status !== 'refunded').reduce((s, o) => s + o.totalCents, 0);
      return {
        users: users.length,
        admins: users.filter((u) => u.role === 'admin').length,
        premium: subs.filter((s) => isPremium(s, now)).length,
        byStatus,
        mrrCents,
        revenue30dCents,
        pendingRefunds: refunds.filter((r) => r.status === 'pending').length + orders.filter((o) => o.status === 'refund_requested').length,
        orders: orders.length,
        signupsByDay: bucketByDay(users.map((u) => u.createdAt), core.clock.nowMs(), 14),
      };
    },

    async users(token: string) {
      await core.requireRole(token, 'admin');
      const [users, subs] = await Promise.all([core.store.list<User>('users'), core.store.list<Subscription>('subscriptions')]);
      const now = core.clock.now();
      return users
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map((u) => {
          const sub = subs.find((s) => s.userId === u.id);
          return { ...toPublic(u), sub, premium: !!sub && isPremium(sub, now) };
        });
    },

    async setRole(token: string, userId: string, role: Role) {
      return core.mutate(async () => {
        const admin = await core.requireRole(token, 'admin');
        if (userId === admin.id) throw new ApiError('self_change', 'You can’t change your own role.');
        if (role !== 'user' && role !== 'admin') throw new ApiError('invalid_input', 'Bad role.');
        const user = await core.store.get<User>('users', userId);
        if (!user) throw new ApiError('not_found', 'User not found.');
        await core.store.put('users', userId, { ...user, role });
        await core.audit(admin.id, 'admin.set_role', userId, 'allowed', { role });
      });
    },

    async setDisabled(token: string, userId: string, disabled: boolean) {
      return core.mutate(async () => {
        const admin = await core.requireRole(token, 'admin');
        if (userId === admin.id) throw new ApiError('self_change', 'You can’t disable your own account.');
        const user = await core.store.get<User>('users', userId);
        if (!user) throw new ApiError('not_found', 'User not found.');
        await core.store.put('users', userId, { ...user, disabled });
        if (disabled) {
          // Revoke live sessions immediately.
          for (const s of await core.store.list<Session>('sessions', { userId })) await core.store.remove('sessions', s.id);
        }
        await core.audit(admin.id, disabled ? 'admin.disable_user' : 'admin.enable_user', userId);
      });
    },

    async audit(token: string, limit = 300): Promise<AuditEntry[]> {
      await core.requireRole(token, 'admin');
      return (await core.store.list<AuditEntry>('audit')).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
    },
  };
}

function bucketByDay(isoDates: string[], nowMs: number, days: number): { day: string; count: number }[] {
  const out: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(nowMs - i * DAY_MS).toISOString().slice(0, 10);
    out.push({ day: d, count: isoDates.filter((x) => x.slice(0, 10) === d).length });
  }
  return out;
}
