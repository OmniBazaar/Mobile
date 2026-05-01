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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';

import { bootstrap } from '../services/BootstrapService';
import { useAuthStore } from '../store/authStore';
import type { DerivedKeys } from '../services/WalletCreationService';
import { registerWithAttestation, signInWithMnemonic } from '../services/AuthService';
import { startAutoLock, stopAutoLock } from '../services/AutoLockService';

import WelcomeScreen from '../screens/WelcomeScreen';
import CreateWalletScreen from '../screens/CreateWalletScreen';
import EmailVerifyScreen from '../screens/EmailVerifyScreen';
import SignInScreen from '../screens/SignInScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import WalletHomeScreen from '../screens/WalletHomeScreen';
import SendScreen from '../screens/SendScreen';
import ReceiveScreen from '../screens/ReceiveScreen';
import SwapScreen from '../screens/SwapScreen';
import MarketplaceHomeScreen from '../screens/MarketplaceHomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import StakingScreen from '../screens/StakingScreen';
import KYCScreen from '../screens/KYCScreen';
import AboutScreen from '../screens/AboutScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import TxHistoryScreen from '../screens/TxHistoryScreen';
import OwnedNFTsScreen from '../screens/OwnedNFTsScreen';
import EscrowsScreen from '../screens/EscrowsScreen';
import PredictionPositionsScreen from '../screens/PredictionPositionsScreen';
import HardwareWalletScreen from '../screens/HardwareWalletScreen';
import TrezorWebViewScreen from '../screens/TrezorWebViewScreen';
import LimitOrderScreen from '../screens/LimitOrderScreen';
import LiquidityScreen from '../screens/LiquidityScreen';
import YieldScreen from '../screens/YieldScreen';
import RWAMarketplaceScreen from '../screens/RWAMarketplaceScreen';
import TokenApprovalsScreen from '../screens/TokenApprovalsScreen';
import ConnectedSitesScreen from '../screens/ConnectedSitesScreen';

/** Which onboarding step the user is currently on. */
type OnboardingStep =
  | 'welcome'
  | 'create'
  | 'register'
  | 'email-verify'
  | 'sign-in'
  | 'forgot-password';

/** In-flight onboarding state. */
interface OnboardingState {
  step: OnboardingStep;
  /** Derived keys held in memory during the creation flow. */
  keys?: DerivedKeys;
  /** Canonical username for the in-flight account (set on Create or Sign-in). */
  username?: string;
  /** Email address (set on Create; needed for verify-email POST). */
  email?: string;
  /** Optional referral username — collected on Create. */
  referralCode?: string;
}

