/**
 * OmniCoin Integration Configuration
 *
 * CANONICAL FILE — shared across Validator, WebApp, and Wallet modules.
 *
 * This file is AUTO-UPDATED by scripts/sync-contract-addresses.js
 * which reads Coin/deployments/*.json and patches addresses in place,
 * then copies this file verbatim to WebApp and Wallet.
 *
 * DO NOT edit WebApp/src/config/omnicoin-integration.ts or
 * Wallet/src/config/omnicoin-integration.ts directly — they are
 * overwritten by the sync script.
 */

import { JsonRpcProvider } from 'ethers';

/**
 * Contract addresses for OmniCoin ecosystem
 */
export interface ContractAddresses {
  /** RPC URL for the network */
  rpcUrl: string;
  /** Avalanche Subnet ID (for avalanchego track-subnets config) */
  subnetId: string;
  /** Avalanche Blockchain ID (for RPC URL construction) */
  blockchainId: string;
  /** Chain ID for EVM transactions */
  chainId: number;
  /** OmniCoin ERC20 token contract address */
  OmniCoin: string;
  /** OmniCore main contract address */
  OmniCore: string;
  /** OmniGovernance DAO contract address */
  OmniGovernance: string;
  /** OmniBridge cross-chain bridge contract address */
  OmniBridge: string;
  /** PrivateOmniCoin privacy token contract address */
  PrivateOmniCoin: string;
  /** PrivateDEX privacy DEX contract address (COTI only) */
  PrivateDEX?: string;
  /** PrivateDEXSettlement bilateral privacy settlement contract (COTI only) */
  PrivateDEXSettlement?: string;
  /** PrivateUSDC privacy-wrapped USDC contract (COTI only) */
  PrivateUSDC?: string;
  /** PrivateWETH privacy-wrapped WETH contract (COTI only) */
  PrivateWETH?: string;
  /** PrivateWBTC privacy-wrapped WBTC contract (COTI only) */
  PrivateWBTC?: string;
  /** MinimalEscrow marketplace escrow contract address */
  MinimalEscrow: string;
  /** LegacyBalanceClaim legacy migration contract address */
  LegacyBalanceClaim: string;
  /** OmniRewardManager reward pool contract address (UUPS proxy) */
  OmniRewardManager?: string;
  /** OmniRegistration user registration contract address (UUPS proxy) */
  OmniRegistration?: string;
  /** OmniSybilGuard Sybil attack prevention contract address (UUPS proxy) */
  OmniSybilGuard?: string;
  /** OmniParticipation trustless participation scoring contract address (UUPS proxy) */
  OmniParticipation?: string;
  /** OmniValidatorRewards trustless validator rewards contract address (UUPS proxy) */
  OmniValidatorRewards?: string;
  /** RWA Compliance Oracle contract address */
  RWAComplianceOracle?: string;
  /** RWA AMM contract address (intentionally non-upgradeable) */
  RWAAMM?: string;
  /** RWA Router contract address */
  RWARouter?: string;
  /** LiquidityBootstrappingPool contract address for initial token distribution */
  LiquidityBootstrappingPool?: string;
  /** OmniBonding contract address for Protocol Owned Liquidity */
  OmniBonding?: string;
  /** LiquidityMining contract address for LP staking rewards */
  LiquidityMining?: string;
  /** DEXSettlement contract address for trustless trade settlement */
  DEXSettlement?: string;
  /** VolumeDiscountOracle contract for volume-based taker fee discounts */
  VolumeDiscountOracle?: string;
  /** CLOBAdapter contract for CLOB routing through OmniSwapRouter */
  CLOBAdapter?: string;
  /** OmniSwapRouter contract address for optimal swap routing */
  OmniSwapRouter?: string;
  /** TestUSDC contract address for testnet liquidity (6 decimals) */
  TestUSDC?: string;
  /** StakingRewardPool trustless on-chain staking reward pool (UUPS proxy) */
  StakingRewardPool?: string;
  /** OmniNFTFactory contract address for deploying NFT collection clones */
  OmniNFTFactory?: string;
  /** OmniNFTCollection implementation contract address (ERC-1167 clone source) */
  OmniNFTCollection?: string;
  /** OmniNFTRoyalty standalone royalty registry for non-OmniNFT collections */
  OmniNFTRoyalty?: string;
  /** OmniFractionalNFT fractionalization vault contract address */
  OmniFractionalNFT?: string;
  /** OmniNFTLending P2P NFT lending contract address */
  OmniNFTLending?: string;
  /** OmniNFTStaking NFT staking pools contract address */
  OmniNFTStaking?: string;
  /** OmniFeeRouter fee-collecting wrapper for external DEX swaps */
  OmniFeeRouter?: string;
  /** OmniYieldFeeCollector yield performance fee collector contract address */
  OmniYieldFeeCollector?: string;
  /** OmniEntryPoint ERC-4337 entry point singleton */
  OmniEntryPoint?: string;
  /** OmniAccountFactory ERC-4337 smart account factory */
  OmniAccountFactory?: string;
  /** OmniPaymaster gas sponsorship in XOM */
  OmniPaymaster?: string;
  /** OmniPredictionRouter prediction market fee-collecting router */
  OmniPredictionRouter?: string;
  /** ReputationCredential soulbound reputation NFT */
  ReputationCredential?: string;
  /** RWAPool constant-product AMM for RWA tokens */
  RWAPool?: string;
  /** UpdateRegistry on-chain release approval registry (ODDAO multi-sig) */
  UpdateRegistry?: string;
  /** UnifiedFeeVault fee aggregation and 70/20/10 distribution vault (UUPS proxy) */
  UnifiedFeeVault?: string;
  /** OmniTreasury protocol treasury with AccessControl governance */
  OmniTreasury?: string;
  /** FeeSwapAdapter contract for token→XOM fee swaps before bridging */
  FeeSwapAdapter?: string;
  /** OmniPrivacyBridge privacy-preserving cross-chain bridge via COTI */
  OmniPrivacyBridge?: string;
  /** OmniPriceOracle trustless multi-validator price consensus (UUPS proxy) */
  OmniPriceOracle?: string;
  /** OmniArbitration trustless on-chain dispute resolution (UUPS proxy) */
  OmniArbitration?: string;
  /** OmniMarketplace trustless listing registration and content verification (UUPS proxy) */
  OmniMarketplace?: string;
  /** OmniENS trustless username registry with XOM fee burn */
  OmniENS?: string;
  /** OmniChatFee trustless chat fee collection with free tier tracking */
  OmniChatFee?: string;
  /** QualificationOracle trustless qualification scoring oracle (UUPS proxy) */
  QualificationOracle?: string;
  /** OmniAccount ERC-4337 smart account implementation */
  OmniAccount?: string;
  /** OmniTimelockController 48h governance timelock (proposer+executor) */
  OmniTimelockController?: string;
  /** EmergencyGuardian 3-of-5 emergency action contract */
  EmergencyGuardian?: string;
  /** ValidatorProvisioner atomic role provisioning across 6+ contracts */
  ValidatorProvisioner?: string;
  /** Bootstrap validator/node discovery registry */
  Bootstrap?: string;
  /** Public RPC URL for external access (distinct from internal rpcUrl) */
  publicRpcUrl?: string;
  /** Block explorer base URL (EIP-3091 compatible) */
  blockExplorerUrl?: string;
  /** OmniForwarder ERC-2771 trusted forwarder for gasless meta-transactions */
  OmniForwarder?: string;
  /** OmniBazaarResolver ENSIP-10 + ERC-3668 wildcard resolver on Ethereum mainnet */
  OmniBazaarResolver?: string;
  /** LiquidityOverflowPool UUPS proxy for LP staking with validator overflow rewards */
  LiquidityOverflowPool?: string;
  /** XOM/USDC LP token on RWAAMM (used for LiquidityOverflowPool staking) */
  XomUsdcPool?: string;
  /** LPZap one-click USDC → LP token conversion (immutable, non-upgradeable) */
  LPZap?: string;
  /** RWAAMMAdapter swap adapter between OmniSwapRouter and RWAAMM */
  RWAAMMAdapter?: string;
  /** ERC20TokenHome ICTT contract on C-Chain (locks USDC for bridging to L1) */
  ERC20TokenHome?: string;
  /** ERC20TokenRemote ICTT contract on L1 (mints bridged USDC from C-Chain) */
  ERC20TokenRemote?: string;
  /** Bridged USDC address on L1 (same as ERC20TokenRemote — the remote IS the token) */
  BridgedUSDC?: string;
  /** TeleporterRegistry on C-Chain (pre-deployed by Ava Labs) */
  TeleporterRegistryCChain?: string;
  /** TeleporterRegistry on L1 (deployed for ICTT infrastructure) */
  TeleporterRegistryL1?: string;
}

