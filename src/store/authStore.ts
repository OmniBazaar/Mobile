/**
 * Mobile auth store — Zustand.
 *
 * Holds the current sign-in state:
 *   - `locked` — wallet exists but app needs PIN / biometric
 *   - `unlocked` — user has authenticated, services may be used
 *   - `signedOut` — no wallet on device; route to onboarding
 *
 * Persistence uses the platform StorageAdapter (SecureStoreAdapter on
 * Mobile). The wallet's encrypted mnemonic, PIN hash, and JWT are all
 * stored via Wallet's existing ChallengeAuthClient + KeyringService
 * facilities — this store only tracks the transient in-memory status.
 */

import { create } from 'zustand';

/** High-level auth lifecycle state. */
export type AuthState = 'bootstrapping' | 'signedOut' | 'guest' | 'locked' | 'unlocked';

/** Per-family address bundle cached at sign-in. */
export interface FamilyAddressBundle {
  /** Bitcoin (mainnet, P2WPKH). */
  bitcoin?: string;
  /** Solana base58 address. */
  solana?: string;
  /** Polkadot SS58 address (DOT). */
  polkadot?: string;
  /** Cosmos hub bech32 address. */
  cosmos?: string;
  /** Cardano shelley bech32 address. */
  cardano?: string;
  /** XRP classic address. */
  xrp?: string;
  /** TRON Base58Check address. */
  tron?: string;
  /** NEAR account ID. */
  near?: string;
  /** Hedera account ID. */
  hedera?: string;
  /** Stellar G-prefix address. */
  stellar?: string;
  /** Tezos tz1/tz2/tz3 address. */
  tezos?: string;
}

/** Shape of the auth slice. */
export interface AuthStoreState {
  /** Current state. */
  state: AuthState;
  /** Primary EVM address of the signed-in user (empty when signedOut/guest). */
  address: string;
  /** Username if claimed; empty otherwise. */
  username: string;
  /**
   * Plain-text BIP-39 mnemonic held in memory while the wallet is
   * unlocked. Erased on `clear()`. Read with `useAuthStore.getState().mnemonic`
   * (don't subscribe — we don't want components to re-render on every
   * unlock event). Required by signing flows (swap, listing-create,
   * NFT buy, predictions, staking).
   */
  mnemonic: string;
  /**
   * Per-family addresses derived once at sign-in / wallet-create. Empty
   * object when signed-out or in guest mode. Populated by
   * `KeyringService.deriveFamilyAddresses(mnemonic)`.
   */
  familyAddresses: FamilyAddressBundle;
  /** True when the user has enabled biometric unlock. */
  biometricEnabled: boolean;
  /** Epoch ms of the most recent successful unlock. */
  lastUnlockMs: number;
  // Actions
  setState(next: AuthState): void;
  setAddress(address: string, username?: string): void;
  setMnemonic(mnemonic: string): void;
  setFamilyAddresses(bundle: FamilyAddressBundle): void;
  setBiometricEnabled(enabled: boolean): void;
  markUnlocked(): void;
  enterGuestMode(): void;
  /**
   * Phase 12: lock the keystore in place — wipes the in-memory seed
   * but keeps the cached username + family addresses + JWT so the
   * UnlockSheet can re-derive without bouncing the user to onboarding.
   * Auto-lock alarms call this instead of `clear()`.
   */
  lockKeystore(): void;
  clear(): void;
}

/**
 * Phase 12 selector — true when an encrypted vault (or cached
 * credentials) is present on this device. `true` for `locked` and
 * `unlocked` lifecycles; `false` for `signedOut` / `guest`. Used by
 * `useRequireAuth` to decide between the AuthPrompt route (no wallet
 * → onboarding) and the contextual UnlockSheet (wallet exists, just
 * locked).
 *
 * @param s - Auth store state.
 * @returns Whether a wallet exists on this device.
 */
export const selectWalletExists = (s: AuthStoreState): boolean =>
  s.state === 'locked' || s.state === 'unlocked';

/**
 * Phase 12 selector — true when the in-memory keyring is materialised
 * and signing operations are available. `false` for every other state
 * including `bootstrapping`. Mirror of the wallet extension's
 * `selectIsUnlocked`.
 *
 * @param s - Auth store state.
 * @returns Whether the keystore is unlocked.
 */
export const selectIsUnlocked = (s: AuthStoreState): boolean =>
  s.state === 'unlocked';

export const useAuthStore = create<AuthStoreState>((set) => ({
  state: 'bootstrapping',
  address: '',
  username: '',
  mnemonic: '',
  familyAddresses: {},
  biometricEnabled: false,
  lastUnlockMs: 0,
  setState: (next) => set({ state: next }),
  /**
   * Phase 12: drop the in-memory seed and flip the lifecycle to
   * `'locked'` instead of `'signedOut'`. Keeps the cached username +
   * familyAddresses so the UnlockSheet's `username` can prefill
   * automatically and the user is not bounced to onboarding for what
   * is functionally a re-enter-password event. Auto-lock alarms now
   * call this instead of `clear()`.
   */
  lockKeystore: () =>
    set({ state: 'locked', mnemonic: '' }),
  setAddress: (address, username) =>
    set({ address, ...(username !== undefined && { username }) }),
  setMnemonic: (mnemonic) => set({ mnemonic }),
  setFamilyAddresses: (bundle) => set({ familyAddresses: bundle }),
  setBiometricEnabled: (enabled) => set({ biometricEnabled: enabled }),
  enterGuestMode: () =>
    set({ state: 'guest', address: '', username: '', mnemonic: '', familyAddresses: {} }),
  markUnlocked: () => {
    set({ state: 'unlocked', lastUnlockMs: Date.now() });
    // Kick off the decentralisation-dashboard heartbeat + push-token
    // registration + chat unread badge as soon as we have an unlocked
    // session + address. All three are lazy-imported so unit tests
    // that exercise authStore don't pull in fetch / setInterval / etc.
    void (async (): Promise<void> => {
      try {
        const reporter = await import('../services/RpcOriginReporter');
        const addr = useAuthStore.getState().address;
        if (addr !== '') reporter.startRpcOriginReporter(addr);
      } catch {
        /* reporter unavailable — silent. */
      }
      try {
        const push = await import('../services/NotificationService');
        const addr = useAuthStore.getState().address;
        if (addr !== '') {
          await push.registerPushToken(addr);
          push.startTapListener();
        }
      } catch {
        /* push module unavailable in this build — silent. */
      }
    })();
  },
  clear: () => {
    set({
      state: 'signedOut',
      address: '',
      username: '',
      mnemonic: '',
      familyAddresses: {},
      lastUnlockMs: 0,
    });
    void (async (): Promise<void> => {
      try {
        const mod = await import('../services/RpcOriginReporter');
        mod.stopRpcOriginReporter();
      } catch {
        /* reporter unavailable — silent. */
      }
      try {
        const push = await import('../services/NotificationService');
        push.stopTapListener();
      } catch {
        /* push module unavailable — silent. */
      }
    })();
  },
}));