/** Post-auth navigation state. */
type AuthedRoute =
  | 'wallet-home'
  | 'send'
  | 'receive'
  | 'swap'
  | 'limit'
  | 'liquidity'
  | 'yield'
  | 'rwa'
  | 'marketplace'
  | 'profile'
  | 'settings'
  | 'staking'
  | 'kyc'
  | 'about'
  | 'privacy'
  | 'tx-history'
  | 'nfts-owned'
  | 'escrows'
  | 'prediction-positions'
  | 'hardware'
  | 'trezor'
  | 'change-password'
  | 'token-approvals'
  | 'connected-sites';

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
  const [authedRoute, setAuthedRoute] = useState<AuthedRoute>('wallet-home');

  // Android hardware-back integration. Without this, pressing the
  // device's physical/gesture Back button drops the user out of the
  // app entirely (the native default), which is hostile UX. We
  // intercept it: if we're on a non-home authed route, return to the
  // wallet home; if we're on the wallet home, fall through to the
  // default (background the app). Uses a ref to read the latest
  // authedRoute inside the listener without re-binding on every state
  // change.
  const authedRouteRef = useRef<AuthedRoute>(authedRoute);
  authedRouteRef.current = authedRoute;
  useEffect(() => {
    /** Map every authed route to its parent for hardware-back. */
    const PARENT: Record<AuthedRoute, AuthedRoute> = {
      'wallet-home': 'wallet-home',
      send: 'wallet-home',
      receive: 'wallet-home',
      swap: 'wallet-home',
      limit: 'swap',
      liquidity: 'swap',
      yield: 'swap',
      rwa: 'marketplace',
      marketplace: 'wallet-home',
      profile: 'wallet-home',
      settings: 'profile',
      staking: 'profile',
      kyc: 'profile',
      about: 'profile',
      privacy: 'swap',
      'tx-history': 'profile',
      'nfts-owned': 'profile',
      escrows: 'profile',
      'prediction-positions': 'profile',
      hardware: 'profile',
      trezor: 'hardware',
      'change-password': 'settings',
      'token-approvals': 'settings',
      'connected-sites': 'settings',
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const here = authedRouteRef.current;
      if (here === 'wallet-home') return false;
      const parent = PARENT[here];
      setAuthedRoute(parent);
      return true;
    });
    return () => sub.remove();
  }, []);

  // AutoLock: arm when the user is unlocked, disarm on sign-out.
  useEffect(() => {
    if (authState !== 'unlocked') {
      stopAutoLock();
      return;
    }
    startAutoLock(() => {
      // Idle / backgrounded — drop session and route to welcome.
      useAuthStore.getState().clear();
      setOnboard({ step: 'welcome' });
    });
    return () => stopAutoLock();
  }, [authState]);

  // Deep-link handler — supports `omnibazaar://send?to=...&amount=...`,
  // `omnibazaar://kyc/complete`, `omnibazaar://swap`, etc.
  useEffect(() => {
    const handle = (url: string | null): void => {
      if (url === null || url === '') return;
      let parsed: ReturnType<typeof Linking.parse>;
      try {
        parsed = Linking.parse(url);
      } catch {
        return;
      }
      const path = parsed.path ?? '';
      if (path === '' || path === '/') return;
      // Only honour deep-links once authed; otherwise the route would
      // be shown in front of the welcome flow and confuse the user.
      if (useAuthStore.getState().state !== 'unlocked') return;
      if (path.startsWith('send')) setAuthedRoute('send');
      else if (path.startsWith('receive')) setAuthedRoute('receive');
      else if (path.startsWith('swap')) setAuthedRoute('swap');
      else if (path.startsWith('limit')) setAuthedRoute('limit');
      else if (path.startsWith('liquidity') || path.startsWith('lp')) setAuthedRoute('liquidity');
      else if (path.startsWith('yield')) setAuthedRoute('yield');
      else if (path.startsWith('rwa')) setAuthedRoute('rwa');
      else if (path.startsWith('marketplace')) setAuthedRoute('marketplace');
      else if (path.startsWith('kyc')) setAuthedRoute('kyc');
      else if (path.startsWith('staking')) setAuthedRoute('staking');
      else if (path.startsWith('settings')) setAuthedRoute('settings');
      else if (path.startsWith('profile')) setAuthedRoute('profile');
    };
    void Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (ev) => handle(ev.url));
    return () => sub.remove();
  }, []);
  const [registerError, setRegisterError] = useState<string | undefined>(undefined);
  const clearAuth = useAuthStore((s) => s.clear);

  // setBiometricEnabled is reserved for the post-launch PIN/biometric
  // gate. Reference it here so the strict-unused-vars lint stays clean
  // even though we don't currently invoke any biometric flow.
  void setBiometricEnabled;

  // Kick off validator discovery before showing any screen that needs
  // the network. BootstrapService is idempotent.
  useEffect(() => {
    void bootstrap().then(() => {
      // We have no persistent auth state yet — every cold start drops
      // the user at Welcome. The deterministic-credentials flow means
      // we can re-derive the wallet from username+password on demand,
      // so there's no encrypted vault to restore from SecureStore.
      setAuthState('signedOut');
    });
  }, [setAuthState]);

  // ---- Onboarding callbacks ---------------------------------------------
  const handleCreate = useCallback((): void => setOnboard({ step: 'create' }), []);
  const handleSignIn = useCallback((): void => setOnboard({ step: 'sign-in' }), []);
  const handleCancel = useCallback((): void => {
    setRegisterError(undefined);
    setOnboard({ step: 'welcome' });
  }, []);

  /** CreateWalletScreen → next step: register with the validator. */
  const handleAccountReady = useCallback(
    (params: {
      keys: DerivedKeys;
      username: string;
      email: string;
      referralCode?: string;
    }): void => {
      setRegisterError(undefined);
      setOnboard({
        step: 'register',
        keys: params.keys,
        username: params.username,
        email: params.email,
        ...(params.referralCode !== undefined && { referralCode: params.referralCode }),
      });
    },
    [],
  );

  /** Register is a side-effecting transition: POST attestation, then
   *  advance to email-verify. The validator emails a 6-digit code on
   *  successful registration. */
  useEffect(() => {
    if (
      onboard.step !== 'register' ||
      onboard.keys === undefined ||
      onboard.username === undefined ||
      onboard.email === undefined
    ) {
      return;
    }
    const { keys, username, email, referralCode } = onboard;
    void (async () => {
      try {
        await registerWithAttestation(keys, username, email, referralCode);
        setOnboard((prev) => ({ ...prev, step: 'email-verify' }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // 409 (username taken) or stale email-already-registered: bail
        // back to welcome with the validator's message visible.
        console.warn('[nav] register failed', err);
        setRegisterError(msg);
        setOnboard({ step: 'welcome' });
      }
    })();
  }, [onboard.step, onboard.keys, onboard.username, onboard.email, onboard.referralCode]);

  /** EmailVerifyScreen → final step: challenge-response login + unlock. */
  const handleEmailVerified = useCallback((): void => {
    if (onboard.keys === undefined || onboard.username === undefined) {
      // Defensive — shouldn't happen because email-verify is gated on
      // the keys+username being set during the create flow.
      setOnboard({ step: 'welcome' });
      return;
    }
    const { keys, username } = onboard;
    void (async () => {
      try {
        await signInWithMnemonic(keys.mnemonic, username);
        setAddress(keys.address, username);
        markUnlocked();
      } catch (err) {
        console.error('[nav] post-verify sign-in failed', err);
        setRegisterError(err instanceof Error ? err.message : String(err));
        setOnboard({ step: 'welcome' });
      }
    })();
  }, [onboard, setAddress, markUnlocked]);

  /** SignInScreen → keys + username + JWT already obtained inside the
   *  screen via signInWithMnemonic; we just flip auth state. */
  const handleSignedIn = useCallback(
    (keys: DerivedKeys, username: string): void => {
      setOnboard((prev) => ({ ...prev, keys, username, step: 'sign-in' }));
      setAddress(keys.address, username);
      markUnlocked();
    },
    [setAddress, markUnlocked],
  );

  // ---- Render -----------------------------------------------------------
  if (authState === 'bootstrapping') return null;

  if (authState === 'unlocked') {
    switch (authedRoute) {
      case 'send':
        return (
          <SendScreen
            mnemonic={onboard.keys?.mnemonic ?? ''}
            onBack={() => setAuthedRoute('wallet-home')}
            onSent={() => setAuthedRoute('wallet-home')}
          />
        );
      case 'receive':
        return <ReceiveScreen onBack={() => setAuthedRoute('wallet-home')} />;
      case 'swap':
        return (
          <SwapScreen
            onBack={() => setAuthedRoute('wallet-home')}
            onOpenPrivacy={() => setAuthedRoute('privacy')}
            onOpenLimit={() => setAuthedRoute('limit')}
            onOpenLiquidity={() => setAuthedRoute('liquidity')}
            onOpenYield={() => setAuthedRoute('yield')}
            mnemonic={onboard.keys?.mnemonic ?? ''}
          />
        );
      case 'marketplace':
        return (
          <MarketplaceHomeScreen
            onBack={() => setAuthedRoute('wallet-home')}
            onOpenSwap={() => setAuthedRoute('swap')}
            mnemonic={onboard.keys?.mnemonic ?? ''}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            onBack={() => setAuthedRoute('wallet-home')}
            onNavigate={(dest) => setAuthedRoute(dest)}
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            onBack={() => setAuthedRoute('profile')}
            onSignOut={() => {
              clearAuth();
              setOnboard({ step: 'welcome' });
            }}
            onOpenChangePassword={() => setAuthedRoute('change-password')}
            onOpenTokenApprovals={() => setAuthedRoute('token-approvals')}
            onOpenConnectedSites={() => setAuthedRoute('connected-sites')}
          />
        );
      case 'staking':
        return (
          <StakingScreen
            onBack={() => setAuthedRoute('profile')}
            mnemonic={onboard.keys?.mnemonic ?? ''}
          />
        );
      case 'kyc':
        return <KYCScreen onBack={() => setAuthedRoute('profile')} />;
      case 'about':
        return <AboutScreen onBack={() => setAuthedRoute('profile')} />;
      case 'privacy':
        return <PrivacyScreen onBack={() => setAuthedRoute('swap')} />;
      case 'tx-history':
        return <TxHistoryScreen onBack={() => setAuthedRoute('profile')} />;
      case 'nfts-owned':
        return (
          <OwnedNFTsScreen
            onBack={() => setAuthedRoute('profile')}
            mnemonic={onboard.keys?.mnemonic ?? ''}
          />
        );
      case 'escrows':
        return (
          <EscrowsScreen
            onBack={() => setAuthedRoute('profile')}
            mnemonic={onboard.keys?.mnemonic ?? ''}
          />
        );
      case 'prediction-positions':
        return (
          <PredictionPositionsScreen
            onBack={() => setAuthedRoute('profile')}
            mnemonic={onboard.keys?.mnemonic ?? ''}
          />
        );
      case 'hardware':
        return (
          <HardwareWalletScreen
            onBack={() => setAuthedRoute('profile')}
            onOpenTrezor={() => setAuthedRoute('trezor')}
          />
        );
      case 'trezor':
        return <TrezorWebViewScreen onBack={() => setAuthedRoute('hardware')} />;
      case 'limit':
        return <LimitOrderScreen onBack={() => setAuthedRoute('swap')} />;
      case 'liquidity':
        return <LiquidityScreen onBack={() => setAuthedRoute('swap')} />;
      case 'yield':
        return <YieldScreen onBack={() => setAuthedRoute('swap')} />;
      case 'rwa':
        return (
          <RWAMarketplaceScreen
            onBack={() => setAuthedRoute('marketplace')}
            onTrade={() => setAuthedRoute('swap')}
          />
        );
      case 'change-password':
        return (
          <ChangePasswordScreen
            onBack={() => setAuthedRoute('settings')}
            onSignOutAndStartOver={() => {
              clearAuth();
              setOnboard({ step: 'welcome' });
            }}
          />
        );
      case 'token-approvals':
        return (
          <TokenApprovalsScreen
            mnemonic={onboard.keys?.mnemonic ?? ''}
            onBack={() => setAuthedRoute('settings')}
          />
        );
      case 'connected-sites':
        return <ConnectedSitesScreen onBack={() => setAuthedRoute('settings')} />;
      case 'wallet-home':
      default:
        return (
          <WalletHomeScreen
            onSend={() => setAuthedRoute('send')}
            onReceive={() => setAuthedRoute('receive')}
            onSwap={() => setAuthedRoute('swap')}
            onShop={() => setAuthedRoute('marketplace')}
            onProfile={() => setAuthedRoute('profile')}
            onSignOut={() => {
              clearAuth();
              setOnboard({ step: 'welcome' });
            }}
          />
        );
    }
  }

  // signedOut — route through the onboarding FSM
  switch (onboard.step) {
    case 'welcome':
      return (
        <WelcomeScreen
          onCreateWallet={handleCreate}
          onSignIn={handleSignIn}
        />
      );
    case 'create':
      return (
        <CreateWalletScreen onAccountReady={handleAccountReady} onCancel={handleCancel} />
      );
    case 'register':
      // Transient — the effect above is POSTing the attestation. If
      // it fails, the effect resets to 'welcome' with the error in
      // registerError; we surface the message in a future Toast or
      // error banner. For now nothing renders during this brief gap.
      return null;
    case 'email-verify':
      return (
        <EmailVerifyScreen
          email={onboard.email ?? ''}
          onVerified={handleEmailVerified}
          onCancel={handleCancel}
        />
      );
    case 'sign-in':
      return (
        <SignInScreen
          onSignedIn={handleSignedIn}
          onCancel={handleCancel}
          onForgotPassword={() => setOnboard({ step: 'forgot-password' })}
        />
      );
    case 'forgot-password':
      return (
        <ForgotPasswordScreen
          onBack={handleCancel}
          onContactSupport={() => {
            // Open the help-centre URL in the platform browser. The
            // import is lazy because expo-linking has its own
            // initialisation cost we want kept off the cold-boot path.
            void (async () => {
              const linking = await import('react-native');
              await linking.Linking.openURL('https://omnibazaar.com/help/contact');
            })();
          }}
        />
      );
    default:
      return null;
  }

  // t() is referenced indirectly via child screens' own i18n — keeping
  // the hook binding above ensures a language-change re-renders the
  // tree.
  void t;
  // registerError is consumed by the next iteration's surface (banner
  // on Welcome, future Toast). Reference it so tsc doesn't flag the
  // unused setter.
  void registerError;
}
