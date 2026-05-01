/**
 * PriceOracle unit tests.
 *
 * Validates:
 *   - CoinGecko native + ERC-20 success paths.
 *   - Li.Fi fallback when CoinGecko fails or is unsupported.
 *   - 5-minute cache reuse without refetch.
 *   - undefined return on every-source failure.
 */

import { clearPriceCache, getTokenUsdPrice } from '../../src/services/PriceOracle';

type FetchMock = jest.Mock;
const realFetch = global.fetch;

beforeEach(() => {
  clearPriceCache();
  global.fetch = jest.fn() as unknown as typeof fetch;
});

afterAll(() => {
  global.fetch = realFetch;
});

describe('PriceOracle', () => {
  it('fetches a native price from CoinGecko', async () => {
    (global.fetch as FetchMock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ethereum: { usd: 1850.42 } }),
    });
    const price = await getTokenUsdPrice(1, undefined);
    expect(price).toBe(1850.42);
  });

  it('fetches an ERC-20 price from CoinGecko', async () => {
    (global.fetch as FetchMock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { usd: 1.0 },
      }),
    });
    const price = await getTokenUsdPrice(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    expect(price).toBe(1.0);
  });

  it('falls back to Li.Fi when CoinGecko returns non-OK', async () => {
    (global.fetch as FetchMock)
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ priceUSD: '12.34' }),
      });
    const price = await getTokenUsdPrice(1, '0x' + 'a'.repeat(40));
    expect(price).toBe(12.34);
  });

  it('returns undefined when every provider fails', async () => {
    (global.fetch as FetchMock)
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    const price = await getTokenUsdPrice(1, '0x' + 'b'.repeat(40));
    expect(price).toBeUndefined();
  });

  it('caches successful reads for 5 minutes', async () => {
    (global.fetch as FetchMock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ethereum: { usd: 2000 } }),
    });
    await getTokenUsdPrice(1, undefined);
    await getTokenUsdPrice(1, undefined);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT cache an undefined result', async () => {
    // Native chains only hit CoinGecko (no Li.Fi fallback for natives),
    // so each `getTokenUsdPrice(1, undefined)` consumes exactly one
    // mock. First call fails → undefined → not cached. Second call
    // succeeds → 2100 → cached.
    (global.fetch as FetchMock)
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ethereum: { usd: 2100 } }),
      });
    expect(await getTokenUsdPrice(1, undefined)).toBeUndefined();
    const second = await getTokenUsdPrice(1, undefined);
    expect(second).toBe(2100);
    // Two distinct fetches — proves the first failure was not cached.
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
