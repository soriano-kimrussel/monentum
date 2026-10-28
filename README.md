# Momentum

A habit, goal and mood-tracking mobile app built with **Expo SDK 58 / React Native / TypeScript**,
designed as a **portfolio and client demo that runs entirely on-device for $0**.

Subscriptions, payments, referrals, affiliates, ad attribution, a marketplace, cloud sync and an
admin console are all **realistic local simulations**, clearly labelled in the UI. No real money
moves, no card data is collected, and nothing is deployed.

→ Read [docs/ZERO_COST_POLICY.md](docs/ZERO_COST_POLICY.md) first.

## Quick start

```bash
npm install            # one-time, needs internet
npx expo start         # scan the QR code with Expo Go (Android / iOS)
```

Demo accounts (one-tap buttons on the sign-in screen):

| Role | Email | Password |
|---|---|---|
| User | `demo@momentum.app` | `Demo1234!` |
| Admin | `admin@momentum.app` | `Admin1234!` |

These are **local demo credentials**, not production identity verification.

Other ways to run it:
- **Android emulator** (free with Android Studio): `npx expo start --android`
- **Fully offline:** `npx expo start --offline` with phone and computer on the same Wi-Fi
- **Web preview** (convenience only, no notifications): `npx expo start --web`

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Jest: domain, backend integration and UI smoke tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint` |
| `npm run verify` | typecheck + lint + tests |
| `npm run audit:deps` | `npm audit` on production deps |
| `npx expo-doctor` | Expo config / dependency diagnostics |

## Features

- **Habits:** daily or weekday schedules, icons and colors, check-ins with 7-day back-fill, streaks
  (scheduled-day aware), archive, local reminder notifications
- **Goals & milestones** linked to habits; **mood tracking** with tags; **journal** with prompts
- **Insights:** completion bars, 13-week heatmap, mood trend, best weekday, mood vs completion
- **Premium (simulated):** Free/Premium, monthly/annual, 7-day trial, upgrade (prorated) and downgrade
  (at renewal), cancel/resume, renewals, payment failure with a grace period, retry, refunds
  (admin-approved), restore purchases, transaction history, **test clock**
- **Referrals:** codes and links, click tracking, configurable rewards, self-referral / alias / device /
  duplicate blocking, reward cap
- **Affiliates & ads:** campaigns, last-click attribution, commissions (pending → approved → paid /
  reversed), PII-free event viewer, synthetic traffic generator
- **Marketplace:** listings, categories, search, inventory, cart, **idempotent** checkout, order history,
  buy again, refunds with restock
- **Admin:** KPIs, simulated MRR, sign-ups and supply/demand charts, users (roles, disable, grant days),
  refund queue, listing management, affiliates, attribution, audit log, webhook signature tester
- **Offline-first:** SQLite storage; simulated cloud sync with outbox, offline toggle, failure injection,
  last-write-wins conflict handling
- **Backup:** JSON export via share sheet, validated import (merge / replace with typed confirmation),
  automatic pre-restore snapshot with undo

## Architecture

```
src/app/       Expo Router screens (file = route)
src/domain/    Pure business rules (streaks, subscription state machine, referrals, marketplace, backup schema)
src/backend/   MockBackend: authN/Z, validation, rate limits, idempotency, audit, signed webhooks
src/data/      DocStore interface: SQLite (device) / in-memory (tests, web)
src/services/  Bootstrap, notifications, file export/import
src/ui/        Theme, components, SVG charts
firebase/      Emulator-only Firestore rules, rules tests, callable functions
docs/          Policy, services, threat model, checklists, walkthrough
```

Screens talk only to `backend.<area>.<action>(token, …)`. Replacing the MockBackend with Firebase
(Auth + Firestore + Functions) means implementing the same interface; the UI doesn't change.

## Firebase emulators (optional)

```bash
# Requires a local Java JDK for the Firestore emulator (free).
cd firebase && npm install
npm run test:rules        # Firestore Security Rules tests against the emulator
npm run emulators         # Emulator UI at http://localhost:4000
```

The project id `demo-momentum` is emulator-only; it can't reach a real Firebase project.
**Status:** written but **not yet executed** (no JDK on the build machine).

## Documentation

- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Zero-cost policy](docs/ZERO_COST_POLICY.md) · [External services inventory](docs/FREE_SERVICES.md)
- [Threat model](docs/THREAT_MODEL.md) · [Security checklist](docs/SECURITY_CHECKLIST.md)
- [Release-readiness checklist](docs/RELEASE_CHECKLIST.md) · [Client demo walkthrough](docs/DEMO_WALKTHROUGH.md)

## Known limitations

- The "backend" runs on-device: great for demonstrating the design, but not a security boundary.
- Web preview uses in-memory storage mirrored to `localStorage`; notifications are unavailable there.
- The Jest preset (`jest-expo`) mis-resolves native-module mocks in this project; `jest.setup.js`
  contains a small, documented workaround.
- Template icon and splash images in `assets/` should be replaced with final artwork.
