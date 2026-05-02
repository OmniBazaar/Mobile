/**
 * FamilyPortfolioService unit tests.
 *
 * The service fans out to @wallet's family balance fetchers + applies
 * CoinGecko pricing. We mock both layers so the test runs offline.
 */

const fetchBitcoin = jest.fn();
const fetchSolana = jest.fn();
const fetchPolkadot = jest.fn();
const fetchCosmos = jest.fn();
const fetchCardano = jest.fn();
const fetchHedera = jest.fn();
const fetchNear = jest.fn();
const fetchStellar = jest.fn();
const fetchTezos = jest.fn();
const fetchTron = jest.fn();
const fetchXrp = jest.fn();

jest.mock('@wallet/core/providers/familyBalanceFetchers', () => ({
  fetchBitcoinFamilyBalance: (family: string, address: string): Promise<unknown> =>
    fetchBitcoin(family, address),
  fetchSolanaBalance: (a: string): Promise<unknown> => fetchSolana(a),
  fetchPolkadotBalance: (a: string): Promise<unknown> => fetchPolkadot(a),
  fetchCosmosBalance: (a: string): Promise<unknown> => fetchCosmos(a),
  fetchCardanoBalance: (a: string): Promise<unknown> => fetchCardano(a),
  fetchHederaBalance: (a: string): Promise<unknown> => fetchHedera(a),
  fetchNearBalance: (a: string): Promise<unknown> => fetchNear(a),
  fetchStellarBalance: (a: string): Promise<unknown> => fetchStellar(a),
  fetchTezosBalance: (a: string): Promise<unknown> => fetchTezos(a),
  fetchTronBalance: (a: string): Promise<unknown> => fetchTron(a),
  fetchXrpBalance: (a: string): Promise<unknown> => fetchXrp(a),
}));

import { fetchFamilyBalances, FAMILY_CHAIN_IDS } from '../../src/services/FamilyPortfolioService';

const realFetch = global.fetch;

beforeEach(() => {
  fetchBitcoin.mockReset();
  fetchSolana.mockReset();
  fetchPolkadot.mockReset();
  fetchCosmos.mockReset();
  fetchCardano.mockReset();
  fetchHedera.mockReset();
  fetchNear.mockReset();
  fetchStellar.mockReset();
  fetchTezos.mockReset();
  fetchTron.mockReset();
  fetchXrp.mockReset();
  // Default: every CoinGecko price probe returns 1 USD per unit so
  // totals are easy to assert.
  global.fetch = jest.fn().mockImplementation(async (url: string) => {
    const slug = url.match(/ids=([^&]+)/)?.[1];
    return {
      ok: true,
      json: async () => (slug ? { [slug]: { usd: 1 } } : {}),
    };
  }) as unknown as typeof fetch;
});

afterAll(() => {
  global.fetch = realFetch;
});

describe('FamilyPortfolioService.fetchFamilyBalances', () => {
  it('returns an empty result for an empty bundle', async () => {
    const result = await fetchFamilyBalances({});
    expect(result.rows).toEqual([]);
    expect(result.totalUsd).toBe(0);
    expect(result.hadErrors).toBe(false);
  });

  it('emits one row per populated family with applied USD price', async () => {
    fetchBitcoin.mockResolvedValueOnce({ raw: 50_000_000n, decimals: 8, symbol: 'BTC' }); // 0.5 BTC
    fetchSolana.mockResolvedValueOnce({ raw: 1_000_000_000n, decimals: 9, symbol: 'SOL' }); // 1 SOL
    fetchXrp.mockResolvedValueOnce({ raw: 10_000_000n, decimals: 6, symbol: 'XRP' }); // 10 XRP

    const result = await fetchFamilyBalances({
      bitcoin: 'bc1qfake',
      solana: 'SoLfake',
      xrp: 'rFake',
    });

    expect(result.rows).toHaveLength(3);
    const symbols = result.rows.map((r) => r.symbol).sort();
    expect(symbols).toEqual(['BTC', 'SOL', 'XRP']);
    // Prices all $1 in our mock → totalUsd = 0.5 + 1 + 10 = 11.5
    expect(result.totalUsd).toBeCloseTo(11.5, 5);
    expect(result.hadErrors).toBe(false);
    const btc = result.rows.find((r) => r.symbol === 'BTC');
    expect(btc?.chainId).toBe(FAMILY_CHAIN_IDS.bitcoin);
  });

  it('marks hadErrors=true when a fetcher rejects', async () => {
    fetchSolana.mockRejectedValueOnce(new Error('rpc unreachable'));
    const result = await fetchFamilyBalances({ solana: 'SoLfake' });
    expect(result.hadErrors).toBe(true);
    expect(result.rows).toEqual([]);
  });

  it('marks hadErrors=true when a fetcher returns undefined', async () => {
    fetchTron.mockResolvedValueOnce(undefined);
    const result = await fetchFamilyBalances({ tron: 'TFake' });
    expect(result.hadErrors).toBe(true);
    expect(result.rows).toEqual([]);
  });

  it('skips families whose address is empty/undefined', async () => {
    fetchSolana.mockResolvedValueOnce({ raw: 5n, decimals: 9, symbol: 'SOL' });
    const result = await fetchFamilyBalances({ solana: 'SoLfake', bitcoin: '' });
    expect(fetchBitcoin).not.toHaveBeenCalled();
    expect(result.rows.map((r) => r.symbol)).toEqual(['SOL']);
  });

  it('emits priceUsd=0 when CoinGecko declines for that family', async () => {
    fetchHedera.mockResolvedValueOnce({ raw: 100_000_000n, decimals: 8, symbol: 'HBAR' });
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    }) as unknown as typeof fetch;
    const result = await fetchFamilyBalances({ hedera: '0.0.123' });
    expect(result.rows[0]?.priceUsd).toBe(0);
    expect(result.rows[0]?.usdValue).toBe(0);
  });
});
