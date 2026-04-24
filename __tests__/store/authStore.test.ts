/**
 * authStore — unit tests for the Zustand slice that tracks sign-in
 * state across the onboarding + authed navigation flow.
 *
 * Each test snapshots the store's initial state, drives it through a
 * known transition, and asserts the final selector reads. No React
 * Native involvement — Zustand runs in pure JS.
 */

import { useAuthStore } from '../../src/store/authStore';

// Helper to reset the store between tests.
function resetAuth(): void {
  useAuthStore.setState({
    state: 'bootstrapping',
    address: '',
    username: '',
    biometricEnabled: false,
    lastUnlockMs: 0,
  });
}

describe('useAuthStore', () => {
  beforeEach(() => {
    resetAuth();
  });

  it('starts in "bootstrapping" with empty identity', () => {
    const s = useAuthStore.getState();
    expect(s.state).toBe('bootstrapping');
    expect(s.address).toBe('');
    expect(s.username).toBe('');
    expect(s.biometricEnabled).toBe(false);
    expect(s.lastUnlockMs).toBe(0);
  });

  it('setState transitions the lifecycle', () => {
    useAuthStore.getState().setState('signedOut');
    expect(useAuthStore.getState().state).toBe('signedOut');
    useAuthStore.getState().setState('locked');
    expect(useAuthStore.getState().state).toBe('locked');
    useAuthStore.getState().setState('unlocked');
    expect(useAuthStore.getState().state).toBe('unlocked');
  });

  it('setAddress updates address and optional username', () => {
    useAuthStore.getState().setAddress('0xabc', 'alice');
    expect(useAuthStore.getState().address).toBe('0xabc');
    expect(useAuthStore.getState().username).toBe('alice');
  });

  it('setAddress without username leaves username untouched', () => {
    useAuthStore.getState().setAddress('0xinitial', 'bob');
    useAuthStore.getState().setAddress('0xnew');
    expect(useAuthStore.getState().address).toBe('0xnew');
    expect(useAuthStore.getState().username).toBe('bob');
  });

  it('setBiometricEnabled flips the flag', () => {
    useAuthStore.getState().setBiometricEnabled(true);
    expect(useAuthStore.getState().biometricEnabled).toBe(true);
    useAuthStore.getState().setBiometricEnabled(false);
    expect(useAuthStore.getState().biometricEnabled).toBe(false);
  });

  it('markUnlocked flips state to unlocked and stamps lastUnlockMs', () => {
    const before = Date.now();
    useAuthStore.getState().markUnlocked();
    const after = Date.now();
    const s = useAuthStore.getState();
    expect(s.state).toBe('unlocked');
    expect(s.lastUnlockMs).toBeGreaterThanOrEqual(before);
    expect(s.lastUnlockMs).toBeLessThanOrEqual(after);
  });

  it('clear resets identity and flips to signedOut', () => {
    useAuthStore.getState().setAddress('0xabc', 'alice');
    useAuthStore.getState().markUnlocked();
    useAuthStore.getState().clear();
    const s = useAuthStore.getState();
    expect(s.state).toBe('signedOut');
    expect(s.address).toBe('');
    expect(s.username).toBe('');
    expect(s.lastUnlockMs).toBe(0);
  });

  it('clear preserves biometricEnabled (user device preference)', () => {
    useAuthStore.getState().setBiometricEnabled(true);
    useAuthStore.getState().clear();
    // biometricEnabled is a device preference, not a session fact — it
    // stays true across sign-out so the next sign-in remembers it.
    expect(useAuthStore.getState().biometricEnabled).toBe(true);
  });

  it('selectors produce reference-stable values across no-op updates', () => {
    const before = useAuthStore.getState().address;
    // No-op setState shouldn't change identity fields.
    useAuthStore.getState().setState('signedOut');
    expect(useAuthStore.getState().address).toBe(before);
  });
});
