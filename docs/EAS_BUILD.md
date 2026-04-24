# EAS Build — OmniBazaar Mobile

This doc covers the four `eas.json` profiles and the one-time setup
needed before the first production-grade binary lands on the App Store /
Google Play + sideload download page.

## Profiles

| Profile | Output | Use case |
|---|---|---|
| `development` | iOS Simulator `.app` + Android debug `.apk` | Local Expo Go alternative with the native modules linked in (BLE, Secure Store, etc.) |
| `preview` | iOS `.ipa` + Android `.apk`, internal distribution | TestFlight internal + Play Console internal + side-load candidates |
| `production-apk` | Android `.apk` only, internal distribution | Website sideload (`WebApp/public/mobile-install/` target) |
| `production` | iOS `.ipa` + Android `.aab` | App Store + Play Store submissions |

## First-time setup

1. Install EAS CLI: `npm i -g eas-cli` (min v11).
2. `eas login` (Expo account with access to the OmniBazaar org).
3. `eas project:init` — replace `omnibazaar-mobile-project-id` in
   `app.json` and `eas.json` with the real project id the CLI prints.
4. Add Apple App Store credentials: `eas credentials` → iOS →
   development + distribution certificates + provisioning profile for
   `com.omnibazaar.mobile`.
5. Add Android keystore: `eas credentials` → Android → generate + upload
   keystore. Back up the keystore JSON to 1Password; losing it means
   losing the ability to publish updates to the same Play listing.
6. Install the Google Play service-account key at
   `./secrets/google-play-key.json` (gitignored). The key must have the
   `Release manager` role on the Play Console.

## Run builds

```bash
# Sideload APK for the website's /mobile/install page.
eas build --profile production-apk --platform android

# TestFlight / Play internal.
eas build --profile preview --platform all

# App Store / Play Store production.
eas build --profile production --platform all

# Dev client (Simulator / Emulator).
eas build --profile development --platform all
```

## Submission

```bash
# TestFlight
eas submit --profile production --platform ios

# Play Store (internal track first; manually promote to production once
# the manual QA pass completes).
eas submit --profile production --platform android
```

## OTA updates

`expo-updates` is configured in `app.json` with
`runtimeVersion: "0.1.0"` and the update URL
`https://u.expo.dev/<project-id>`. Ship JS-only patches with:

```bash
eas update --branch production --message "Fix X"
```

Native changes (new native modules, manifest edits, upgraded RN or
Expo SDK) always require a fresh binary — not an OTA.

## Environment variables

The `base` profile injects `EXPO_PUBLIC_VALIDATOR_ENDPOINT` so
`@wallet/background/services/ValidatorDiscoveryService.getBaseUrl()`
has a hardcoded fallback when IPNS / Bootstrap discovery is still
warming up. Every other runtime env var flows through the same
`EXPO_PUBLIC_*` channel; validator IPs and chain IDs never leave
`omnicoin-integration.ts` (SOT).

## Gotchas

- BLE background modes are **disabled** (`isBackgroundEnabled: false`).
  The iOS review team rejects apps that request the background
  Bluetooth entitlement without a justified background use case; we
  sign hardware txs only in the foreground.
- Android 12+ requires the runtime `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT`
  permissions, declared in `app.json → android.permissions`. The user
  is prompted the first time they open `HardwareWalletScreen`.
- The Xcode project that `expo prebuild` generates is **not** checked
  in. EAS rebuilds it from `app.json` every time. If you add a manual
  native module, add its `expo-build-properties` config to `app.json`
  so the prebuild is reproducible.
