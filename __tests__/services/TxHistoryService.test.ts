/**
 * TxHistoryService — unit tests for the validator-first history fetch.
 */

jest.mock('../../src/services/BootstrapService', () => ({
  getBaseUrl: () => 'http://validator.test',
}));

jest.mock('@wallet/core/providers/ClientRPCRegistry', () => ({
  getClientRPCRegistry: () => ({
    getProvider: () => undefined,
  }),
}));

import {
  fetchValidatorHistory,
  getHistory,
  type TxHistoryRow,
} from '../../src/services/TxHistoryService';

const ADDR = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function mockOk(body: unknown): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('TxHistoryService', () => {
  it('returns [] when the address is empty', async () => {
    const rows = await fetchValidatorHistory('');
    expect(rows).toEqual([]);
  });

  it('parses validator envelope { success, data: { rows } }', async () => {
    mockOk({
      success: true,
      data: {
        rows: [
          {
            id: 'v-1',
            txHash: '0xhash1',
            chainId: 88008,
            direction: 'in',
            category: 'native',
            label: 'Received XOM',
            value: '100',
            symbol: 'XOM',
            timestamp: 1,
            privacy: false,
          },
          {
            txHash: '0xhash2',
            chainId: 88008,
            category: 'privacy',
            label: 'Shielded',
            value: '50',
            privacy: true,
          },
        ],
      },
    });
    const rows = await fetchValidatorHistory(ADDR);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe('v-1');
    expect(rows[0]?.symbol).toBe('XOM');
    // Row without explicit id falls back to `${chainId}:${txHash}`.
    expect(rows[1]?.id).toBe('88008:0xhash2');
    expect(rows[1]?.privacy).toBe(true);
    expect(rows[1]?.category).toBe('privacy');
  });

  it('drops malformed rows', async () => {
    mockOk({
      success: true,
      data: {
        rows: [
          {}, // no txHash/chainId
          { txHash: 'ok', chainId: 1, direction: 'out', category: 'swap', value: '1' },
        ],
      },
    });
    const rows = await fetchValidatorHistory(ADDR);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.chainId).toBe(1);
    expect(rows[0]?.category).toBe('swap');
  });

  it('returns [] when the validator returns { success: false }', async () => {
    mockOk({ success: false, error: 'broken' });
    const rows = await fetchValidatorHistory(ADDR);
    expect(rows).toEqual([]);
  });

  it('getHistory falls back to [] when validator is empty and no chain provider', async () => {
    mockOk({ success: true, data: { rows: [] } });
    const rows: TxHistoryRow[] = await getHistory(ADDR, 88008);
    expect(rows).toEqual([]);
  });
});
