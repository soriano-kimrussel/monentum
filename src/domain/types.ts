// Core domain types shared by the backend, data layer and UI.
// All money values are integer cents. All dates are ISO strings or `YYYY-MM-DD` day keys.

export type Role = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  passwordHash: string;
  passwordSalt: string;
  referralCode: string;
  referredBy?: string;
  deviceId?: string;
  /** Last-click campaign attribution captured at sign-up (simulated ads/affiliates). */
  attribution?: { campaignId: string; at: string };
  createdAt: string;
  disabled?: boolean;
}

/** User shape that is safe to hand to the UI (no credential material). */
export type PublicUser = Omit<User, 'passwordHash' | 'passwordSalt'>;

export interface Session {
  id: string;
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Habit {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  /** Days of week the habit is scheduled. All 7 = daily. */
  days: Weekday[];
  reminderTime?: string; // "HH:MM"
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CheckIn {
  id: string;
  userId: string;
  habitId: string;
  day: string; // YYYY-MM-DD
  createdAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
  doneAt?: string;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  targetDate?: string; // YYYY-MM-DD
  milestones: Milestone[];
  habitIds: string[];
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export type MoodScore = 1 | 2 | 3 | 4 | 5;

export interface MoodEntry {
  id: string;
  userId: string;
  day: string;
  score: MoodScore;
  tags: string[];
  note: string;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  body: string;
  prompt?: string;
  mood?: MoodScore;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string | null;
  action: string;
  target?: string;
  detail?: Record<string, unknown>;
  outcome: 'allowed' | 'denied' | 'error';
}
