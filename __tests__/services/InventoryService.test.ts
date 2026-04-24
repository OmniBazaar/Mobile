/**
 * InventoryService — unit tests for the three inventory readers.
 */

jest.mock('../../src/services/BootstrapService', () => ({
  getBaseUrl: () => 'http://validator.test',
}));

import {
  getStakingPosition,
  listBuyerEscrows,
  listOwnedNFTs,
} from '../../src/services/InventoryService';

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

function mockFail(): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ success: false, error: '404' }),
  }) as unknown as typeof fetch;
}

describe('InventoryService.listOwnedNFTs', () => {
  it('returns [] for empty address', async () => {
    expect(await listOwnedNFTs('')).toEqual([]);
  });

  it('parses {data:{items:[]}} envelope', async () => {
    mockOk({
      success: true,
      data: {
        items: [
          {
            chainId: 88008,
            contractAddress: '0xAA',
            tokenId: '7',
            collectionName: 'Test',
            imageUrl: 'https://example/img.png',
            activeListingId: 'L-1',
          },
          { chainId: 1, contractAddress: '0xBB', tokenId: '42' },
        ],
      },
    });
    const rows = await listOwnedNFTs('0x1');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.collectionName).toBe('Test');
    expect(rows[0]?.activeListingId).toBe('L-1');
    expect(rows[1]?.chainId).toBe(1);
  });

  it('drops malformed rows', async () => {
    mockOk({ success: true, data: { items: [{ chainId: 1 }, {}] } });
    expect(await listOwnedNFTs('0x1')).toEqual([]);
  });

  it('returns [] on HTTP failure', async () => {
    mockFail();
    expect(await listOwnedNFTs('0x1')).toEqual([]);
  });
});

describe('InventoryService.listBuyerEscrows', () => {
  it('parses escrow rows with valid status', async () => {
    mockOk({
      success: true,
      data: {
        escrows: [
          {
            escrowId: '1',
            listingId: '101',
            status: 'FUNDED',
            buyerAddress: '0x1',
            sellerAddress: '0x2',
            amount: '10',
            currency: 'XOM',
            createdAt: 1_700_000_000_000,
            listingTitle: 'T-shirt',
          },
          {
            escrowId: '2',
            listingId: '102',
            status: 'BOGUS',
            buyerAddress: '0x1',
            sellerAddress: '0x2',
            amount: '10',
            currency: 'XOM',
            createdAt: 1_700_000_000_000,
          },
        ],
      },
    });
    const rows = await listBuyerEscrows('0x1');
    // The BOGUS-status row is dropped.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('FUNDED');
    expect(rows[0]?.listingTitle).toBe('T-shirt');
  });

  it('returns [] when validator returns success:false', async () => {
    mockOk({ success: false, error: 'no indexer' });
    expect(await listBuyerEscrows('0x1')).toEqual([]);
  });
});

describe('InventoryService.getStakingPosition', () => {
  it('parses {data:{...}} with optional unlockAt', async () => {
    mockOk({
      success: true,
      data: {
        amount: '5000000000000000000000',
        pendingRewards: '100000000000000000',
        baseAprBps: 600,
        bonusAprBps: 200,
        unlockAt: 1_800_000_000,
        participationScore: 55,
      },
    });
    const pos = await getStakingPosition('0x1');
    expect(pos?.amount).toBe('5000000000000000000000');
    expect(pos?.baseAprBps).toBe(600);
    expect(pos?.bonusAprBps).toBe(200);
    expect(pos?.unlockAt).toBe(1_800_000_000);
    expect(pos?.participationScore).toBe(55);
  });

  it('returns undefined when payload lacks amount', async () => {
    mockOk({ success: true, data: {} });
    expect(await getStakingPosition('0x1')).toBeUndefined();
  });

  it('returns undefined on HTTP failure', async () => {
    mockFail();
    expect(await getStakingPosition('0x1')).toBeUndefined();
  });
});