/**
 * Canonical matching-validator address embedded in every EIP-712 DEX Order.
 * This is a public label for fee-attribution only — no private key exists
 * for this address. Every client (WebApp, Wallet, iceberg seeder) must use
 * this exact value in the `matchingValidator` field of signed orders.
 */
export const MATCHING_VALIDATOR_ADDRESS = '0x0000000000000000000000000000000000000001';

/**
 * Contract addresses mapped by network name
 * Auto-generated from Coin/deployments/*.json
 */
export const OMNICOIN_ADDRESSES: Record<string, ContractAddresses> = {
  // Local Hardhat network (chainId: 131313) - Points to current Fuji deployment
  // ⚠️  CRITICAL: These addresses MUST match Coin/deployments/localhost.json
  // Last deployed: 2025-11-10 (Fresh L1 deployment)
  // Synchronized by: scripts/sync-contract-addresses.js
  hardhat: {
    rpcUrl: 'http://127.0.0.1:40681/ext/bc/2TEeYGdsqvS3eLBk8vrd9bedJiPR7uyeUo1YChM75HtCf9TzFk/rpc',
    subnetId: 'g9rP3Cirj5jJEukLDYQ72EbsRnpwEeVRL9pdLZqhJq1fivCke',
    blockchainId: '2TEeYGdsqvS3eLBk8vrd9bedJiPR7uyeUo1YChM75HtCf9TzFk',
    chainId: 131313,
    OmniCoin: '0x117defc430E143529a9067A7866A9e7Eb532203C',
    OmniCore: '0x0Ef606683222747738C04b4b00052F5357AC6c8b',
    OmniGovernance: '0x0000000000000000000000000000000000000000',
    OmniBridge: '0x0000000000000000000000000000000000000000',
    PrivateOmniCoin: '0x09F99AE44bd024fD2c16ff6999959d053f0f32B5',
    MinimalEscrow: '0xa0aF1B47C6B4c56E776c8c920dB677E394060bDD',
    LegacyBalanceClaim: '0x1201b2f0e94B8722792FC4F515E64133c122CD39',
    OmniRewardManager: '0xE2e1b926AE798647DDfD7E5A95862C6C2E3C6F67',
    OmniRegistration: '0x0E4E697317117B150481a827f1e5029864aAe781',
    OmniSybilGuard: '0xe6E7fA5FA18F06686df1603B63eCff8683F118B0',
    OmniParticipation: '0x500436A6bd54A0C5260F961ff5941dDa1549b658',
    OmniValidatorRewards: '0x6136A40Ea03586aCA976FA2bbe9deC072EA75869',
    RWAComplianceOracle: '0xF6acBc80dd1Ba20F9e4e90e1A6fe145536C60bb5',
    RWAAMM: '0xb287f8CE22748a4b3f0fB570bc7FF7B67161cB8f',
    RWARouter: '0x88fF08e10ab7004ab375AD9e5201Ecad67865be2',
    LiquidityBootstrappingPool: '0x5C032b6F109B9d2f2Cf86A0fB70b7A419EeBA408',
    OmniBonding: '0x1F976D7F01a31Fd6A1afd3508BfC562D778404Dd',
    LiquidityMining: '0xCD2f28E7630d55aC1b10530c5EBA1564a84E4511',
    DEXSettlement: '0xa1Fa0D36586859399b0e6c6E639A50063bBAa2Ce',
    OmniSwapRouter: '0x0DCef11B5aaBf8CeAd12Ea4BE2eC1fAb7Efa586B',
    TestUSDC: '0xFC866508bb2720054F9e346B286A08E7143423A7',
    StakingRewardPool: '0x1A12040129c47B92fd10083d4969Fb392a9554Af',
    OmniNFTCollection: '0x9FDeB42834Cbe4C83DEe2F318AAAB3C6EDf6C8B0',
    OmniNFTFactory: '0x13DFA910fD8D2d061e95C875F737bE89FF073475',
    OmniNFTRoyalty: '0x951706B3590728F648FEC362DBEAE9b0cb60b3ed',
    OmniNFTLending: '0x2bc4165812b8f3028a4a2E52b2D4C67fE4DF675A',
    OmniFractionalNFT: '0x9A59E976c6a9dC08062268e69467E431Eef554fC',
    OmniNFTStaking: '0xD5AD7beD2Db6E05925b68a19CA645A3333726380',
    OmniEntryPoint: '0xDc3d2d1fC7d2354a56Ae9EF78bF4fB2A2c2712C4',
    OmniAccountFactory: '0xB4DA36E4346b702C0705b03883E8b87D3D061379',
    OmniPaymaster: '0x8F36f50C92b8c80835263695eda0227fb3968724',
    OmniFeeRouter: '0x7e0C0c59E6D87B37920098D4000c3EfE586E6DC5',
    OmniPredictionRouter: '0xBBD4C2dca354cfF43458b52c95173131E77443D9',
    OmniYieldFeeCollector: '0x1312eE58a794eb3aDa6D38cEbfcBD05f87e76511',
    ReputationCredential: '0x4f41a213a4eBa3e74Cc17b28695BCC3e8692be63',
    RWAPool: '0x853CB0499b8fb159f48dE7696194Db852b305355',
    UpdateRegistry: '0x3A396c75573f1F3c2C45456600cc950605d8Fa02',
    UnifiedFeeVault: '0x45dB9304a5124d3cD6d646900b1c4C0cA6A89658',
    FeeSwapAdapter: '0x6Bce2b309b6C0107a8eB48d865ea52F858B9C865',
    OmniPriceOracle: '0xF0D0595F760895F04fe17c1fCA55e4E6D7714677',
    OmniArbitration: '0x1af7FDbB1dcD37b39F3B1C7d79F8fBD5238E3BC3',
    OmniMarketplace: '0x02835C667F646D97dAf632BDDdf682Fb1753e7ad',
    OmniENS: '0x0c553f1B3C121e2A583A97044aE02fe1654AB55e',
    OmniChatFee: '0x5Fac9435D844729c858e6a0B411bbcE044eFD38F',
    publicRpcUrl: 'https://rpc.omnicoin.net',
    blockExplorerUrl: '/explorer',
  },

  // Fuji Testnet Subnet-EVM (chainId: 131313)
  // ⚠️  CRITICAL: These addresses MUST match Coin/deployments/fuji.json
  // Last deployed: 2026-02-28 (UnifiedFeeVault address synced)
  // Fresh L1 deployment with P-Chain registration (multi-validator support)
  fuji: {
    rpcUrl: 'http://127.0.0.1:40681/ext/bc/2TEeYGdsqvS3eLBk8vrd9bedJiPR7uyeUo1YChM75HtCf9TzFk/rpc',
    subnetId: 'g9rP3Cirj5jJEukLDYQ72EbsRnpwEeVRL9pdLZqhJq1fivCke',
    blockchainId: '2TEeYGdsqvS3eLBk8vrd9bedJiPR7uyeUo1YChM75HtCf9TzFk',
    chainId: 131313,
    OmniCoin: '0x117defc430E143529a9067A7866A9e7Eb532203C',
    OmniCore: '0x0Ef606683222747738C04b4b00052F5357AC6c8b',
    OmniGovernance: '0x0000000000000000000000000000000000000000',
    OmniBridge: '0x0000000000000000000000000000000000000000',
    PrivateOmniCoin: '0x09F99AE44bd024fD2c16ff6999959d053f0f32B5',
    MinimalEscrow: '0xa0aF1B47C6B4c56E776c8c920dB677E394060bDD',
    LegacyBalanceClaim: '0x1201b2f0e94B8722792FC4F515E64133c122CD39',
    OmniRewardManager: '0xE2e1b926AE798647DDfD7E5A95862C6C2E3C6F67',
    OmniRegistration: '0x0E4E697317117B150481a827f1e5029864aAe781',
    OmniSybilGuard: '0xe6E7fA5FA18F06686df1603B63eCff8683F118B0',
    OmniParticipation: '0x500436A6bd54A0C5260F961ff5941dDa1549b658',
    OmniValidatorRewards: '0x6136A40Ea03586aCA976FA2bbe9deC072EA75869',
    RWAComplianceOracle: '0xF6acBc80dd1Ba20F9e4e90e1A6fe145536C60bb5',
    RWAAMM: '0xb287f8CE22748a4b3f0fB570bc7FF7B67161cB8f',
    RWARouter: '0x88fF08e10ab7004ab375AD9e5201Ecad67865be2',
    LiquidityBootstrappingPool: '0x5C032b6F109B9d2f2Cf86A0fB70b7A419EeBA408',
    OmniBonding: '0x1F976D7F01a31Fd6A1afd3508BfC562D778404Dd',
    LiquidityMining: '0xCD2f28E7630d55aC1b10530c5EBA1564a84E4511',
    DEXSettlement: '0xa1Fa0D36586859399b0e6c6E639A50063bBAa2Ce',
    OmniSwapRouter: '0x0DCef11B5aaBf8CeAd12Ea4BE2eC1fAb7Efa586B',
    TestUSDC: '0xFC866508bb2720054F9e346B286A08E7143423A7',
    StakingRewardPool: '0x1A12040129c47B92fd10083d4969Fb392a9554Af',
    OmniNFTCollection: '0x9FDeB42834Cbe4C83DEe2F318AAAB3C6EDf6C8B0',
    OmniNFTFactory: '0x13DFA910fD8D2d061e95C875F737bE89FF073475',
    OmniNFTRoyalty: '0x951706B3590728F648FEC362DBEAE9b0cb60b3ed',
    OmniNFTLending: '0x2bc4165812b8f3028a4a2E52b2D4C67fE4DF675A',
    OmniFractionalNFT: '0x9A59E976c6a9dC08062268e69467E431Eef554fC',
    OmniNFTStaking: '0xD5AD7beD2Db6E05925b68a19CA645A3333726380',
    OmniEntryPoint: '0xDc3d2d1fC7d2354a56Ae9EF78bF4fB2A2c2712C4',
    OmniAccountFactory: '0xB4DA36E4346b702C0705b03883E8b87D3D061379',
    OmniPaymaster: '0x8F36f50C92b8c80835263695eda0227fb3968724',
    OmniFeeRouter: '0x7e0C0c59E6D87B37920098D4000c3EfE586E6DC5',
    OmniPredictionRouter: '0xBBD4C2dca354cfF43458b52c95173131E77443D9',
    OmniYieldFeeCollector: '0x1312eE58a794eb3aDa6D38cEbfcBD05f87e76511',
    ReputationCredential: '0x4f41a213a4eBa3e74Cc17b28695BCC3e8692be63',
    RWAPool: '0x853CB0499b8fb159f48dE7696194Db852b305355',
    UpdateRegistry: '0x3A396c75573f1F3c2C45456600cc950605d8Fa02',
    UnifiedFeeVault: '0x45dB9304a5124d3cD6d646900b1c4C0cA6A89658',
    FeeSwapAdapter: '0x6Bce2b309b6C0107a8eB48d865ea52F858B9C865',
    OmniPriceOracle: '0xF0D0595F760895F04fe17c1fCA55e4E6D7714677',
    OmniArbitration: '0x1af7FDbB1dcD37b39F3B1C7d79F8fBD5238E3BC3',
    OmniMarketplace: '0x02835C667F646D97dAf632BDDdf682Fb1753e7ad',
    OmniENS: '0x0c553f1B3C121e2A583A97044aE02fe1654AB55e',
    OmniChatFee: '0x5Fac9435D844729c858e6a0B411bbcE044eFD38F',
    publicRpcUrl: 'https://rpc.omnicoin.net',
    blockExplorerUrl: '/explorer',
  },

  // Avalanche Mainnet Subnet-EVM (Production)
  // ⚠️  CRITICAL: These addresses MUST match Coin/deployments/mainnet.json
  // Redeployed: 2026-03-14 (v2, minBaseFee=1, PoS Native)
  // Contract addresses will be updated by deploy-all-mainnet-v2.js
  mainnet: {
    rpcUrl:
      'http://65.108.205.116:9650/ext/bc/B5gLCyeRWScxf1CeGHfXjEkcp5au8dQYQjtSV6cRammsLjsbK/rpc',
    subnetId: '0000000000000000000000000000000000000000000000000000000000000000',
    blockchainId: 'B5gLCyeRWScxf1CeGHfXjEkcp5au8dQYQjtSV6cRammsLjsbK',
    chainId: 88008,
    publicRpcUrl: 'https://rpc.omnicoin.net',
    blockExplorerUrl: '/explorer',
    OmniCoin: '0x1eE61487F08F715055358A1F020A86c9E571ED78',
    PrivateOmniCoin: '0xb09F2900f6603Da92DB3D5df52e804CaF9c78f09',
    MinimalEscrow: '0x1Bbce5CC4d985178F28DE86597dC7747A4E4d4A7',
    OmniCore: '0xa7680b25C0483E6d9E8AdD01e3FeEE33ABD43ce6',
    OmniGovernance: '0xa812904860c615FeCE377F17F87670EcA0E0899c',
    LegacyBalanceClaim: '0xa47dC07a3608646605DFAaC392eaE90bfc750a7B',
    OmniRegistration: '0x2B05cbA7740EE483f6151Fa40CF5D48C45A1AD88',
    StakingRewardPool: '0xb53aDA994b2929228DfB9bc95A2151DE135E8A77',
    OmniParticipation: '0xcd54E622C4549D666b63ce89400c4cD439bf84F9',
    OmniValidatorRewards: '0x6974F8c7712a4f294A1f66Efc16EC678AAB7b7F2',
    OmniRewardManager: '0x3138855f8EdAA2D41f1a2Ae5Cc0C0052b61e9de3',
    DEXSettlement: '0x0F2dF0921E8c5f68689820D811C0926D9eDb7f38',
    VolumeDiscountOracle: '0x1ffc4736960b7D820D3d0E8D086cD5f8ddBe6d9C',
    CLOBAdapter: '0xe84D9b6Bb4c1CAf9A31E492E8758Be7A28348b9b',
    OmniSwapRouter: '0x12a8145C26a696C60edcC8931AE860cb822553A4',
    UnifiedFeeVault: '0xf702f60683c5AFd2351d0b0941c0AADEa62015e1',
    OmniMarketplace: '0xaf0734938801b9f7E1C6d83c78Dfd0667607AA2a',
    OmniENS: '0x9Db5C15bEea394A215fe3f10d2A5fb4290b6633B',
    OmniChatFee: '0x19c01a5C9D23f432EcB56Ef976f55B4FB6EAcFd5',
    OmniPriceOracle: '0xB4Fc75e626f39a86E4BB023bC6f654964f354c3e',
    OmniArbitration: '0x4f82fd4ef1CC0cd2Be4D1c72477663db20Af62Cb',
    UpdateRegistry: '0xA5eb4BF4a46B3CfAaC684818f56fD8263f79031D',
    LiquidityMining: '0xd3cd580d0CB62B1d48d15932BdF09a81dc93836e',
    OmniBonding: '0x166439CE6d91973B672De12E5a4991B177D39414',
    RWAComplianceOracle: '0xd72230D6b6263B710ff01B2303bb72FB6A651258',
    RWAAMM: '0xdBe9101F6C8f33dfF37C4df8041B64f89D9ab12f',
    RWARouter: '0xE0b02D0bd42F1cFF64f5E44b7D9fC59558f1F9DF',
    OmniYieldFeeCollector: '0xbD3a1D5Df3c4F375000C6396CDac08D5F3EaD971',
    OmniNFTCollection: '0xAeD114e0e14444b0F7fE19b5c9E23059498B8B3C',
    OmniNFTFactory: '0xEcE80C7cd2A77D7D0B20EA4f32C58227fc52Dd10',
    OmniFractionalNFT: '0xA86d82dFc7149dff166e8E5212d1a88C553990b6',
    OmniNFTLending: '0x8B7b1266BbB1DD72517424C9aF76e3436EDE5008',
    OmniNFTStaking: '0x9862a6939e327D5AdD45Bcd4Ce23caDFe22050a8',
    OmniBridge: '0x0620F30363A64363F0BA4D05F25C6AC15f178Fe8',
    OmniEntryPoint: '0x3F870D129da8Ae7329268EEf11700c651aCe4d5B',
    OmniAccountFactory: '0xd4c08a1BcB2466f7D887c8A952Edc11C9309E68c',
    OmniPaymaster: '0x80A448F48dC0216298270CfC0D9801cecC8d222C',
    OmniPredictionRouter: '0xE2F12A18f10DBdb925458B1e6aacC88bb1Ff9978',
    ReputationCredential: '0xacF208C9E3bF46360dCcCaC79d4069fc0084569a',
    OmniFeeRouter: '0xE707c9b2750b84069508AcdF44343b3dF75AB4e1',
    FeeSwapAdapter: '0x3C2226e6c02e41274dC73B07bffB042CaCf83872',
    OmniPrivacyBridge: '0x739b44D2D7E7A4B496A9620b7B346002885bd6A0',
    PrivateDEX: '0x8eEA9eCe017796A60e0Bf2A5ee59fd18b020c58D',
    PrivateDEXSettlement: '0xa07899F3bC247fB2AEb36BF6c4849342116277D4',
    PrivateUSDC: '0x073d9b45aaBa31f673f045DD12C5B5a4b8E5d33e',
    PrivateWETH: '0x08E6eE4AAA804FECF7e490ffD86f8Aa0661a9E88',
    PrivateWBTC: '0x82848b5879343979C3fd43B931313aa881eD1A41',
    OmniForwarder: '0xaF8c638b69A61e28617e0C71178D4910aB4e83E5',
    OmniTimelockController: '0xa3A3756f6DEfeCFd13B96bd74530E014b4574722',
    EmergencyGuardian: '0x435954106b070244038b9f9bad8865b2e80cE8AE',
    ValidatorProvisioner: '0xef66d84281c642AaD8341617759a69224011484e',
    Bootstrap: '0x6B96a83655040aB3C315195C3cB0CabAD42C981b',
    TestUSDC: '0x732d5711f9D97B3AFa3C4c0e4D1011EBF1550b8c',
    LiquidityBootstrappingPool: '0x8130aDf195EF48544D22dAd562dfD97096b02360',
    OmniTreasury: '0x18678DB9EeE901839744883B4780D918f086e6D0',
    OmniNFTRoyalty: '0x0000000000000000000000000000000000000000',
    QualificationOracle: '0x0000000000000000000000000000000000000000',
    OmniAccount: '0x0000000000000000000000000000000000000000',
    OmniBazaarResolver: '0xFC2aA43A546b4eA9fFF6cFe02A49A793a78B898B', // Ethereum mainnet L1 (ENSIP-10 + ERC-3668)
    LiquidityOverflowPool: '0x3e3FB3416236fCab0dB9A45171c5532Aff665EC8',
    XomUsdcPool: '0x1729F725A79002458447a3d68DDb01fCae3B5D16',
    LPZap: '0x8968a41ee5208eAF6E9fe290558BcCD1D0A482c3',
    RWAAMMAdapter: '0x10eAB8AB3dF628eDb6bF3B3B0Fff4B3e17e2CdF6',
    ERC20TokenHome: '0x79B7480feEb8fD4509993c78ef8DdE9786Fc9ded',
    ERC20TokenRemote: '0x81f4072fCca24d373FFCB34c248995DFC6c1219C',
    BridgedUSDC: '0x81f4072fCca24d373FFCB34c248995DFC6c1219C',
    TeleporterRegistryCChain: '0x7C43605E14F391720e1b37E49C78C4b03A488d98',
    TeleporterRegistryL1: '0x87D02531b71D54Fb2125D75EA02B7e025E6dE626',
  },

  // COTI Testnet (Privacy Layer Development)
  // ⚠️  Will be updated by sync script after deployment
  // Will be synchronized from Coin/deployments/coti-testnet.json
  'coti-testnet': {
    rpcUrl: 'https://testnet.coti.io/rpc',
    subnetId: '0000000000000000000000000000000000000000000000000000000000000000',
    blockchainId: '0000000000000000000000000000000000000000000000000000000000000000',
    chainId: 7082400, // COTI Testnet chain ID (verified)
    OmniCoin: '0x0000000000000000000000000000000000000000', // Not deployed on COTI
    OmniCore: '0x0000000000000000000000000000000000000000', // Not deployed on COTI
    OmniGovernance: '0x0000000000000000000000000000000000000000', // Not deployed on COTI
    OmniBridge: '0x123522e908b34799Cf14aDdF7B2A47Df404c4d47', // OmniPrivacyBridgeSimple ✅ DEPLOYED 2025-11-13
    PrivateOmniCoin: '0x6BF2b6df85CfeE5debF0684c4B656A3b86a31675', // PrivateOmniCoinSimple ✅ DEPLOYED 2025-11-13
    PrivateDEX: '0xA242e4555CECF29F888b0189f216241587b9945E', // PrivateDEXSimple ✅ DEPLOYED 2025-11-13
    PrivateDEXSettlement: '0x0000000000000000000000000000000000000000', // To be deployed
    PrivateUSDC: '0x0000000000000000000000000000000000000000', // To be deployed
    PrivateWETH: '0x0000000000000000000000000000000000000000', // To be deployed
    PrivateWBTC: '0x0000000000000000000000000000000000000000', // To be deployed
    MinimalEscrow: '0x0000000000000000000000000000000000000000', // Not deployed on COTI
    LegacyBalanceClaim: '0x0000000000000000000000000000000000000000', // Not deployed on COTI
  },

  // COTI Mainnet (Privacy Layer - Deployed 2026-03-21)
  // Addresses synchronized from Coin/deployments/coti-mainnet.json
  'coti-mainnet': {
    rpcUrl: 'https://mainnet.coti.io/rpc', // COTI mainnet RPC (verified)
    subnetId: '0000000000000000000000000000000000000000000000000000000000000000', // Not applicable
    blockchainId: '0000000000000000000000000000000000000000000000000000000000000000', // Native COTI chain
    chainId: 2632500, // COTI mainnet chain ID (verified from COTI docs)
    OmniCoin: '0x0000000000000000000000000000000000000000', // To be deployed
    OmniCore: '0x0000000000000000000000000000000000000000', // To be deployed
    OmniGovernance: '0x0000000000000000000000000000000000000000', // To be deployed
    OmniBridge: '0x0D6bD1C10EDae3DEC57F426760686130759c84AB', // OmniPrivacyBridge proxy
    PrivateOmniCoin: '0x9338B9eF1291b0266D28E520797eD57020A84D3B', // pXOM proxy
    PrivateDEX: '0xf20765a9Eb38a4753c5774c86677251cfbEcc690', // PrivateDEX proxy
    PrivateDEXSettlement: '0xc2468BA2F42b5ea9095B43E68F39c366730B84B4', // PrivateDEXSettlement proxy
    PrivateUSDC: '0x031f1761e2163b7f0eD47EdD17D7E110D4411b37', // PrivateUSDC proxy
    PrivateWETH: '0xaE3D9bDf72a7160712cb99f01E937Ee2F5AF339c', // PrivateWETH proxy
    PrivateWBTC: '0xD95a682e06A618a1c1a5e2AEb2086AeD87140e0f', // PrivateWBTC proxy
    MinimalEscrow: '0x0000000000000000000000000000000000000000', // To be deployed
    LegacyBalanceClaim: '0x0000000000000000000000000000000000000000', // Not applicable
  },
};

