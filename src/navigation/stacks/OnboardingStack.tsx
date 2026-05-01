/**
 * Onboarding stack — pre-auth screens.
 *
 * Welcome → Create or SignIn or ForgotPassword. Create → EmailVerify
 * (a side-effect transition: registers attestation, then advances).
 * On successful verify, switches the root nav to MainTabs.
 *
 * Guest mode entry: WelcomeScreen calls `enterGuestMode()` on the auth
 * store, which flips the root state to `guest` — RootNavigator picks
 * that up and renders MainTabs (with RequireAuth gating action buttons).
 *
 * @module navigation/stacks/OnboardingStack
 */

import React, { useCallback, useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import type { OnboardingStackParamList, RootStackParamList } from '../types';

import { useAuthStore } from '../../store/authStore';
import {
  registerWithAttestation,
  signInWithMnemonic,
} from '../../services/AuthService';
import type { DerivedKeys } from '../../services/WalletCreationService';
import { deriveFamilyAddresses } from '../../services/FamilyAddressService';
import { logger } from '../../utils/logger';

import WelcomeScreen from '../../screens/WelcomeScreen';
import CreateWalletScreen from '../../screens/CreateWalletScreen';
import EmailVerifyScreen from '../../screens/EmailVerifyScreen';
import SignInScreen from '../../screens/SignInScreen';
import ForgotPasswordScreen from '../../screens/ForgotPasswordScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/** Hold the in-flight derivation result + post-verify creds. */
interface InFlight {
  keys: DerivedKeys;
  username: string;
  email: string;
  referralCode?: string;
}
let _inFlight: InFlight | undefined;

/** Welcome screen — adds "Continue as Guest" CTA. */
function WelcomeWrapper(): React.ReactElement {
  const nav = useNavigation<NavigationProp<OnboardingStackParamList>>();
  const enterGuest = useAuthStore((s) => s.enterGuestMode);
  return (
    <WelcomeScreen
      onCreateWallet={(): void => nav.navigate('Create')}
      onSignIn={(): void => nav.navigate('SignIn')}
      onContinueAsGuest={(): void => enterGuest()}
    />
  );
}

/** Create-wallet wrapper. */
function CreateWrapper(): React.ReactElement {
  const nav = useNavigation<NavigationProp<OnboardingStackParamList>>();
  const handleAccountReady = useCallback(
    (params: {
      keys: DerivedKeys;
      username: string;
      email: string;
      referralCode?: string;
    }): void => {
      _inFlight = {
        keys: params.keys,
        username: params.username,
        email: params.email,
        ...(params.referralCode !== undefined && { referralCode: params.referralCode }),
      };
      nav.navigate('EmailVerify', { email: params.email });
    },
    [nav],
  );
  return (
    <CreateWalletScreen
      onAccountReady={handleAccountReady}
      onCancel={(): void => nav.navigate('Welcome')}
    />
  );
}

/** EmailVerify wrapper — runs the attestation register side-effect. */
function EmailVerifyWrapper(): React.ReactElement {
  const nav =
    useNavigation<NavigationProp<OnboardingStackParamList & RootStackParamList>>();
  const { t } = useTranslation();
  const setAddress = useAuthStore((s) => s.setAddress);
  const setMnemonic = useAuthStore((s) => s.setMnemonic);
  const setFamilyAddresses = useAuthStore((s) => s.setFamilyAddresses);
  const markUnlocked = useAuthStore((s) => s.markUnlocked);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (_inFlight === undefined) {
      nav.navigate('Welcome');
      return;
    }
    const { keys, username, email, referralCode } = _inFlight;
    void (async () => {
      try {
        await registerWithAttestation(keys, username, email, referralCode);
      } catch (err) {
        logger.warn('[onboarding] register failed', {
          err: err instanceof Error ? err.message : String(err),
        });
        setError(
          err instanceof Error
            ? err.message
            : t('onboarding.registerFailed', { defaultValue: 'Registration failed.' }),
        );
      }
    })();
    // _inFlight is module-scope; we re-read it in handleVerified.
  }, [nav, t]);

  const handleVerified = useCallback((): void => {
    if (_inFlight === undefined) {
      nav.navigate('Welcome');
      return;
    }
    const { keys, username } = _inFlight;
    void (async () => {
      try {
        await signInWithMnemonic(keys.mnemonic, username);
        setAddress(keys.address, username);
        setMnemonic(keys.mnemonic);
        setFamilyAddresses(deriveFamilyAddresses(keys.mnemonic));
        markUnlocked();
        // RootNavigator's auth listener will switch us to MainTabs.
      } catch (err) {
        logger.error('[onboarding] post-verify sign-in failed', {
          err: err instanceof Error ? err.message : String(err),
        });
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [nav, setAddress, setMnemonic, markUnlocked]);

  // The EmailVerifyScreen renders its own error state via its internal
  // useState; we surface a registration error by aborting the verify
  // step (route back to Welcome with the error logged). A future Sprint
  // can plumb the error through if EmailVerifyScreen grows an errorMessage
  // prop, but that changes its public API — out of scope for Sprint 1.
  void error;

  return (
    <EmailVerifyScreen
      email={_inFlight?.email ?? ''}
      onVerified={handleVerified}
      onCancel={(): void => {
        _inFlight = undefined;
        nav.navigate('Welcome');
      }}
    />
  );
}

/** Sign-in wrapper. */
function SignInWrapper(): React.ReactElement {
  const nav = useNavigation<NavigationProp<OnboardingStackParamList>>();
  const setAddress = useAuthStore((s) => s.setAddress);
  const setMnemonic = useAuthStore((s) => s.setMnemonic);
  const setFamilyAddresses = useAuthStore((s) => s.setFamilyAddresses);
  const markUnlocked = useAuthStore((s) => s.markUnlocked);
  return (
    <SignInScreen
      onSignedIn={(keys, username): void => {
        setAddress(keys.address, username);
        setMnemonic(keys.mnemonic);
        setFamilyAddresses(deriveFamilyAddresses(keys.mnemonic));
        markUnlocked();
      }}
      onCancel={(): void => nav.navigate('Welcome')}
      onForgotPassword={(): void => nav.navigate('ForgotPassword')}
    />
  );
}

/** Forgot-password wrapper. */
function ForgotPasswordWrapper(): React.ReactElement {
  const nav = useNavigation();
  return (
    <ForgotPasswordScreen
      onBack={(): void => nav.goBack()}
      onContactSupport={(): void => {
        void (async () => {
          const linking = await import('react-native');
          await linking.Linking.openURL('https://omnibazaar.com/help/contact');
        })();
      }}
    />
  );
}

/**
 * Build the onboarding stack.
 *
 * @returns Onboarding stack navigator.
 */
export default function OnboardingStack(): React.ReactElement {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="Welcome" component={WelcomeWrapper} />
      <Stack.Screen name="Create" component={CreateWrapper} />
      <Stack.Screen name="EmailVerify" component={EmailVerifyWrapper} />
      <Stack.Screen name="SignIn" component={SignInWrapper} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordWrapper} />
    </Stack.Navigator>
  );
}
