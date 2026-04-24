/**
 * RootNavigator — top-level screen orchestrator for the Phase 1 auth
 * flow. Uses a simple finite-state machine pattern (in-component useState)
 * rather than react-navigation stacks because the flow is strictly
 * linear and navigation state doesn't survive reloads anyway (the
 * authStore tracks "is the wallet locked/signedOut/unlocked?" across
 * mounts).
 *
 * Phases 2+ will adopt react-navigation for the authenticated tab
 * layout; the auth gate here only needs to pick one of ~8 screens.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { bootstrap } from '../services/BootstrapService';
import { useAuthStore } from '../store/authStore';
import type { DerivedKeys } from '../services/WalletCreationService';
import { addressFromMnemonic, registerWithAttestation, signInWithMnemonic } from '../services/AuthService';

import WelcomeScreen from '../screens/WelcomeScreen';
import CreateWalletScreen from '../screens/CreateWalletScreen';
import SeedBackupScreen from '../screens/SeedBackupScreen';
import SeedVerifyScreen from '../screens/SeedVerifyScreen';
import ImportWalletScreen from '../screens/ImportWalletScreen';
import PinSetupScreen from '../screens/PinSetupScreen';
import BiometricEnrollScreen from '../screens/BiometricEnrollScreen';
import SignInScreen from '../screens/SignInScreen';
import HomeScreen from '../screens/HomeScreen';

/** Which onboarding step the user is currently on. */
type OnboardingStep =
  | 'welcome'
  | 'create'
  | 'seed-backup'
  | 'seed-verify'
  | 'import'
  | 'pin-setup'
  | 'biometric'
  | 'register'
  | 'sign-in';

/** In-flight onboarding state. */
interface OnboardingState {
  step: OnboardingStep;
  /** Derived keys held in memory during the creation/import flow. */
  keys?: DerivedKeys;
  /** PIN chosen during pin-setup. */
  pin?: string;
}

/**
 * Render the right screen based on the auth lifecycle state + the
 * in-flight onboarding step.
 *
 * @returns JSX.
 */
export default function RootNavigator(): JSX.Element | null {
  const { t } = useTranslation();
  const authState = useAuthStore((s) => s.state);
  const setAuthState = useAuthStore((s) => s.setState);
  const setAddress = useAuthStore((s) => s.setAddress);
  const setBiometricEnabled = useAuthStore((s) => s.setBiometricEnabled);
  const markUnlocked = useAuthStore((s) => s.markUnlocked);

  const [onboard, setOnboard] = useState<OnboardingState>({ step: 'welcome' });

  // Kick off validator discovery before showing any screen that needs
  // the network. BootstrapService is idempotent.
  useEffect(() => {
    void bootstrap().then(() => {
      // We have no persistent auth state yet in Phase 1 — every cold
      // start drops the user at Welcome. Phase 2 restores from
      // SecureStore and routes to AppLock when a wallet exists.
      setAuthState('signedOut');
    });
  }, [setAuthState]);

  // ---- Onboarding callbacks ---------------------------------------------
  const handleCreate = useCallback((): void => setOnboard({ step: 'create' }), []);
  const handleImport = useCallback((): void => setOnboard({ step: 'import' }), []);
  const handleCancel = useCallback((): void => setOnboard({ step: 'welcome' }), []);

  const handleMnemonicReady = useCallback((keys: DerivedKeys): void => {
    setOnboard({ step: 'seed-backup', keys });
  }, []);

  const handleSeedBackupConfirmed = useCallback((): void => {
    setOnboard((prev) => ({ ...prev, step: 'seed-verify' }));
  }, []);

  const handleSeedVerified = useCallback((): void => {
    setOnboard((prev) => ({ ...prev, step: 'pin-setup' }));
  }, []);

  const handleImported = useCallback((keys: DerivedKeys): void => {
    setOnboard({ step: 'pin-setup', keys });
  }, []);

  const handlePinSet = useCallback((pin: string): void => {
    setOnboard((prev) => ({ ...prev, pin, step: 'biometric' }));
  }, []);

  const handleBiometricDone = useCallback(
    (enabled: boolean): void => {
      setBiometricEnabled(enabled);
      setOnboard((prev) => ({ ...prev, step: 'register' }));
    },
    [setBiometricEnabled],
  );

  // Register is a side-effecting transition: call the validator,
  // then flip authState to unlocked + surface the address.
  useEffect(() => {
    if (onboard.step !== 'register' || onboard.keys === undefined) return;
    const keys = onboard.keys;
    void (async () => {
      try {
        // Phase 1 uses the derived address as the default username; a
        // later wizard step will let the user pick a human-readable
        // username (subject to the `^[a-z][a-z0-9_]{2,19}$` rules).
        const username = `anon_${keys.address.slice(2, 10).toLowerCase()}`;
        await registerWithAttestation(keys, username);
        setAddress(keys.address, username);
        markUnlocked();
      } catch (err) {
        // If registration fails the user may already be registered —
        // fall back to challenge-response sign-in rather than blocking.
        console.warn('[nav] registration failed, attempting sign-in', err);
        try {
          await signInWithMnemonic(keys.mnemonic);
          setAddress(addressFromMnemonic(keys.mnemonic));
          markUnlocked();
        } catch (signInErr) {
          console.error('[nav] sign-in fallback also failed', signInErr);
          // Surface to user via future error screen. For now drop
          // back to welcome so they can retry.
          setOnboard({ step: 'welcome' });
        }
      }
    })();
  }, [onboard.step, onboard.keys, setAddress, markUnlocked]);

  // ---- Render -----------------------------------------------------------
  if (authState === 'bootstrapping') return null;

  if (authState === 'unlocked') {
    return <HomeScreen />;
  }

  // signedOut — route through the onboarding FSM
  switch (onboard.step) {
    case 'welcome':
      return (
        <WelcomeScreen
          onCreateWallet={handleCreate}
          onImportWallet={handleImport}
          onSignIn={handleImport}
        />
      );
    case 'create':
      return <CreateWalletScreen onMnemonicReady={handleMnemonicReady} onCancel={handleCancel} />;
    case 'seed-backup':
      return (
        <SeedBackupScreen
          mnemonic={onboard.keys?.mnemonic ?? ''}
          onConfirm={handleSeedBackupConfirmed}
          onCancel={handleCancel}
        />
      );
    case 'seed-verify':
      return (
        <SeedVerifyScreen
          mnemonic={onboard.keys?.mnemonic ?? ''}
          onVerified={handleSeedVerified}
          onCancel={handleCancel}
        />
      );
    case 'import':
      return <ImportWalletScreen onImported={handleImported} onCancel={handleCancel} />;
    case 'pin-setup':
      return <PinSetupScreen onPinSet={handlePinSet} onCancel={handleCancel} />;
    case 'biometric':
      return <BiometricEnrollScreen onDone={handleBiometricDone} />;
    case 'register':
      // Transient state — the effect above is calling the validator.
      return null;
    case 'sign-in':
      return (
        <SignInScreen
          mnemonic={onboard.keys?.mnemonic ?? ''}
          onSignedIn={() => {
            if (onboard.keys !== undefined) {
              setAddress(addressFromMnemonic(onboard.keys.mnemonic));
            }
            markUnlocked();
          }}
          onCancel={handleCancel}
        />
      );
    default:
      return null;
  }

  // t() is referenced indirectly via child screens' own i18n — keeping
  // the hook binding above ensures a language-change re-renders the
  // tree.
  void t;
}
