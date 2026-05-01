/**
 * Profile tab — settings + KYC + about + advanced.
 *
 * Many planned routes (Earnings, Rewards, Orders, Referrals, Notifications,
 * ParticipationScore, ParticipationBreakdown, Governance, StakingCalculator)
 * land in Sprint 2 B9 — for now they render the shared ComingSoon
 * placeholder so the tile under ProfileScreen does not dead-end.
 *
 * @module navigation/stacks/ProfileStack
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import type { ProfileStackParamList, RootStackParamList, AppTabsParamList } from '../types';
import { useAuthStore } from '../../store/authStore';

import ProfileScreen, { type ProfileDestination } from '../../screens/ProfileScreen';
import SettingsScreen from '../../screens/SettingsScreen';
import KYCScreen from '../../screens/KYCScreen';
import AboutScreen from '../../screens/AboutScreen';
import ChangePasswordScreen from '../../screens/ChangePasswordScreen';
import TokenApprovalsScreen from '../../screens/TokenApprovalsScreen';
import ConnectedSitesScreen from '../../screens/ConnectedSitesScreen';
import HardwareWalletScreen from '../../screens/HardwareWalletScreen';
import TrezorWebViewScreen from '../../screens/TrezorWebViewScreen';
import ParticipationScoreScreen from '../../screens/ParticipationScoreScreen';
import StakingCalculatorScreen from '../../screens/StakingCalculatorScreen';
import ReferralScreen from '../../screens/ReferralScreen';
import NotificationsScreen from '../../screens/NotificationsScreen';
import { ComingSoonScreen } from '../shared/ComingSoonScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

/** Translate `navigation.goBack()` into the `onBack` callback shape. */
function goBack(nav: { goBack: () => void }): () => void {
  return (): void => nav.goBack();
}

/** Map ProfileScreen's destination keys to nav targets. */
function destinationToRoute(
  dest: ProfileDestination,
  nav: NavigationProp<ProfileStackParamList & AppTabsParamList & RootStackParamList>,
): void {
  switch (dest) {
    case 'settings':
      nav.navigate('Settings');
      return;
    case 'staking':
      // Staking + AddressBook live in the Wallet stack.
      nav.navigate('Wallet', { screen: 'Staking' });
      return;
    case 'kyc':
      nav.navigate('KYC');
      return;
    case 'about':
      nav.navigate('About');
      return;
    case 'tx-history':
      nav.navigate('Wallet', { screen: 'TxHistory' });
      return;
    case 'nfts-owned':
      nav.navigate('Wallet', { screen: 'OwnedNFTs' });
      return;
    case 'escrows':
      nav.navigate('Wallet', { screen: 'Escrows' });
      return;
    case 'prediction-positions':
      nav.navigate('Wallet', { screen: 'PredictionPositions' });
      return;
    case 'hardware':
      nav.navigate('Hardware');
      return;
    case 'participation-score':
      nav.navigate('ParticipationScore');
      return;
    case 'staking-calculator':
      nav.navigate('StakingCalculator');
      return;
    case 'referrals':
      nav.navigate('Referrals');
      return;
    case 'address-book':
      nav.navigate('Wallet', { screen: 'AddressBook' });
      return;
    case 'notifications':
      nav.navigate('Notifications');
      return;
  }
}

/** Profile-home wrapper. */
function ProfileHomeWrapper(): React.ReactElement {
  const nav =
    useNavigation<NavigationProp<ProfileStackParamList & AppTabsParamList & RootStackParamList>>();
  return (
    <ProfileScreen
      onBack={(): void => nav.navigate('Wallet')}
      onNavigate={(dest): void => destinationToRoute(dest, nav)}
    />
  );
}

/** Settings wrapper. */
function SettingsWrapper(): React.ReactElement {
  const nav = useNavigation<NavigationProp<ProfileStackParamList & RootStackParamList>>();
  const clearAuth = useAuthStore((s) => s.clear);
  return (
    <SettingsScreen
      onBack={goBack(nav)}
      onSignOut={(): void => {
        clearAuth();
        nav.reset({ index: 0, routes: [{ name: 'Onboarding' as never }] });
      }}
      onOpenChangePassword={(): void => nav.navigate('ChangePassword')}
      onOpenTokenApprovals={(): void => nav.navigate('TokenApprovals')}
      onOpenConnectedSites={(): void => nav.navigate('ConnectedSites')}
    />
  );
}

