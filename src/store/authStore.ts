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
  /** True when the user has enabled biometric unlock. */
  biometricEnabled: boolean;
  /** Epoch ms of the most recent successful unlock. */
  lastUnlockMs: number;
  // Actions
  setState(next: AuthState): void;
  setAddress(address: string, username?: string): void;
  setMnemonic(mnemonic: string): void;
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
  biometricEnabled: false,
  lastUnlockMs: 0,
  setState: (next) => set({ state: next }),
  setAddress: (address, username) =>
    set({ address, ...(username !== undefined && { username }) }),
  setMnemonic: (mnemonic) => set({ mnemonic }),
  setBiometricEnabled: (enabled) => set({ biometricEnabled: enabled }),
  enterGuestMode: () => set({ state: 'guest', address: '', username: '', mnemonic: '' }),
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
