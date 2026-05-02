/**
 * Phase 12 — Mobile auth-store three-state selector contract.
 *
 * Mirrors `Wallet/tests/popup/Phase12AuthStore.test.ts`. Pins the
 * `selectWalletExists` / `selectIsUnlocked` selectors so a future store
 * refactor cannot silently re-conflate the two concepts.
 *
 * The browse-first UX rests on these being orthogonal: a user can
 * have a keystore on this device but a locked keyring (auto-lock fired
 * during a long browse session). The unlock-first model used a single
 * boolean; Phase 12 replaces it with two.
 */

import {
  useAuthStore,
  selectWalletExists,
  selectIsUnlocked,
} from '../../src/store/authStore';
import { useUnlockGuardStore } from '../../src/store/unlockGuardStore';

function reset(): void {
  useAuthStore.setState({
    state: 'bootstrapping',
    address: '',
    username: '',
    mnemonic: '',
    familyAddresses: {},
    biometricEnabled: false,
    lastUnlockMs: 0,
  });
  useUnlockGuardStore.setState({ pending: null });
}

describe('Phase 12 mobile auth-store selectors', () => {
  beforeEach(() => {
    reset();
  });

  it('selectWalletExists is false in bootstrapping / signedOut / guest', () => {
    useAuthStore.getState().setState('bootstrapping');
    expect(selectWalletExists(useAuthStore.getState())).toBe(false);
    useAuthStore.getState().setState('signedOut');
    expect(selectWalletExists(useAuthStore.getState())).toBe(false);
    useAuthStore.getState().setState('guest');
    expect(selectWalletExists(useAuthStore.getState())).toBe(false);
  });

  it('selectWalletExists is true in locked + unlocked', () => {
    useAuthStore.getState().setState('locked');
    expect(selectWalletExists(useAuthStore.getState())).toBe(true);
    useAuthStore.getState().setState('unlocked');
    expect(selectWalletExists(useAuthStore.getState())).toBe(true);
  });

  it('selectIsUnlocked is true ONLY in unlocked', () => {
    for (const s of ['bootstrapping', 'signedOut', 'guest', 'locked'] as const) {
      useAuthStore.getState().setState(s);
      expect(selectIsUnlocked(useAuthStore.getState())).toBe(false);
    }
    useAuthStore.getState().setState('unlocked');
    expect(selectIsUnlocked(useAuthStore.getState())).toBe(true);
  });

  it('lockKeystore wipes the in-memory seed and flips state to locked', () => {
    useAuthStore.setState({
      state: 'unlocked',
      mnemonic: 'apple banana cherry',
      address: '0xabc',
      username: 'alice',
    });
    useAuthStore.getState().lockKeystore();
    const s = useAuthStore.getState();
    expect(s.state).toBe('locked');
    expect(s.mnemonic).toBe('');
    // username + address are PRESERVED so the UnlockSheet can prefill
    // and the JWT-bearing identity stays intact across the lock.
    expect(s.address).toBe('0xabc');
    expect(s.username).toBe('alice');
  });

  it('lockKeystore is independently invokable from any state', () => {
    useAuthStore.getState().setState('signedOut');
    useAuthStore.getState().lockKeystore();
    expect(useAuthStore.getState().state).toBe('locked');
  });
});

describe('Phase 12 mobile unlock-guard slice', () => {
  beforeEach(() => {
    reset();
  });

  it('pending starts null, setPending opens, cancel clears', () => {
    expect(useUnlockGuardStore.getState().pending).toBeNull();
    useUnlockGuardStore.getState().setPending({
      actionKey: 'swap',
      run: () => undefined,
    });
    expect(useUnlockGuardStore.getState().pending?.actionKey).toBe('swap');
    useUnlockGuardStore.getState().cancel();
    expect(useUnlockGuardStore.getState().pending).toBeNull();
  });

  it('resolve returns the pending action and clears the slot', () => {
    let ran = 0;
    useUnlockGuardStore.getState().setPending({
      actionKey: 'stake',
      run: () => {
        ran += 1;
      },
    });
    const action = useUnlockGuardStore.getState().resolve();
    expect(useUnlockGuardStore.getState().pending).toBeNull();
    expect(action).not.toBeNull();
    action?.run();
    expect(ran).toBe(1);
  });

  it('resolve returns null when nothing is pending', () => {
    expect(useUnlockGuardStore.getState().resolve()).toBeNull();
  });
});
