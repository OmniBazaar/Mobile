/**
 * PortfolioClient — thin Mobile-side wrapper around the canonical
 * `PortfolioService` exported by `@wallet`.
 *
 * The service is a singleton that hits the validator's
 * `/api/v1/wallet/portfolio/:address` endpoints to aggregate balances
 * across all SUPPORTED_CHAIN_IDS (Ethereum, Arbitrum, Base, Polygon,
 * Optimism, Avalanche, OmniCoin L1) plus DeFi positions and top
 * holdings. The validator does the Multicall3 + ERC-20 metadata work
 * server-side, so the wallet only needs to render.
 *
 * Mobile uses the singleton directly but constructs it with the
 * Mobile-local validator base URL so the same import works whether the
 * device is on Wi-Fi (validator over LAN) or cellular (validator over
 * `https://wallet.omnibazaar.com`). `getInstance` only honours the
 * `apiBase` argument on first call, so we resolve it through
 * `BootstrapService.getBaseUrl()` exactly once per session.
 *
 * @module services/PortfolioClient
 */

import { PortfolioService } from '@wallet/services/PortfolioService';
import { getBaseUrl } from './BootstrapService';

/**
 * Return the lazily-initialised PortfolioService bound to the Mobile
 * app's active validator base URL.
 *
 * @returns The shared PortfolioService instance.
 */
export function getPortfolioService(): PortfolioService {
  return PortfolioService.getInstance(getBaseUrl());
}
