/**
 * CreateListingService unit tests.
 *
 * The service signs the gasless intent with the seller's mnemonic and
 * POSTs to the validator via MarketplaceClient. We verify:
 *   - The canonical EIP-191 string is `${seller} ${title} ${price} ${currency} ${ts}`.
 *   - The signature is recoverable to the seller address.
 *   - Optional location fields only ride along when truthy.
 *   - The MarketplaceClient receives the right payload shape.
 */

import { ethers, Mnemonic } from 'ethers';
import { createListing } from '../../src/services/CreateListingService';

const createListingMock = jest.fn();

jest.mock('@wallet/services/marketplace/MarketplaceClient', () => ({
  getMarketplaceClient: () => ({
    createListing: (payload: unknown): Promise<unknown> => createListingMock(payload),
  }),
}));

const TEST_MNEMONIC = Mnemonic.fromEntropy('0x' + '00'.repeat(16)).phrase;
const TEST_ADDRESS = ethers.Wallet.fromPhrase(TEST_MNEMONIC).address;

beforeEach(() => {
  createListingMock.mockReset();
  createListingMock.mockResolvedValue({ listingId: 'L-123' });
});

describe('CreateListingService.createListing', () => {
  it('signs the canonical EIP-191 string and forwards a complete payload', async () => {
    const result = await createListing({
      title: 'Vintage Watch',
      description: 'Mid-century Omega',
      price: '120',
      currency: 'XOM',
      category: 'products',
      imageUrls: ['ipfs://Qm1', 'ipfs://Qm2'],
      sellerAddress: TEST_ADDRESS,
      mnemonic: TEST_MNEMONIC,
      country: 'US',
      region: 'CA',
      city: 'San Diego',
    });

    expect(result.listingId).toBe('L-123');
    expect(createListingMock).toHaveBeenCalledTimes(1);
    const payload = createListingMock.mock.calls[0]?.[0] as {
      sellerAddress: string;
      title: string;
      price: string;
      currency: string;
      category: string;
      images: string[];
      intentSignature: string;
      intentTimestamp: number;
      country?: string;
      region?: string;
      city?: string;
    };
    expect(payload.sellerAddress).toBe(TEST_ADDRESS);
    expect(payload.title).toBe('Vintage Watch');
    expect(payload.price).toBe('120');
    expect(payload.currency).toBe('XOM');
    expect(payload.category).toBe('products');
    expect(payload.images).toEqual(['ipfs://Qm1', 'ipfs://Qm2']);
    expect(payload.country).toBe('US');
    expect(payload.region).toBe('CA');
    expect(payload.city).toBe('San Diego');

    // Recover signer from the canonical message — it must equal the
    // seller address.
    const canonical = `${TEST_ADDRESS} ${payload.title} ${payload.price} ${payload.currency} ${payload.intentTimestamp}`;
    const recovered = ethers.verifyMessage(canonical, payload.intentSignature);
    expect(recovered.toLowerCase()).toBe(TEST_ADDRESS.toLowerCase());
  });

  it('omits optional location fields when not provided', async () => {
    await createListing({
      title: 'T-shirt',
      description: 'Cotton',
      price: '15',
      currency: 'USDC',
      category: 'products',
      imageUrls: ['ipfs://Qm3'],
      sellerAddress: TEST_ADDRESS,
      mnemonic: TEST_MNEMONIC,
    });
    const payload = createListingMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload['country']).toBeUndefined();
    expect(payload['region']).toBeUndefined();
    expect(payload['city']).toBeUndefined();
  });

  it('propagates validator errors', async () => {
    createListingMock.mockRejectedValueOnce(new Error('intent signature invalid'));
    await expect(
      createListing({
        title: 'X',
        description: 'Y',
        price: '1',
        currency: 'XOM',
        category: 'products',
        imageUrls: ['ipfs://X'],
        sellerAddress: TEST_ADDRESS,
        mnemonic: TEST_MNEMONIC,
      }),
    ).rejects.toThrow(/intent signature invalid/);
  });

  it('embeds an integer timestamp close to Date.now()', async () => {
    const before = Date.now();
    await createListing({
      title: 'X',
      description: 'Y',
      price: '1',
      currency: 'XOM',
      category: 'products',
      imageUrls: ['ipfs://X'],
      sellerAddress: TEST_ADDRESS,
      mnemonic: TEST_MNEMONIC,
    });
    const after = Date.now();
    const payload = createListingMock.mock.calls[0]?.[0] as { intentTimestamp: number };
    expect(payload.intentTimestamp).toBeGreaterThanOrEqual(before);
    expect(payload.intentTimestamp).toBeLessThanOrEqual(after);
    expect(Number.isInteger(payload.intentTimestamp)).toBe(true);
  });
});
