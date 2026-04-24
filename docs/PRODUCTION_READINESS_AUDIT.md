# OmniBazaar Mobile — Production Readiness Audit

**Version:** Audit snapshot 2026-04-24
**Scope:** Phase-by-phase status of the Mobile app against the
`Validator/ADD_MOBILE_APP.md` v2.1 plan, grouped by the 6 tracks
(A–F) defined in that plan's Part 19.

Legend:
- ✅ Done — shippable as-is
- 🟨 Partial — MVP in place, extensions pending
- ⏳ Pending — scaffolding exists but not integrated
- ⛔ Not started

---

## Track A — Intent-Based Trading Readiness

| # | Criterion | Status | Notes |
|---|---|---|---|
| A1 | OmniDEX-first routing validated against mainnet DEXSettlement V3.1 | 🟨 | `UniversalSwapClient` imported via `@wallet/services/dex/UniversalSwapClient`; SwapScreen wires `getQuote()` directly. Live validation requires connection to mainnet V1. |
| A2 | Li.Fi fallback works for USDC-on-Ethereum → USDT-on-Arbitrum | 🟨 | Route attribution surfaces in UI; requires Li.Fi API key registration for production. |
| A3 | 0x aggregator works for in-chain swaps on Base | 🟨 | Same: attribution label present; aggregator infra validated upstream in Wallet. |
| A4 | XOM → USDC mandatory pre-hop enforced (regression test) | ⏳ | IntentRouter in `@wallet/core/intent/` handles this; no Mobile-side regression test yet. |
| A5 | Multi-hop XOM → USDC → bridge → target end-to-end live | ⛔ | Requires bridge monitor + gasless submission (Phase 3 Week 2). |

---

## Track B — Privacy (COTI pXOM)

| # | Criterion | Status | Notes |
|---|---|---|---|
| B1 | COTI `_safeOnboard()` completes first-time | 🟨 | PrivacyScreen probes `isOnboarded()` at mount and surfaces a "first-time setup" card; first shield tx runs `_safeOnboard()` inline. |
| B2 | Shield flow (XOM → pXOM) succeeds | 🟨 | PrivacyScreen calls `PrivacyService.shield()`. Live validator confirmation pending. |
| B3 | Unshield flow (pXOM → XOM) succeeds | 🟨 | PrivacyScreen calls `PrivacyService.unshield()`. |
| B4 | TX history shows shielded / unshielded states correctly | ⛔ | Depends on TX history screen (deferred from Phase 2). |
| B5 | COTI gas balance check warns before shield attempts | 🟨 | Onboard status check surfaces first-time warning; explicit COTI gas read deferred. |

---

## Track C — 5 Marketplaces (15 items, 3 per marketplace)

### C.1 P2P
| # | Criterion | Status | Notes |
|---|---|---|---|
| C1.a | Browse + filter works | ✅ | `P2PBrowseScreen` wired to `MarketplaceClient.listListings` with search + refresh. |
| C1.b | Purchase completes E2E | 🟨 | Listing detail + escrow purchase pending Phase 4 Week 2. |
| C1.c | Receipt / order reflects in portfolio | ⏳ | Needs escrow integration. |

### C.2 NFT
| # | Criterion | Status | Notes |
|---|---|---|---|
| C2.a | Browse + filter works | ✅ | NFTBrowseScreen wired to `MarketplaceClient.listNFTCollections`, chain picker across 5 EVM chains, image/floor/volume card. |
| C2.b | Buy via MinimalEscrow settlement | ⛔ | Pending NFT service integration on Mobile. |
| C2.c | Receipt reflects in portfolio | ⛔ | Same. |

### C.3 RWA
| # | Criterion | Status | Notes |
|---|---|---|---|
| C3.a | Browse + filter works | 🟨 | Deep-link to DEX from MarketplaceHomeScreen with explainer card. Standalone RWA catalog deferred. |
| C3.b | Trade completes E2E | ⛔ | KYC + jurisdiction gating wired but trade flow pending. |
| C3.c | Position reflects in portfolio | ⛔ | Same. |

