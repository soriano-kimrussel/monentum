# Zero-Cost Policy

Momentum is a **portfolio / client-demonstration project with a hard budget of $0.**
This document is binding for anyone (human or AI) working on the repository.

## Rules

1. **Never** upgrade a service, enable billing, attach a payment method, buy credits, a domain,
   a subscription, an API plan or a developer membership.
2. **Never** deploy to infrastructure that requires payment, including Firebase Cloud Functions,
   which need the Blaze (pay-as-you-go) plan with a billing account.
3. **Never** call a paid API (AI, maps, SMS, email, ads, analytics).
4. **Never** create real payment-provider transactions or collect card numbers, CVVs or bank details.
5. **Never** submit to the Apple App Store or Google Play (both require paid developer accounts).
6. If a feature can't run for $0, build a **clearly labelled local simulation** and document it here
   and in [FREE_SERVICES.md](FREE_SERVICES.md).
7. Before adding any dependency or integration, ask: *can this create a charge or require a paid
   account?* If there is any uncertainty, **don't activate it**. Use a local implementation.
8. A free usage quota is **not** the same as free. Anything that needs a card on file is out of scope.

## What runs where

| Concern | Implementation | Runs | Cost |
|---|---|---|---|
| App runtime | Expo SDK 58 / React Native in **Expo Go** | Your phone / emulator | $0 |
| Database | `expo-sqlite` (device), in-memory + localStorage (web preview) | On device | $0 |
| "Server" / authorization | `src/backend` MockBackend | On device | $0 |
| Authentication | Local demo accounts (PBKDF2-hashed passwords in SQLite) | On device | $0 |
| Cloud sync | Simulated outbox + "cloud" namespace in the same DB | On device | $0 |
| Payments / subscriptions | Deterministic simulated provider + signed mock webhooks + test clock | On device | $0 |
| Referrals, affiliates, ad attribution | Local event log + rules | On device | $0 |
| Marketplace | Local listings, idempotent simulated checkout | On device | $0 |
| Notifications | `expo-notifications` **local** notifications (no push server) | On device | $0 |
| Backups | User-initiated JSON export/import | On device | $0 |
| Firebase rules & functions | **Emulator Suite only**, project id `demo-momentum` | Your computer | $0 |

The `demo-` project-id prefix tells the Firebase CLI to run fully offline against emulators; it can't
touch a real Firebase project.

## Running everything offline

After `npm install` (which needs internet once), the app needs no network:

```bash
npx expo start --offline     # serves the JS bundle from your computer over LAN
```

Open it in Expo Go on a phone on the same Wi-Fi, or in an Android emulator. All data lives on the device.

## Simulated vs real

Every simulated money or growth surface shows a purple **"Demo mode / simulated"** banner. Nothing in
the UI or docs presents a mock as a real integration. In particular:

- Purchases, renewals, refunds and orders are **simulated**. No money moves.
- "Restore purchases" rebuilds entitlement from the **local** ledger. It doesn't prove a real store purchase.
- Webhook verification uses a **mock secret** and proves only the verification logic.
- Local demo auth is **not** production identity verification.
- Front-end role checks are UX only. Authorization lives in the backend layer (see
  [THREAT_MODEL.md](THREAT_MODEL.md) for why even that is not a real security boundary on-device).
