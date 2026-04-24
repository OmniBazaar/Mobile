/**
 * SwapService.executeQuote — integration test with mocked
 * UniversalSwapClient + ClientRPCRegistry.
 *
 * Locks in the three-step flow (execute → sign+broadcast → submitSignedTx)
 * without hitting a live validator or chain.
 */

import type { TransactionRequest, TransactionResponse } from 'ethers';

// Mock the UniversalSwapClient. The factory returns a stable object so
// the SwapService under test sees the same mock on each call.
const mockExecute = jest.fn();
const mockSubmitSignedTx = jest.fn(async () => undefined);

jest.mock('@wallet/services/dex/UniversalSwapClient', () => ({
  getUniversalSwapClient: () => ({
    execute: mockExecute,
    submitSignedTx: mockSubmitSignedTx,
  }),
}));

// Mock the ClientRPCRegistry. `getProvider` returns undefined by default;
// individual tests override per-chain.
const mockProvider = { __mock: true } as const;
const mockGetProvider = jest.fn();

jest.mock('@wallet/core/providers/ClientRPCRegistry', () => ({
  getClientRPCRegistry: () => ({
    getProvider: mockGetProvider,
  }),
}));

// Mock ethers.Wallet.fromPhrase so we don't actually derive keys.
// The returned object's sendTransaction resolves to a canned
// TransactionResponse whose wait() resolves immediately.
const mockSendTransaction = jest.fn(async (tx: TransactionRequest) => {
  const hash = `0x${'a'.repeat(62)}${(tx.chainId ?? 0).toString(16).padStart(2, '0')}`;
  return {
    hash,
    wait: async (): Promise<null> => null,
  } as unknown as TransactionResponse;
});

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    Wallet: {
      ...actual.Wallet,
      fromPhrase: jest.fn(() => ({
        sendTransaction: mockSendTransaction,
      })),
    },
  };
});

import { executeQuote } from '../../src/services/SwapService';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('SwapService.executeQuote', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProvider.mockReturnValue(mockProvider);
  });

  it('calls UniversalSwapClient.execute with the quoteId + address', async () => {
    mockExecute.mockResolvedValue({
      operationId: 'op-123',
      status: 'submitted',
      message: 'ok',
      transactions: [],
    });
    await executeQuote({
      quoteId: 'q-abc',
      address: '0x1111111111111111111111111111111111111111',
      mnemonic: MNEMONIC,
    });
    expect(mockExecute).toHaveBeenCalledWith(
      'q-abc',
      '0x1111111111111111111111111111111111111111',
    );
  });

  it('signs + broadcasts every unsigned tx in order', async () => {
    mockExecute.mockResolvedValue({
      operationId: 'op-456',
      status: 'submitted',
      message: 'ok',
      transactions: [
        { step: 'approve', chainId: 1, to: '0xA', data: '0x01', value: '0', description: '' },
        { step: 'swap', chainId: 1, to: '0xB', data: '0x02', value: '0', description: '' },
      ],
    });

    const result = await executeQuote({
      quoteId: 'q-1',
      address: '0x1111111111111111111111111111111111111111',
      mnemonic: MNEMONIC,
    });

    expect(mockSendTransaction).toHaveBeenCalledTimes(2);
    expect(result.txHashes).toHaveLength(2);
    expect(result.chainIds).toEqual([1, 1]);
    expect(result.operationId).toBe('op-456');
    expect(result.status).toBe('submitted');
  });

  it('reports deposit + claim step labels to the validator', async () => {
    mockExecute.mockResolvedValue({
      operationId: 'op-789',
      status: 'awaiting_claim',
      message: 'claim required',
      transactions: [
        { step: 'approve', chainId: 10, to: '0xA', data: '0x', value: '0', description: '' },
        { step: 'claim', chainId: 42161, to: '0xB', data: '0x', value: '0', description: '' },
      ],
    });

    await executeQuote({
      quoteId: 'q-2',
      address: '0x2222222222222222222222222222222222222222',
      mnemonic: MNEMONIC,
    });

    // Each on-chain tx should push its hash to the validator with the
    // right step label. 'approve' maps to 'deposit'; 'claim' stays 'claim'.
    expect(mockSubmitSignedTx).toHaveBeenCalledTimes(2);
    expect(mockSubmitSignedTx.mock.calls[0]).toEqual(
      expect.arrayContaining(['op-789', expect.any(String), 'deposit']),
    );
    expect(mockSubmitSignedTx.mock.calls[1]).toEqual(
      expect.arrayContaining(['op-789', expect.any(String), 'claim']),
    );
  });

  it('continues the flow when submitSignedTx fails (non-fatal push)', async () => {
    mockExecute.mockResolvedValue({
      operationId: 'op-x',
      status: 'submitted',
      message: '',
      transactions: [
        { step: 'swap', chainId: 8453, to: '0xC', data: '0x', value: '0', description: '' },
      ],
    });
    mockSubmitSignedTx.mockRejectedValueOnce(new Error('validator down'));

    const result = await executeQuote({
      quoteId: 'q-3',
      address: '0x3333333333333333333333333333333333333333',
      mnemonic: MNEMONIC,
    });

    // Tx was still broadcast + included in the result.
    expect(result.txHashes).toHaveLength(1);
    expect(mockSendTransaction).toHaveBeenCalledTimes(1);
  });

  it('throws a clear error when the target chain has no RPC provider', async () => {
    mockExecute.mockResolvedValue({
      operationId: 'op-y',
      status: 'submitted',
      message: '',
      transactions: [
        { step: 'swap', chainId: 999, to: '0xD', data: '0x', value: '0', description: '' },
      ],
    });
    mockGetProvider.mockReturnValueOnce(undefined);

    await expect(
      executeQuote({
        quoteId: 'q-4',
        address: '0x4444444444444444444444444444444444444444',
        mnemonic: MNEMONIC,
      }),
    ).rejects.toThrow(/no RPC provider available for chainId 999/);
  });

  it('returns an empty txHashes array when execute returns zero transactions', async () => {
    mockExecute.mockResolvedValue({
      operationId: 'op-empty',
      status: 'queued',
      message: 'nothing to sign yet',
      transactions: [],
    });

    const result = await executeQuote({
      quoteId: 'q-5',
      address: '0x5555555555555555555555555555555555555555',
      mnemonic: MNEMONIC,
    });
    expect(result.txHashes).toEqual([]);
    expect(result.chainIds).toEqual([]);
    expect(result.status).toBe('queued');
  });
});
