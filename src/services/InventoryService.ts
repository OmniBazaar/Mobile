/**
 * InventoryService — per-subsystem inventory read endpoints.
 *
 * Each helper here is a thin `fetch()` wrapper around a validator REST
 * route. Failures (network down, 404, `success:false`) resolve to `[]`
 * or `undefined` so the UI can render an honest empty state instead of
 * crashing. The validator is authoritative — we do not fall back to
 * on-chain scans because the user's mobile RPC budget can't realistically
 * sweep every ERC-721 Transfer event across every chain.
 */

import { getBaseUrl } from './BootstrapService';

/** A single NFT the user owns. */
export interface OwnedNFT {
  /** Chain id. */
  chainId: number;
  /** Collection contract address. */
  contractAddress: string;
  /** Collection name (human-readable). */
  collectionName?: string;
  /** Token id (decimal string, can exceed uint64). */
  tokenId: string;
  /** Image URL (IPFS gateway or https). */
  imageUrl?: string;
  /** Optional listing id when the token is currently listed for sale. */
  activeListingId?: string;
  /** Last observed floor price in the collection's native currency. */
  floorPrice?: string;
}

/** Aggregated staking-position row. */
export interface StakingPosition {
  /** Total staked XOM in wei (decimal string). */
  amount: string;
  /** Pending rewards in wei (decimal string). */
  pendingRewards: string;
  /** Current base APR × 100 (e.g. 600 = 6.00%). */
  baseAprBps: number;
  /** Duration-bonus APR × 100. */
  bonusAprBps: number;
  /** Unix seconds at which any lock expires (0 when flexible). */
  unlockAt?: number;
  /** Aggregate participation score 0–100 (reputation). */
  participationScore?: number;
}

/** Escrow summary as surfaced by the validator's buyer view. */
export interface EscrowSummary {
  escrowId: string;
  listingId: string;
  status:
    | 'CREATED'
    | 'FUNDED'
    | 'SHIPPED'
    | 'RELEASED'
    | 'REFUNDED'
    | 'DISPUTED'
    | 'CANCELLED';
  buyerAddress: string;
  sellerAddress: string;
  amount: string;
  currency: string;
  createdAt: number;
  updatedAt?: number;
  /** Short listing title (convenience — saves a second RTT). */
  listingTitle?: string;
}

/**
 * Pull the NFTs currently owned by `address` across every indexed chain.
 * The validator aggregates its per-chain ownership index and returns a
 * single list. Zero validator coverage surfaces as an empty array.
 *
 * @param address - Wallet address.
 * @returns Owned NFTs (may be empty).
 */
export async function listOwnedNFTs(address: string): Promise<OwnedNFT[]> {
  if (address === '') return [];
  const base = getBaseUrl().replace(/\/$/, '');
  const url = `${base}/api/v1/nft/owned/${encodeURIComponent(address)}`;
  try {
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return [];
    const body = (await resp.json()) as {
      success?: boolean;
      data?: { items?: unknown };
      items?: unknown;
    };
    if (body.success === false) return [];
    const raw = Array.isArray(body.data?.items)
      ? body.data?.items
      : Array.isArray(body.items)
        ? body.items
        : [];
    return (raw as unknown[])
      .map(normalizeOwnedNFT)
      .filter((row): row is OwnedNFT => row !== undefined);
  } catch {
    return [];
  }
}

/**
 * Pull the user's active + past escrows as a buyer.
 *
 * @param address - Buyer wallet address.
 * @returns Escrow summaries, newest first.
 */
export async function listBuyerEscrows(address: string): Promise<EscrowSummary[]> {
  if (address === '') return [];
  const base = getBaseUrl().replace(/\/$/, '');
  const url = `${base}/api/v1/marketplace/escrows/${encodeURIComponent(address)}?role=buyer`;
  try {
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return [];
    const body = (await resp.json()) as {
      success?: boolean;
      data?: { escrows?: unknown };
      escrows?: unknown;
    };
    if (body.success === false) return [];
    const raw = Array.isArray(body.data?.escrows)
      ? body.data?.escrows
      : Array.isArray(body.escrows)
        ? body.escrows
        : [];
    return (raw as unknown[])
      .map(normalizeEscrow)
      .filter((row): row is EscrowSummary => row !== undefined);
  } catch {
    return [];
  }
}

/**
 * Fetch the user's current staking position.
 *
 * @param address - Staker wallet address.
 * @returns Position, or undefined when the user has never staked / the
 *   endpoint is unavailable.
 */