/**
 * Detect network based on environment variables.
 * Browser-safe: guards against missing `process` global.
 * @returns Network name ('mainnet' or 'fuji')
 */
export function detectNetwork(): string {
  if (typeof process !== 'undefined' && process.env['AVALANCHE_NETWORK'] === 'mainnet') {
    return 'mainnet';
  }
  // Default to fuji for development/testing
  return 'fuji';
}

/**
 * Check if we're running in a browser context
 * @returns true if running in browser, false if running in Node.js
 */
function isBrowser(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as { document?: unknown }).document !== 'undefined'
  );
}

/**
 * Get the RPC URL to use for blockchain connections.
 *
 * When running in a browser, we use the RPC proxy endpoint on the validator
 * because browsers cannot directly access the local avalanchego RPC endpoint.
 * When running in Node.js (e.g., during testing), we use the direct RPC URL.
 *
 * @param addresses Contract addresses object (optional, uses detected network if not provided)
 * @returns RPC URL suitable for the current environment
 */
export function getRpcUrl(addresses?: ContractAddresses): string {
  const config = addresses ?? getContractAddresses();

  // In browser context, use the proxy endpoint served by the validator
  if (isBrowser()) {
    const origin = window.location.origin;
    return `${origin}/api/v1/rpc/proxy`;
  }

  // In Node.js context (tests, scripts), use direct RPC URL
  return config.rpcUrl;
}

