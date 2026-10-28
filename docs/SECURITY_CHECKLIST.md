# Security Checklist

✅ = done and covered by an executed test · 🟡 = done, not executed or partially covered · ⬜ = production work not done (out of demo scope)

## Secrets & configuration
- ✅ No real secrets in the repo; `.env.example` contains placeholders and a clearly mock webhook secret
- ✅ Strict `.gitignore` for `.env*`, keystores, service-account JSON, Firebase config files, provisioning profiles
- ✅ No server credentials embedded in the mobile app (the only "secret" is the labelled mock webhook secret)
- ✅ Firebase config uses the emulator-only `demo-momentum` project

## Authentication
- ✅ Passwords hashed (PBKDF2-SHA256, per-user salt); hashes never leave the backend layer
- ✅ Password policy (8+ chars, letter + digit) enforced server-side
- ✅ Login rate limiting; failed attempts counted even though the request errors
- ✅ Uniform error messages (no account enumeration)
- ✅ Session expiry on real time; sign-out invalidates; disable revokes sessions
- ⬜ Email verification, password reset, MFA (needs a real identity provider)

## Authorization
- ✅ Every backend call authenticates the session token
- ✅ Ownership checks on every user-content read and write (IDOR tests)
- ✅ Admin endpoints enforce role on the backend (13 endpoints tested with a normal-user token)
- ✅ Admins can't self-escalate, self-demote or self-disable
- ✅ Denied attempts written to the audit log (and kept even though the request fails)
- 🟡 Firestore Security Rules + rules tests written (`firebase/`); **not executed** (needs a local JDK)
- ⬜ Server-side deployment of the same rules (needs a real backend; see ZERO_COST_POLICY)

## Input validation
- ✅ Zod schemas on every backend entry point (habit, goal, mood, journal, listing, cart, refund reason, sign-up/in)
- ✅ Backup import: size cap, schema, referential integrity, re-ownership, re-keying, overwrite protection
- ✅ Server-side cart pricing; quantity and stock bounds

## Payments (simulated)
- ✅ No card / bank data collected anywhere; demo "cards" are behaviour switches
- ✅ Webhook signature (HMAC-SHA256), timestamp tolerance, constant-time compare, replay dedupe
- ✅ Idempotent checkout; serialized mutations; refund eligibility rules; commission reversal on refund
- ⬜ Real store receipt validation (needs StoreKit / Play Billing / a provider)

## Privacy
- ✅ Analytics events stripped of PII; subjects are salted hashes; no third-party SDKs
- ✅ All data stays on device; exports are user-initiated
- ⬜ Encryption at rest, data-deletion workflow, privacy policy (production)

## Dependencies
- ✅ `npm audit` run; one dev-only advisory documented in THREAT_MODEL.md
- ✅ `npx expo-doctor`: 20/20 checks pass
- ✅ Only SDK-compatible versions (resolved from Expo's `bundledNativeModules.json`)
