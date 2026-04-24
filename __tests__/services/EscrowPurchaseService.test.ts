/**
 * EscrowPurchaseService — unit test.
 *
 * Mocks MarketplaceClient.createEscrow and asserts the service:
 *   - signs an EIP-712 CreateEscrow intent bound to MinimalEscrow
 *   - forwards the listing + buyer + signature to the validator
 *   - returns the validator's escrowId/chatThreadId/txHash unchanged
 */

const mockCreateEscrow = jest.fn();
jest.mock('@wallet/services/marketplace/MarketplaceClient', () => ({
  getMarketplaceClient: () => ({
    createEscrow: mockCreateEscrow,
  }),
}));

import { purchaseEscrow } from '../../src/services/EscrowPurchaseService';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const LISTING = {
  id: 'listing-42',
  sellerAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  sellerUsername: 'alice',
  title: 'Sample item',
  description: 'desc',
  price: '10.5',
  currency: 'XOM',
  category: 'electronics',
  subcategory: '',
  images: [],
  createdAt: 0,
  status: 'ACTIVE',
} as unknown as import('@wallet/services/marketplace/MarketplaceClient').MarketplaceListing;

describe('EscrowPurchaseService.purchaseEscrow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateEscrow.mockResolvedValue({
      escrowId: '101',
      chatThreadId: 'chat-1',
      txHash: '0xfeedcafe',
    });
  });

  it('signs + forwards the intent to MarketplaceClient.createEscrow', async () => {
    const result = await purchaseEscrow({
      listing: LISTING,
      buyer: '0x1111111111111111111111111111111111111111',
      mnemonic: MNEMONIC,
    });
    expect(result.escrowId).toBe('101');
    expect(result.chatThreadId).toBe('chat-1');
    expect(result.txHash).toBe('0xfeedcafe');
    expect(mockCreateEscrow).toHaveBeenCalledTimes(1);
    const [payload] = mockCreateEscrow.mock.calls[0];
    expect(payload.listingId).toBe('listing-42');
    expect(payload.amount).toBe('10.5');
    expect(payload.currency).toBe('XOM');
    expect(payload.buyerAddress).toBe('0x1111111111111111111111111111111111111111');
    expect(payload.sellerAddress).toBe(LISTING.sellerAddress);
    expect(typeof payload.intentSignature).toBe('string');
    expect(payload.intentSignature.startsWith('0x')).toBe(true);
    expect(typeof payload.intentTimestamp).toBe('number');
  });

  it('passes through optional referrers when provided', async () => {
    await purchaseEscrow({
      listing: LISTING,
      buyer: '0x1111111111111111111111111111111111111111',
      mnemonic: MNEMONIC,
      referrer: '0x2222222222222222222222222222222222222222',
      referrer2: '0x3333333333333333333333333333333333333333',
    });
    const [payload] = mockCreateEscrow.mock.calls[0];
    expect(payload.referrer).toBe('0x2222222222222222222222222222222222222222');
    expect(payload.referrer2).toBe('0x3333333333333333333333333333333333333333');
  });
});