/**
 * Get contract addresses for a specific network
 * @param network - Network name (optional, auto-detected if not provided)
 * @returns Contract addresses for the specified network
 * @throws Error if network is not found
 */
export function getContractAddresses(network?: string): ContractAddresses {
  const targetNetwork = network !== undefined && network !== '' ? network : detectNetwork();
  const addresses = OMNICOIN_ADDRESSES[targetNetwork];
  if (addresses === undefined) {
    throw new Error(`No contract addresses found for network: ${targetNetwork}`);
  }
  return addresses;
}

/**
 * Bootstrap Configuration for Bootstrap.sol
 *
 * Bootstrap.sol is the SINGLE SOURCE OF TRUTH for validator/node discovery.
 *
 * Fuji testnet: Deployed on Avalanche C-Chain (publicly accessible)
 * Mainnet: Deployed on OmniCoin L1 (chain 88008) for free gas
 */
export interface BootstrapConfig {
  /** RPC URL for the chain where Bootstrap.sol is deployed */
  rpcUrl: string;
  /** Chain ID where Bootstrap.sol is deployed */
  chainId: number;
  /** Bootstrap contract address */
  Bootstrap: string;
}

/**
 * C-Chain bootstrap configuration alias (deprecated).
 * @deprecated Use BootstrapConfig instead.
 */
