# Release-Readiness Checklist (Client Demo)

"Release" here means **ready to present**, not store submission.

## Automated (run `npm run verify`)
- [x] TypeScript: `npx tsc --noEmit` passes
- [x] Lint: `npx expo lint` passes
- [x] Unit + integration + UI smoke tests: `npm test` (83 tests)
- [x] `npx expo-doctor`: 20/20
- [x] Android JS bundle builds: `npx expo export --platform android`
- [x] Web bundle builds: `npx expo export --platform web`
- [ ] Firestore rules tests: `cd firebase && npm install && npm run test:rules` (**not yet run**: needs a local JDK)

## Manual, on a real device (Expo Go)
- [ ] App boots offline (airplane mode after the bundle loads) and seeds demo data
- [ ] Demo user: toggle check-ins, log mood, write a journal entry, create a habit with a reminder
- [ ] Local notification arrives (Reminders → "Send a test notification")
- [ ] Trial → advance clock +8d → converts; fails-on-renewal card → +30d → past due → retry
- [ ] Refund request → sign out → admin approves → user loses premium
- [ ] **Sign out, then sign in as a different account in the same session.** This could not be
      verified in the Jest UI harness (it renders an empty tree after re-entering the app group
      there), so check it on a device.
- [ ] Shop: add to cart, double-tap "Place order", confirm a single order and a single stock decrement
- [ ] Backup: export → replace-restore with `REPLACE` → undo
- [ ] Sync screen: offline toggle queues changes; "simulate edit on another device" → Sync pulls it
- [ ] Deep links: in **Expo Go** the custom scheme isn't registered, so use the Expo Go form, e.g.
      `adb shell am start -a android.intent.action.VIEW -d "exp://<LAN-IP>:8081/--/invite/<CODE>"`
      (and `.../--/c/FITCOACH` for a campaign). `momentum://invite/<CODE>` works only in a development or standalone build.

## Branding & config
- [x] App name "Momentum", scheme `momentum`, brand color `#5B4BDB`
- [x] Splash configured via the `expo-splash-screen` plugin; adaptive icon background set
- [ ] Replace the template icon / splash PNGs in `assets/` with final artwork (1024×1024 icon; Android adaptive foreground/monochrome)
- [x] Bundle ids set (`app.momentum.demo`). Placeholders: change if this ever ships for real

## Store steps that can't be done for $0 (documented, not performed)
| Step | Requirement |
|---|---|
| iOS App Store submission, TestFlight | Apple Developer Program membership (annual fee) |
| Google Play submission / internal testing track | Google Play Console registration (one-time fee) |
| Production push notifications (APNs / FCM with server) | Developer accounts and a hosted sender |
| Real in-app purchases | Store accounts plus merchant / tax setup |
| Hosted backend (Cloud Functions) | Firebase Blaze plan with a billing account |

A local Android **development build** (`npx expo run:android`) is possible for free if Android Studio
and the SDK are installed, but it isn't required: the demo uses only Expo Go modules.
