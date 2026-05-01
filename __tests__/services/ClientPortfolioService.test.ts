/**
 * ClientPortfolioService unit tests.
 *
 * Validates the on-device aggregator's contract:
 *   - Refuses malformed addresses with `undefined`.
 *   - Sums per-chain native + ERC-20 USD into `totalUsd`.
 *   - Sorts tokens by USD value descending.
 *   - Surfaces `hadErrors=true` when any chain fan-out fails.
 *
 * Mocks the underlying `PortfolioService` + `PriceOracle` modules so
 * the test runs without network access.
 */

import {
  clearClientPortfolioCache,
  getClientPortfolio,
} from '../../src/services/ClientPortfolioService';

jest.mock('../../src/services/PortfolioService', () => ({
  ERC20_TOKENS: [
    { chainId: 1, address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', decimals: 6 },
    { chainId: 8453, address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', symbol: 'USDC', decimals: 6 },
  ],
  fetchNativeBalances: jest.fn(),
  fetchErc20Balances: jest.fn(),
  formatRaw: (raw: bigint, decimals: number) => {
    const scale = 10n ** BigInt(decimals);
    const whole = raw / scale;
    const frac = raw % scale;
    if (frac === 0n) return whole.toString();
    let f = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
    return f === '' ? whole.toString() : `${whole.toString()}.${f}`;
  },
}));

jest.mock('../../src/services/PriceOracle', () => ({
  getTokenUsdPrices: jest.fn(),
  priceKey: (chainId: number, contract: string | undefined): string =>
    `${chainId}:${contract === undefined || contract === '' ? 'native' : contract.toLowerCase()}`,
}));

import * as portfolioServiceMod from '../../src/services/PortfolioService';
import * as priceOracleMod from '../../src/services/PriceOracle';

const portfolio = portfolioServiceMod as unknown as {
  fetchNativeBalances: jest.Mock;
  fetchErc20Balances: jest.Mock;
};
const priceOracle = priceOracleMod as unknown as {
  getTokenUsdPrices: jest.Mock;
};

const ADDR = '0x021868f2e3d49c059ef52b539aaa933b437e0321';

beforeEach(() => {
  clearClientPortfolioCache();
  jest.clearAllMocks();
});

describe('ClientPortfolioService.getClientPortfolio', () => {
  it('returns undefined for a malformed address', async () => {
    const result = await getClientPortfolio('not-an-address');
    expect(result).toBeUndefined();
  });

  it('sums native + ERC-20 across chains into a single totalUsd', async () => {
    portfolio.fetchNativeBalances.mockResolvedValueOnce([
      { chainId: 1, chainName: 'Ethereum', symbol: 'ETH', decimals: 18, raw: 1_000_000_000_000_000_000n }, // 1 ETH
      { chainId: 8453, chainName: 'Base', symbol: 'ETH', decimals: 18, raw: 500_000_000_000_000_000n }, // 0.5 ETH
    ]);
    portfolio.fetchErc20Balances.mockResolvedValueOnce([
      { chainId: 1, chainName: 'Ethereum', symbol: 'USDC', decimals: 6, raw: 100_000_000n }, // 100 USDC
      { chainId: 8453, chainName: 'Base', symbol: 'USDC', decimals: 6, raw: 50_000_000n }, // 50 USDC
    ]);
    priceOracle.getTokenUsdPrices.mockResolvedValueOnce(
      new Map([
        ['1:native', 2_000],
        ['8453:native', 2_000],
        ['1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 1.0],
        ['8453:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', 1.0],
      ]),
    );

    const result = await getClientPortfolio(ADDR);

    expect(result).toBeDefined();
    // 1 ETH × 2000 + 0.5 ETH × 2000 + 100 USDC + 50 USDC = 3150
    expect(result?.totalUsd).toBeCloseTo(3150, 5);
    expect(result?.chains).toHaveLength(2);
    expect(result?.tokens).toHaveLength(4);
    expect(result?.hadErrors).toBe(false);
    // Tokens are sorted by USD value descending; the largest row should
    // be ETH-on-Ethereum at $2000.
    const top = result?.tokens[0];
    expect(top?.symbol).toBe('ETH');
    expect(top?.chainId).toBe(1);
  });

  it('marks hadErrors=true when a chain fan-out fails', async () => {
    portfolio.fetchNativeBalances.mockResolvedValueOnce([
      {
        chainId: 1,
        chainName: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
        raw: 0n,
        error: 'rpc unreachable',
      },
    ]);
    portfolio.fetchErc20Balances.mockResolvedValueOnce([]);
    priceOracle.getTokenUsdPrices.mockResolvedValueOnce(new Map());

    const result = await getClientPortfolio(ADDR);
    expect(result?.hadErrors).toBe(true);
    expect(result?.chains[0]?.error).toBe(true);
    expect(result?.totalUsd).toBe(0);
  });

  it('serves the cached snapshot on subsequent calls within 30 s', async () => {
    portfolio.fetchNativeBalances.mockResolvedValue([]);
    portfolio.fetchErc20Balances.mockResolvedValue([]);
    priceOracle.getTokenUsdPrices.mockResolvedValue(new Map());

    await getClientPortfolio(ADDR);
    await getClientPortfolio(ADDR);

    expect(portfolio.fetchNativeBalances).toHaveBeenCalledTimes(1);
  });

  it('bypasses the cache when force=true', async () => {
    portfolio.fetchNativeBalances.mockResolvedValue([]);
    portfolio.fetchErc20Balances.mockResolvedValue([]);
    priceOracle.getTokenUsdPrices.mockResolvedValue(new Map());

    await getClientPortfolio(ADDR);
    await getClientPortfolio(ADDR, true);

    expect(portfolio.fetchNativeBalances).toHaveBeenCalledTimes(2);
  });
});