export type CChainBootstrapConfig = BootstrapConfig;

/**
 * Bootstrap configurations by network environment
 */
export const BOOTSTRAP_CONFIG: Record<string, BootstrapConfig> = {
  // Fuji C-Chain (testnet)
  // Bootstrap.sol deployed: 2025-12-06
  // Deployed on C-Chain (43113) so testnet clients can discover validators
  fuji: {
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    chainId: 43113,
    Bootstrap: '0x85D1B11778ae3Fb7F90cE2078f0eb65C97ff6cAd',
  },

  // OmniCoin L1 (production)
  // Redeployed: 2026-03-15 (v3, PoS Native)
  // Bootstrap.sol deployed on L1 (88008) — validators self-register here
  // rpcUrl uses nginx reverse proxy (rpc.omnicoin.net → 65.108.205.116:9650/ext/bc/.../rpc)
  // AVALANCHE_RPC_URL env var overrides per-validator for local endpoint usage
  mainnet: {
    rpcUrl: 'https://rpc.omnicoin.net',
    chainId: 88008,
    Bootstrap: '0x6B96a83655040aB3C315195C3cB0CabAD42C981b',
  },

  // Local development
  local: {
    rpcUrl: 'http://127.0.0.1:9650/ext/bc/C/rpc',
    chainId: 43112,
    Bootstrap: '0x0000000000000000000000000000000000000000',
  },
};

