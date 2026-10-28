// Simulated marketplace. Orders are demo records: nothing is charged or shipped.

export const CATEGORIES = ['Templates', 'Journals', 'Audio', 'Coaching', 'Gear'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Listing {
  id: string;
  title: string;
  description: string;
  category: Category;
  priceCents: number;
  inventory: number;
  icon: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CartLine {
  listingId: string;
  qty: number;
}

export interface OrderLine {
  listingId: string;
  title: string;
  qty: number;
  unitCents: number;
}

export type OrderStatus = 'paid' | 'refund_requested' | 'refunded';

export interface Order {
  id: string;
  userId: string;
  idempotencyKey: string;
  lines: OrderLine[];
  totalCents: number;
  status: OrderStatus;
  campaignId?: string;
  createdAt: string;
  updatedAt: string;
  refundReason?: string;
}

export const MAX_QTY_PER_LINE = 10;

export class MarketError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'MarketError';
  }
}

/** Validate a cart against current listings and price it server-side (never trust client prices). */
export function priceCart(cart: CartLine[], listings: Map<string, Listing>): { lines: OrderLine[]; totalCents: number } {
  if (cart.length === 0) throw new MarketError('empty_cart', 'Your cart is empty.');
  const merged = new Map<string, number>();
  for (const line of cart) {
    if (!Number.isInteger(line.qty) || line.qty < 1) throw new MarketError('bad_qty', 'Quantity must be a positive whole number.');
    merged.set(line.listingId, (merged.get(line.listingId) ?? 0) + line.qty);
  }
  const lines: OrderLine[] = [];
  for (const [listingId, qty] of merged) {
    const l = listings.get(listingId);
    if (!l || !l.active) throw new MarketError('unavailable', 'An item in your cart is no longer available.');
    if (qty > MAX_QTY_PER_LINE) throw new MarketError('bad_qty', `Max ${MAX_QTY_PER_LINE} per item.`);
    if (qty > l.inventory) throw new MarketError('out_of_stock', `Only ${l.inventory} left of “${l.title}”.`);
    lines.push({ listingId, title: l.title, qty, unitCents: l.priceCents });
  }
  return { lines, totalCents: lines.reduce((s, l) => s + l.qty * l.unitCents, 0) };
}

export function searchListings(listings: Listing[], query: string, category?: Category | null): Listing[] {
  const q = query.trim().toLowerCase();
  return listings.filter(
    (l) => l.active && (!category || l.category === category) && (!q || l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)),
  );
}

export interface SupplyDemand {
  category: Category;
  inStock: number;
  unitsSold: number;
}

export function supplyDemand(listings: Listing[], orders: Order[]): SupplyDemand[] {
  const byListing = new Map(listings.map((l) => [l.id, l]));
  const rows = new Map<Category, SupplyDemand>(CATEGORIES.map((c) => [c, { category: c, inStock: 0, unitsSold: 0 }]));
  for (const l of listings) if (l.active) rows.get(l.category)!.inStock += l.inventory;
  for (const o of orders) {
    if (o.status === 'refunded') continue;
    for (const line of o.lines) {
      const cat = byListing.get(line.listingId)?.category;
      if (cat) rows.get(cat)!.unitsSold += line.qty;
    }
  }
  return [...rows.values()];
}
