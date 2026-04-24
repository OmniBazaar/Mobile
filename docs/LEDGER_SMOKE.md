# Ledger hardware-wallet smoke test

Cert-grade acceptance for Track D1 + D4 requires a physical-device
round-trip on iOS and Android. This doc is the exact sequence to run
once you have a Nano X (BLE) and/or a Nano S Plus (USB-C).

## Prereqs

- **Device:** Ledger Nano X (BLE) or Nano S Plus (USB-C) with the
  latest Ethereum app installed via Ledger Live.
- **Firmware:** Nano X ≥ 2.4.x, Nano S Plus ≥ 1.1.x.
- **iOS target:** iPhone SE 4 (or any device on iOS 17+) with
  Bluetooth enabled.
- **Android target:** Samsung A15 (or equivalent on Android 12+).
  USB OTG required for the USB-C path.
- **Build:** run `npm run build:preview:ios` (or `:android`). The
  preview profile has `react-native-ble-plx` linked and
  `@ledgerhq/hw-transport-react-native-hid` on Android.

## iOS — Ledger Nano X (BLE)

1. Wake the Nano X (press both buttons) and open the Ethereum app.
2. Launch the Mobile preview build on the iPhone.
3. Sign in (import the test-fund wallet via the standard onboarding flow).
4. Navigate: `Profile` → `Hardware wallet`.
5. Tap **Scan for devices**. Grant the Bluetooth permission when iOS
   prompts.
6. The Nano X should appear within 10 seconds. Tap **Connect**.
7. The screen should display `Connected: {deviceId}` — this confirms
   `MobileBLEAdapter.scan → connect → close` completes without error.
8. Stay on the screen; open `Ethereum → Settings → Blind signing` on
   the Nano X and flip it on if needed.
9. **Get-address APDU**:
   ```
   CLA=E0 INS=02 P1=00 P2=01 LC=15 PATH=44'/60'/0'/0/0
   ```
   In a dev client, invoke
   `LedgerService.getEthereumAddress("m/44'/60'/0'/0/0")`. The Nano X
   should prompt "Address / Send to". Confirm. The Mobile client
   surfaces a 0x-prefixed 20-byte address. **Expected:** address
   matches `Ledger Live → Accounts → Ethereum → Main`.
10. **Sign-message APDU** (challenge-response login):
    ```
    CLA=E0 INS=08 P1=00 P2=00 LC=varies MSG="OmniBazaar login: {challenge}"
    ```
    Invoke `ChallengeAuthClient.signInWithHardware()`. The Nano X
    should show the challenge fragments + `Sign message`. Confirm.
    **Expected:** the validator's `/login-verify` response reports
    success; the Mobile app reaches `WalletHome`.
11. Close the app → relaunch → repeat step 5–6. Confirm the second
    pairing also lands. (Nano X caches bonding info on its side.)

## Android — Ledger Nano X (BLE)

Same steps as iOS, with these deltas:

- First run: Android prompts for `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT`.
- Android 12+ requires the user to grant location permission alongside
  Bluetooth for background scans; we avoid background so no prompt.
- Signing latency is typically 1–2 seconds faster than iOS because
  Android lets the adapter set a 156-byte MTU up-front.

## Android — Ledger Nano S Plus (USB-C)

1. Connect the Nano S Plus to the phone via USB-C and unlock it.
2. Android shows a "Allow OmniBazaar to access this device?" dialog.
   Tap **OK** and ✅ the "Always allow" checkbox.
3. In the Mobile app: `Profile` → `Hardware wallet` →
   **Scan for devices**. USB devices appear alongside BLE ones
   (`MobileUSBHIDAdapter.enumerate` runs after BLE scan).
4. Tap **Connect** on the Nano S Plus row.
5. Proceed with get-address + sign-message exactly as in the Nano X
   flow.
6. Unplug + replug — confirm the device shows up again after a fresh
   `enumerate`.

## Trezor Model T — WebView

1. `Profile` → `Hardware wallet` → **Open Trezor Connect**.
2. Connect the Trezor via USB-C (Android) or Bluetooth bridge (iOS).
3. Unlock with your PIN.
4. The hosted Trezor Connect page guides you through:
   - `ethereumGetAddress` at `m/44'/60'/0'/0/0`.
   - `ethereumSignMessage` for a challenge-response login.
5. Confirm both operations on the device.
6. Return to the Mobile app; the WebView dispatches the responses via
   `TrezorBridgeService` and the login completes.

## What "green" looks like

All three sections check off:

- [ ] Nano X BLE: scan → connect → get_address → sign_message on iOS
- [ ] Nano X BLE: scan → connect → get_address → sign_message on Android
- [ ] Nano S Plus USB-C: enumerate → open → get_address → sign_message on Android
- [ ] Trezor Model T WebView: get_address + sign_message roundtrip
- [ ] Challenge-response login completes end-to-end via `ChallengeAuthClient.signInWithHardware()`

When all five are ✅, flip Tracks D1–D4 in the audit.

## Failure triage

- **"Bluetooth is not available on this build"** — preview build was
  not prebuilt with `react-native-ble-plx` linked. Run
  `expo prebuild` and rebuild.
- **Scan finds nothing** — ensure the Nano X is awake AND the
  Ethereum app is open on the device screen. A locked / "Dashboard"
  Nano X advertises but can't service APDUs.
- **"Invalid data" from sign_message** — Ledger's Ethereum app
  rejects non-EIP-191 prefixes. Confirm the Mobile client's message
  bytes begin with `"\x19Ethereum Signed Message:\n"`.
- **USB HID "open failed"** — on Android 14+ Samsung devices the
  "Default USB" accessory setting must be set to "File transfer" or
  the HID interface is blocked. Settings → Connected devices → USB →
  File transfer.
