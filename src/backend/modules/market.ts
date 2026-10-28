// SIMULATED marketplace: demo listings, demo orders. Nothing is charged, shipped or fulfilled.
import { MarketError, priceCart, supplyDemand, type CartLine, type Listing, type Order } from '../../domain/marketplace';
import type { User } from '../../domain/types';
import { randomId } from '../../lib/crypto';
import { ApiError, Core } from '../core';
import { cartSchema, listingInputSchema, parse, reasonSchema } from '../schemas';
import { recordCommission, reverseCommission } from './growth';

export function marketApi(core: Core) {
  return {
    async listings(token: string, includeInactive = false) {
      const user = await core.authenticate(token);
      const all = await core.store.list<Listing>('listings');
      // Inactive listings are an admin-only view.
      const visible = includeInactive && user.role === 'admin' ? all : all.filter((l) => l.active);
      return visible.sort((a, b) => a.title.localeCompare(b.title));
    },

    async listing(token: string, id: string) {
      const user = await core.authenticate(token);
      const l = await core.store.get<Listing>('listings', id);
      if (!l || (!l.active && user.role !== 'admin')) throw new ApiError('not_found', 'Listing not found.');
      return l;
    },

    /**
     * Idempotent checkout. Retrying with the same key (double tap, flaky network)
     * returns the original order instead of charging and decrementing stock twice.
     */
    async checkout(token: string, rawCart: unknown, idempotencyKey: string): Promise<{ order: Order; replayed: boolean }> {
      const cart = parse(cartSchema, rawCart) as CartLine[];
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(idempotencyKey)) throw new ApiError('invalid_input', 'Bad idempotency key.');
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        if (!(await core.hit(`checkout:${user.id}`, 10, 60_000))) throw new ApiError('rate_limited', 'Too many checkouts. Slow down a little.');
        const prior = (await core.store.list<Order>('orders', { userId: user.id, idempotencyKey }))[0];
        if (prior) return { order: prior, replayed: true };

        const listings = new Map((await core.store.list<Listing>('listings')).map((l) => [l.id, l]));
        let priced;
        try {
          priced = priceCart(cart, listings);
        } catch (e) {
          if (e instanceof MarketError) throw new ApiError(e.code, e.message);
          throw e;
        }
        const now = core.clock.now();
        for (const line of priced.lines) {
          const l = listings.get(line.listingId)!;
          await core.store.put('listings', l.id, { ...l, inventory: l.inventory - line.qty, updatedAt: now });
        }
        const order: Order = {
          id: randomId('ord_'),
          userId: user.id,
          idempotencyKey,
          lines: priced.lines,
          totalCents: priced.totalCents,
          status: 'paid',
          campaignId: user.attribution?.campaignId,
          createdAt: now,
          updatedAt: now,
        };
        await core.store.put('orders', order.id, order);
        await core.track('order', { deviceId: user.deviceId, valueCents: order.totalCents, props: { lines: order.lines.length } });
        await recordCommission(core, user, order.id, order.totalCents);
        await core.audit(user.id, 'market.checkout', order.id, 'allowed', { totalCents: order.totalCents });
        return { order, replayed: false };
      });
    },

    async orders(token: string) {
      const user = await core.authenticate(token);
      return (await core.store.list<Order>('orders', { userId: user.id })).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },

    async requestOrderRefund(token: string, orderId: string, rawReason: unknown) {
      const reason = parse(reasonSchema, rawReason);
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        const order = await core.owned<Order>('orders', orderId, user);
        if (order.status !== 'paid') throw new ApiError('not_refundable', 'This order can’t be refunded.');
        await core.store.put('orders', order.id, { ...order, status: 'refund_requested', refundReason: reason, updatedAt: core.clock.now() });
        await core.audit(user.id, 'market.refund_request', order.id);
      });
    },

    // ---------- admin ----------

    async allOrders(token: string) {
      await core.requireRole(token, 'admin');
      const [orders, users] = await Promise.all([core.store.list<Order>('orders'), core.store.list<User>('users')]);
      return orders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((o) => ({ ...o, email: users.find((u) => u.id === o.userId)?.email }));
    },

    async decideOrderRefund(token: string, orderId: string, approve: boolean) {
      return core.mutate(async () => {
        const admin = await core.requireRole(token, 'admin');
        const order = await core.store.get<Order>('orders', orderId);
        if (!order) throw new ApiError('not_found', 'Order not found.');
        if (order.status !== 'refund_requested') throw new ApiError('bad_state', 'No refund pending for this order.');
        const now = core.clock.now();
        if (approve) {
          // Restock what was sold.
          for (const line of order.lines) {
            const l = await core.store.get<Listing>('listings', line.listingId);
            if (l) await core.store.put('listings', l.id, { ...l, inventory: l.inventory + line.qty, updatedAt: now });
          }
          await reverseCommission(core, order.id);
          const buyer = await core.store.get<User>('users', order.userId);
          await core.track('refund', { deviceId: buyer?.deviceId, valueCents: order.totalCents });
        }
        await core.store.put('orders', order.id, { ...order, status: approve ? 'refunded' : 'paid', updatedAt: now });
        await core.audit(admin.id, approve ? 'market.refund_approve' : 'market.refund_reject', order.id);
      });
    },

    async saveListing(token: string, raw: unknown, id?: string): Promise<Listing> {
      const input = parse(listingInputSchema, raw);
      return core.mutate(async () => {
        const admin = await core.requireRole(token, 'admin');
        const now = core.clock.now();
        const prev = id ? await core.store.get<Listing>('listings', id) : null;
        if (id && !prev) throw new ApiError('not_found', 'Listing not found.');
        const listing: Listing = { ...input, id: prev?.id ?? randomId('lst_'), createdAt: prev?.createdAt ?? now, updatedAt: now };
        await core.store.put('listings', listing.id, listing);
        await core.audit(admin.id, prev ? 'market.listing_update' : 'market.listing_create', listing.id);
        return listing;
      });
    },

    async supplyDemand(token: string) {
      await core.requireRole(token, 'admin');
      const [listings, orders] = await Promise.all([core.store.list<Listing>('listings'), core.store.list<Order>('orders')]);
      return supplyDemand(listings, orders);
    },
  };
}
