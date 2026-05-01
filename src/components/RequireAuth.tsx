/**
 * RequireAuth — wraps a write-action that requires a signed-in user.
 *
 * In guest mode the user can browse marketplaces, see prices, read
 * reviews, etc. The moment they tap a write-action button — Buy, Send,
 * Swap, Stake, List — we route them to the AuthPrompt modal instead.
 * After sign-in / wallet creation, they re-attempt the action.
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
 *      <Button onPress={() => requireAuth('Sign in to buy', handleBuy)} />
 *      ```
 *
 * Both forms forward the same logic: if `useAuthStore.state` is
 * `'unlocked'`, run the callback directly; otherwise route to the
 * AuthPrompt modal.
 *
 * @module components/RequireAuth
 */

import React from 'react';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { useAuthStore } from '../store/authStore';
import type { RootStackParamList } from '../navigation/types';

/** Callback signature used by both render-prop and hook forms. */
export type AuthedOnPress = (action: () => void | Promise<void>) => void;

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
  const wrapped: AuthedOnPress = (action) => {
    requireAuth(props.reason, action, props.intendedRoute);
  };
  return <>{props.children(wrapped)}</>;
}

/**
 * Hook form. Returns a callable `requireAuth(reason, action)` that
 * routes guests to AuthPrompt and runs the action immediately for
 * signed-in users.
 *
 * @returns Function that gates an action behind auth.
 */
export function useRequireAuth(): (
  reason: string,
  action: () => void | Promise<void>,
  intendedRoute?: string,
) => void {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  return (reason, action, intendedRoute) => {
    const state = useAuthStore.getState().state;
    if (state === 'unlocked') {
      const result = action();
      if (result instanceof Promise) void result;
      return;
    }
    // 'guest', 'signedOut', 'locked', 'bootstrapping' — all need auth.
    nav.navigate('AuthPrompt', {
      reason,
      ...(intendedRoute !== undefined && { intendedRoute }),
    });
  };
}
