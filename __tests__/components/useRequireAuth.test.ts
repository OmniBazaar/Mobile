/**
 * Phase 12 mobile — useRequireAuth three-state branching contract.
 *
 * Mirrors `Wallet/tests/popup/useUnlockGuard.test.tsx`. Pins the same
 * three branches without requiring a full RN render harness:
 *
 *   • state === 'unlocked'  → action runs synchronously
 *   • state === 'locked'    → unlock-guard slice's `pending` is set;
 *                            no navigation occurs
 *   • state === 'guest' / 'signedOut' / 'bootstrapping' → calls
 *     navigation.navigate('AuthPrompt', ...)
 *
 * The hook reads `useNavigation` from `@react-navigation/native`. We
 * mock that module so the navigate spy is observable here without
 * mounting a NavigationContainer. The hook itself is invoked through
 * a tiny wrapper that lets the test capture its callable form.
 */

import { useAuthStore } from '../../src/store/authStore';
import { useUnlockGuardStore } from '../../src/store/unlockGuardStore';

const navigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: (): { navigate: typeof navigate } => ({ navigate }),
}));

// Import AFTER the mock so the hook picks it up.
import { useRequireAuth } from '../../src/components/RequireAuth';

beforeEach(() => {
  navigate.mockReset();
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
});

/**
 * Drive `useRequireAuth` once and return its callable form. The hook
 * reads `useNavigation` synchronously inside its body, so we can run
 * it outside a NavigationContainer as long as `useNavigation` is
 * mocked — which it is, above.
 *
 * @returns The `requireAuth(reason, action, intendedRoute?, actionKey?)` callback.
 */
function getRequireAuth(): ReturnType<typeof useRequireAuth> {
  // useRequireAuth has no internal state — it's a pure function-returning
  // function. We can call it directly outside a renderer.
  return useRequireAuth();
}

describe('useRequireAuth — Phase 12 three-state branching', () => {
  it('runs the action synchronously when state === "unlocked"', () => {
    useAuthStore.getState().setState('unlocked');
    const requireAuth = getRequireAuth();
    let ran = 0;
    requireAuth('Sign in to swap', () => {
      ran += 1;
    });
    expect(ran).toBe(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(useUnlockGuardStore.getState().pending).toBeNull();
  });

  it('enqueues a deferred action when state === "locked" (no navigation)', () => {
    useAuthStore.getState().setState('locked');
    const requireAuth = getRequireAuth();
    let ran = 0;
    requireAuth(
      'Sign in to swap',
      () => {
        ran += 1;
      },
      undefined,
      'swap',
    );
    expect(ran).toBe(0);
    expect(navigate).not.toHaveBeenCalled();
    expect(useUnlockGuardStore.getState().pending?.actionKey).toBe('swap');
  });

  it('navigates to AuthPrompt when state === "signedOut"', () => {
    useAuthStore.getState().setState('signedOut');
    const requireAuth = getRequireAuth();
    let ran = 0;
    requireAuth('Sign in to swap', () => {
      ran += 1;
    });
    expect(ran).toBe(0);
    expect(navigate).toHaveBeenCalledWith('AuthPrompt', {
      reason: 'Sign in to swap',
    });
  });

  it('navigates to AuthPrompt when state === "guest"', () => {
    useAuthStore.getState().setState('guest');
    const requireAuth = getRequireAuth();
    requireAuth('Sign in to bridge', () => undefined);
    expect(navigate).toHaveBeenCalledWith('AuthPrompt', {
      reason: 'Sign in to bridge',
    });
  });

  it('navigates with intendedRoute when supplied', () => {
    useAuthStore.getState().setState('signedOut');
    const requireAuth = getRequireAuth();
    requireAuth(
      'Sign in to buy this listing',
      () => undefined,
      'P2PListingDetail',
      'buyListing',
    );
    expect(navigate).toHaveBeenCalledWith('AuthPrompt', {
      reason: 'Sign in to buy this listing',
      intendedRoute: 'P2PListingDetail',
    });
  });

  it('handles async actions when unlocked (Promise return type)', () => {
    useAuthStore.getState().setState('unlocked');
    const requireAuth = getRequireAuth();
    let ran = 0;
    const slow = (): Promise<void> =>
      new Promise<void>((resolve) => {
        ran += 1;
        resolve();
      });
    requireAuth('test', slow);
    expect(ran).toBe(1);
  });

  it('preserves the deferred action`s run() callback for later resolution', () => {
    useAuthStore.getState().setState('locked');
    const requireAuth = getRequireAuth();
    const action = jest.fn();
    requireAuth('Sign in to stake', action, undefined, 'stake');
    // Action not yet invoked.
    expect(action).not.toHaveBeenCalled();
    // The unlock-guard slice resolves the pending action; here we
    // simulate the post-unlock resolve path the UnlockSheetMount
    // performs.
    const pending = useUnlockGuardStore.getState().resolve();
    expect(pending).not.toBeNull();
    pending?.run();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('action defaults to "default" when actionKey is omitted on a locked path', () => {
    useAuthStore.getState().setState('locked');
    const requireAuth = getRequireAuth();
    requireAuth('Sign in to continue', () => undefined);
    expect(useUnlockGuardStore.getState().pending?.actionKey).toBe('default');
  });
});