/**
 * Get Bootstrap configuration for a specific network
 * @param network - Network name ('fuji', 'mainnet', 'local')
 * @returns Bootstrap configuration
 * @throws Error if network is not found
 */
export function getBootstrapConfig(network?: string): BootstrapConfig {
  // Default to mainnet (production — OmniCoin L1 chain 88008)
  const targetNetwork = network !== undefined && network !== '' ? network : 'mainnet';
  const config = BOOTSTRAP_CONFIG[targetNetwork];
  if (config === undefined) {
    throw new Error(`No Bootstrap config found for network: ${targetNetwork}`);
  }
  // Allow per-validator RPC override via AVALANCHE_RPC_URL env var
  // Each validator has its own IP and should use its local avalanchego endpoint
  if (typeof process !== 'undefined' && targetNetwork === 'mainnet') {
    const envRpcUrl = process.env['AVALANCHE_RPC_URL'];
    if (envRpcUrl !== undefined && envRpcUrl !== '') {
      return { ...config, rpcUrl: envRpcUrl };
    }
  }
  return config;
}

/**
 * Get bootstrap configuration by network name (deprecated alias).
 * @deprecated Use getBootstrapConfig instead.
 */
export const getCChainBootstrapConfig = getBootstrapConfig;

/**
 * Check if Bootstrap.sol is deployed (address is not zero)
 * @param network - Network name
 * @returns True if Bootstrap contract is deployed
 */
