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
export type AuthState = 'bootstrapping' | 'signedOut' | 'locked' | 'unlocked';

/** Shape of the auth slice. */
export interface AuthStoreState {
  /** Current state. */
  state: AuthState;
  /** Primary EVM address of the signed-in user (empty when signedOut). */
  address: string;
  /** Username if claimed; empty otherwise. */
  username: string;
  /** True when the user has enabled biometric unlock. */
  biometricEnabled: boolean;
  /** Epoch ms of the most recent successful unlock. */
  lastUnlockMs: number;
  // Actions
  setState(next: AuthState): void;
  setAddress(address: string, username?: string): void;
  setBiometricEnabled(enabled: boolean): void;
  markUnlocked(): void;
  clear(): void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  state: 'bootstrapping',
  address: '',
  username: '',
  biometricEnabled: false,
  lastUnlockMs: 0,
  setState: (next) => set({ state: next }),
  setAddress: (address, username) =>
    set({ address, ...(username !== undefined && { username }) }),
  setBiometricEnabled: (enabled) => set({ biometricEnabled: enabled }),
  markUnlocked: () => set({ state: 'unlocked', lastUnlockMs: Date.now() }),
  clear: () =>
    set({ state: 'signedOut', address: '', username: '', lastUnlockMs: 0 }),
}));
