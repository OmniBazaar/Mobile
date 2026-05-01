/**
 * React-navigation route param maps for the Mobile app.
 *
 * Three layers:
 *   1. RootStack — the top-level: onboarding screens (pre-auth) +
 *      "MainTabs" (post-auth) + global modals (HardwareSign, etc.).
 *   2. Per-tab native-stack: ShopStack, TradeStack, WalletStack,
 *      ChatStack, ProfileStack.
 *   3. Inside each stack, screens that need params get them typed here.
 *
 * Strict typing on screen props is enforced via `RouteProp` /
 * `NativeStackScreenProps` at consumption sites — this is the source of
 * truth those types reference.
 *
 * Adding a screen:
 *   1. Add its route name + params to the matching ParamList below.
 *   2. Add it to AppTabs.tsx (or the relevant Stack file).
 *   3. Use `RootStackScreenProps<'X'>` in the screen wrapper.
 *
 * @module navigation/types
 */

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

/* eslint-disable @typescript-eslint/no-empty-interface */

/** Pre-auth onboarding stack (Welcome → Create / SignIn / EmailVerify / Forgot). */
export type OnboardingStackParamList = {
  Welcome: undefined;
  Create: undefined;
  EmailVerify: { email: string };
  SignIn: undefined;
  ForgotPassword: undefined;
};

/** Shop tab — marketplaces. */
export type ShopStackParamList = {
  MarketplaceHome: { kind?: 'p2p' | 'nft' | 'rwa' | 'yield' | 'predictions' } | undefined;
  P2PListingDetail: { listingId: string };
  CreateListing: undefined;
  MyListings: undefined;
  NFTDetail: { collectionAddress: string; tokenId?: string };
  PredictionDetail: { marketId: string };
};

/** Trade tab — DEX. */
export type TradeStackParamList = {
  Swap: undefined;
  Limit: undefined;
  Liquidity: undefined;
  Yield: undefined;
  RWA: undefined;
  Privacy: undefined;
  Bridge: undefined;
};

/** Wallet tab — portfolio + send/receive + per-asset detail. */
export type WalletStackParamList = {
  WalletHome: undefined;
  Send: { to?: string; amount?: string; chainId?: number } | undefined;
  Receive: undefined;
  TokenDetail: { chainId: number; contract?: string; symbol: string };
  TxHistory: undefined;
  OwnedNFTs: undefined;
  Escrows: undefined;
  PredictionPositions: undefined;
  Staking: undefined;
  AddressBook: undefined;
};

/** Chat tab — conversations + room. */
export type ChatStackParamList = {
  Conversations: undefined;
  ChatRoom: { roomId: string; counterpartyAddress?: string };
};

/** Profile tab — settings + KYC + score + about. */
export type ProfileStackParamList = {
  ProfileHome: undefined;
  Settings: undefined;
  KYC: undefined;
  About: undefined;
  ChangePassword: undefined;
  TokenApprovals: undefined;
  ConnectedSites: undefined;
  Hardware: undefined;
  TrezorWebView: undefined;
  ParticipationScore: undefined;
  StakingCalculator: undefined;
  EarningsHistory: undefined;
  Notifications: undefined;
  Governance: undefined;
};

/** Bottom-tab routes. */
export type AppTabsParamList = {
  Shop: NavigatorScreenParams<ShopStackParamList>;
  Trade: NavigatorScreenParams<TradeStackParamList>;
  Wallet: NavigatorScreenParams<WalletStackParamList>;
  Chat: NavigatorScreenParams<ChatStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

/** Root stack — all onboarding + tabs + modals (e.g. hardware-sign sheet). */
export type RootStackParamList = {
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  MainTabs: NavigatorScreenParams<AppTabsParamList>;
  HardwareSign: { requestId: string };
  AuthPrompt: { reason: string; intendedRoute?: string } | undefined;
};

/* ----- Screen prop helpers ---------------------------------------------- */

/** Onboarding stack screen props. */
export type OnboardingStackScreenProps<R extends keyof OnboardingStackParamList> =
  NativeStackScreenProps<OnboardingStackParamList, R>;

/** Root stack screen props (composite when nested in tabs). */
export type RootStackScreenProps<R extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  R
>;

/** Shop stack screen props composed with the Tabs nav. */
export type ShopStackScreenProps<R extends keyof ShopStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<ShopStackParamList, R>,
  BottomTabScreenProps<AppTabsParamList, 'Shop'>
>;

/** Trade stack screen props composed with the Tabs nav. */
export type TradeStackScreenProps<R extends keyof TradeStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<TradeStackParamList, R>,
  BottomTabScreenProps<AppTabsParamList, 'Trade'>
>;

/** Wallet stack screen props composed with the Tabs nav. */
export type WalletStackScreenProps<R extends keyof WalletStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<WalletStackParamList, R>,
  BottomTabScreenProps<AppTabsParamList, 'Wallet'>
>;

/** Chat stack screen props composed with the Tabs nav. */
export type ChatStackScreenProps<R extends keyof ChatStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<ChatStackParamList, R>,
  BottomTabScreenProps<AppTabsParamList, 'Chat'>
>;

/** Profile stack screen props composed with the Tabs nav. */
export type ProfileStackScreenProps<R extends keyof ProfileStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<ProfileStackParamList, R>,
  BottomTabScreenProps<AppTabsParamList, 'Profile'>
>;
