/**
 * AppTabs — the canonical 5-tab bottom bar for the post-auth experience.
 *
 * Tabs (in left-to-right order, matching ADD_MOBILE_APP.md Part 10):
 *
 *   Shop   (storefront icon)  → 5 marketplaces
 *   Trade  (line-chart icon)  → DEX swap + sub-routes
 *   Wallet (wallet icon)      → portfolio home + send/receive + assets
 *   Chat   (message icon)     → conversations + room (+ unread badge)
 *   Profile(person icon)      → settings + KYC + score + about
 *
 * Each tab owns its own native-stack navigator, so per-tab navigation
 * state is preserved when switching between tabs (the iOS gold
 * standard).
 *
 * Haptics + a11y labels are applied per-tab. The chat unread badge is
 * driven by `useChatUnread()` (lands in Sprint 2 B5; for Sprint 1 the
 * hook returns 0 so the badge is hidden).
 *
 * @module navigation/AppTabs
 */

import React from 'react';
import { Platform } from 'react-native';
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import type { AppTabsParamList } from './types';
import { colors } from '@theme/colors';
import { useChatUnread } from '../hooks/useChatUnread';

import ShopStack from './stacks/ShopStack';
import TradeStack from './stacks/TradeStack';
import WalletStack from './stacks/WalletStack';
import ChatStack from './stacks/ChatStack';
import ProfileStack from './stacks/ProfileStack';

const Tab = createBottomTabNavigator<AppTabsParamList>();

/** Trigger a light haptic on every tab press. iOS-only (Android lacks it). */
function tapHaptic(): void {
  if (Platform.OS === 'ios') {
    void Haptics.selectionAsync();
  }
}

/**
 * Build the icon component for a given tab. We pick filled vs outline
 * based on `focused` to match the Phantom / Trust Wallet conventions.
 *
 * @param name - Filled icon name.
 * @param outline - Outline icon name.
 * @returns A function react-navigation calls per render.
 */
function iconFor(
  name: React.ComponentProps<typeof Ionicons>['name'],
  outline: React.ComponentProps<typeof Ionicons>['name'],
): NonNullable<BottomTabNavigationOptions['tabBarIcon']> {
  return ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
    <Ionicons name={focused ? name : outline} color={color} size={size} />
  );
}

/**
 * Render the 5-tab bottom navigator.
 *
 * @returns JSX.
 */
export default function AppTabs(): React.ReactElement {
  const { t } = useTranslation();
  const unreadChats = useChatUnread();
  return (
    <Tab.Navigator
      initialRouteName="Wallet"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderSoft,
          borderTopWidth: 1,
          paddingTop: 4,
          height: Platform.OS === 'ios' ? 84 : 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
      screenListeners={{
        tabPress: tapHaptic,
      }}
    >
      <Tab.Screen
        name="Shop"
        component={ShopStack}
        options={{
          tabBarLabel: t('tabs.shop', { defaultValue: 'Shop' }),
          tabBarAccessibilityLabel: t('tabs.shopA11y', { defaultValue: 'Shop tab — browse marketplaces' }),
          tabBarIcon: iconFor('storefront', 'storefront-outline'),
        }}
      />
      <Tab.Screen
        name="Trade"
        component={TradeStack}
        options={{
          tabBarLabel: t('tabs.trade', { defaultValue: 'Trade' }),
          tabBarAccessibilityLabel: t('tabs.tradeA11y', { defaultValue: 'Trade tab — DEX, swap, liquidity' }),
          tabBarIcon: iconFor('analytics', 'analytics-outline'),
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletStack}
        options={{
          tabBarLabel: t('tabs.wallet', { defaultValue: 'Wallet' }),
          tabBarAccessibilityLabel: t('tabs.walletA11y', { defaultValue: 'Wallet tab — portfolio and assets' }),
          tabBarIcon: iconFor('wallet', 'wallet-outline'),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatStack}
        options={{
          tabBarLabel: t('tabs.chat', { defaultValue: 'Chat' }),
          tabBarAccessibilityLabel: t('tabs.chatA11y', { defaultValue: 'Chat tab — conversations with sellers' }),
          tabBarIcon: iconFor('chatbubble', 'chatbubble-outline'),
          ...(unreadChats > 0 && { tabBarBadge: unreadChats }),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarLabel: t('tabs.profile', { defaultValue: 'Profile' }),
          tabBarAccessibilityLabel: t('tabs.profileA11y', { defaultValue: 'Profile tab — account, KYC, settings' }),
          tabBarIcon: iconFor('person-circle', 'person-circle-outline'),
        }}
      />
    </Tab.Navigator>
  );
}
