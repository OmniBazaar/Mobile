# OmniBazaar Mobile — Store Review Notes (DRAFT)

> **Status — DRAFT.** Paste this content into App Store Connect's
> "App Review → Notes" field and Google Play Console's "Review
> guidance" field when submitting. Legal must review the KYC + AML
> sections first.

---

## App description (1–2 paragraphs)

OmniBazaar is a non-custodial Web3 marketplace + multi-chain wallet.
The Mobile app delivers the full OmniBazaar platform — peer-to-peer
buying and selling, NFT browsing and purchase, intent-based DEX
swapping across 8+ EVM chains, prediction markets, staking, and
hardware-wallet integration — on iOS and Android.

The app stores user keys exclusively on-device (iOS Keychain / Android
Keystore). The OmniBazaar maintainers never have custody of user funds,
keys, or marketplace state; transactions are signed locally and broadcast
to public blockchains.

---

## Test account for review

```
Username:        review-tester
PIN:             123456 (debug PIN; only valid in builds tagged for review)
Recovery phrase: abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
Test funds:      ~5 XOM, ~10 USDC on every supported chain — pre-loaded for the review wallet by the validator's `seed-review-account` job
```

**Reviewer flow:** sign in with the recovery phrase above → tap
**Swap** → swap 1 XOM → USDC → confirm. The transaction is gasless
(OmniRelay meta-tx); the user pays no gas. Then tap **Shop** → P2P →
tap any listing → "Buy with escrow" → confirm. The escrow is funded
on the test wallet.

---

## KYC compliance

OmniBazaar uses a tiered identity-verification model. **No KYC is
required for basic wallet, swap, or browse functionality** — those
work anonymously with only an email-verified account.

Higher tiers (required only for marketplace selling, validator-status,
or per-region RWA trading) ask the user to opt in to KYC verification
through **Persona**, an industry-standard third-party identity provider.
We never see the user's government ID or selfie in cleartext; Persona
returns only the verification result and the resulting tier.

| Tier | Trigger | Verification |
|------|---------|--------------|
| 0 — Anonymous | Default | Email only |
| 1 — Basic | Optional bonus eligibility | Email + phone + social-follow |
| 2 — Verified | Optional, unlocks fee discounts | Persona document OCR + AML/PEP screening |
| 3 — Identity | Required for marketplace selling | Persona government ID + facial match |
| 4 — Institutional | Required for validator operators | Persona business-entity verification |

Persona's privacy policy applies to documents the user submits. See
the in-app "Identity Verification" screen for the user-facing copy.

---

## AML compliance

OmniBazaar runs the following automated controls:

1. **OFAC / sanctioned-address screening** on every wallet address that
   initiates a marketplace listing or escrow funding. Matched addresses
   are blocked at the API gateway; the user sees an "address not
   eligible" message.
2. **AML / PEP screening** at KYC Tier 2, run automatically after
   document OCR. The screening provider is part of the Persona stack.
3. **Velocity limits** on KYC-Tier-0 and KYC-Tier-1 accounts to slow
   structuring attempts.
4. **Suspicious-pattern detection** on the validator side:
   round-tripping, mixer-adjacent inflows, and rapid-relay patterns
   are flagged for manual review and may result in account suspension.

The on-chain protocol is permissionless — we cannot freeze user wallets
or reverse user transactions. Suspension only restricts access to
validator-mediated features (marketplace listing, escrow funding,
KYC-gated swaps); the user retains full custody of their keys.

---

## Age rating: 17+ (Apple) / Mature 17+ (Google)

The app handles real cryptocurrency and real money. Per Apple's
guidelines (1.4.1, 3.1.5(a)(i)) and Google's gambling-and-finance
policies, we set the age rating to 17+.

The app does **not** include:

- Gambling (prediction markets are CFTC-event-contract-style, not
  casino games)
- Adult content
- Drug or alcohol references
- Violence

It does include:

- Frequent / intense profanity: **No**
- Cartoon or fantasy violence: **No**
- Mature / suggestive themes: **No**
- Sexual content: **No**
- Horror / fear themes: **No**
- Realistic violence: **No**
- Simulated gambling: **No** (predictions are derivative contracts on
  real-world outcomes, not games of chance)
- Unrestricted web access: **No** (the app does not include a general
  web browser)

---

## Cryptocurrency disclosure

Per Apple App Store Review Guideline 3.1.5(b) and Google Play
Cryptocurrency policy:

- The app facilitates self-custodial wallet operations (no custody)
- The app facilitates DEX trading (peer-to-peer swap, no exchange
  custody)
- The app does **not** facilitate ICOs / new-token sales (no token
  distribution mechanism in the v1.0 release)
- The app supports **staking** of the OmniCoin (XOM) native token
- The app supports **NFT marketplace** transactions
- The app supports **prediction markets** sourced from third-party
  Conditional Token Framework (CTF) protocols (Polymarket, Kalshi
  feeds)

---

## Permissions justification

| Permission | Why |
|---|---|
| Camera | QR code scanning for receive addresses, KYC document capture, marketplace listing photos |
| Bluetooth | Pairing with Ledger Nano X hardware wallets over BLE |
| USB (Android only) | Pairing with Ledger Nano S Plus over USB-C |
| Photos | Selecting marketplace listing images from the user's photo library |
| Location | Optional — finding nearby P2P sellers (off by default; user-toggle) |
| Microphone | Optional — voice messages in escrow chat (off by default) |
| Local notifications | Trade fills, escrow status changes, security alerts |
| Biometric (Face ID / Touch ID / fingerprint) | Unlocking the app and signing transactions |

The app does **not** request:

- Full contacts access
- SMS / call log access
- Background location
- Background Bluetooth (foreground only — `bluetoothAlwaysUsageDescription`
  is for the iOS prompt; the BLE adapter explicitly disables background
  modes)

---

## Submission checklist

- [ ] Privacy Policy live at `omnibazaar.com/legal/mobile/privacy`
- [ ] Terms of Service live at `omnibazaar.com/legal/mobile/terms`
- [ ] App Store Connect "App Privacy" form completed (use the table
      in `Mobile/docs/STORE_PRIVACY_FORM.md`)
- [ ] Google Play "Data Safety" form completed (same table)
- [ ] 10 iOS screenshots uploaded (per device size: 6.7", 6.1", 5.5")
- [ ] 10 Android screenshots uploaded (phone + 7" tablet + 10" tablet)
- [ ] Feature graphic 1024×500 uploaded
      (`Mobile/store-assets/google-play-feature-graphic-1024x500.png`)
- [ ] App icon 1024×1024 uploaded (`Mobile/assets/images/icon.png`)
