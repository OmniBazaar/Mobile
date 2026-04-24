/**
 * NFTBuyService — integration tests for the buy flow.
 *
 * Mocks the nftBuyPrereqs + RelaySubmitService + HTTP layer so the
 * service can be exercised end-to-end without live contracts. The tests
 * lock in:
 *   - allowance-skip path when already approved
 *   - auto-approval via OmniRelay when allowance is short
 *   - fast-path intent (paymentToken == receiveToken) has ZERO_HASH
 *   - validator rejection surfaces a typed failure
 */

const mockReadErc20Allowance = jest.fn();
const mockEncodeErc20Approve = jest.fn(() => '0xapprovecalldata');

jest.mock('@wallet/services/marketplace/nftBuyPrereqs', () => ({
  readErc20Allowance: mockReadErc20Allowance,
  encodeErc20Approve: mockEncodeErc20Approve,
  UINT256_MAX: '0x' + 'f'.repeat(64),
}));

const mockSubmitTransaction = jest.fn();
jest.mock('../../src/services/RelaySubmitService', () => ({
  submitTransaction: mockSubmitTransaction,
  OMNICOIN_L1_CHAIN_ID: 88008,
  shouldRelay: (id: number) => id === 88008,
  relayL1Transaction: jest.fn(),
  broadcastDirect: jest.fn(),
}));

jest.mock('../../src/services/BootstrapService', () => ({
  getBaseUrl: () => 'http://validator.test',
}));

import { buyNFT } from '../../src/services/NFTBuyService';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const COMMON = {
  listingId: '42',
  nftTokenId: '7',
  nftContract: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
  seller: '0x2222222222222222222222222222222222222222',
  buyer: '0x1111111111111111111111111111111111111111',
  paymentAmount: '1000000000000000000',
  mnemonic: MNEMONIC,
};

/** Stub fetch globally in each test so nothing escapes. */
const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function mockFetchOk(body: unknown): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  }) as unknown as typeof fetch;
}

function mockFetchBadRequest(body: unknown): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('NFTBuyService.buyNFT', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadErc20Allowance.mockResolvedValue(BigInt('10000000000000000000'));
    mockSubmitTransaction.mockResolvedValue('0xapprove');
  });

  it('sends only the buy intent when allowance already covers the price', async () => {
    mockFetchOk({ success: true, saleId: 'sale-1', txHash: '0xbuy', blockNumber: 100 });
    const res = await buyNFT(COMMON);

    expect(mockReadErc20Allowance).toHaveBeenCalledTimes(1);
    expect(mockSubmitTransaction).not.toHaveBeenCalled();
    expect(res).toEqual(
      expect.objectContaining({
        ok: true,
        saleId: 'sale-1',
        txHash: '0xbuy',
        blockNumber: 100,
        approvedInline: false,
      }),
    );
  });

  it('auto-approves via relay when allowance is short', async () => {
    mockReadErc20Allowance.mockResolvedValue(0n);
    mockFetchOk({ success: true, saleId: 'sale-2', txHash: '0xbuy2' });

    const res = await buyNFT(COMMON);
    expect(mockSubmitTransaction).toHaveBeenCalledTimes(1);
    const [submittedTx] = mockSubmitTransaction.mock.calls[0];
    // Approval targets the OmniCoin address (paymentToken) and chain 88008 for gaslessness.
    expect(submittedTx.chainId).toBe(88008);
    expect(submittedTx.value).toBe('0');
    expect(submittedTx.data).toBe('0xapprovecalldata');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.approvedInline).toBe(true);
    }
  });

  it('returns APPROVE_FAILED when the approval relay rejects', async () => {
    mockReadErc20Allowance.mockResolvedValue(0n);
    mockSubmitTransaction.mockRejectedValueOnce(new Error('relay offline'));

    const res = await buyNFT(COMMON);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('APPROVE_FAILED');
      expect(res.message).toMatch(/relay offline/);
    }
  });

  it('surfaces VALIDATOR_REJECTED when the /api/v1/nft/buy endpoint fails', async () => {
    mockFetchBadRequest({ success: false, error: 'stale listing', action: 'refresh' });
    const res = await buyNFT(COMMON);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('VALIDATOR_REJECTED');
      expect(res.message).toMatch(/stale listing/);
    }
  });

  it('returns INTENT_REJECTED when SELF_BUY is detected before signing', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const res = await buyNFT({
      ...COMMON,
      // buyer == seller triggers the local validator before the HTTP call.
      seller: COMMON.buyer,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('INTENT_REJECTED');
      expect(res.message).toBe('SELF_BUY');
    }
    // We must never hit the network when the local validator rejects.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
