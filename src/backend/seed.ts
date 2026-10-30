// Synthetic demo data. Every person, email and order here is fictional.
import { DAY_MS, addDays, toDayKey } from '../domain/dates';
import type { Affiliate, Campaign } from '../domain/growth';
import type { Listing } from '../domain/marketplace';
import { PLANS, type Subscription, type Transaction } from '../domain/subscription';
import type { CheckIn, Goal, Habit, JournalEntry, MoodEntry, MoodScore, User, Weekday } from '../domain/types';
import { randomId } from '../lib/crypto';
import type { Core } from './core';
import { createUser } from './modules/auth';

export const DEMO_ACCOUNTS = {
  user: { email: 'demo@momentum.app', password: 'Demo1234!', displayName: 'Alex Rivera' },
  admin: { email: 'admin@momentum.app', password: 'Admin1234!', displayName: 'Sam Admin' },
} as const;

const SEED_VERSION = 1;

/** Deterministic PRNG so the seeded history looks the same on every install. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export async function seedIfNeeded(core: Core): Promise<boolean> {
  const meta = await core.store.get<{ version: number }>('meta', 'seed');
  if (meta?.version === SEED_VERSION) return false;
  await core.store.transaction(() => seed(core));
  return true;
}

async function seed(core: Core) {
  const nowMs = core.clock.nowMs();
  const iso = (daysAgo: number) => new Date(nowMs - daysAgo * DAY_MS).toISOString();
  const rand = mulberry32(42);

  const demo = await createUser(core, { ...DEMO_ACCOUNTS.user, deviceId: 'seed-device-demo', createdAt: iso(60) });
  await createUser(core, { ...DEMO_ACCOUNTS.admin, role: 'admin', deviceId: 'seed-device-admin', createdAt: iso(90) });

  // Demo user's history: 4 habits, ~8 weeks of check-ins with a realistic, improving pattern.
  const habitDefs: [string, string, string, Weekday[], number][] = [
    ['Morning walk', 'walk', '#5E8C6A', ALL_DAYS, 0.82],
    ['Read 20 pages', 'book', '#5B8BA6', ALL_DAYS, 0.7],
    ['Meditate', 'leaf', '#8B7BB8', [1, 2, 3, 4, 5], 0.6],
  ];
  const today = toDayKey(new Date(nowMs));
  const habits: Habit[] = [];
  for (const [name, icon, color, days, p] of habitDefs) {
    const h: Habit = { id: randomId('hab_'), userId: demo.id, name, icon, color, days, archived: false, createdAt: iso(56), updatedAt: iso(56), reminderTime: name === 'Meditate' ? '07:30' : undefined };
    habits.push(h);
    await core.store.put('habits', h.id, h);
    for (let i = 55; i >= 1; i--) {
      const day = addDays(today, -i);
      const recentBoost = i < 14 ? 0.12 : 0;
      if (days.includes(new Date(nowMs - i * DAY_MS).getDay() as Weekday) && rand() < p + recentBoost) {
        const c: CheckIn = { id: `${h.id}_${day}`, userId: demo.id, habitId: h.id, day, createdAt: iso(i) };
        await core.store.put('checkIns', c.id, c);
      }
    }
  }

  const goal: Goal = {
    id: randomId('gol_'),
    userId: demo.id,
    title: 'Run a 10K',
    description: 'Build up to running 10 km without stopping.',
    targetDate: addDays(today, 45),
    milestones: [
      { id: randomId('mil_'), title: 'Run 3 km', done: true, doneAt: iso(30) },
      { id: randomId('mil_'), title: 'Run 5 km', done: true, doneAt: iso(10) },
      { id: randomId('mil_'), title: 'Run 8 km', done: false },
      { id: randomId('mil_'), title: 'Run 10 km', done: false },
    ],
    habitIds: [habits[0].id],
    status: 'active',
    createdAt: iso(40),
    updatedAt: iso(10),
  };
  await core.store.put('goals', goal.id, goal);

  const tags = ['work', 'sleep', 'exercise', 'family', 'social', 'stress'];
  for (let i = 30; i >= 1; i--) {
    if (rand() < 0.2) continue;
    const day = addDays(today, -i);
    const score = Math.min(5, Math.max(1, Math.round(3 + (rand() - 0.4) * 2.5 + (i < 10 ? 0.5 : 0)))) as MoodScore;
    const m: MoodEntry = { id: `${demo.id}_${day}`, userId: demo.id, day, score, tags: [tags[Math.floor(rand() * tags.length)]], note: '', createdAt: iso(i) };
    await core.store.put('moods', m.id, m);
  }

  const journal: [string, string, number][] = [
    ['A good week', 'Kept the walking streak going even when it rained. Small wins compound.', 3],
    ['Slow start', 'Skipped meditation twice. Moving it to right after coffee might help.', 9],
    ['Why I started', 'I want more energy for the kids and to stop feeling rushed every morning.', 20],
  ];
  for (const [title, body, d] of journal) {
    const j: JournalEntry = { id: randomId('jrn_'), userId: demo.id, title, body, createdAt: iso(d), updatedAt: iso(d) };
    await core.store.put('journal', j.id, j);
  }

  // Affiliates and campaigns.
  const affiliates: Affiliate[] = [
    { id: 'aff_fitcoach', name: 'FitCoach Jamie (demo)', commissionBps: 2000, createdAt: iso(80) },
    { id: 'aff_mindful', name: 'Mindful Minutes Podcast (demo)', commissionBps: 1500, createdAt: iso(70) },
  ];
  for (const a of affiliates) await core.store.put('affiliates', a.id, a);
  const campaigns: Campaign[] = [
    { id: 'cmp_fitcoach', affiliateId: 'aff_fitcoach', name: 'FitCoach YouTube', channel: 'influencer', code: 'FITCOACH', createdAt: iso(80) },
    { id: 'cmp_podcast', affiliateId: 'aff_mindful', name: 'Podcast mid-roll', channel: 'podcast', code: 'MINDFUL', createdAt: iso(70) },
    { id: 'cmp_social', affiliateId: null, name: 'New Year social ads', channel: 'social', code: 'NEWYEAR', createdAt: iso(60) },
    { id: 'cmp_search', affiliateId: null, name: 'Search: habit tracker', channel: 'search', code: 'SEARCH1', createdAt: iso(60) },
  ];
  for (const c of campaigns) await core.store.put('campaigns', c.id, c);

  // Synthetic community users with a spread of subscription states for the admin dashboard.
  const people = ['Jordan Lee', 'Priya Shah', 'Mateo Garcia', 'Chen Wei', 'Fatima Noor', 'Liam Murphy', 'Ana Souza', 'Kofi Mensah'];
  const states: Subscription['status'][] = ['active', 'trialing', 'active', 'past_due', 'expired', 'none', 'active', 'none'];
  for (let i = 0; i < people.length; i++) {
    const name = people[i];
    const u = await createUser(core, {
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
      password: randomId(),
      displayName: name,
      deviceId: `seed-device-${i}`,
      createdAt: iso(5 + i * 6),
    });
    const campaign = campaigns[i % campaigns.length];
    const attributed: User = { ...u, attribution: { campaignId: campaign.id, at: iso(5 + i * 6) } };
    await core.store.put('users', u.id, attributed);
    await core.track('campaign_click', { deviceId: u.deviceId, campaignId: campaign.id, at: iso(5 + i * 6 + 0.1) });
    await core.track('signup', { deviceId: u.deviceId, at: iso(5 + i * 6) });

    const status = states[i];
    const plan = i % 3 === 0 ? 'premium_annual' : 'premium_monthly';
    const sub: Subscription = { userId: u.id, plan: null, status: 'none', trialUsed: false, cancelAtPeriodEnd: false, paymentMethod: 'sim_success', updatedAt: iso(1) };
    if (status === 'trialing') Object.assign(sub, { plan, status, trialUsed: true, trialEndsAt: iso(-3) });
    if (status === 'active' || status === 'past_due' || status === 'expired') {
      const start = iso(4 + i);
      const txn: Transaction = {
        id: randomId('txn_'),
        userId: u.id,
        type: 'purchase',
        plan,
        amountCents: PLANS[plan].priceCents,
        status: 'succeeded',
        periodStart: start,
        periodEnd: new Date(nowMs - (4 + i) * DAY_MS + PLANS[plan].periodDays * DAY_MS).toISOString(),
        createdAt: start,
      };
      await core.store.put('transactions', txn.id, txn);
      await core.track('purchase', { deviceId: u.deviceId, valueCents: txn.amountCents, at: start, props: { plan } });
      if (campaign.affiliateId) {
        const bps = affiliates.find((a) => a.id === campaign.affiliateId)!.commissionBps;
        await core.store.put('commissions', `com_${txn.id}`, {
          id: `com_${txn.id}`, affiliateId: campaign.affiliateId, campaignId: campaign.id, sourceId: txn.id,
          saleCents: txn.amountCents, amountCents: Math.floor((txn.amountCents * bps) / 10000), status: i < 2 ? 'approved' : 'pending', createdAt: start, updatedAt: start,
        });
      }
      Object.assign(sub, { plan, status: 'active', trialUsed: true, currentPeriodStart: txn.periodStart, currentPeriodEnd: txn.periodEnd });
      if (status === 'past_due') Object.assign(sub, { status, paymentMethod: 'sim_fail_on_renewal', graceEndsAt: iso(-2) });
      if (status === 'expired') Object.assign(sub, { status, currentPeriodEnd: iso(1) });
      if (i === 2) {
        // A pending refund request for the admin queue.
        await core.store.put('refunds', 'rfd_seed', { id: 'rfd_seed', userId: u.id, transactionId: txn.id, reason: 'Accidentally bought the wrong plan.', status: 'pending', createdAt: iso(1) });
      }
    }
    await core.store.put('subscriptions', u.id, sub);
  }

  // Extra anonymous ad traffic.
  for (let i = 0; i < 60; i++) {
    const c = campaigns[Math.floor(rand() * campaigns.length)];
    await core.track('campaign_click', { deviceId: `seed-anon-${i}`, campaignId: c.id, at: iso(rand() * 25) });
  }

  // Marketplace catalog.
  const listings: Omit<Listing, 'id' | 'createdAt' | 'updatedAt'>[] = [
    { title: 'Morning Routine Template Pack', description: '12 ready-made habit stacks for calmer mornings.', category: 'Templates', priceCents: 299, inventory: 999, icon: 'sunny', active: true },
    { title: 'Deep Work Template Pack', description: 'Focus blocks and shutdown rituals for knowledge workers.', category: 'Templates', priceCents: 399, inventory: 999, icon: 'briefcase', active: true },
    { title: '90-Day Guided Journal Prompts', description: 'One reflective prompt a day for a full quarter.', category: 'Journals', priceCents: 499, inventory: 999, icon: 'book', active: true },
    { title: 'Gratitude Prompt Deck', description: '52 weekly gratitude prompts.', category: 'Journals', priceCents: 199, inventory: 999, icon: 'heart', active: true },
    { title: 'Rain & Focus Soundscape', description: '45-minute ambient track for focus sessions.', category: 'Audio', priceCents: 249, inventory: 999, icon: 'rainy', active: true },
    { title: 'Sleep Wind-down Audio Set', description: 'Five guided wind-down sessions.', category: 'Audio', priceCents: 599, inventory: 999, icon: 'moon', active: true },
    { title: '1:1 Habit Coaching (30 min)', description: 'Demo listing: a coaching session slot.', category: 'Coaching', priceCents: 2900, inventory: 6, icon: 'people', active: true },
    { title: 'Momentum Dot-Grid Notebook', description: 'Demo physical product. Limited stock.', category: 'Gear', priceCents: 1800, inventory: 14, icon: 'create', active: true },
    { title: 'Habit Tracker Wall Poster', description: 'Demo physical product. Low stock to show inventory limits.', category: 'Gear', priceCents: 1200, inventory: 3, icon: 'grid', active: true },
    { title: 'Retired: Winter Challenge Pack', description: 'Inactive listing visible only to admins.', category: 'Templates', priceCents: 199, inventory: 0, icon: 'snow', active: false },
  ];
  for (const l of listings) {
    const id = randomId('lst_');
    await core.store.put('listings', id, { ...l, id, createdAt: iso(50), updatedAt: iso(50) });
  }

  await core.store.put('meta', 'seed', { version: SEED_VERSION, at: new Date(nowMs).toISOString() });
}
