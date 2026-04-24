# Maestro E2E flows — OmniBazaar Mobile

Primary user journey broken into four flows that run in order:

1. `flows/onboarding.yaml` — fresh install → create wallet → PIN.
2. `flows/swap.yaml` — 1 XOM swap round-trip.
3. `flows/p2p-buy.yaml` — browse P2P listing → fund escrow.
4. `flows/sign-out.yaml` — return to Welcome.

## Running

```bash
# Install Maestro (one-time)
curl -fsSL https://get.maestro.mobile.dev | bash

# iOS Simulator (iPhone SE 4 image)
xcrun simctl boot "iPhone SE (3rd generation)"
maestro test .maestro/

# Android Emulator (Samsung A15-class)
emulator -avd Pixel_6_API_34 &
maestro test .maestro/

# JUnit report for CI
maestro test --format junit --output maestro-report.xml .maestro/
```

The flows use plain English UI copy (e.g. `Create Wallet`, `Buy with
escrow`) rather than `testID`s so they read as a script of what the
user does, not what a developer wired. If you rename a button, update
the matching assertion here in the same commit.

## Debug-only shortcuts

Two shortcuts exist specifically for E2E runs:

- `EXPO_PUBLIC_MAESTRO_SKIP_VERIFY=true` makes the seed-verify screen
  show a "Skip in debug" button so the flow doesn't have to re-enter
  three tiles in the correct order.
- `EXPO_PUBLIC_MAESTRO_DEFAULT_PIN=123456` accepts a fixed PIN during
  onboarding. Release builds reject this.

Both are no-ops in production archives.

## CI integration

CI-ready when EAS builds emit an `.app` / `.apk` Maestro can install.
Until that lands, flows run manually on a developer's simulator /
emulator. Track D5 (cert-grade E2E gate) depends on this harness
running against production-profile binaries on real hardware (iPhone
SE 4 + Samsung A15), not just simulators.