export async function getStakingPosition(
  address: string,
): Promise<StakingPosition | undefined> {
  if (address === '') return undefined;
  const base = getBaseUrl().replace(/\/$/, '');
  const url = `${base}/api/v1/staking/${encodeURIComponent(address)}/position`;
  try {
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return undefined;
    const body = (await resp.json()) as {
      success?: boolean;
      data?: Record<string, unknown>;
      amount?: unknown;
    };
    if (body.success === false) return undefined;
    const raw = (body.data ?? (body as unknown as Record<string, unknown>)) as Record<
      string,
      unknown
    >;
    const amount = typeof raw['amount'] === 'string' ? raw['amount'] : undefined;
    if (amount === undefined) return undefined;
    const pending =
      typeof raw['pendingRewards'] === 'string' ? raw['pendingRewards'] : '0';
    const baseApr =
      typeof raw['baseAprBps'] === 'number' ? raw['baseAprBps'] : 0;
    const bonusApr =
      typeof raw['bonusAprBps'] === 'number' ? raw['bonusAprBps'] : 0;
    return {
      amount,
      pendingRewards: pending,
      baseAprBps: baseApr,
      bonusAprBps: bonusApr,
      ...(typeof raw['unlockAt'] === 'number' && { unlockAt: raw['unlockAt'] }),
      ...(typeof raw['participationScore'] === 'number' && {
        participationScore: raw['participationScore'],
      }),
    };
  } catch {
    return undefined;
  }
}

/**
 * Coerce a raw validator NFT row into a typed {@link OwnedNFT}.
 * Returns undefined on malformed rows so the caller can filter them out.
 *
 * @param raw - Row from the HTTP response.
 * @returns Typed row or undefined.
 */
function normalizeOwnedNFT(raw: unknown): OwnedNFT | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const chainId = typeof r['chainId'] === 'number' ? r['chainId'] : undefined;
  const contractAddress =
    typeof r['contractAddress'] === 'string' ? r['contractAddress'] : undefined;
  const tokenId = typeof r['tokenId'] === 'string' ? r['tokenId'] : undefined;
  if (chainId === undefined || contractAddress === undefined || tokenId === undefined) {
    return undefined;
  }
  return {
    chainId,
    contractAddress,
    tokenId,
    ...(typeof r['collectionName'] === 'string' && {
      collectionName: r['collectionName'],
    }),
    ...(typeof r['imageUrl'] === 'string' && { imageUrl: r['imageUrl'] }),
    ...(typeof r['activeListingId'] === 'string' && {
      activeListingId: r['activeListingId'],
    }),
    ...(typeof r['floorPrice'] === 'string' && { floorPrice: r['floorPrice'] }),
  };
}

/**
 * Coerce a raw validator escrow row into an {@link EscrowSummary}.
 * Returns undefined on malformed rows.
 *
 * @param raw - Row from the HTTP response.
 * @returns Typed row or undefined.
 */
function normalizeEscrow(raw: unknown): EscrowSummary | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const escrowId = typeof r['escrowId'] === 'string' ? r['escrowId'] : undefined;
  const listingId = typeof r['listingId'] === 'string' ? r['listingId'] : undefined;
  const status = typeof r['status'] === 'string' ? r['status'] : undefined;
  const buyerAddress =
    typeof r['buyerAddress'] === 'string' ? r['buyerAddress'] : undefined;
  const sellerAddress =
    typeof r['sellerAddress'] === 'string' ? r['sellerAddress'] : undefined;
  const amount = typeof r['amount'] === 'string' ? r['amount'] : undefined;
  const currency = typeof r['currency'] === 'string' ? r['currency'] : undefined;
  const createdAt =
    typeof r['createdAt'] === 'number' ? r['createdAt'] : undefined;
  if (
    escrowId === undefined ||
    listingId === undefined ||
    status === undefined ||
    buyerAddress === undefined ||
    sellerAddress === undefined ||
    amount === undefined ||
    currency === undefined ||
    createdAt === undefined
  ) {
    return undefined;
  }
  const allowed: ReadonlyArray<EscrowSummary['status']> = [
    'CREATED',
    'FUNDED',
    'SHIPPED',
    'RELEASED',
    'REFUNDED',
    'DISPUTED',
    'CANCELLED',
  ];
  if (!allowed.includes(status as EscrowSummary['status'])) return undefined;
  return {
    escrowId,
    listingId,
    status: status as EscrowSummary['status'],
    buyerAddress,
    sellerAddress,
    amount,
    currency,
    createdAt,
    ...(typeof r['updatedAt'] === 'number' && { updatedAt: r['updatedAt'] }),
    ...(typeof r['listingTitle'] === 'string' && { listingTitle: r['listingTitle'] }),
  };
}
