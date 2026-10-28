# Client Demo Walkthrough (≈12 minutes)

**Setup (before the meeting):** `npx expo start`, open in Expo Go, and do a fresh start via
*You → Demo controls → Reset demo data*. Have the admin credentials ready.

| Account | Email | Password |
|---|---|---|
| Demo user | `demo@momentum.app` | `Demo1234!` |
| Admin | `admin@momentum.app` | `Admin1234!` |

(The sign-in screen has one-tap buttons for both.) Everything shown is local and simulated; say so up front.

## Script

1. **Sign in (demo user)** – "Accounts are local demo accounts; nothing leaves the phone."
2. **Today** – progress ring, tap to complete *Read 20 pages* (haptic tick), streak count updates.
   Log a mood with a tag. *Talking point: one tap per habit and per mood.*
3. **Habit detail** – tap *Morning walk*: current / longest streak, 30-day rate, back-fill a missed day.
4. **Insights** – 30-day completion bars, 13-week heatmap, mood trend, "what we noticed" (best weekday,
   mood vs completion). Switch to *90 days* → Free plan limit → upsell.
5. **Premium (simulated)** – purple banner: *no real payment*. Start the 7-day trial.
   *You → Demo controls → +8d*: the trial converts and a simulated charge appears in *Subscription → Transaction history*.
6. **Failure path** – switch the demo card to *fails on renewal* → *+30d* → **past due** banner with grace
   period → switch back to *always approves* → *Retry payment* → active.
7. **Refund** – request a refund on the latest charge.
8. **Goals & journal** – *Run a 10K*: tick a milestone, ring animates. New journal entry from a prompt.
9. **Shop** – search "journal", add to cart, place order (simulated); *Buy again* from order history.
   Mention server-side pricing and the idempotent checkout (double tap → one order).
10. **Invite friends** – referral code and link; explain anti-abuse (self, alias, same device, caps).
11. **Backup** – export JSON (share sheet), then *Undo last restore* to show recovery.
12. **Sync** – go offline, complete a habit (pending = 1), back online → *Sync now*; *simulate edit on another device* → sync pulls it.
13. **Sign out → Admin**
    - Dashboard: users, premium count, simulated MRR, sign-ups chart, marketplace supply vs demand.
    - **Refund queue** → approve the refund from step 7 (entitlement removed, affiliate commission reversed).
    - **Affiliates** → approve and mark paid; create an affiliate (generates a tracking link).
    - **Attribution** → *Simulate 40 campaign clicks*; per-campaign funnel; **Events** tab shows PII-free events.
    - **Webhook tester** → valid ✅, replay → duplicate, tampered / forged / stale → ⛔.
    - **Audit log** → filter *denied* to show blocked access attempts.
14. **Close** – "Everything runs for $0 on-device; Firebase rules and functions are written for the
    emulator and swap in behind the same backend interface."

## Screenshot / recording plan

Record with the phone's built-in screen recorder (free) or `adb shell screenrecord` on Android.

| # | Screen | State to capture |
|---|---|---|
| 1 | Sign in | Demo account card visible |
| 2 | Today | Ring partly filled, one habit checked, mood selected |
| 3 | Insights | 30-day view with heatmap and mood trend |
| 4 | Habit detail | 8-day strip with a back-filled day |
| 5 | Paywall | Annual selected, *Save 33%* pill, simulated banner |
| 6 | Subscription | Past-due state with retry button |
| 7 | Shop grid | Category chips + low-stock labels |
| 8 | Cart / order | Order placed (simulated) |
| 9 | Invite friends | Code, stats, records with a blocked self-referral |
| 10 | Backup | Valid file preview with counts |
| 11 | Admin dashboard | KPIs and charts |
| 12 | Webhook tester | Mixed ✅ / ⛔ results |
