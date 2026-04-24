# OmniBazaar Mobile — HANDOFF

## DO NOT REMOVE. RETAIN THESE AT THE TOP OF THIS FILE

### Module purpose
React Native + Expo (SDK 50) mobile client for OmniBazaar. Delivers the full platform — 5 marketplaces, DEX + intent-based trading, multi-chain wallet, privacy swaps, staking, KYC, challenge-response auth — on iOS + Android. Tracks the OmniBazaar Mobile GitHub repo `https://github.com/OmniBazaar/Mobile.git`.

### Architectural commitments (non-negotiable)
1. **Trustless** — passwords never leave the device. `ChallengeAuthClient` (imported from `@wallet/services/auth/ChallengeAuthClient`) drives `/api/v1/auth/login-challenge` → `ethers.Wallet.signMessage` → `/api/v1/auth/login-verify`. Registration is attestation-based.
2. **Gasless on L1** — OmniCoin L1 writes must route through OmniRelay (`WalletRelayingSigner` + `OmniRelayClient`). Currently the Swap execution path broadcasts directly; OmniRelay integration is the open gap for Track A5.
3. **Mobile-originated RPC** — every balance fetch, multicall, gas estimate goes through `@wallet/core/providers/ClientRPCRegistry`. No hardcoded RPC URLs. Regression test `__tests__/regression/no-hardcoded-rpc-urls.test.ts` enforces.
4. **Validator discovery** — `BootstrapService` kicks off `ValidatorDiscoveryService` at cold start; Bootstrap.sol → IPNS → hardcoded seeds with failover.
5. **Intent-based routing** — `IntentRouter` in `@wallet/core/intent/` enforces `XOM → USDC on L1` pre-hop; Mobile's SwapScreen currently trusts the validator's route ranking.
6. **Thin client** — no business logic on Mobile beyond UI + signing + keyring. All services imported from `@wallet/*` via path aliases.

### Key paths + tooling
- **Git remote:** `origin/main` at `github.com/OmniBazaar/Mobile`
- **Path aliases:** `@wallet/*` → `../Wallet/src/*`, `@webapp/*` → `../WebApp/src/*`. Configured in `tsconfig.json`, `babel.config.js`, `metro.config.js`, and `jest.config.js`.
- **Platform adapters:** 8 RN adapter impls in `src/platform/` register at boot via `src/platform/register-mobile-adapters.ts` → called from `App.tsx`. Registry lives in `@wallet/platform/registry`.
- **i18n:** 10 locales copied from Wallet via `scripts/sync-i18n.mjs`; `npm run sync:i18n`. Re-run after Wallet updates locales.
- **Contract addresses:** `src/config/omnicoin-integration.ts` populated by the root `scripts/sync-contract-addresses.js` (Mobile added as a COPY target).
- **Authoritative plan:** `../Validator/ADD_MOBILE_APP.md` v2.1
- **Production audit:** `docs/PRODUCTION_READINESS_AUDIT.md` — Tracks A–F scorecard. Update in place, never snapshot.

### Build + gates
```bash
cd ~/OmniBazaar/Mobile
npm run typecheck     # tsc --noEmit, strict mode
npm test              # Jest; currently 79/79 passing in ~1.2s
npm run sync:i18n     # pull locales from Wallet
```
Wallet regression must stay green after any shared-code change:
```bash
cd ~/OmniBazaar/Wallet
npm run type-check && npm run build:chrome && npm run validate:dist:chrome
```

