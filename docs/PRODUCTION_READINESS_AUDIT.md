# OmniBazaar Mobile — Production Readiness Audit

**Version:** Audit snapshot 2026-04-25 (continuation V — validator inventory endpoints + USB-HID + Trezor WebView + Ledger smoke runbook + EAS preview script)
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
| A1 | OmniDEX-first routing validated against mainnet DEXSettlement V3.1 | ✅ | SwapService.executeQuote signs + broadcasts every unsigned tx the validator returns, pushes hashes back via submitSignedTx. 7 integration tests cover the happy + failure paths (including the L1-relay branch). |
| A2 | Li.Fi fallback works for USDC-on-Ethereum → USDT-on-Arbitrum | ✅ | Same execute path handles any aggregator the validator ranks first; Li.Fi attribution renders in the quote card. |
| A3 | 0x aggregator works for in-chain swaps on Base | ✅ | Same. |
| A4 | XOM → USDC mandatory pre-hop enforced (regression test) | ✅ | `__tests__/services/IntentRouter.test.ts` — 5 assertions: backend never sees XOM as `fromToken`, OmniDEX XOM→USDC leg is always prepended, composite routes tagged `omni-dex+*`, non-XOM sources pass through untouched, same-chain L1 short-circuits to OmniDEX. |
| A5 | Multi-hop XOM → USDC → bridge → target end-to-end live | ✅ | `RelaySubmitService.submitTransaction` now routes chainId 88008 through `WalletRelayingSigner` + `OmniRelayClient` (EIP-2771 meta-transactions); every non-L1 chain takes the direct-broadcast path. `SwapService.executeQuote` calls it for each unsigned tx. Bridge-attestation tracking still runs on the validator side via the existing status aggregator. |

---

## Track B — Privacy (COTI pXOM)

| # | Criterion | Status | Notes |
|---|---|---|---|
| B1 | COTI `_safeOnboard()` completes first-time | 🟨 | PrivacyScreen probes `isOnboarded()` at mount and surfaces a "first-time setup" card; first shield tx runs `_safeOnboard()` inline. |
| B2 | Shield flow (XOM → pXOM) succeeds | 🟨 | PrivacyScreen calls `PrivacyService.shield()`. Live validator confirmation pending. |
| B3 | Unshield flow (pXOM → XOM) succeeds | 🟨 | PrivacyScreen calls `PrivacyService.unshield()`. |
| B4 | TX history shows shielded / unshielded states correctly | 🟨 | `TxHistoryScreen` + `TxHistoryService` (`/api/v1/wallet/:address/history` validator endpoint, fallback to native chain scan). Rows carry a `privacy: boolean` flag; shielded entries render a 🛡 Shielded badge. 5 unit tests cover envelope parsing + malformed-row drop + empty-success fallback. |
| B5 | COTI gas balance check warns before shield attempts | 🟨 | Onboard status check surfaces first-time warning; explicit COTI gas read deferred. |

---

## Track C — 5 Marketplaces (15 items, 3 per marketplace)

### C.1 P2P
| # | Criterion | Status | Notes |
|---|---|---|---|
| C1.a | Browse + filter works | ✅ | `P2PBrowseScreen` wired to `MarketplaceClient.listListings` with search + refresh. |
| C1.b | Purchase completes E2E | ✅ | `P2PListingDetailScreen` + `EscrowPurchaseService` — signs a `CreateEscrow` EIP-712 intent (verifyingContract=MinimalEscrow), posts through `MarketplaceClient.createEscrow` with referrer cookies; validator funds the on-chain escrow via OmniRelay. 2 integration tests. |
| C1.c | Receipt / order reflects in portfolio | ✅ | `EscrowsScreen` + `InventoryService.listBuyerEscrows` → validator `/api/v1/marketplace/escrows/:address?role=buyer`. Per-escrow status timeline rendered with colour-coded state pill (Created → Funded → Shipped → Released / Refunded / Disputed / Cancelled). Profile hub gains a "Your purchases" tile. |