### C.4 Yield
| # | Criterion | Status | Notes |
|---|---|---|---|
| C4.a | Browse catalog works | 🟨 | Deep-link to DEX from MarketplaceHomeScreen. Standalone yield catalog deferred. |
| C4.b | Deposit / withdraw completes E2E | ⛔ | `YieldService` in Wallet; Mobile UI pending. |
| C4.c | Position reflects in portfolio | ⛔ | Same. |

### C.5 Predictions
| # | Criterion | Status | Notes |
|---|---|---|---|
| C5.a | Browse markets | ✅ | PredictionsBrowseScreen wired to `PredictionsClient.getOpenMarkets`. Question + category + YES cents + volume + resolution date. |
| C5.b | Buy outcome + claim completes E2E | ⛔ | `PredictionsClient` buy/claim available in Wallet; Mobile UI pending. |
| C5.c | Claim reflects in portfolio | ⛔ | Same. |

---

## Track D — Hardware Wallets (physical-device verification)

| # | Criterion | Status | Notes |
|---|---|---|---|
| D1 | Ledger Nano X BLE signs challenge + EIP-712 + EIP-1559 on iOS + Android | ⛔ | Mobile BLE adapter + `@ledgerhq/hw-transport-react-native-ble` integration pending Phase 6. |
| D2 | Ledger Nano S Plus USB-C signs on Android | ⛔ | Requires `react-native-hid` + HID transport. |
| D3 | Trezor Model T signs via WebView fallback | ⛔ | Trezor Connect hosted webview integration pending. |
| D4 | Hardware challenge-response login completes | ⛔ | `ChallengeAuthClient.hardwareSigner()` exists in Wallet; Mobile transport wiring pending. |

---

## Track E — Bundle + Performance + Battery

| # | Criterion | Status | Notes |
|---|---|---|---|
| E1 | iOS download size < 60 MB | ⏳ | No production EAS build yet. Bundle tree-shaking will matter most once wallet-core families load. |
| E2 | Android AAB split-APK download < 45 MB | ⏳ | Same. |
| E3 | Cold start ≤ 2.0s on iPhone SE 4 | ⏳ | Instrumentation pending. |
| E4 | Cold start ≤ 2.5s on Samsung A15 | ⏳ | Instrumentation pending. |
| E5 | 60fps on FlashList scrolls on Samsung A15 | 🟨 | P2PBrowseScreen uses FlatList; FlashList swap-in is a one-line change. |
| E6 | Battery drain ≤ 15% / hr of active trading | ⏳ | Real-device testing deferred. |

---

## Track F — Store Assets + Compliance

| # | Criterion | Status | Notes |
|---|---|---|---|
| F1 | 10 iOS + 10 Android screenshots ready | ⛔ | Screen captures on emulator — not done. |
| F2 | Feature graphic (1024×500) designed | ⛔ | Pending. |
| F3 | Privacy policy + ToS live on omnibazaar.com | ⏳ | Install-page footer links point at expected URLs; content sign-off pending. |
| F4 | Non-custodial architecture doc ready | ✅ | Covered by Validator/ADD_MOBILE_APP.md v2.1 (path-alias + trustless-core sections). |
| F5 | Challenge-response auth architecture doc ready | ✅ | Same plan doc; AuthService.ts inline JSDoc plus test coverage. |
| F6 | OmniRelay gasless disclosure doc ready | ✅ | Root CLAUDE.md + plan doc. |
| F7 | KYC process doc ready | 🟨 | KYCScreen enumerates tiers; external process doc pending. |
| F8 | AML compliance statement ready | ⏳ | Refers to tier-2 AML/PEP screening in plan; stand-alone statement pending. |
| F9 | App Privacy + Data Safety forms ready | ⛔ | Pending app-store submission. |
| F10 | Age rating 17+ documentation | ⛔ | Pending. |

---

## Cross-cutting Mobile Implementation Status

