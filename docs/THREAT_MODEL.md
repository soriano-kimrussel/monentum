# Threat Model

Scope: the Momentum demo app (Expo / React Native) and its local MockBackend, plus the
emulator-only Firebase rules and functions written for a future real backend.

## The most important caveat

**In the demo, the "backend" runs on the same device as the UI.** It enforces authentication,
ownership, roles, rate limits and idempotency exactly the way a server would, and every rule
is covered by tests. But anyone with physical access to a rooted or jailbroken device, or a debugger,
could modify the JS bundle or the SQLite file. So:

- Local demo auth is **not** production identity verification.
- Front-end role checks (hiding admin screens) are **UX only**.
- The MockBackend demonstrates **server-side authorization design**. A production build must
  run the same logic on a trusted server (Cloud Functions + Firestore Security Rules), which is
  what `firebase/` sketches.

## Assets

| Asset | Why it matters |
|---|---|
| User content (habits, mood, journal) | Personal and potentially sensitive (mental-health adjacent) |
| Credentials (password hashes, session tokens) | Account takeover |
| Entitlements (premium status) | Revenue integrity |
| Ledger (transactions, refunds, commissions, orders) | Financial integrity, fraud |
| Admin capabilities | Full control over others' accounts |
| Analytics events | Privacy; must not leak PII to third parties |

## Actors

- **Normal user**: may try to read or modify others' data or grant themselves premium.
- **Referral / affiliate fraudster**: self-referrals, duplicate rewards, click spam.
- **Malicious admin or compromised admin session.**
- **Network attacker**: forged or replayed payment webhooks (relevant once a real provider exists).
- **Device thief / malware**: local data access.

## Threats and mitigations (STRIDE-style)

| # | Threat | Mitigation in this repo | Test |
|---|---|---|---|
| S1 | Credential stuffing / brute force | Sliding-window login rate limit (5 per 15 min); generic error for wrong email vs password; limiter counters survive the failed request's rollback | `auth-security.test.ts` |
| S2 | Session theft / reuse | Random 48-hex-char tokens; 30-day expiry on **real** time (the demo test clock can't extend or expire sessions); sign-out deletes the session; disabling a user revokes all sessions | `auth-security.test.ts` |
| S3 | Password disclosure | PBKDF2-SHA256 with a per-user salt; hashes are never returned to the UI (`toPublic`) | `auth-security.test.ts` |
| T1 | Editing another user's records (IDOR) | Every write re-loads the doc and checks `userId` (`core.owned`); not-owner returns the same `not_found` as missing to prevent id probing; denied attempts are audited | `auth-security.test.ts`, `firestore.rules.test.ts` |
| T2 | Client-set prices / quantities | Server-side pricing (`priceCart`) ignores client prices; quantities and stock validated | `billing-growth-market.test.ts` |
| T3 | Granting yourself premium | Entitlement derived only from subscription state written by billing transitions; rules make `subscriptions` server-write-only | both suites |
| T4 | Forged / tampered / replayed payment webhooks | HMAC-SHA256 over `timestamp.body`, constant-time compare, 5-minute freshness window, event-id dedupe | `growth-market-backup.test.ts`, `billing-growth-market.test.ts` |
| T5 | Double-charge / double-stock-decrement (double tap, retry) | Client idempotency key per checkout, server lookup by `(userId, key)`, all mutations serialized through one queue + transaction | `billing-growth-market.test.ts` |
| T6 | Malicious backup file | Size cap (5 MB), strict Zod schema with length limits, referential checks, records re-owned to the importer, foreign backups re-keyed so they can't collide with the original owner's ids, never overwrites another user's doc, typed confirmation for replace, automatic pre-restore snapshot with undo | `content-sync-backup.test.ts`, `growth-market-backup.test.ts` |
| R1 | Repudiation of admin actions | Audit log for role changes, disables, refunds, commission transitions, config changes, webhooks, denied access | `auth-security.test.ts` |
| I1 | PII leaking into analytics | `sanitizeProps` drops PII-looking keys and email-like values; subjects are salted hashes of device ids; no third-party SDKs | `billing-growth-market.test.ts` |
| I2 | Account enumeration | Uniform login error; IDOR returns `not_found` | `auth-security.test.ts` |
| D1 | Click / sign-up spam | Per-device rate limits on referral clicks, ad clicks, sign-ups and checkouts | `auth-security.test.ts` (login), code review (others) |
| E1 | Privilege escalation | Admin endpoints require `role === 'admin'` on the backend; admins can't change their own role or disable themselves; Firebase design uses custom claims set only by an admin-only callable | `auth-security.test.ts`, `firestore.rules.test.ts` |
| E2 | Referral abuse | Self-referral blocked by account, normalized email (dots / plus-aliases) and device; one attribution per referee; reward idempotent; per-referrer cap | `billing-growth-market.test.ts`, `growth-market-backup.test.ts` |

## Accepted risks (demo only)

- On-device backend: see the caveat at the top.
- SQLite file is not encrypted at rest (SQLCipher isn't in Expo Go). A production app should
  encrypt sensitive tables or keep them server-side.
- PBKDF2 iteration count is modest (10,000) so it stays fast in a JS engine. Production should hash on the
  server with argon2id / scrypt.
- The session token is stored in the local database rather than the Keychain/Keystore.
- `npm audit` reports a high-severity `zod` advisory inside Expo's **developer CLI** (`@expo/cli` → `zod@3`).
  It isn't shipped in the app bundle; the app's own `zod` is 4.6.7 (patched). The suggested
  `npm audit fix --force` would downgrade to Expo SDK 54, so it wasn't applied.
