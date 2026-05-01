/**
 * Wallet tab — native stack containing the portfolio home + Send/Receive
 * + per-asset detail + transaction history + NFT gallery + escrows +
 * staking + address book.
 *
 * Each `Wrapper` translates the existing screen's prop signature
 * (`{ onBack, onSend, … mnemonic }`) to react-navigation's
 * `navigation.navigate()` so we don't have to rewrite every screen.
 *
 * @module navigation/stacks/WalletStack
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import type { WalletStackParamList, RootStackParamList } from '../types';
import { useAuthStore } from '../../store/authStore';

import WalletHomeScreen from '../../screens/WalletHomeScreen';
import SendScreen from '../../screens/SendScreen';
import ReceiveScreen from '../../screens/ReceiveScreen';
import TxHistoryScreen from '../../screens/TxHistoryScreen';
import OwnedNFTsScreen from '../../screens/OwnedNFTsScreen';
import EscrowsScreen from '../../screens/EscrowsScreen';
import PredictionPositionsScreen from '../../screens/PredictionPositionsScreen';
import StakingScreen from '../../screens/StakingScreen';
import { ComingSoonScreen } from '../shared/ComingSoonScreen';

const Stack = createNativeStackNavigator<WalletStackParamList>();

/** Translate `navigation.goBack()` into the `onBack` callback shape. */
function goBack(nav: { goBack: () => void }): () => void {
  return (): void => nav.goBack();
}

/** Wallet home wrapper — translates the action callbacks into nav. */
function WalletHomeWrapper(): React.ReactElement {
  const nav = useNavigation<NavigationProp<WalletStackParamList & RootStackParamList>>();
  const clearAuth = useAuthStore((s) => s.clear);
  return (
    <WalletHomeScreen
      onSend={(): void => nav.navigate('Send')}
      onReceive={(): void => nav.navigate('Receive')}
      onSwap={(): void => nav.navigate('MainTabs', { screen: 'Trade', params: { screen: 'Swap' } })}
      onShop={(): void => nav.navigate('MainTabs', { screen: 'Shop' })}
      onProfile={(): void => nav.navigate('MainTabs', { screen: 'Profile' })}
      onSignOut={(): void => {
        clearAuth();
        nav.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
      }}
    />
  );
}

/** Send screen wrapper. */
function SendWrapper(): React.ReactElement {
  const nav = useNavigation();
  const mnemonic = useAuthStore((s) => s.mnemonic);
  return (
    <SendScreen
      mnemonic={mnemonic}
      onBack={goBack(nav)}
      onSent={goBack(nav)}
    />
  );
}

/** Receive screen wrapper. */
function ReceiveWrapper(): React.ReactElement {
  const nav = useNavigation();
  return <ReceiveScreen onBack={goBack(nav)} />;
}

/** Tx history wrapper. */
function TxHistoryWrapper(): React.ReactElement {
  const nav = useNavigation();
  return <TxHistoryScreen onBack={goBack(nav)} />;
}

/** Owned NFTs wrapper. */
function OwnedNFTsWrapper(): React.ReactElement {
  const nav = useNavigation();
  const mnemonic = useAuthStore((s) => s.mnemonic);
  return <OwnedNFTsScreen onBack={goBack(nav)} mnemonic={mnemonic} />;
}

/** Escrows wrapper. */
function EscrowsWrapper(): React.ReactElement {
  const nav = useNavigation();
  const mnemonic = useAuthStore((s) => s.mnemonic);
  return <EscrowsScreen onBack={goBack(nav)} mnemonic={mnemonic} />;
}

/** Prediction positions wrapper. */
function PredictionPositionsWrapper(): React.ReactElement {
  const nav = useNavigation();
  const mnemonic = useAuthStore((s) => s.mnemonic);
  return <PredictionPositionsScreen onBack={goBack(nav)} mnemonic={mnemonic} />;
}

/** Staking wrapper. */
function StakingWrapper(): React.ReactElement {
  const nav = useNavigation();
  const mnemonic = useAuthStore((s) => s.mnemonic);
  return <StakingScreen onBack={goBack(nav)} mnemonic={mnemonic} />;
}

/**
 * Build the Wallet-tab stack.
 *
 * @returns Wallet stack navigator.
 */
export default function WalletStack(): React.ReactElement {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="WalletHome" component={WalletHomeWrapper} />
      <Stack.Screen name="Send" component={SendWrapper} />
      <Stack.Screen name="Receive" component={ReceiveWrapper} />
      <Stack.Screen
        name="TokenDetail"
        component={ComingSoonScreen}
        initialParams={{ feature: 'Token Detail', sprint: 'Sprint 2 H5' }}
      />
      <Stack.Screen name="TxHistory" component={TxHistoryWrapper} />
      <Stack.Screen name="OwnedNFTs" component={OwnedNFTsWrapper} />
      <Stack.Screen name="Escrows" component={EscrowsWrapper} />
      <Stack.Screen name="PredictionPositions" component={PredictionPositionsWrapper} />
      <Stack.Screen name="Staking" component={StakingWrapper} />
      <Stack.Screen
        name="AddressBook"
        component={ComingSoonScreen}
        initialParams={{ feature: 'Address Book', sprint: 'Sprint 2 B9' }}
      />
    </Stack.Navigator>
  );
}
