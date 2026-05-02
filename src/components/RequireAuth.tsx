/**
 * RequireAuth — wraps a write-action that requires a signed-in user.
 *
 * Phase 12 (2026-05-01) splits the gating into three branches:
 *
 *   • `unlocked` — run the callback directly. Today's behavior.
 *   • `locked` (wallet exists, in-memory seed wiped — typically after
 *     auto-lock) — open the contextual `<UnlockSheet>` (mounted once
 *     under `RootNavigator`) and resume the deferred action after
 *     successful unlock. The user is NOT bounced out of context to
 *     onboarding for what is functionally a re-enter-password event.
 *   • `signedOut` / `guest` / `bootstrapping` — route to AuthPrompt as
 *     today. The user creates or imports a wallet, then resumes the
 *     intended deep-link via the `intendedRoute` parameter.
 *
 * Two API shapes:
 *
 *   1. **Render-prop**:
 *      ```
 *      <RequireAuth reason="Sign in to buy this listing">
 *        {(authedOnPress) => (
 *          <Button title="Buy" onPress={() => authedOnPress(handleBuy)} />
 *        )}
 *      </RequireAuth>
 *      ```
 *
 *   2. **`useRequireAuth` hook**:
 *      ```
 *      const requireAuth = useRequireAuth();
 *      <Button
 *        onPress={() =>
 *          requireAuth('Sign in to buy', handleBuy, 'BuyDeepLink', 'buyListing')
 *        }
 *      />
 *      ```
 *
 * Pairs 1:1 with the wallet extension's `useUnlockGuard()` hook (see
 * `Wallet/src/popup/hooks/useUnlockGuard.tsx`) — the action-key strings
 * MUST match between the two surfaces.
 *
 * @module components/RequireAuth
 */

import React from 'react';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { useAuthStore } from '../store/authStore';
import { useUnlockGuardStore } from '../store/unlockGuardStore';
import type { RootStackParamList } from '../navigation/types';

/** Callback signature used by both render-prop and hook forms. */
export type AuthedOnPress = (
  action: () => void | Promise<void>,
  /** Phase-12 actionKey — picks the unlock-sheet body sentence. */
  actionKey?: string,
) => void;

/** Props for the render-prop form. */
export interface RequireAuthProps {
  /** Short, user-facing reason ("Sign in to buy this listing"). */
  reason: string;
  /** Optional intended deep-link to resume after sign-in. */
  intendedRoute?: string;
  /** Render prop. Receives a wrapped `authedOnPress`. */
  children: (authedOnPress: AuthedOnPress) => React.ReactNode;
}

/**
 * Render-prop component. Use when you need the wrapped callback inline.
 *
 * @param props - See {@link RequireAuthProps}.
 * @returns The render-prop's output.
 */
export function RequireAuth(props: RequireAuthProps): React.ReactElement {
  const requireAuth = useRequireAuth();
  const wrapped: AuthedOnPress = (action, actionKey) => {
    requireAuth(props.reason, action, props.intendedRoute, actionKey);
  };
  return <>{props.children(wrapped)}</>;
}

/**
 * Hook form. Returns a callable `requireAuth(reason, action, intendedRoute?, actionKey?)`.
 *
 *   • `state === 'unlocked'` → run synchronously.
 *   • `state === 'locked'`   → open the contextual UnlockSheet via the
 *     unlock-guard slice; the deferred action resumes after unlock.
 *   • else                   → AuthPrompt (today's onboarding bounce).
 *
 * @returns Function that gates an action behind auth.
 */
export function useRequireAuth(): (
  reason: string,
  action: () => void | Promise<void>,
  intendedRoute?: string,
  actionKey?: string,
) => void {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  return (reason, action, intendedRoute, actionKey) => {
    const state = useAuthStore.getState().state;
    if (state === 'unlocked') {
      const result = action();
      if (result instanceof Promise) void result;
      return;
    }
    if (state === 'locked') {
      // Wallet exists on this device — show the contextual UnlockSheet
      // and resume the deferred action after the user re-enters their
      // password. The sheet is mounted once under RootNavigator and
      // reads from the unlock-guard store; here we just enqueue.
      useUnlockGuardStore.getState().setPending({
        actionKey: actionKey ?? 'default',
        run: action,
      });
      return;
    }
    // 'guest', 'signedOut', 'bootstrapping' — no wallet on device.
    nav.navigate('AuthPrompt', {
      reason,
      ...(intendedRoute !== undefined && { intendedRoute }),
    });
  };
}
