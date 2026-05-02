# Closed Beta — OmniBazaar Mobile (Android-first)

**Audience:** internal QA + 20 invited external testers
**Channel:** APK sideload via `https://app.omnibazaar.com/mobile/install`
**Goal:** find P0/P1 issues before Play Store internal-track submission
**Plan reference:** `Validator/ADD_MOBILE_APP.md` Group G1 + `Validator/MOBILE_REMEDIATION_PLAN.md` Sprint 6.

---

## 1. Distribution

The sideload page (`WebApp/src/pages/mobile/InstallPage.tsx`) is already
live and self-serve:

```text
https://app.omnibazaar.com/mobile/install
```

It performs UA detection (Android → APK download button, iOS → "iOS
deferred", desktop → QR code) and publishes the SHA-256 of the
current APK as a sibling `.apk.sha256` file so testers can verify
the binary before installing. APK is signed with the EAS preview
keystore in `eas.json`.

To roll out a new beta build:

```bash
cd Mobile
eas build --profile preview --platform android
# eas auto-uploads the APK to the EAS dashboard. Download:
eas build:download --latest --platform android --output OmniBazaar-latest.apk
# Compute + upload the SHA-256 alongside the APK:
shasum -a 256 OmniBazaar-latest.apk | awk '{print $1}' > OmniBazaar-latest.apk.sha256
# Upload both to the OmniBazaar website's mobile/install/ static path
# (replace with whatever the actual hosting commit step is).
```

---

## 2. Tester onboarding email (template)

```text
Subject: You're invited — OmniBazaar Mobile closed beta

Hi <name>,

You're one of 20 testers helping us shake out the new OmniBazaar
mobile app before we list it on Google Play. Here's what we need:

1. Install the app:
   https://app.omnibazaar.com/mobile/install
   (Android only for now. Verify the SHA-256 before installing if
    you'd like — instructions are on the page.)

2. Try the four "golden" flows below. If anything breaks, send a
   short note to mobile-beta@omnibazaar.com — screenshots help.

3. Treat this as real money. The app is on mainnet. Don't deposit
   more than you're willing to learn from.

Golden flows
------------
A. Sign-up: "Create New Account" → set username + password → email
   verify → wallet home shows portfolio total in USD.

B. Browse-as-guest: from cold start, tap "Browse as Guest" → swipe
   through Shop / Trade / Wallet / Chat / Profile tabs → tap any
   listing's Buy button → confirm the sign-in modal pops up.

C. Sell-on-mobile: from Shop's P2P sub-tab tap the "+" FAB → take
   a photo of something to sell → fill the form → publish.

D. Bridge: Trade tab → Bridge → USDC, Ethereum → Arbitrum, 10 USDC
   → confirm the quote card loads with a price + fees.

Known limitations
-----------------
• iOS submission is deferred — Android only for this beta.
• Hardware wallet (Ledger / Trezor) physical-device support is
  in code but not yet smoke-tested. Skip for now.
• Push notifications: we'll register at sign-in but the validator's
  push pipeline is still being warmed up — don't expect them yet.

Thanks for helping us ship!
— The OmniBazaar team
```

---

## 3. Feedback intake

Every beta report flows into the same triage box. Recommended channels:

- **Email:** `mobile-beta@omnibazaar.com` (forward to the team's
  triage Slack channel via a forwarding rule)
- **In-app:** Settings → "Send Feedback" link (Sprint 6 follow-up;
  not yet wired)
- **TestFlight-style crash reports:** Sentry SDK already initialised
  via `Mobile/src/services/SentryService.ts`. Crashes are captured
  automatically when the DSN env var is set in the EAS build.

When a tester replies, capture:

- **Build version** — `app.json` `version` + `ios.buildNumber` /
  `android.versionCode`. Visible in the About screen (Profile →
  About).
- **Device** — model + Android version (Settings → About phone).
- **Reproduction steps** — golden-flow ID (A/B/C/D) or free-form.
- **Screenshot or screen recording** — required for any UI bug.
- **Wallet address** — only when relevant; never the seed/password.

---

## 4. Triage

Use a single GitHub Project board (or Linear, whatever the team
already runs) with three columns:

| Column | Definition | SLA |
|---|---|---|
| **Triage** | new reports, owner unassigned | 24 h |
| **Fix in flight** | owner assigned, branch open | 3 days |
| **Verified** | merged + verified on a re-built APK by the reporter | — |

Severity tags (P0 = ship blocker; P1 = ship blocker for store; P2 =
nice-to-have):

- **P0** — crash, lost funds, signature failure, sign-in broken
- **P1** — broken feature flow, missing translation in default
  locale, wrong error copy, hardcoded English in a button label
- **P2** — visual polish, layout glitches on edge devices, longer
  delays than Track E budgets

A P0 found by 2+ testers triggers a bonus EAS build the same day.

---

## 5. Cadence

- **Day 0:** ship beta APK. Send onboarding email.
- **Day 1–7:** triage daily. Same-day fix-build for P0s.
- **Day 7:** re-run all 22 critical Maestro flows on the latest
  build, on a real Samsung A15 + Pixel 6.
  ```bash
  cd Mobile
  npx maestro test .maestro/ --device-name "Samsung A15" --include-tags=critical
  ```
- **Day 8:** if zero P0/P1 outstanding, tag the build for Play Store
  internal-track submission.

---

## 6. Promotion to Play Store internal track

Once the beta build passes Day 8, promote without a rebuild:

```bash
eas submit --profile production --platform android --latest
```

The internal track is a private channel inside Play Console — only
Google-account-listed testers see it. It unblocks the "production
review" timer at Google's end (typically 3–7 days). Promote to the
public track once the internal track has soaked for 24 h with no
crashes in Sentry.

---

## 7. After-action review

Once the public-track submission lands, write a one-page after-action:

- **Total reports** by severity
- **Time-to-fix** distribution (median + p95)
- **Top 3 issues** — what they were and how we caught them
- **Process improvements** for the next major release

Save it under `Mobile/docs/beta-N.md` — replace `N` with the build
generation. Include a link in `ADD_MOBILE_APP.md` Sprint 6 log.