export function isBootstrapDeployed(network?: string): boolean {
  const config = getBootstrapConfig(network);
  return config.Bootstrap !== '0x0000000000000000000000000000000000000000';
}

/**
 * Provider options for safe RPC connections
 */
export interface SafeProviderOptions {
  /** Network name (auto-detected if not provided) */
  network?: string;
  /** Whether to use static network (fail fast instead of retry forever). Default: true */
  staticNetwork?: boolean;
  /** Polling interval in ms. Set to 0 to disable polling. Default: 0 (disabled) */
  pollingInterval?: number;
}

/**
 * Create an ethers JsonRpcProvider with timeout protection.
 *
 * This prevents the common issue where ethers.js retries forever when:
 * - The RPC URL is wrong (e.g., missing /ext/bc/<id>/rpc path)
 * - The node is not responding
 * - Network detection fails
 *
 * @param options - Provider configuration options
 * @returns JsonRpcProvider configured for fail-fast behavior
 *
 * @example
 * ```typescript
 * // Simple usage - auto-detects network
 * const provider = createSafeProvider();
 *
 * // Specify network explicitly
 * const provider = createSafeProvider({ network: 'fuji' });
 *
 * // With polling enabled (for subscriptions)
 * const provider = createSafeProvider({ pollingInterval: 4000 });
 * ```
 */
