/**
 * EscrowPurchaseService — Mobile-side P2P escrow funding.
 *
 * Signs a CreateEscrow EIP-712 intent (bound to the OmniBazaar domain,
 * verifyingContract = MinimalEscrow) and posts it through
 * `MarketplaceClient.createEscrow`. The validator verifies the
 * signature, deducts the 0.25% buyer escrow fee, funds the on-chain
 * escrow via OmniRelay (gasless for the buyer), and returns the
 * resulting escrowId + chat thread + tx hash.
 */

import { ethers, Wallet } from 'ethers';

import {
  buildTypedData,
  CREATE_ESCROW_TYPES,
  type CreateEscrowMessage,
  randomNonce,
} from '@wallet/background/eip712Intents';
import {
  getMarketplaceClient,
  type CreateEscrowResult,
  type MarketplaceListing,
} from '@wallet/services/marketplace/MarketplaceClient';

import { getContractAddresses } from '../config/omnicoin-integration';

/** Inputs. */
export interface EscrowPurchaseParams {
  /** Listing the user is purchasing. */
  listing: MarketplaceListing;
  /** Buyer wallet address. */
  buyer: string;
  /** BIP39 mnemonic — used in-memory only for signing. */
  mnemonic: string;
  /** Optional primary referrer. */
  referrer?: string;
  /** Optional second-level referrer. */
  referrer2?: string;
}

/**
 * Sign + submit a CreateEscrow intent.
 *
 * @param params - See {@link EscrowPurchaseParams}.
 * @returns Escrow result from the validator.
 */
export async function purchaseEscrow(
  params: EscrowPurchaseParams,
): Promise<CreateEscrowResult> {
  const addresses = getContractAddresses('mainnet');
  const verifyingContract =
    (addresses as unknown as Record<string, string | undefined>)['MinimalEscrow'] ??
    ethers.ZeroAddress;

  const timestamp = Date.now();
  const nonce = randomNonce();
  const message: CreateEscrowMessage = {
    buyer: params.buyer,
    seller: params.listing.sellerAddress,
    listingId: params.listing.id,
    amount: params.listing.price,
    currency: params.listing.currency,
    timestamp,
    nonce,
  };
  const td = buildTypedData(message, 'CreateEscrow', CREATE_ESCROW_TYPES, verifyingContract);
  const wallet = Wallet.fromPhrase(params.mnemonic);
  const intentSignature = await wallet.signTypedData(td.domain, td.types, td.message);

  return getMarketplaceClient().createEscrow({
    listingId: params.listing.id,
    amount: params.listing.price,
    currency: params.listing.currency,
    buyerAddress: params.buyer,
    sellerAddress: params.listing.sellerAddress,
    ...(params.referrer !== undefined && { referrer: params.referrer }),
    ...(params.referrer2 !== undefined && { referrer2: params.referrer2 }),
    intentSignature,
    intentTimestamp: timestamp,
  });
}
