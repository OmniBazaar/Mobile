/**
 * CreateListingService — Mobile-side wrapper that signs the gasless
 * intent for a new P2P listing and submits it to the validator.
 *
 * Mirrors the Wallet popup's pattern: caller provides the listing
 * fields + the in-memory mnemonic; this service:
 *   1. Builds the canonical intent string `${seller} ${title} ${price} ${currency} ${ts}`.
 *   2. Signs it via `ethers.Wallet.signMessage` (EIP-191).
 *   3. POSTs to `/api/v1/marketplace/listings` via MarketplaceClient.
 *
 * The validator stores listing metadata in IPFS automatically; the
 * `images` array carries the IPFS gateway URLs returned by
 * {@link IPFSUploadService.uploadAsset}.
 *
 * @module services/CreateListingService
 */

import { Wallet } from 'ethers';

import {
  getMarketplaceClient,
  type CreateListingPayload,
  type CreateListingResult,
  type ListingCategory,
} from '@wallet/services/marketplace/MarketplaceClient';

import { logger } from '../utils/logger';

/** Caller-supplied form values. */
export interface CreateListingArgs {
  /** Listing title. */
  title: string;
  /** Listing description. */
  description: string;
  /** Decimal price as a string. */
  price: string;
  /** Currency symbol (XOM, USDC, etc.). */
  currency: string;
  /** Category enum. */
  category: ListingCategory;
  /** IPFS gateway URLs of attached images. */
  imageUrls: string[];
  /** Optional location. */
  country?: string;
  region?: string;
  city?: string;
  /** Seller's EVM address. */
  sellerAddress: string;
  /** BIP-39 mnemonic — used in-memory only for signing. */
  mnemonic: string;
}

/**
 * Sign + submit a new listing.
 *
 * @param args - See {@link CreateListingArgs}.
 * @returns Validator result.
 */
export async function createListing(args: CreateListingArgs): Promise<CreateListingResult> {
  const ts = Date.now();
  const canonical = `${args.sellerAddress} ${args.title} ${args.price} ${args.currency} ${ts}`;
  const wallet = Wallet.fromPhrase(args.mnemonic);
  const signature = await wallet.signMessage(canonical);
  logger.debug('[create-listing] signing intent', { ts, title: args.title });
  const payload: CreateListingPayload = {
    sellerAddress: args.sellerAddress,
    title: args.title,
    description: args.description,
    price: args.price,
    currency: args.currency,
    category: args.category,
    images: args.imageUrls,
    intentSignature: signature,
    intentTimestamp: ts,
    ...(args.country !== undefined && { country: args.country }),
    ...(args.region !== undefined && { region: args.region }),
    ...(args.city !== undefined && { city: args.city }),
  };
  return await getMarketplaceClient().createListing(payload);
}
