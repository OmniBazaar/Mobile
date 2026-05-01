/**
 * React-navigation deep-link config.
 *
 * Exposes the URL → screen map for `omnibazaar://` and the
 * `https://app.omnibazaar.com` universal-link domain (Sprint 6 wires
 * the `apple-app-site-association` + `assetlinks.json` files; the URL
 * shape is final now so the platform can ingest links the moment those
 * land).
 *
 * Top-level patterns:
 *   omnibazaar://wallet                 → Wallet → WalletHome
 *   omnibazaar://wallet/send?to=…       → Wallet → Send (params copied)
 *   omnibazaar://shop/p2p               → Shop → MarketplaceHome (P2P sub-tab)
 *   omnibazaar://shop/listing/:id       → Shop → P2PListingDetail
 *   omnibazaar://shop/nft               → Shop → MarketplaceHome (NFT)
 *   omnibazaar://trade/swap             → Trade → Swap
 *   omnibazaar://trade/limit            → Trade → Limit
 *   omnibazaar://trade/bridge           → Trade → Bridge (Sprint 2)
 *   omnibazaar://chat                   → Chat → Conversations
 *   omnibazaar://chat/room/:roomId      → Chat → ChatRoom
 *   omnibazaar://profile                → Profile → ProfileHome
 *   omnibazaar://profile/kyc            → Profile → KYC
 *   omnibazaar://profile/staking        → Wallet → Staking (lives in Wallet)
 *   omnibazaar://wc?uri=…               → Sprint 2 (WalletConnect pairing)
 *
 * @module navigation/linking
 */

import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';

import type { RootStackParamList } from './types';

/** Build the linking-config object. */
export function createLinking(): LinkingOptions<RootStackParamList> {
  return {
    prefixes: [
      Linking.createURL('/'),
      'omnibazaar://',
      'https://app.omnibazaar.com',
    ],
    config: {
      screens: {
        Onboarding: {
          screens: {
            Welcome: 'welcome',
            SignIn: 'sign-in',
            Create: 'create',
            ForgotPassword: 'forgot-password',
          },
        },
        MainTabs: {
          screens: {
            Shop: {
              screens: {
                MarketplaceHome: 'shop/:kind?',
                P2PListingDetail: 'shop/listing/:listingId',
                NFTDetail: 'shop/nft/:collectionAddress/:tokenId?',
                PredictionDetail: 'shop/predictions/:marketId',
                CreateListing: 'shop/create',
                MyListings: 'shop/mine',
              },
            },
            Trade: {
              screens: {
                Swap: 'trade/swap',
                Limit: 'trade/limit',
                Liquidity: 'trade/liquidity',
                Yield: 'trade/yield',
                RWA: 'trade/rwa',
                Privacy: 'trade/privacy',
                Bridge: 'trade/bridge',
              },
            },
            Wallet: {
              screens: {
                WalletHome: 'wallet',
                Send: 'wallet/send',
                Receive: 'wallet/receive',
                TokenDetail: 'wallet/token/:chainId/:contract?',
                TxHistory: 'wallet/history',
                OwnedNFTs: 'wallet/nfts',
                Escrows: 'wallet/escrows',
                PredictionPositions: 'wallet/predictions',
                Staking: 'wallet/staking',
                AddressBook: 'wallet/contacts',
              },
            },
            Chat: {
              screens: {
                Conversations: 'chat',
                ChatRoom: 'chat/room/:roomId',
              },
            },
            Profile: {
              screens: {
                ProfileHome: 'profile',
                Settings: 'profile/settings',
                KYC: 'profile/kyc',
                About: 'profile/about',
                ChangePassword: 'profile/change-password',
                TokenApprovals: 'profile/approvals',
                ConnectedSites: 'profile/sites',
                Hardware: 'profile/hardware',
                ParticipationScore: 'profile/score',
                StakingCalculator: 'profile/calculator',
                EarningsHistory: 'profile/earnings',
                Notifications: 'profile/notifications',
                Governance: 'profile/governance',
              },
            },
          },
        },
        AuthPrompt: 'auth-prompt',
      },
    },
  };
}