### Session-latest additions (2026-04-24 continuation)
- NFTBrowseScreen + PredictionsBrowseScreen live via `MarketplaceClient.listNFTCollections` + `PredictionsClient.getOpenMarkets`
- MarketplaceHomeScreen: RWA + Yield cards now deep-link to Swap with a "Trade on DEX" CTA instead of a coming-soon placeholder
- PrivacyScreen — XOM ↔ pXOM shield/unshield with COTI onboard probe, first-time setup banner, fee hint, confirmation Alert
- Swap header exposes a "Privacy (pXOM)" link that routes to PrivacyScreen
- PortfolioService gains `fetchErc20Balances` + `ERC20_TOKENS` registry (9 entries, USDC/USDT across ETH/ARB/BASE/POLY/OP/AVAX)
- WalletHome list now shows native + ERC-20 together; zero-balance non-L1 natives hidden
- 4 new unit tests (ERC20_TOKENS invariants) — 73 total passing

### Shipped (feat/platform-adapters branch on Wallet + OmniBazaar/Mobile main)
- Platform adapter layer with 11 interfaces, 45 passing unit tests.
- 14 Mobile-import-surface Wallet files refactored onto adapter registry.
- Mobile skeleton: path aliases (`@wallet/*`, `@webapp/*`), Metro monorepo resolver, 8 RN platform adapter impls (SecureStore, Notification, Alarm, Runtime, NetworkStatus, Biometric, Tabs, Messaging).
- Full Phase 1 auth flow: Welcome → CreateWallet → SeedBackup → SeedVerify → Import → PinSetup → BiometricEnroll → SignIn → Home. BIP39 + owner/active HD derivation. Challenge-response attestation registration + sign-in via ChallengeAuthClient.
- Phase 2 wallet core: WalletHomeScreen (8 chains), SendScreen, ReceiveScreen (QR).
- Phase 3 swap MVP: SwapScreen with route attribution via UniversalSwapClient.
- Phase 4 marketplace shell: MarketplaceHomeScreen (5 tabs), P2PBrowseScreen live.
- Phase 5 profile hub: ProfileScreen, SettingsScreen (language + auto-lock + biometric toggle), StakingScreen (tier reference), KYCScreen (Persona handoff), AboutScreen (manifest + legal links).
- Phase 9: WebApp `/mobile/install` sideload landing + 4 Playwright smoke cases.

### Gates passing
- Mobile `npm run typecheck` — exit 0
- Mobile `npm test` — **56/56** tests pass in ~1s
- Wallet `build:chrome` + 226 tests — unchanged (adapter refactor preserved behavior)

### Regression protection
- `tests/regression/no-hardcoded-rpc-urls.test.ts` guards against direct RPC references
- `src/platform/smoke-test.ts` fails tsc if `@wallet/*` alias imports regress

### Known gaps vs plan (priority-ordered)
1. Swap execution + OmniRelay gasless submit (Phase 3 Week 2) — blocks Track A completion.
2. Hardware wallet transports (Phase 6) — blocks Track D.
3. NFT / RWA / Yield / Predictions marketplace flows (Phase 4 Week 2) — blocks Track C.
4. ERC-20 token balances + non-EVM family balances (Phase 2 extensions) — blocks full portfolio view.
5. COTI privacy flows (Phase 3 Week 2) — blocks Track B.
6. EAS Build production profiles + real artifact hosting — blocks Track E measurement + Track F screenshots.
7. Physical-device testing (iOS + Android + Ledger) — blocks Track D cert.
8. React Native Testing Library + jest-expo preset for component tests (Phase 8) — blocks component-level regression coverage.

---

## Recommended path to ship-ready

**Sprint P10.1 (~2 weeks):**
- Swap execution via UniversalSwapClient + OmniRelay for L1 (Track A4, A5 → 🟨 → ✅)
- NFT marketplace flow via MinimalEscrow (Track C2)
- COTI privacy shield/unshield (Track B1–B5)
- Component tests via jest-expo for 5 critical screens

**Sprint P10.2 (~2 weeks):**
- Ledger Nano X BLE integration (Track D1)
- RWA + Yield marketplace trade flows (Track C3, C4)
- Predictions CTF buy + claim (Track C5)
- EAS Build production profiles + real CDN hosts for IPA/APK

**Sprint P10.3 (~1 week):**
- Physical-device regression pass (Ledger, Trezor)
- Performance benchmarks on Samsung A15 baseline
- Store assets + compliance docs
- App Store + Google Play submission

**Estimated calendar to v1.0 ship:** 5 weeks of focused work from this snapshot.
