import { create } from 'zustand';

import type { PublicUser } from '../domain/types';

interface PendingInvite {
  referralCode?: string;
  campaignCode?: string;
}

interface SessionState {
  status: 'booting' | 'ready' | 'error';
  bootError?: string;
  token: string | null;
  user: PublicUser | null;
  deviceId: string;
  invite: PendingInvite;
  /** Bumped whenever backend data changes so screens can refetch. */
  version: number;
  setBooted: (deviceId: string, token: string | null, user: PublicUser | null) => void;
  setBootError: (message: string) => void;
  setSession: (token: string, user: PublicUser) => void;
  setUser: (user: PublicUser) => void;
  clear: () => void;
  setInvite: (invite: PendingInvite) => void;
  bump: () => void;
}

export const useSession = create<SessionState>((set) => ({
  status: 'booting',
  token: null,
  user: null,
  deviceId: '',
  invite: {},
  version: 0,
  setBooted: (deviceId, token, user) => set({ status: 'ready', deviceId, token, user }),
  setBootError: (bootError) => set({ status: 'error', bootError }),
  setSession: (token, user) => set({ token, user }),
  setUser: (user) => set({ user }),
  clear: () => set({ token: null, user: null }),
  setInvite: (invite) => set((s) => ({ invite: { ...s.invite, ...invite } })),
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
