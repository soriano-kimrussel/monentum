import { create } from 'zustand';

import type { CartLine } from '../domain/marketplace';

interface CartState {
  lines: CartLine[];
  add: (listingId: string, qty?: number) => void;
  setQty: (listingId: string, qty: number) => void;
  replace: (lines: CartLine[]) => void;
  clear: () => void;
}

/** Client-side cart. Prices and stock are always re-checked by the backend at checkout. */
export const useCart = create<CartState>((set) => ({
  lines: [],
  add: (listingId, qty = 1) =>
    set((s) => {
      const existing = s.lines.find((l) => l.listingId === listingId);
      return existing
        ? { lines: s.lines.map((l) => (l.listingId === listingId ? { ...l, qty: Math.min(10, l.qty + qty) } : l)) }
        : { lines: [...s.lines, { listingId, qty }] };
    }),
  setQty: (listingId, qty) => set((s) => ({ lines: qty <= 0 ? s.lines.filter((l) => l.listingId !== listingId) : s.lines.map((l) => (l.listingId === listingId ? { ...l, qty: Math.min(10, qty) } : l)) })),
  replace: (lines) => set({ lines }),
  clear: () => set({ lines: [] }),
}));
