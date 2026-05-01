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
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from './types';
import { createLinking } from './linking';

import { useAuthStore } from '../store/authStore';
import { bootstrap } from '../services/BootstrapService';
import { startAutoLock, stopAutoLock } from '../services/AutoLockService';

import OnboardingStack from './stacks/OnboardingStack';
import AppTabs from './AppTabs';
import AuthPromptScreen from './AuthPromptScreen';

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

  // AutoLock: arm on unlocked, disarm on sign-out / guest.
  useEffect(() => {
    if (authState !== 'unlocked') {
      stopAutoLock();
      return;
    }
    startAutoLock(() => {
      clearAuth();
    });
    return (): void => stopAutoLock();
  }, [authState, clearAuth]);

  if (authState === 'bootstrapping') return null;

  // 'unlocked' → MainTabs with full features.
  // 'guest' → MainTabs with read-only access (action buttons routed
  //           through RequireAuth → AuthPrompt).
  // 'signedOut' or 'locked' → Onboarding stack.
  const showTabs = authState === 'unlocked' || authState === 'guest';

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
    </NavigationContainer>
  );
}