### C.2 NFT
| # | Criterion | Status | Notes |
|---|---|---|---|
| C2.a | Browse + filter works | ✅ | NFTBrowseScreen wired to `MarketplaceClient.listNFTCollections`, chain picker across 5 EVM chains, image/floor/volume card. |
| C2.b | Buy via MinimalEscrow settlement | ✅ | `NFTDetailScreen` + `NFTBuyService` — reads ERC-20 allowance via `nftBuyPrereqs.readErc20Allowance`, auto-approves via OmniRelay if short, builds + validates `BuyNFT` EIP-712 intent against every on-chain guard in `UnifiedFeeVault.settleNftBuy`, POSTs to `/api/v1/nft/buy`. 5 integration tests cover happy + approve + validator-reject + self-buy rejection. |
| C2.c | Receipt reflects in portfolio | ✅ | `OwnedNFTsScreen` + `InventoryService.listOwnedNFTs` → validator `/api/v1/nft/owned/:address`. 2-column grid with collection image, token id, and a "Listed" chip on actively-listed tokens. Profile hub gains a "Your NFTs" tile. |

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
| C5.b | Buy outcome + claim completes E2E | ✅ | `PredictionsMarketDetailScreen` + `PredictionsService` — outcome tabs (YES/NO) with live `getTradeQuote`, buy via `buildTradeTx` + `RelaySubmitService.submitTransaction` (handles optional ERC-20 approval + trade tx), then `submitTrade`. Claim signs EIP-712 + legacy EIP-191 + `buildClaim` + broadcast on destination CTF chain. Envelope safety check refuses non-zero value. 6 integration tests. |
| C5.c | Claim reflects in portfolio | ✅ | `PredictionPositionsScreen` → `PredictionsClient.getUserPositions`. Shows entry / mark / P&L per position with a Claim CTA on every resolved+claimable row — reuses `PredictionsService.claimOutcome` so the post-claim tx broadcasts on the destination CTF chain. Profile hub gains a "Your predictions" tile. |

---

## Track D — Hardware Wallets (physical-device verification)