/** KYC wrapper. */
function KYCWrapper(): React.ReactElement {
  const nav = useNavigation();
  return <KYCScreen onBack={goBack(nav)} />;
}

/** About wrapper. */
function AboutWrapper(): React.ReactElement {
  const nav = useNavigation();
  return <AboutScreen onBack={goBack(nav)} />;
}

/** Change-password wrapper. */
function ChangePasswordWrapper(): React.ReactElement {
  const nav = useNavigation<NavigationProp<ProfileStackParamList & RootStackParamList>>();
  const clearAuth = useAuthStore((s) => s.clear);
  return (
    <ChangePasswordScreen
      onBack={goBack(nav)}
      onSignOutAndStartOver={(): void => {
        clearAuth();
        nav.reset({ index: 0, routes: [{ name: 'Onboarding' as never }] });
      }}
    />
  );
}

/** Token-approvals wrapper. */
function TokenApprovalsWrapper(): React.ReactElement {
  const nav = useNavigation();
  const mnemonic = useAuthStore((s) => s.mnemonic);
  return <TokenApprovalsScreen mnemonic={mnemonic} onBack={goBack(nav)} />;
}

/** Connected-sites wrapper. */
function ConnectedSitesWrapper(): React.ReactElement {
  const nav = useNavigation();
  return <ConnectedSitesScreen onBack={goBack(nav)} />;
}

/** Hardware-wallet hub. */
function HardwareWrapper(): React.ReactElement {
  const nav = useNavigation<NavigationProp<ProfileStackParamList>>();
  return (
    <HardwareWalletScreen
      onBack={goBack(nav)}
      onOpenTrezor={(): void => nav.navigate('TrezorWebView')}
    />
  );
}

/** Trezor WebView wrapper. */
function TrezorWebViewWrapper(): React.ReactElement {
  const nav = useNavigation();
  return <TrezorWebViewScreen onBack={goBack(nav)} />;
}

/** Participation-score wrapper. */
function ParticipationScoreWrapper(): React.ReactElement {
  const nav = useNavigation();
  return <ParticipationScoreScreen onBack={goBack(nav)} />;
}

/** Staking-calculator wrapper. */
function StakingCalculatorWrapper(): React.ReactElement {
  const nav = useNavigation();
  return <StakingCalculatorScreen onBack={goBack(nav)} />;
}

/** Referral wrapper. */
function ReferralWrapper(): React.ReactElement {
  const nav = useNavigation();
  return <ReferralScreen onBack={goBack(nav)} />;
}

/** Notifications wrapper. */
function NotificationsWrapper(): React.ReactElement {
  const nav = useNavigation();
  return <NotificationsScreen onBack={goBack(nav)} />;
}

/**
 * Build the Profile-tab stack.
 *
 * @returns Profile stack navigator.
 */
export default function ProfileStack(): React.ReactElement {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="ProfileHome" component={ProfileHomeWrapper} />
      <Stack.Screen name="Settings" component={SettingsWrapper} />
      <Stack.Screen name="KYC" component={KYCWrapper} />
      <Stack.Screen name="About" component={AboutWrapper} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordWrapper} />
      <Stack.Screen name="TokenApprovals" component={TokenApprovalsWrapper} />
      <Stack.Screen name="ConnectedSites" component={ConnectedSitesWrapper} />
      <Stack.Screen name="Hardware" component={HardwareWrapper} />
      <Stack.Screen name="TrezorWebView" component={TrezorWebViewWrapper} />
      <Stack.Screen name="ParticipationScore" component={ParticipationScoreWrapper} />
      <Stack.Screen name="StakingCalculator" component={StakingCalculatorWrapper} />
      <Stack.Screen name="Referrals" component={ReferralWrapper} />
      <Stack.Screen
        name="EarningsHistory"
        component={ComingSoonScreen}
        initialParams={{ feature: 'Earnings History', sprint: 'Sprint 3 polish' }}
      />
      <Stack.Screen name="Notifications" component={NotificationsWrapper} />
      <Stack.Screen
        name="Governance"
        component={ComingSoonScreen}
        initialParams={{ feature: 'Governance', sprint: 'post-hard-launch (FF-gated)' }}
      />
    </Stack.Navigator>
  );
}
