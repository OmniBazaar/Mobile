/**
 * RootNavigator — top-level orchestrator.
 *
 * Owns:
 *   - NavigationContainer + linking config (omnibazaar:// + universal links)
 *   - Bootstrap dispatch (validator discovery + i18n init)
 *   - AutoLock arming (idle / backgrounded → drop session → onboarding)
 *   - Switch between Onboarding stack (pre-auth) and MainTabs (post-auth
 *     OR guest mode — guests see read-only marketplaces)
 *   - Modal route(s): AuthPromptScreen (guest sign-in CTA)
 *
 * Replaces the prior in-component switch + BackHandler hack — react-
 * navigation's native-stack + bottom-tabs bring us iOS swipe-back,
 * Android predictive-back, deep-link routing, and per-tab stack
 * persistence for free.
 *
 * @module navigation/RootNavigator
 */

import React, { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from './types';
import { createLinking } from './linking';

import { useAuthStore } from '../store/authStore';
import { bootstrap } from '../services/BootstrapService';
import { startAutoLock, stopAutoLock } from '../services/AutoLockService';
import { evaluateNativeGuard } from '../services/NativeAutoLockGuard';

import OnboardingStack from './stacks/OnboardingStack';
import AppTabs from './AppTabs';
import AuthPromptScreen from './AuthPromptScreen';
import UnlockSheetMount from '../components/UnlockSheetMount';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Render the navigation tree.
 *
 * @returns JSX or null while bootstrapping.
 */
export default function RootNavigator(): React.ReactElement | null {
  const authState = useAuthStore((s) => s.state);
  const setAuthState = useAuthStore((s) => s.setState);
  const clearAuth = useAuthStore((s) => s.clear);

  // Validator discovery on cold-start. BootstrapService is idempotent.
  useEffect(() => {
    void bootstrap().then(() => {
      // No persistent vault — we re-derive the wallet from credentials
      // on demand. Cold start always lands at signedOut.
      setAuthState('signedOut');
    });
  }, [setAuthState]);

  // AutoLock: arm on unlocked, disarm on sign-out / guest / locked.
  // Phase 12: when the timer fires, transition to `locked` (NOT
  // `signedOut`) so the user keeps their browse session and the
  // contextual UnlockSheet appears on the next 🔒 action. The
  // pre-Phase-12 `clearAuth()` bounced the user to onboarding —
  // the unlock-first model — and is replaced here.
  const lockKeystore = useAuthStore((s) => s.lockKeystore);
  useEffect(() => {
    if (authState !== 'unlocked') {
      stopAutoLock();
      return;
    }
    startAutoLock(() => {
      lockKeystore();
    });
    return (): void => stopAutoLock();
  }, [authState, lockKeystore]);

  // Native auto-lock guard (Sprint 7 / H9): the JS setTimeout in
  // AutoLockService dies when the OS suspends or kills the bundle. The
  // guard's persisted "lockBy" timestamp survives those events. We
  // evaluate it on cold-start AND on every AppState=active transition
  // — if the elapsed time would have fired the timer, force-lock now.
  useEffect(() => {
    let cancelled = false;
    const check = (): void => {
      if (cancelled) return;
      // Only runs when the wallet is unlocked — there's nothing to lock
      // in any other state.
      if (useAuthStore.getState().state !== 'unlocked') return;
      void evaluateNativeGuard().then((expired) => {
        if (!cancelled && expired) {
          lockKeystore();
        }
      });
    };
    // Cold-start check (first paint after bootstrap).
    check();
    const sub = AppState.addEventListener('change', (next: AppStateStatus): void => {
      if (next === 'active') check();
    });
    return (): void => {
      cancelled = true;
      sub.remove();
    };
  }, [lockKeystore]);

  if (authState === 'bootstrapping') return null;

  // 'unlocked' → MainTabs with full features.
  // 'guest' / 'locked' → MainTabs with read-only access (action buttons
  //           routed through RequireAuth → contextual UnlockSheet for
  //           `locked`, AuthPrompt for `guest`).
  // 'signedOut' → Onboarding stack.
  const showTabs =
    authState === 'unlocked' ||
    authState === 'guest' ||
    authState === 'locked';

  return (
    <NavigationContainer linking={createLinking()}>
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: 'fade' }}
      >
        {showTabs ? (
          <>
            <Stack.Screen name="MainTabs" component={AppTabs} />
            <Stack.Screen
              name="AuthPrompt"
              component={AuthPromptScreen}
              options={{
                presentation: 'transparentModal',
                animation: 'slide_from_bottom',
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Onboarding" component={OnboardingStack} />
        )}
      </Stack.Navigator>
      {/* Phase 12: contextual UnlockSheet, mounted once and driven by
          the unlock-guard zustand slice. Renders nothing while no
          deferred action is pending. */}
      {showTabs ? <UnlockSheetMount /> : null}
    </NavigationContainer>
  );
}
