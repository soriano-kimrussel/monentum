// LOCAL DEMO AUTHENTICATION. Accounts live in the on-device database. This is not
// production-grade identity verification (no email verification, no server, no MFA).
import { checkReferral, isReferralCodeShape, makeReferralCode, normEmail, type ReferralRecord } from '../../domain/growth';
import { newSubscription } from '../../domain/subscription';
import type { PublicUser, Role, Session, User } from '../../domain/types';
import { hashPassword, randomBytes, randomId, timingSafeEqual } from '../../lib/crypto';
import { ApiError, Core, toPublic } from '../core';
import { parse, signInSchema, signUpSchema } from '../schemas';
import { rewardReferral } from './referrals';

const LOGIN_MAX_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const SIGNUP_MAX_PER_DEVICE = 5;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

export interface AuthResult {
  token: string;
  user: PublicUser;
}

export async function uniqueReferralCode(core: Core): Promise<string> {
  for (;;) {
    const code = makeReferralCode(randomBytes(6));
    if ((await core.store.list('users', { referralCode: code })).length === 0) return code;
  }
}

/** Create a user record. Shared by sign-up and seeding. */
export async function createUser(core: Core, input: { email: string; password: string; displayName: string; role?: Role; deviceId?: string; createdAt?: string }): Promise<User> {
  const salt = randomId();
  const now = input.createdAt ?? core.clock.now();
  const user: User = {
    id: randomId('usr_'),
    email: input.email.toLowerCase(),
    displayName: input.displayName,
    role: input.role ?? 'user',
    passwordSalt: salt,
    passwordHash: hashPassword(input.password, salt),
    referralCode: await uniqueReferralCode(core),
    deviceId: input.deviceId,
    createdAt: now,
  };
  await core.store.put('users', user.id, user);
  await core.store.put('subscriptions', user.id, newSubscription(user.id, now));
  return user;
}

export function authApi(core: Core) {
  return {
    async signUp(raw: unknown, ctx: { deviceId: string; campaignCode?: string }): Promise<AuthResult> {
      const input = parse(signUpSchema, raw);
      return core.mutate(async () => {
        if (!(await core.hit(`signup:${ctx.deviceId}`, SIGNUP_MAX_PER_DEVICE, SIGNUP_WINDOW_MS))) {
          throw new ApiError('rate_limited', 'Too many sign-ups from this device. Try again later.');
        }
        const existing = await core.store.list<User>('users');
        if (existing.some((u) => normEmail(u.email) === normEmail(input.email))) {
          throw new ApiError('email_taken', 'An account with this email already exists.');
        }
        const user = await createUser(core, { ...input, deviceId: ctx.deviceId });

        // Campaign attribution (from a simulated ad / affiliate link).
        if (ctx.campaignCode) {
          const campaign = (await core.store.list<{ id: string; code: string }>('campaigns', { code: ctx.campaignCode }))[0];
          if (campaign) {
            user.attribution = { campaignId: campaign.id, at: core.clock.now() };
            await core.store.put('users', user.id, user);
          }
        }
        await core.track('signup', { deviceId: ctx.deviceId, campaignId: user.attribution?.campaignId });

        // Referral attribution. A blocked referral never blocks the sign-up itself.
        const code = input.referralCode || undefined;
        if (code) {
          const referrer = isReferralCodeShape(code) ? (existing.find((u) => u.referralCode === code) ?? null) : null;
          const records = await core.store.list<ReferralRecord>('referrals');
          const blockReason = checkReferral({ referrer, referee: user, existing: records });
          if (referrer) {
            const record: ReferralRecord = {
              id: randomId('ref_'),
              code,
              referrerId: referrer.id,
              refereeId: user.id,
              status: blockReason ? 'blocked' : 'signed_up',
              blockReason: blockReason ?? undefined,
              createdAt: core.clock.now(),
            };
            await core.store.put('referrals', record.id, record);
            if (!blockReason) {
              await core.store.put('users', user.id, { ...(await core.store.get<User>('users', user.id))!, referredBy: referrer.id });
              if ((await core.referralConfig()).trigger === 'signup') await rewardReferral(core, record);
            }
            await core.audit(user.id, 'referral.signup', record.id, blockReason ? 'denied' : 'allowed', { reason: blockReason });
          }
        }

        const session = await core.createSession(user.id);
        await core.audit(user.id, 'auth.signup', user.id);
        const fresh = (await core.store.get<User>('users', user.id))!;
        return { token: session.token, user: toPublic(fresh) };
      });
    },

    async signIn(raw: unknown): Promise<AuthResult> {
      const input = parse(signInSchema, raw);
      return core.mutate(async () => {
        const key = `login:${input.email}`;
        const user = (await core.store.list<User>('users', { email: input.email }))[0];
        const ok = !!user && timingSafeEqual(hashPassword(input.password, user.passwordSalt), user.passwordHash);
        if (!ok || user.disabled) {
          if (!(await core.hit(key, LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS))) {
            await core.audit(user?.id ?? null, 'auth.login', input.email.replace(/^(.).*@/, '$1***@'), 'denied', { reason: 'rate_limited' });
            throw new ApiError('rate_limited', 'Too many failed attempts. Wait 15 minutes and try again.');
          }
          await core.audit(user?.id ?? null, 'auth.login', undefined, 'denied', { reason: 'bad_credentials' });
          // Same message for unknown email and wrong password: no account enumeration.
          throw new ApiError('invalid_credentials', 'Email or password is incorrect.');
        }
        await core.resetLimit(key);
        const session = await core.createSession(user.id);
        await core.audit(user.id, 'auth.login', user.id);
        return { token: session.token, user: toPublic(user) };
      });
    },

    async signOut(token: string) {
      return core.mutate(async () => {
        const session = (await core.store.list<Session>('sessions', { token }))[0];
        if (session) await core.store.remove('sessions', session.id);
      });
    },

    async me(token: string): Promise<PublicUser> {
      return toPublic(await core.authenticate(token));
    },

    async updateProfile(token: string, displayName: string): Promise<PublicUser> {
      return core.mutate(async () => {
        const user = await core.authenticate(token);
        const name = displayName.trim().slice(0, 40);
        if (!name) throw new ApiError('invalid_input', 'Name is required.');
        const next = { ...user, displayName: name };
        await core.store.put('users', user.id, next);
        return toPublic(next);
      });
    },
  };
}
