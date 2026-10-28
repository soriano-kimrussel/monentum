// Referral, affiliate and advertising-attribution rules. Simulation only:
// no data leaves the device and no real advertising SDK is involved.

import { DAY_MS } from './dates';

// ---------- Referrals ----------

export interface ReferralConfig {
  /** When the referrer earns the reward. */
  trigger: 'signup' | 'first_checkin';
  rewardDays: number;
  /** Cap on rewards a single referrer can earn. */
  maxRewardsPerReferrer: number;
}

export const DEFAULT_REFERRAL_CONFIG: ReferralConfig = { trigger: 'first_checkin', rewardDays: 7, maxRewardsPerReferrer: 10 };

export interface ReferralClick {
  id: string;
  code: string;
  deviceId: string;
  at: string;
}

export interface ReferralRecord {
  id: string;
  code: string;
  referrerId: string;
  refereeId: string;
  status: 'signed_up' | 'rewarded' | 'blocked';
  blockReason?: string;
  createdAt: string;
  rewardedAt?: string;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity

export function makeReferralCode(randomBytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[randomBytes[i] % CODE_ALPHABET.length];
  return `MOM-${s}`;
}

export function inviteLink(code: string): string {
  return `momentum://invite/${encodeURIComponent(code)}`;
}

export const isReferralCodeShape = (code: string) => /^MOM-[A-Z2-9]{6}$/.test(code);

/**
 * Decide whether a sign-up with a referral code is valid.
 * Blocks self-referral by account, email and device, and duplicate attribution.
 */
export function checkReferral(args: {
  referrer: { id: string; email: string; deviceId?: string } | null;
  referee: { id: string; email: string; deviceId?: string };
  existing: ReferralRecord[];
}): string | null {
  const { referrer, referee, existing } = args;
  if (!referrer) return 'unknown_code';
  if (referrer.id === referee.id) return 'self_referral';
  if (normEmail(referrer.email) === normEmail(referee.email)) return 'self_referral';
  if (referrer.deviceId && referee.deviceId && referrer.deviceId === referee.deviceId) return 'same_device';
  if (existing.some((r) => r.refereeId === referee.id)) return 'already_referred';
  return null;
}

/** Strip plus-addressing and dots for gmail-style aliases so `a+1@x` can't self-refer `a@x`. */
export function normEmail(email: string): string {
  const [local, domain] = email.trim().toLowerCase().split('@');
  return `${local.split('+')[0].replace(/\./g, '')}@${domain}`;
}

export function canReward(record: ReferralRecord, all: ReferralRecord[], config: ReferralConfig): string | null {
  if (record.status !== 'signed_up') return record.status === 'rewarded' ? 'already_rewarded' : 'blocked';
  const earned = all.filter((r) => r.referrerId === record.referrerId && r.status === 'rewarded').length;
  if (earned >= config.maxRewardsPerReferrer) return 'reward_cap_reached';
  return null;
}

/** Extend bonus premium from whichever is later: now or the current bonus end. */
export function extendBonus(currentUntil: string | undefined, now: string, days: number): string {
  const base = currentUntil && currentUntil > now ? currentUntil : now;
  return new Date(new Date(base).getTime() + days * DAY_MS).toISOString();
}

// ---------- Affiliates ----------

export interface Affiliate {
  id: string;
  name: string;
  /** Commission in basis points (1000 = 10%). */
  commissionBps: number;
  createdAt: string;
}

export interface Campaign {
  id: string;
  affiliateId: string | null; // null = owned ad campaign
  name: string;
  channel: 'social' | 'search' | 'podcast' | 'influencer' | 'email';
  code: string;
  createdAt: string;
}

export type CommissionStatus = 'pending' | 'approved' | 'reversed' | 'paid';

export interface Commission {
  id: string;
  affiliateId: string;
  campaignId: string;
  /** The transaction or order that generated the commission. */
  sourceId: string;
  saleCents: number;
  amountCents: number;
  status: CommissionStatus;
  createdAt: string;
  updatedAt: string;
}

export const ATTRIBUTION_WINDOW_DAYS = 30;

export function commissionFor(saleCents: number, bps: number): number {
  return Math.floor((saleCents * bps) / 10_000);
}

const COMMISSION_TRANSITIONS: Record<CommissionStatus, CommissionStatus[]> = {
  pending: ['approved', 'reversed'],
  approved: ['paid', 'reversed'],
  reversed: [],
  paid: [], // paid commissions are settled; clawbacks would be a separate ledger entry
};

export function canTransitionCommission(from: CommissionStatus, to: CommissionStatus): boolean {
  return COMMISSION_TRANSITIONS[from].includes(to);
}

// ---------- Ad / analytics events ----------

export type AnalyticsEventName =
  | 'campaign_click'
  | 'install'
  | 'signup'
  | 'trial_start'
  | 'purchase'
  | 'refund'
  | 'checkin'
  | 'order';

export interface AnalyticsEvent {
  id: string;
  name: AnalyticsEventName;
  at: string;
  campaignId?: string;
  /** Salted hash; never the raw user id, email or name. */
  subject?: string;
  valueCents?: number;
  props: Record<string, string | number | boolean>;
}

const PII_KEYS = /email|name|phone|address|password|token|card|cvv|ssn|note|body|ip/i;
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/** Drop keys that look like PII and any string value that looks like an email. */
export function sanitizeProps(props: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (PII_KEYS.test(k)) continue;
    if (typeof v === 'string') {
      if (EMAIL_LIKE.test(v)) continue;
      out[k] = v.slice(0, 64);
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    }
  }
  return out;
}

export interface CampaignReport {
  campaignId: string;
  clicks: number;
  signups: number;
  purchases: number;
  revenueCents: number;
  conversionRate: number;
}

/** Last-click attribution: each subject's conversions go to their latest click within the window. */
export function attributionReport(events: AnalyticsEvent[], campaignIds: string[]): CampaignReport[] {
  const sorted = [...events].sort((a, b) => (a.at < b.at ? -1 : 1));
  const lastClick = new Map<string, { campaignId: string; at: string }>();
  const report = new Map<string, CampaignReport>(
    campaignIds.map((id) => [id, { campaignId: id, clicks: 0, signups: 0, purchases: 0, revenueCents: 0, conversionRate: 0 }]),
  );
  for (const e of sorted) {
    if (e.name === 'campaign_click' && e.campaignId) {
      const r = report.get(e.campaignId);
      if (r) r.clicks++;
      if (e.subject) lastClick.set(e.subject, { campaignId: e.campaignId, at: e.at });
      continue;
    }
    if (!e.subject) continue;
    const click = lastClick.get(e.subject);
    if (!click) continue;
    if (new Date(e.at).getTime() - new Date(click.at).getTime() > ATTRIBUTION_WINDOW_DAYS * DAY_MS) continue;
    const r = report.get(click.campaignId);
    if (!r) continue;
    if (e.name === 'signup') r.signups++;
    if (e.name === 'purchase' || e.name === 'order') {
      r.purchases++;
      r.revenueCents += e.valueCents ?? 0;
    }
    if (e.name === 'refund') r.revenueCents -= e.valueCents ?? 0;
  }
  for (const r of report.values()) r.conversionRate = r.clicks ? r.signups / r.clicks : 0;
  return [...report.values()];
}
