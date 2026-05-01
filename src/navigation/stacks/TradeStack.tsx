/**
 * Trade tab — DEX swap + limit + LP + yield + RWA + privacy + bridge.
 *
 * @module navigation/stacks/TradeStack
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import type { TradeStackParamList } from '../types';
import { useAuthStore } from '../../store/authStore';

import SwapScreen from '../../screens/SwapScreen';
import LimitOrderScreen from '../../screens/LimitOrderScreen';
import LiquidityScreen from '../../screens/LiquidityScreen';
import YieldScreen from '../../screens/YieldScreen';
import RWAMarketplaceScreen from '../../screens/RWAMarketplaceScreen';
import PrivacyScreen from '../../screens/PrivacyScreen';
import { ComingSoonScreen } from '../shared/ComingSoonScreen';

const Stack = createNativeStackNavigator<TradeStackParamList>();

/** Translate `navigation.goBack()` into the `onBack` callback shape. */
function goBack(nav: { goBack: () => void }): () => void {
  return (): void => nav.goBack();
}

/** Swap wrapper — Trade tab home. */
function SwapWrapper(): React.ReactElement {
  const nav = useNavigation<NavigationProp<TradeStackParamList>>();
  const mnemonic = useAuthStore((s) => s.mnemonic);
  return (
    <SwapScreen
      onBack={goBack(nav)}
      onOpenPrivacy={(): void => nav.navigate('Privacy')}
      onOpenLimit={(): void => nav.navigate('Limit')}
      onOpenLiquidity={(): void => nav.navigate('Liquidity')}
      onOpenYield={(): void => nav.navigate('Yield')}
      mnemonic={mnemonic}
    />
  );
}

/** Limit-order wrapper. */
function LimitWrapper(): React.ReactElement {
  const nav = useNavigation();
  return <LimitOrderScreen onBack={goBack(nav)} />;
}

/** Liquidity wrapper. */
function LiquidityWrapper(): React.ReactElement {
  const nav = useNavigation();
  return <LiquidityScreen onBack={goBack(nav)} />;
}

/** Yield wrapper. */
function YieldWrapper(): React.ReactElement {
  const nav = useNavigation();
  return <YieldScreen onBack={goBack(nav)} />;
}

/** RWA wrapper — TradeStack version routes "Trade" back to the Swap screen. */
function RWAWrapper(): React.ReactElement {
  const nav = useNavigation<NavigationProp<TradeStackParamList>>();
  return <RWAMarketplaceScreen onBack={goBack(nav)} onTrade={(): void => nav.navigate('Swap')} />;
}

/** Privacy wrapper. */
function PrivacyWrapper(): React.ReactElement {
  const nav = useNavigation();
  return <PrivacyScreen onBack={goBack(nav)} />;
}

/**
 * Build the Trade-tab stack.
 *
 * @returns Trade stack navigator.
 */
export default function TradeStack(): React.ReactElement {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="Swap" component={SwapWrapper} />
      <Stack.Screen name="Limit" component={LimitWrapper} />
      <Stack.Screen name="Liquidity" component={LiquidityWrapper} />
      <Stack.Screen name="Yield" component={YieldWrapper} />
      <Stack.Screen name="RWA" component={RWAWrapper} />
      <Stack.Screen name="Privacy" component={PrivacyWrapper} />
      <Stack.Screen
        name="Bridge"
        component={ComingSoonScreen}
        initialParams={{ feature: 'Bridge', sprint: 'Sprint 2 B6' }}
      />
    </Stack.Navigator>
  );
}
