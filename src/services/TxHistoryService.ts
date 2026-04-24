/**
 * TxHistoryService — Mobile-side transaction history.
 *
 * Primary source: validator's `/api/v1/wallet/:address/history` endpoint.
 * Returns a mixed list of native transfers, ERC-20 transfers, marketplace
 * settlements, prediction trades, staking actions, and privacy (XOM↔pXOM)
 * flows. Rows carry a `privacy` flag so the UI can distinguish shielded
 * operations (Track B4).
 *
 * Falls back to on-chain native transfer discovery via
 * `ClientRPCRegistry` when the validator is offline — the fallback only
 * reports native sends/receives on the user's active chains because
 * full cross-contract log indexing from a thin client would exceed
 * the mobile RPC quota.
 */

import { getClientRPCRegistry } from '@wallet/core/providers/ClientRPCRegistry';

import { getBaseUrl } from './BootstrapService';

/** Single history row. */
export interface TxHistoryRow {
  /** Unique row id (validator-assigned or chainId:hash fallback). */
  id: string;
  /** On-chain tx hash. */
  txHash: string;
  /** Chain the tx landed on. */
  chainId: number;
  /** Direction from the user's perspective. */
  direction: 'in' | 'out' | 'self';
  /** Category (validator-authored or a local best-effort guess). */
  category:
    | 'native'
    | 'erc20'
    | 'swap'
    | 'marketplace'
    | 'nft'
    | 'predictions'
    | 'staking'
    | 'privacy'
    | 'other';
  /** Human-readable short label. */
  label: string;
  /** Value in the token's native units (decimal string). */
  value: string;
  /** Token symbol, when applicable. */
  symbol?: string;
  /** Counterparty (recipient for `out`, sender for `in`). */
  counterparty?: string;
  /** Unix seconds. */
  timestamp: number;
  /** True when the row represents a shielded (pXOM) operation. */
  privacy?: boolean;
  /** Status string from the indexer ("confirmed", "pending", ...). */
  status?: string;
}

/**
 * Fetch history from the validator's indexer.
 *
 * @param address - Wallet address (lower or mixed case).
 * @param limit - Max rows (server caps at 100).
 * @returns Rows ordered newest first. Empty array when the endpoint is
 *   unreachable or returns a non-success envelope.
 */
export async function fetchValidatorHistory(
  address: string,
  limit = 50,
): Promise<TxHistoryRow[]> {
  if (address === '') return [];
  const base = getBaseUrl().replace(/\/$/, '');
  const params = new URLSearchParams({ limit: String(limit) });
  const url = `${base}/api/v1/wallet/${encodeURIComponent(address)}/history?${params.toString()}`;
  try {
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return [];
    const body = (await resp.json()) as {
      success?: boolean;
      data?: { rows?: unknown };
      rows?: unknown;
    };
    if (body.success === false) return [];
    const rows = Array.isArray(body.data?.rows)
      ? body.data?.rows
      : Array.isArray(body.rows)
        ? body.rows
        : [];
    return (rows as unknown[]).map(normalizeRow).filter((r): r is TxHistoryRow => r !== undefined);
  } catch {
    return [];
  }
}

/**
 * Best-effort native-transfer fallback via ClientRPCRegistry. Pulls the
 * last ~2000 blocks on the active chain and returns any tx the user
 * signed or received. Cheap enough for a Mobile UI; far from a full
 * indexer. Intended to render *something* when the validator endpoint
 * is temporarily unreachable.
 *
 * @param address - Wallet address.
 * @param chainId - Chain to scan (88008 for XOM).
 * @returns Rows ordered newest first.
 */
