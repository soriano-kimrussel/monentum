# Momentum — Zero-Cost Implementation Plan

Momentum is a habit, goal and mood-tracking app built as a **portfolio / client demo**.
Budget is **$0**: everything runs locally, nothing is deployed, and every paid integration
(payments, app stores, ads, cloud functions) is a clearly labelled local simulation.

See [ZERO_COST_POLICY.md](ZERO_COST_POLICY.md) and [FREE_SERVICES.md](FREE_SERVICES.md).

## Architecture

```
src/
  app/          Expo Router screens only (file = route)
  domain/       Pure TypeScript business rules: streaks, analytics, subscription state
                machine, referrals, affiliates, marketplace, backup schemas. No React, no I/O.
  backend/      "MockBackend": the authoritative layer the UI calls. It plays the role a
                Cloud Functions / Firestore-rules backend would play: session validation,
                role checks, ownership checks, rate limits, idempotency, audit log,
                webhook signature verification. It runs ON DEVICE, so it demonstrates the
                logic but is NOT a security boundary (see docs/THREAT_MODEL.md).
  data/         DocStore interface + adapters (expo-sqlite on native, in-memory for tests
                and web), simulated cloud sync engine (outbox + simulated remote).
  services/     Provider interfaces (Auth, Payments, Notifications, Analytics) with mock
                implementations; Firebase adapters are future work behind the same interfaces.
  stores/       Zustand UI/session state.
  ui/           Theme, components, SVG charts.
firebase/       Emulator-only config, Firestore/Storage rules, rule tests, callable functions.
docs/           Policy, services, threat model, checklists, walkthrough.
```

Swapping to Firebase later means implementing `Backend` against Cloud Functions + Firestore
— screens only depend on the `Backend` interface.

## Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Repo inspection, SDK-58 dependencies, tooling (Jest, ESLint, TS), docs skeleton | Done |
| 1 | Domain layer + DocStore + MockBackend (auth, roles, habits, check-ins, streaks, goals, mood, journal) with tests | Done, tested |
| 2 | Subscriptions (trial, renew, fail, cancel, upgrade/downgrade, refunds, restore, test clock), mock payment provider + signed webhooks | Done, tested |
| 3 | Referrals, affiliates, ad-attribution analytics (PII-free events) | Done, tested |
| 4 | Marketplace (listings, search, cart, idempotent checkout, refunds, restock) | Done, tested |
| 5 | Admin dashboard, audit log, backup/restore, sync simulation | Done, tested |
| 6 | Mobile UI for all journeys, SVG charts, local notifications | Done. All 22 main screens render in UI smoke tests; on-device manual pass pending (see RELEASE_CHECKLIST) |
| 7 | Firebase Emulator Suite: rules + rule tests + callable functions | Written, **not executed** (needs a local JDK) |
| 8 | Release readiness: branding config, walkthrough script, screenshot plan, checklists | Done except final icon/splash artwork (template images still in `assets/`) |

### Next steps
1. Install a free JDK, then run `cd firebase && npm install && npm run test:rules`.
2. On-device manual pass of RELEASE_CHECKLIST.md (especially sign-out → sign-in as another user).
3. Replace template icon and splash artwork.
4. Optional: a `FirebaseBackend` that implements the same interface against the emulators.

## Explicitly NOT done (would cost money or need paid accounts)

- App Store / Google Play submission (Apple Developer Program fee, Play Console fee).
- Live Stripe / RevenueCat / StoreKit / Play Billing.
- Deploying Cloud Functions (requires Firebase Blaze plan with billing account).
- Remote push notifications via APNs (requires paid Apple membership).
- EAS cloud builds are not required; Expo Go is used for the demo.
