/**
 * Shop tab — 5 marketplaces (P2P / NFT / RWA / Yield / Predictions).
 *
 * `MarketplaceHomeScreen` owns the 5-sub-tab shell. CreateListing and
 * MyListings are pushed on top via the stack — they reach Sprint 2 ✅
 * (per MOBILE_REMEDIATION_PLAN H6) wired to the real seller flow.
 *
 * @module navigation/stacks/ShopStack
 */

import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import type { ShopStackParamList, RootStackParamList, AppTabsParamList } from '../types';
import { useAuthStore } from '../../store/authStore';
import { useRequireAuth } from '../../components/RequireAuth';
import { useTranslation } from 'react-i18next';

import MarketplaceHomeScreen from '../../screens/MarketplaceHomeScreen';
import CreateListingScreen from '../../screens/CreateListingScreen';
import MyListingsScreen from '../../screens/MyListingsScreen';
import P2PListingDetailScreen from '../../screens/P2PListingDetailScreen';
import { ComingSoonScreen } from '../shared/ComingSoonScreen';
import type { MarketplaceListing } from '@wallet/services/marketplace/MarketplaceClient';

const Stack = createNativeStackNavigator<ShopStackParamList>();

/**
 * The marketplace home itself owns its 5-tab + listing-detail state in
 * a self-managed switch. We layer create / mine on top via stack.
 */
function MarketplaceHomeWrapper(): React.ReactElement {
  const nav =
    useNavigation<NavigationProp<ShopStackParamList & AppTabsParamList & RootStackParamList>>();
  const mnemonic = useAuthStore((s) => s.mnemonic);
  const requireAuth = useRequireAuth();
  const { t } = useTranslation();
  return (
    <MarketplaceHomeScreen
      onBack={(): void => nav.navigate('MainTabs', { screen: 'Wallet' })}
      onOpenSwap={(): void => nav.navigate('MainTabs', { screen: 'Trade', params: { screen: 'Swap' } })}
      mnemonic={mnemonic}
      onCreateListing={(): void => {
        requireAuth(
          t('authPrompt.toCreateListing', { defaultValue: 'Sign in to list an item for sale.' }),
          () => nav.navigate('CreateListing'),
        );
      }}
      onOpenMyListings={(): void => {
        requireAuth(
          t('authPrompt.toCreateListing', { defaultValue: 'Sign in to list an item for sale.' }),
          () => nav.navigate('MyListings'),
        );
      }}
    />
  );
}

/** CreateListing wrapper. */
function CreateListingWrapper(): React.ReactElement {
  const nav = useNavigation();
  return (
    <CreateListingScreen
      onBack={(): void => nav.goBack()}
      onListed={(): void => nav.goBack()}
    />
  );
}

/** MyListings wrapper — pushes detail when a row is tapped. */
function MyListingsWrapper(): React.ReactElement {
  const nav = useNavigation<NavigationProp<ShopStackParamList>>();
  const [pendingDetail, setPendingDetail] = useState<MarketplaceListing | undefined>(undefined);
  const buyer = useAuthStore((s) => s.address);
  const mnemonic = useAuthStore((s) => s.mnemonic);
  if (pendingDetail !== undefined) {
    return (
      <P2PListingDetailScreen
        listing={pendingDetail}
        buyer={buyer}
        mnemonic={mnemonic}
        onBack={(): void => setPendingDetail(undefined)}
      />
    );
  }
  return (
    <MyListingsScreen
      onBack={(): void => nav.goBack()}
      onSelect={setPendingDetail}
      onCreate={(): void => nav.navigate('CreateListing')}
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
      <Stack.Screen name="CreateListing" component={CreateListingWrapper} />
      <Stack.Screen name="MyListings" component={MyListingsWrapper} />
      <Stack.Screen
        name="P2PListingDetail"
        component={ComingSoonScreen}
        initialParams={{ feature: 'P2P Listing (deep-link)', sprint: 'Sprint 3 polish' }}
      />
      <Stack.Screen
        name="NFTDetail"
        component={ComingSoonScreen}
        initialParams={{ feature: 'NFT Detail (deep-link)', sprint: 'Sprint 3 polish' }}
      />
      <Stack.Screen
        name="PredictionDetail"
        component={ComingSoonScreen}
        initialParams={{ feature: 'Prediction Market Detail (deep-link)', sprint: 'Sprint 3 polish' }}
      />
    </Stack.Navigator>
  );
}
