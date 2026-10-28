// Firestore Security Rules tests. Run ONLY against the local emulator:
//   cd firebase && npm install && npm run test:rules
// Requires a local JDK for the Firestore emulator. Nothing here contacts a real Firebase project.
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-momentum',
    firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const admin = () => env.authenticatedContext('root', { admin: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const habit = (userId: string) => ({ userId, name: 'Walk', icon: 'walk', color: '#2F9E77', days: [1, 2, 3], archived: false });

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), path), data));
}

describe('user data isolation', () => {
  it('lets users create and read their own habits', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'habits/h1'), habit('alice')));
    await assertSucceeds(getDoc(doc(alice(), 'habits/h1')));
  });

  it('blocks reading, editing or deleting another user’s habit', async () => {
    await seed('habits/h1', habit('alice'));
    await assertFails(getDoc(doc(bob(), 'habits/h1')));
    await assertFails(updateDoc(doc(bob(), 'habits/h1'), { name: 'pwned' }));
    await assertFails(deleteDoc(doc(bob(), 'habits/h1')));
  });

  it('blocks creating a document on behalf of someone else and transferring ownership', async () => {
    await assertFails(setDoc(doc(bob(), 'habits/h2'), habit('alice')));
    await seed('habits/h1', habit('alice'));
    await assertFails(updateDoc(doc(alice(), 'habits/h1'), { userId: 'bob' }));
  });

  it('validates input shape', async () => {
    await assertFails(setDoc(doc(alice(), 'habits/h3'), { ...habit('alice'), color: 'javascript:alert(1)' }));
    await assertFails(setDoc(doc(alice(), 'habits/h4'), { ...habit('alice'), name: 'x'.repeat(81) }));
  });

  it('requires check-ins to use the deterministic id and the caller’s own habit', async () => {
    await seed('habits/h1', habit('alice'));
    await seed('habits/hb', habit('bob'));
    await assertSucceeds(setDoc(doc(alice(), 'checkIns/h1_2026-03-01'), { userId: 'alice', habitId: 'h1', day: '2026-03-01' }));
    await assertFails(setDoc(doc(alice(), 'checkIns/random'), { userId: 'alice', habitId: 'h1', day: '2026-03-02' }));
    await assertFails(setDoc(doc(alice(), 'checkIns/hb_2026-03-01'), { userId: 'alice', habitId: 'hb', day: '2026-03-01' }));
  });

  it('denies unauthenticated access everywhere', async () => {
    await seed('habits/h1', habit('alice'));
    await assertFails(getDoc(doc(anon(), 'habits/h1')));
    await assertFails(setDoc(doc(anon(), 'habits/h9'), habit('alice')));
  });
});

describe('server-only and admin-only data', () => {
  it('prevents clients from granting themselves premium', async () => {
    await seed('subscriptions/alice', { userId: 'alice', status: 'none' });
    await assertSucceeds(getDoc(doc(alice(), 'subscriptions/alice')));
    await assertFails(setDoc(doc(alice(), 'subscriptions/alice'), { userId: 'alice', status: 'active' }));
    await assertFails(getDoc(doc(bob(), 'subscriptions/alice')));
  });

  it('prevents clients from escalating their role', async () => {
    await seed('users/alice', { displayName: 'Alice', email: 'a@x.com', createdAt: 'x', referralCode: 'MOM-AAAAAA' });
    await assertSucceeds(updateDoc(doc(alice(), 'users/alice'), { displayName: 'Ally' }));
    await assertFails(updateDoc(doc(alice(), 'users/alice'), { role: 'admin' }));
  });

  it('keeps orders, transactions, refunds and commissions server-written', async () => {
    await assertFails(setDoc(doc(alice(), 'orders/o1'), { userId: 'alice', totalCents: 0 }));
    await assertFails(setDoc(doc(alice(), 'transactions/t1'), { userId: 'alice', amountCents: -999 }));
    await assertFails(setDoc(doc(alice(), 'refunds/r1'), { userId: 'alice', status: 'approved' }));
    await assertFails(setDoc(doc(admin(), 'commissions/c1'), { status: 'paid' }));
  });

  it('restricts admin collections to the admin custom claim', async () => {
    await seed('audit/a1', { action: 'x' });
    await seed('events/e1', { name: 'signup' });
    await assertFails(getDoc(doc(alice(), 'audit/a1')));
    await assertFails(getDoc(doc(alice(), 'events/e1')));
    await assertSucceeds(getDoc(doc(admin(), 'audit/a1')));
    await assertSucceeds(getDoc(doc(admin(), 'events/e1')));
  });

  it('hides inactive listings from shoppers but not admins', async () => {
    await seed('listings/l1', { title: 'Retired', active: false });
    await assertFails(getDoc(doc(alice(), 'listings/l1')));
    await assertSucceeds(getDoc(doc(admin(), 'listings/l1')));
  });

  it('only lets referrers (or admins) read their referral records', async () => {
    await seed('referrals/r1', { referrerId: 'alice', refereeId: 'bob' });
    await assertSucceeds(getDoc(doc(alice(), 'referrals/r1')));
    await assertFails(getDoc(doc(bob(), 'referrals/r1')));
    await assertFails(setDoc(doc(alice(), 'referrals/r2'), { referrerId: 'alice', status: 'rewarded' }));
  });
});