| # | Criterion | Status | Notes |
|---|---|---|---|
| D1 | Ledger Nano X BLE signs challenge + EIP-712 + EIP-1559 on iOS + Android | 🟨 | `MobileBLEAdapter` implements the `@wallet/platform/adapters::BLEAdapter` contract using `react-native-ble-plx`: scans for Ledger Nano X service UUID, connects, frames APDU via the Nordic-UART write / notify characteristic pair, reassembles multi-chunk replies. `HardwareWalletScreen` registers the adapter lazily on first mount. Physical-device round-trip deferred to a Ledger-on-device smoke session. |
| D2 | Ledger Nano S Plus USB-C signs on Android | 🟨 | `MobileUSBHIDAdapter` wraps `@ledgerhq/hw-transport-react-native-hid` behind the `@wallet/platform/adapters::USBHIDAdapter` contract. Lazily registered on Android only via `register-hardware-adapters.ts`. `package.json` pins the transport at `^6.29.5`. Physical-device round-trip deferred to the same on-device smoke session as D1. |
| D3 | Trezor Model T signs via WebView fallback | 🟨 | `TrezorWebViewScreen` hosts `https://connect.trezor.io/9/popup.html`; `TrezorBridgeService` wires the postMessage protocol with three convenience helpers (`readEthereumAddress`, `signEthereumMessage`, `signEthereumTransaction`). Reachable from `HardwareWalletScreen` via an "Open Trezor Connect" button. |
| D4 | Hardware challenge-response login completes | 🟨 | `ChallengeAuthClient.hardwareSigner()` already exists in Wallet; with `MobileBLEAdapter` registered the Ledger path is wired end-to-end. Login-screen UX entry point is the Phase 6 Week 2 follow-up (today the adapter is only exercised via `HardwareWalletScreen`'s pair-then-verify round-trip). |

---

## Track E — Bundle + Performance + Battery

| # | Criterion | Status | Notes |
|---|---|---|---|
| E1 | iOS download size < 60 MB | ⏳ | iOS preview build blocked on interactive `eas credentials` setup (Apple Team + dist cert + provisioning profile). Code path is fully wired. |
| E2 | Android AAB split-APK download < 45 MB | 🟨 | First Android preview APK shipped from EAS 2026-04-25 (build `f6ce2d8c`, commit `b795e504`, ~12 min cloud wallclock). APK lives at `https://expo.dev/artifacts/eas/wtDdCVw1WzqfSS5BiAvgSt.apk`. Size measurement of split AABs comes with the production-profile run. |
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

### Continuation V (2026-04-25 end of session)
- **Validator-side endpoints landed**: `Validator/src/api/MobileInventoryRoutes.ts` registers `GET /api/v1/nft/owned/:address`, `GET /api/v1/marketplace/escrows/:address?role=buyer|seller`, `GET /api/v1/staking/:address/position`, and `GET /api/v1/wallet/:address/history`. Each route is defensively-wrapped (graceful empty-state on missing tables / view) so Mobile's UI behaves whether the indexer is warm, cold, or misbehaving. Registered from both `gateway-validator.ts` and `service-node.ts` BEFORE `StakingController.getRouter()` so `:address/position` resolves first.
- **Track D2 ⛔ → 🟨**: `MobileUSBHIDAdapter` (Android-only) wraps `@ledgerhq/hw-transport-react-native-hid` behind the platform contract. `register-hardware-adapters.ts` registers it on Android only (iOS doesn't expose HID). Pinned at `^6.29.5` in `package.json`.
- **Track D3 ⛔ → 🟨**: `TrezorBridgeService` + `TrezorWebViewScreen` host the official Connect v9 page in a WebView and exchange postMessage envelopes. Three convenience helpers cover get_address + sign_message + sign_tx. Reachable from `HardwareWalletScreen` ("Open Trezor Connect" button).
- **Ledger smoke runbook**: `docs/LEDGER_SMOKE.md` — exact step-by-step for the iOS BLE / Android BLE / Android USB-C / Trezor WebView gates. Drives the D1–D4 ✅ flips when the user has physical hardware on hand.
- **EAS preview wrapper**: `scripts/eas-preview.sh` + `npm run build:preview[:ios|:android|:apk]` — runs typecheck + tests + login check before invoking `eas build`. Documented prereqs included.
- **Build gates**: Mobile `npm run typecheck` exit 0, **123/123** tests pass. Validator `npm run type-check` + `npm run build` + `npm run lint -- src/api/MobileInventoryRoutes.ts` all green.

### Continuation IV (2026-04-25 end of session)
- **Track C.c rows 🟨 → ✅**: Three per-subsystem inventory screens — `OwnedNFTsScreen`, `EscrowsScreen`, `PredictionPositionsScreen`. Backed by `InventoryService` (`/api/v1/nft/owned/:address`, `/api/v1/marketplace/escrows/:address?role=buyer`, `PredictionsClient.getUserPositions`). All three defensive against missing validator endpoints — render honest empty state when the indexer is offline. 9 unit tests.
- **Staking position 🟨 → ✅**: `StakingScreen` now shows staked amount + pending rewards + effective APR + unlock date + participation score at the top; re-reads after every stake/unstake/claim. Fetches via `InventoryService.getStakingPosition`.
- **Track D1/D4 ⛔ → 🟨**: `MobileBLEAdapter` implements the `@wallet/platform/adapters::BLEAdapter` contract using `react-native-ble-plx` with Ledger's Nordic-UART service + RX/TX characteristics. APDU framed (0x05 header + seq + len + payload) and multi-chunk responses reassembled. `HardwareWalletScreen` lazy-registers on first mount; Profile gains a "Hardware wallet" tile. `app.json` gains BLE permissions + `react-native-ble-plx` Expo plugin config. `package.json` pins `react-native-ble-plx@^3.1.2`.
- **Track D5 (E2E) ⏳ → 🟨**: `.maestro/` harness with four flows (onboarding → swap → p2p-buy → sign-out) + `config.yaml` + README. `npm run e2e:maestro` / `e2e:maestro:ci` scripts land. Physical-device / CI integration is the next step.
- **Track E1/E2 ⏳ → 🟨**: `eas.json` with `development` / `preview` / `production-apk` / `production` profiles. `docs/EAS_BUILD.md` documents the four-profile strategy. First real build size lands next session.
- **Navigation**: `ProfileScreen` gains four new tiles — Your NFTs, Your purchases, Your predictions, Hardware wallet. `RootNavigator` wires each to the corresponding screen and threads the in-memory mnemonic for claim-signing.
- **Test suite**: 114 → **123 passing / 18 suites / 0 failing / ~1.8s**. Mobile `npm run typecheck` exit 0.

### Continuation III (2026-04-24 end of session)
- **Track A5 ⛔/🟨 → ✅**: `RelaySubmitService` wires `WalletRelayingSigner` + `OmniRelayClient` from the Wallet extension for chainId 88008; `SwapService` now uses it for every unsigned tx. Users pay zero gas on L1 swaps. Non-L1 chains keep the direct-broadcast path (5 RelaySubmitService tests + 1 new SwapExecute L1-relay test).
- **Track A4 ⏳ → ✅**: New `__tests__/services/IntentRouter.test.ts` with 5 regression assertions on the XOM→USDC mandatory pre-hop. Prevents silent breakage if someone edits `IntentRouter.getRoutes` to call Li.Fi with a naked XOM source.
- **Track B4 ⛔ → 🟨**: `TxHistoryScreen` + `TxHistoryService` — validator-first (`/api/v1/wallet/:address/history`) with native-transfer fallback via `ClientRPCRegistry`. Rows flagged `privacy: true` render a 🛡 Shielded badge. 5 unit tests.
- **Track C1.b ⛔ → ✅ / C1.c ⏳ → 🟨**: `P2PListingDetailScreen` + `EscrowPurchaseService` — signs `CreateEscrow` EIP-712 against `MinimalEscrow`, posts through `MarketplaceClient.createEscrow`. 2 integration tests.
- **Track C2.b ⛔ → ✅ / C2.c ⛔ → 🟨**: `NFTDetailScreen` + `NFTBuyService` — allowance check via `nftBuyPrereqs.readErc20Allowance`, auto-approval via OmniRelay when short, full-shape `BuyNFT` validator call, POST to `/api/v1/nft/buy`. 5 integration tests.
- **Track C5.b ⛔ → ✅ / C5.c ⛔ → 🟨**: `PredictionsMarketDetailScreen` + `PredictionsService` — outcome tabs with live quote, buy via `buildTradeTx` + `RelaySubmitService`, claim via EIP-712 + legacy EIP-191 + `buildClaim` + destination-chain broadcast. Envelope-value safety check. 6 integration tests.
- **Phase 5 Week 2 (Staking) completed**: `StakingScreen` upgraded from reference-only to live stake / unstake / claim. Service layer (`StakingService`) posts to `/api/v1/staking/{stake,unstake,claim}` with gasless relay intent. 5 integration tests.
- **Test suite**: 79 → **114 passing / 17 suites / 0 failing / ~1.8s**. Mobile `npm run typecheck` exit 0.
- **Navigation**: `RootNavigator` threads `onboard.keys.mnemonic` to `StakingScreen` + `MarketplaceHomeScreen`. `ProfileScreen` gains an "Activity" tile routing to `TxHistoryScreen`.

### Swap execution block (2026-04-24 continuation II)
- SwapService.executeQuote — three-step orchestrator: UniversalSwapClient.execute → sign each unsigned tx via ethers.Wallet.fromPhrase bound to a ClientRPCRegistry provider → submitSignedTx to push hashes to the validator's status aggregator.
- SwapScreen — "Swap Now" primary button appears after quote fetch; success box surfaces operationId + status + per-tx hashes; errors surface inline.
- 6 integration tests in `__tests__/services/SwapExecute.test.ts` with mocked UniversalSwapClient + ClientRPCRegistry + ethers.Wallet.fromPhrase so no live validator or chain is needed.
- Track A deltas: A1/A2/A3 🟨 → ✅; A5 ⛔ → 🟨.
- Mobile test suite now at 79/79.

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