### Never
- Add `@types/react-native` to WebApp's deps (root `node_modules` already hoists it, which broke WebApp typecheck once)
- Hardcode validator IPs or RPC URLs in Mobile source (`src/platform/validatorSeeds.ts` is the only allowed exception; not yet created — still relies on ValidatorDiscoveryService's internal fallback)
- Move Wallet source out of `Wallet/src/` — Mobile imports directly via path aliases; the `packages/` monorepo extraction approach was explicitly rejected (see ADD_MOBILE_APP.md v2.1)
- Use `jest-expo` preset (the setup was bypassed in favor of `ts-jest` — component tests via jest-expo + RNTL are a Phase 8 Week 2 follow-up)

---
**END OF HEADER — EVERYTHING BELOW IS CURRENT HANDOFF CONTEXT**
---

## Current state (2026-04-24 end of session)

### What's shipped
Seven phases at MVP+ with committed, tested code:
- **Phase 0** Mobile skeleton + path aliases + 8 platform adapters + Wallet adapter refactor (14 files routed through platform registry; Wallet extension's 226 tests preserved)
- **Phase 1** Full challenge-response auth flow — 9 onboarding screens (Welcome → CreateWallet → SeedBackup → SeedVerify → Import → PinSetup → BiometricEnroll → SignIn → Home)
- **Phase 2** Multi-chain portfolio (native + ERC-20), Send, Receive
- **Phase 3** Intent-based Swap w/ route attribution + **swap execution** (sign + broadcast + validator status push)
- **Phase 4** Marketplace shell w/ 5 sub-tabs + live P2P + NFT + Predictions browsers; RWA + Yield deep-link to DEX
- **Phase 5** Profile hub (Staking / KYC / Settings / About) + XOM↔pXOM Privacy screen
- **Phase 8** 79 unit + integration tests
- **Phase 9** WebApp `/mobile/install` sideload landing + Playwright smoke
- **Phase 10** Production Readiness Audit scorecard

### Production audit scorecard (Tracks A–F)
| Track | Score |
|---|---|
| A Intent-based trading | **3/5 ✅** 1/5 🟨 1/5 ⏳ |
| B Privacy (COTI pXOM) | 4/5 🟨 1/5 ⛔ |
| C 5 Marketplaces | **3/15 ✅** 3/15 🟨 3/15 ⏳ 6/15 ⛔ |
| D Hardware wallets | 4/4 ⛔ (transports pending) |
| E Perf / bundle / battery | 1/6 🟨 5/6 ⏳ |
| F Store assets + compliance | 3/10 ✅ 1/10 🟨 2/10 ⏳ 4/10 ⛔ |

See `docs/PRODUCTION_READINESS_AUDIT.md` for the full per-row scorecard with explicit pending notes.

### Gates at close
- `npm run typecheck` — exit 0
- `npm test` — **79/79** passing, no open-handle warnings, ~1.2s
- Wallet `type-check` + `build:chrome` + 226 tests — preserved across all refactors
- WebApp `/mobile/install` + 4 Playwright smoke cases — committed in WebApp repo

### Commit log (Mobile, newest first)
```
423be81 docs: audit refresh — Track A 3/5 green after swap execution lands
78fd887 test(swap): lock in executeQuote flow with mocked validator + RPC
d27bfa6 feat(dex): swap execution — sign + broadcast + validator status push
80b2800 docs: audit refresh — Track B + Track C deltas from this session
a40ab66 feat(wallet): ERC-20 balances — WalletHome shows USDC/USDT alongside native
ad469d8 feat(privacy): Track B MVP — PrivacyScreen (XOM ↔ pXOM via COTI V2)
935c13a feat(marketplace): NFT + Predictions browse + RWA/Yield DEX deep-link
b72ca25 docs: Phase 10 — production readiness audit scorecard
c9c16f1 test(mobile): Phase 8 uplift — authStore + BootstrapService coverage
633f3d6 feat(profile): Phase 5 MVP — profile hub + staking + KYC + settings + about
496d73f feat(marketplace): Phase 4 MVP — marketplace shell + P2P browse
8189514 feat(dex): Phase 3 — intent-based swap screen + service
54ac06c feat(wallet): Phase 2 — multi-chain portfolio + send + receive
fe4b786 feat(auth): Phase 1 — bootstrap + challenge-response auth flow
1937fe2 fix(platform): path-alias cross-tsconfig compatibility + smoke-test
bf5767b feat(scaffolding): utils + shared components so tsc --noEmit passes
cc84925 feat(platform): Mobile skeleton — path aliases + adapter impls + sync scripts
```

Wallet repo (`feat/platform-adapters` branch, 10 commits beyond `origin/main`) holds the platform adapter layer. WebApp repo (`main`) has the Phase 9 install landing. All three repos should be pushed independently when the user is ready.

---

## Open gaps, priority-ordered (the "remaining work")

### Top-of-queue (highest ROI per hour)

1. **OmniRelay gasless submit on L1** (Track A5 🟨 → ✅ + A4 regression test)
   - `SwapService.executeQuote` currently always calls `signAndBroadcast`. For `chainId === 88008` it should route through `@wallet/core/relay/WalletRelayingSigner` + `OmniRelayClient` instead so users never pay gas on OmniCoin L1.
   - Wallet extension pattern: SW signs a `ForwardRequest` with wallet key, posts to `/api/v1/relay/submit`, validator submits on-chain.
   - Blocker: `UnsignedSwapTransaction` is a raw-tx shape; L1 path needs an EIP-2771 re-encoding step. Check whether the validator's `/universal-swap/execute` endpoint returns L1 txs in a different shape when the user's address has a `VITE_ENABLE_SMART_ACCOUNT`-like flag set, or whether the Mobile client re-wraps client-side.

2. **NFT buy flow** (Track C2.b/c ⛔ → ✅)
   - `NFTBrowseScreen` today is browse-only. The buy path requires:
     1. Read `ERC20.allowance(buyer, settlement)` via `nftBuyPrereqs.readErc20Allowance`; if insufficient, sign + broadcast an approve.
     2. Sign a `BuyNFT` EIP-712 intent (reuse `services/marketplace/buyNFTIntentValidator.ts` from the parallel session's work on Wallet).
     3. POST the intent to `MarketplaceClient.buyNFT(...)` — verify the method name; may need to add a thin client-side wrapper.
   - Add an `NFTDetailScreen` between `NFTBrowseScreen` and the buy confirmation sheet.

3. **Predictions buy + claim** (Track C5.b/c ⛔ → ✅)
   - `PredictionsClient.buildTradeTx` + `.submitTrade` + `.buildClaim` are already exported. Need a `PredictionsMarketDetailScreen` wiring outcome tabs + buy intent + claim button.

4. **TX history screen** (Track B4 ⛔ → ✅ + Track C portfolio rows)
   - Needed for shielded/unshielded state display and for the portfolio "receipt reflects" rows. Index client-side by chain via `ClientRPCRegistry` `getLogs`, plus any validator-side indexed history endpoint.

5. **Maestro E2E flows** (Track D5 — cert-grade for physical device gate)
   - 22 critical journeys per `ADD_MOBILE_APP.md` Part 17 Track D. Start with onboarding → swap → buy P2P listing → sign out.

### Second priority (structural but less urgent)

6. **Hardware wallet transports** (Track D full)
   - Install `@ledgerhq/hw-transport-react-native-ble` + `react-native-ble-plx` native modules; wire `MobileBLEAdapter` via `getBLEAdapter()` (interface already defined in `@wallet/platform/adapters`).
   - Trezor via WebView fallback (no first-class RN SDK).

7. **XOM→USDC pre-hop regression test** (Track A4 ⏳ → ✅)
   - Ported from Wallet extension's R-round tests. Add to `__tests__/services/SwapService.test.ts` with a mock validator that rejects XOM-origin cross-chain quotes without the USDC pre-hop.

8. **Staking stake/unstake/claim flow** (Phase 5 Week 2)
   - `StakingScreen` is read-only today; contract flows via `@wallet/services/StakingService.ts`. Needs OmniRelay for gasless (depends on #1).

9. **Governance placeholder** (Phase 5 deferred)
   - FF-gated by `FEATURES.governance.enabled=false`; flip after hard launch.

### Deferred to ops / external

- **Track E (perf + bundle)** — requires EAS Build production profiles + physical Samsung A15 benchmarking
- **Track F (compliance)** — privacy policy + ToS finalization, store screenshots, App Privacy + Data Safety forms
- **Apple App Store + Google Play submission** (Phase 11) — blocked on F completion

---

## Recommended next steps (for the next session)

1. Start with **OmniRelay gasless submit on L1** — it's the last piece keeping Track A5 🟨. Investigate whether the validator's `/universal-swap/execute` already returns L1 txs in EIP-2771 wrapper format, or if Mobile needs to re-encode. Read `@wallet/core/relay/WalletRelayingSigner.ts` and `OmniRelayClient.ts` to understand the pattern.
2. Then **NFT buy flow** — biggest user-facing gap; closes 2 more Track C rows. `NFTDetailScreen` + buy sheet + allowance-approve flow is ~6 hours of focused work.
3. Then **Predictions buy + claim** — same pattern, smaller surface (outcome tabs + buy + claim).
4. Then **TX history** — once these three land, the Portfolio view reflects actual trade/buy/claim receipts.

When context is tight in any future session, lean on `docs/PRODUCTION_READINESS_AUDIT.md` — its per-row status + priority ordering is the single source of truth.

---

## Task list snapshot (at close)

```
#1   Phase 0: Mobile Skeleton + Wallet Adapter Refactor           ✅ completed
#2   Phase 1: Bootstrap + Challenge-Response Auth                 ✅ completed
#3   Phase 2: Wallet Core + Multi-Chain Send/Receive              ✅ completed
#4   Phase 3: DEX + Intent-Based Trading + Privacy                ✅ completed
#5   Phase 4: 5 Marketplaces + Escrow + Chat + Push               ✅ completed
#6   Phase 5: Staking + Bridge + KYC + Governance + Settings      ✅ completed
#7   Phase 6: Hardware Wallets + WalletConnect v2 + dApp Browser  ⏳ pending
#8   Phase 7: Parity Audit + i18n + Accessibility                 ⏳ pending
#9   Phase 8: Testing (Unit + Integration + E2E + Playwright)     ✅ completed
#10  Phase 9: Packaging + Website Sideload                        ✅ completed
#11  Phase 10: Production Readiness Audit (Tracks A-F)            ✅ completed
#12  Phase 11: App Store + Google Play Submission + Launch        ⏳ pending
```

Phases 6, 7, 11 remain explicitly pending; all others at MVP+ or complete. Pending phases' detailed descriptions live in the task tracker and `docs/PRODUCTION_READINESS_AUDIT.md`.

---

## Gotchas future sessions should know

1. **Cross-realm ethers** — Mobile's `node_modules/ethers` and Wallet's `node_modules/ethers` resolve to distinct module realms via Metro. Same package version, same runtime ABI, but TypeScript sees distinct `Network` types because of `#private` fields. Workaround in `SendService`/`SwapService`: cast the provider via `unknown as ethers.Provider` at the one call site that joins them.

2. **jest tsconfig is inline** in `jest.config.js` — the Mobile tsconfig lives in `tsconfig.json` with `module: commonjs` because Expo SDK 50's Metro demands it. Tests use a matching inline `module: commonjs` config in `jest.config.js` to keep them aligned.

3. **Cross-tsconfig import.meta** — Wallet's `ValidatorDiscoveryService` previously used `import.meta.env.VITE_VALIDATOR_ENDPOINT` directly. Mobile's commonjs tsc rejects `import.meta`. Fixed by `Function('return import.meta')()` indirection + `process.env.EXPO_PUBLIC_VALIDATOR_ENDPOINT` fallback (see Wallet `b61eb7a`).

4. **`@types/create-hash` shim** — Mobile's `src/types/wallet-shims.d.ts` declares `create-hash` because Wallet's `familyAddressDerivation.ts` imports it and Mobile's node_modules doesn't auto-hoist the types. Keep this shim; do not install `@types/create-hash` at the root.

5. **Pre-existing Wallet working tree** — the `feat/platform-adapters` branch absorbed ~138 files of a parallel-session's in-progress Wallet work (see `b1c26cb`). It's already landed on the adapter branch; if that branch ever merges to Wallet `main`, expect a sizeable diff vs origin.

6. **Mobile CLAUDE.md stub** — `Mobile/CLAUDE.md` still says "On hold — browser extension priority". It's stale. User hasn't asked to update it. Don't update without direction.

7. **Dependencies hoisted at workspace root** — `expo-clipboard`, `expo-screen-capture`, and `@types/react-native` ended up in root `node_modules` from `npm install` in Mobile. They resolve fine via Metro's `nodeModulesPaths` fallback, but `@types/react-native` breaks WebApp's default `@types/*` auto-inclusion in tsc. WebApp type-check has been failing on this since before my first Mobile commit; the failure is unrelated to Mobile changes.

---

**Mobile repo state at end of session:**
- Branch: `main`, up to date with `origin/main`
- Uncommitted: only modifications the user intends (if any on next open)
- Tests: 79/79 green
- Typecheck: exit 0

Ready for the next developer or the next session.