export function createSafeProvider(options: SafeProviderOptions = {}): JsonRpcProvider {
  const { network, staticNetwork = true, pollingInterval = 0 } = options;

  const config = getContractAddresses(network);

  const provider = new JsonRpcProvider(
    config.rpcUrl,
    staticNetwork
      ? {
          chainId: config.chainId,
          name: network !== undefined && network !== '' ? network : 'omnicoin',
        }
      : undefined,
    {
      staticNetwork,
      polling: pollingInterval > 0,
      ...(pollingInterval > 0 && { pollingInterval }),
    }
  );

  return provider;
}

/**
 * Execute a provider call with timeout protection.
 *
 * Wraps any Promise with a timeout to prevent indefinite hangs.
 *
 * @param promise - The promise to execute
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @param operation - Description of the operation for error messages
 * @returns The result of the promise
 * @throws Error if the operation times out
 *
 * @example
 * ```typescript
 * const provider = createSafeProvider();
 * const blockNumber = await withTimeout(
 *   provider.getBlockNumber(),
 *   5000,
 *   'getBlockNumber'
 * );
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 10000,
  operation = 'RPC call'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Resolve the 0x Swap API key from the environment.
 *
 * The key is read from `process.env['ZEROX_API_KEY']` and passed to
 * `ZeroXProvider` so quote/execute calls go out on the free-tier 10 RPS
 * per chain budget (a single key is enough for all 5 supported chains).
 * If the variable is absent or empty, `undefined` is returned and the
 * provider falls back to unauthenticated requests (much lower budget);
 * the `AggregatorRouter` still degrades gracefully to Li.Fi / native
 * routing when 0x is rate-limited.
 *
 * @returns 0x API key when set, otherwise `undefined`
 */
export function getZeroXApiKey(): string | undefined {
  const key = process.env['ZEROX_API_KEY'];
  if (typeof key !== 'string' || key.length === 0) return undefined;
  return key;
}
