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
  clear(): void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  state: 'bootstrapping',
  address: '',
  username: '',
  mnemonic: '',
  familyAddresses: {},
  biometricEnabled: false,
  lastUnlockMs: 0,
  setState: (next) => set({ state: next }),
  setAddress: (address, username) =>
    set({ address, ...(username !== undefined && { username }) }),
  setMnemonic: (mnemonic) => set({ mnemonic }),
  setFamilyAddresses: (bundle) => set({ familyAddresses: bundle }),
  setBiometricEnabled: (enabled) => set({ biometricEnabled: enabled }),
  enterGuestMode: () =>
    set({ state: 'guest', address: '', username: '', mnemonic: '', familyAddresses: {} }),
  markUnlocked: () => {
    set({ state: 'unlocked', lastUnlockMs: Date.now() });
    // Kick off the decentralisation-dashboard heartbeat as soon as
    // we have an unlocked session + address. Idempotent: second call
    // is a no-op inside the reporter. Lazy-imported so unit tests
    // that exercise authStore don't pull in fetch / setInterval.
    void (async (): Promise<void> => {
      try {
        const mod = await import('../services/RpcOriginReporter');
        const addr = useAuthStore.getState().address;
        if (addr !== '') mod.startRpcOriginReporter(addr);
      } catch {
        /* reporter unavailable — silent. */
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
    })();
  },
}));