export async function fetchNativeFallback(
  address: string,
  chainId: number,
): Promise<TxHistoryRow[]> {
  if (address === '') return [];
  const registry = getClientRPCRegistry();
  const provider = registry.getProvider(chainId);
  if (provider === undefined) return [];
  try {
    const head = await provider.getBlockNumber();
    const window = 2000;
    const from = Math.max(0, head - window);
    const rows: TxHistoryRow[] = [];
    const lower = address.toLowerCase();
    // Sample every 50 blocks to keep mobile RPC usage bounded. The
    // validator-sourced list is authoritative — this is only a
    // fill-the-screen fallback while indexing catches up.
    for (let b = head; b > from; b -= 50) {
      const block = await provider.getBlock(b);
      if (block === null) continue;
      for (const hash of block.transactions) {
        const tx = await provider.getTransaction(hash);
        if (tx === null) continue;
        const fromLower = tx.from.toLowerCase();
        const toLower = tx.to?.toLowerCase();
        const isUs = fromLower === lower || toLower === lower;
        if (!isUs) continue;
        const direction: 'in' | 'out' | 'self' =
          fromLower === lower && toLower === lower
            ? 'self'
            : fromLower === lower
              ? 'out'
              : 'in';
        rows.push({
          id: `${chainId}:${tx.hash}`,
          txHash: tx.hash,
          chainId,
          direction,
          category: 'native',
          label: `${direction === 'out' ? 'Sent' : 'Received'} native`,
          value: tx.value.toString(),
          ...(tx.to !== null && tx.to !== undefined && { counterparty: direction === 'out' ? tx.to : tx.from }),
          timestamp: block.timestamp,
          status: 'confirmed',
        });
        if (rows.length >= 25) break;
      }
      if (rows.length >= 25) break;
    }
    return rows;
  } catch {
    return [];
  }
}

/**
 * Convenience: validator-first, fallback to chain-scan on the primary
 * chain when the validator returns nothing.
 *
 * @param address - Wallet address.
 * @param fallbackChainId - Chain to scan when validator is empty.
 * @returns Rows.
 */
export async function getHistory(
  address: string,
  fallbackChainId = 88008,
): Promise<TxHistoryRow[]> {
  const fromValidator = await fetchValidatorHistory(address);
  if (fromValidator.length > 0) return fromValidator;
  return fetchNativeFallback(address, fallbackChainId);
}

/**
 * Coerce a raw validator row into a typed {@link TxHistoryRow}. Returns
 * undefined on malformed rows so the caller can filter them out.
 *
 * @param raw - Unknown value from the HTTP response.
 * @returns Row, or undefined.
 */
function normalizeRow(raw: unknown): TxHistoryRow | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const txHash = typeof r['txHash'] === 'string' ? r['txHash'] : undefined;
  const chainId = typeof r['chainId'] === 'number' ? r['chainId'] : undefined;
  if (txHash === undefined || chainId === undefined) return undefined;
  const direction = ((): TxHistoryRow['direction'] => {
    const d = r['direction'];
    if (d === 'in' || d === 'out' || d === 'self') return d;
    return 'out';
  })();
  const category = ((): TxHistoryRow['category'] => {
    const c = r['category'];
    if (
      c === 'native' ||
      c === 'erc20' ||
      c === 'swap' ||
      c === 'marketplace' ||
      c === 'nft' ||
      c === 'predictions' ||
      c === 'staking' ||
      c === 'privacy'
    ) {
      return c;
    }
    return 'other';
  })();
  return {
    id: typeof r['id'] === 'string' ? r['id'] : `${chainId}:${txHash}`,
    txHash,
    chainId,
    direction,
    category,
    label: typeof r['label'] === 'string' ? r['label'] : category,
    value: typeof r['value'] === 'string' ? r['value'] : '0',
    ...(typeof r['symbol'] === 'string' && { symbol: r['symbol'] }),
    ...(typeof r['counterparty'] === 'string' && { counterparty: r['counterparty'] }),
    timestamp:
      typeof r['timestamp'] === 'number'
        ? r['timestamp']
        : Math.floor(Date.now() / 1000),
    ...(r['privacy'] === true && { privacy: true }),
    ...(typeof r['status'] === 'string' && { status: r['status'] }),
  };
}
