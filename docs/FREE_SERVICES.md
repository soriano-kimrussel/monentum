# External Services Inventory

Every external tool or service the project touches, whether it runs locally or remotely,
and whether it could ever cost money. **Pricing and plan terms change. Verify on the linked
official page before enabling anything new.** This project enables none of the paid items.

## Used today

| Service / tool | Local or remote | Account needed? | Billing info needed? | Notes |
|---|---|---|---|---|
| npm registry | Remote (install time only) | No | No | Needed once for `npm install`. |
| Expo CLI (`npx expo`) | Local | No | No | Dev server, bundling, `expo export`, `expo lint`. |
| Expo Go app | Local (on your phone) | No | No | Free from the App Store / Google Play. Runs the demo without building native code. |
| `expo-sqlite`, `expo-notifications` (local only), `expo-file-system`, `expo-document-picker`, `expo-sharing`, `expo-crypto`, `expo-haptics` | Local | No | No | Bundled in Expo Go. No remote push is used. |
| `@noble/hashes` | Local | No | No | Pure-JS SHA-256 / HMAC / PBKDF2. |
| Jest, React Native Testing Library, ESLint, TypeScript | Local | No | No | |
| `npm audit` | Remote (advisory DB lookup) | No | No | Free dependency audit. |
| Git | Local | No | No | GitHub Free is optional if you want a remote. |

## Written, not active (emulator-only)

| Service / tool | Local or remote | Account needed? | Billing info needed? | Notes |
|---|---|---|---|---|
| Firebase CLI + Emulator Suite (Auth, Firestore, Functions) | **Local** | No (with `demo-*` project id) | No | The Firestore emulator needs a local **Java JDK** (free; check the firebase-tools docs for the current minimum version). Not installed on the machine this was built on, so the rules tests have **not been run yet**. |
| `@firebase/rules-unit-testing` | Local | No | No | Runs the rules tests against the emulator. |

## Deliberately NOT used (would cost money or need a paid / carded account)

| Service | Why not | Simulated by |
|---|---|---|
| Firebase **Blaze** plan / deployed Cloud Functions | Needs a billing account | `src/backend` + emulator-only functions |
| Firebase production project (even Spark) | Not needed; avoids any risk of accidental upgrades | Emulators + local adapters |
| Stripe / RevenueCat / StoreKit / Google Play Billing (live) | Real money, merchant accounts | `src/domain/subscription.ts`, signed mock webhooks |
| Apple Developer Program | Annual fee | Not submitted; Expo Go demo |
| Google Play Console | One-time registration fee | Not submitted; Expo Go demo |
| EAS Build / Submit / Update | Not required; free tiers still need an account and have limits | `npx expo start` + Expo Go; `expo export` for bundle checks |
| Push notifications via APNs / FCM | Needs developer accounts or hosted credentials | Local notifications only |
| Ad networks / MMPs (attribution SDKs) | Paid and send data to third parties | Local PII-free event log + last-click attribution |
| AI APIs | Paid per token | Not used |
| Domains / hosting | Paid | `momentum://` deep links inside the app |

## Limits that could interrupt a demo

- **Expo Go compatibility:** the demo only uses modules bundled in Expo Go for SDK 58. Keep the Expo Go
  app updated to a version that supports SDK 58.
- **Web preview:** runs from an in-memory store mirrored to `localStorage`, and notifications are
  unavailable. Use the phone app for the real demo.
- **No network is required** after install, so there are no quotas to exhaust.
