// Callable Cloud Functions for the LOCAL emulator only (project "demo-momentum").
// They show how the MockBackend's server-side rules map onto Firebase: authentication from
// the callable context, admin from a custom claim, transactional idempotent checkout, and
// refund decisions that only an admin can make. Business rules mirror src/domain.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';

initializeApp();
const db = getFirestore();

function requireUser(req: CallableRequest): string {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  return req.auth.uid;
}

function requireAdmin(req: CallableRequest): string {
  const uid = requireUser(req);
  if (req.auth?.token.admin !== true) throw new HttpsError('permission-denied', 'Admins only.');
  return uid;
}

async function audit(actorId: string | null, action: string, target: string, outcome: 'allowed' | 'denied') {
  await db.collection('audit').add({ actorId, action, target, outcome, at: FieldValue.serverTimestamp() });
}

/** Idempotent, transactional checkout: prices and stock are read server-side. */
export const checkout = onCall(async (req) => {
  const uid = requireUser(req);
  const { cart, idempotencyKey } = req.data as { cart: { listingId: string; qty: number }[]; idempotencyKey: string };
  if (!Array.isArray(cart) || cart.length === 0 || cart.length > 50) throw new HttpsError('invalid-argument', 'Bad cart.');
  if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(idempotencyKey)) throw new HttpsError('invalid-argument', 'Bad idempotency key.');

  const orderRef = db.collection('orders').doc(`${uid}_${idempotencyKey}`);
  return db.runTransaction(async (tx) => {
    const prior = await tx.get(orderRef);
    if (prior.exists) return { orderId: orderRef.id, replayed: true };
    let totalCents = 0;
    const lines: { listingId: string; title: string; qty: number; unitCents: number }[] = [];
    const reads = await Promise.all(cart.map((l) => tx.get(db.collection('listings').doc(String(l.listingId)))));
    reads.forEach((snap, i) => {
      const qty = cart[i].qty;
      const l = snap.data();
      if (!l || !l.active) throw new HttpsError('failed-precondition', 'Item unavailable.');
      if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw new HttpsError('invalid-argument', 'Bad quantity.');
      if (qty > l.inventory) throw new HttpsError('failed-precondition', `Only ${l.inventory} left.`);
      lines.push({ listingId: snap.id, title: l.title, qty, unitCents: l.priceCents });
      totalCents += qty * l.priceCents;
      tx.update(snap.ref, { inventory: FieldValue.increment(-qty) });
    });
    tx.set(orderRef, { userId: uid, idempotencyKey, lines, totalCents, status: 'paid_simulated', createdAt: FieldValue.serverTimestamp() });
    return { orderId: orderRef.id, replayed: false };
  });
});

/** Admin-only refund decision. Approving revokes entitlement if it funds the current period. */
export const decideRefund = onCall(async (req) => {
  const adminId = requireAdmin(req);
  const { refundId, approve } = req.data as { refundId: string; approve: boolean };
  const ref = db.collection('refunds').doc(String(refundId));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'No such refund.');
    if (snap.get('status') !== 'pending') throw new HttpsError('failed-precondition', 'Already decided.');
    tx.update(ref, { status: approve ? 'approved' : 'rejected', decidedBy: adminId, decidedAt: FieldValue.serverTimestamp() });
    if (approve) {
      const txnRef = db.collection('transactions').doc(snap.get('transactionId'));
      tx.update(txnRef, { status: 'refunded' });
      tx.set(db.collection('subscriptions').doc(snap.get('userId')), { status: 'refunded' }, { merge: true });
    }
  });
  await audit(adminId, approve ? 'billing.refund_approve' : 'billing.refund_reject', refundId, 'allowed');
  return { ok: true };
});

/** Admin-only role management through custom claims (never a client-writable field). */
export const setAdmin = onCall(async (req) => {
  const adminId = requireAdmin(req);
  const { uid, admin } = req.data as { uid: string; admin: boolean };
  if (uid === adminId) throw new HttpsError('failed-precondition', 'You can’t change your own role.');
  await getAuth().setCustomUserClaims(String(uid), { admin: !!admin });
  await audit(adminId, 'admin.set_role', uid, 'allowed');
  return { ok: true };
});
