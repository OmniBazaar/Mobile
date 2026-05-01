/**
 * Shop tab — 5 marketplaces (P2P / NFT / RWA / Yield / Predictions).
 *
 * Currently the shell `MarketplaceHomeScreen` owns sub-tab + listing-detail
 * routing internally (it pushes its own state for selected listings).
 * Wrapping it in a stack lets us add CreateListing / MyListings as
 * separate routes for Sprint 2 H6 without rewriting the shell.
 *
 * @module navigation/stacks/ShopStack
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import type { ShopStackParamList, RootStackParamList } from '../types';
import { useAuthStore } from '../../store/authStore';

import MarketplaceHomeScreen from '../../screens/MarketplaceHomeScreen';
import { ComingSoonScreen } from '../shared/ComingSoonScreen';

const Stack = createNativeStackNavigator<ShopStackParamList>();

/** Marketplace home wrapper. */
function MarketplaceHomeWrapper(): React.ReactElement {
  const nav = useNavigation<NavigationProp<ShopStackParamList & RootStackParamList>>();
  const mnemonic = useAuthStore((s) => s.mnemonic);
  return (
    <MarketplaceHomeScreen
      onBack={(): void => nav.navigate('MainTabs', { screen: 'Wallet' })}
      onOpenSwap={(): void => nav.navigate('MainTabs', { screen: 'Trade', params: { screen: 'Swap' } })}
      mnemonic={mnemonic}
    />
  );
}

/**
 * Build the Shop-tab stack.
 *
 * @returns Shop stack navigator.
 */
export default function ShopStack(): React.ReactElement {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="MarketplaceHome" component={MarketplaceHomeWrapper} />
      <Stack.Screen
        name="P2PListingDetail"
        component={ComingSoonScreen}
        initialParams={{ feature: 'P2P Listing (deep-link)', sprint: 'Sprint 2 H6' }}
      />
      <Stack.Screen
        name="CreateListing"
        component={ComingSoonScreen}
        initialParams={{ feature: 'Create P2P Listing', sprint: 'Sprint 2 H6' }}
      />
      <Stack.Screen
        name="MyListings"
        component={ComingSoonScreen}
        initialParams={{ feature: 'My Listings', sprint: 'Sprint 2 H6' }}
      />
      <Stack.Screen
        name="NFTDetail"
        component={ComingSoonScreen}
        initialParams={{ feature: 'NFT Detail (deep-link)', sprint: 'Sprint 2 H6' }}
      />
      <Stack.Screen
        name="PredictionDetail"
        component={ComingSoonScreen}
        initialParams={{ feature: 'Prediction Market Detail (deep-link)', sprint: 'Sprint 2 H6' }}
      />
    </Stack.Navigator>
  );
}
