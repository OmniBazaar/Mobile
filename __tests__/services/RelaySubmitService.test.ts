/**
 * RelaySubmitService — unit tests for gasless L1 routing.
 *
 * Asserts that `shouldRelay(88008)` is true (with OmniForwarder configured)
 * and false for every other chain, and that `submitTransaction` picks the
 * relay path for L1 and the direct path for non-L1. The underlying
 * `WalletRelayingSigner` + `ethers.Wallet.sendTransaction()` calls are
 * mocked at the module boundary so no real signing / RPC work happens.
 */

const mockRelaySend = jest.fn();
const mockDirectSend = jest.fn();

jest.mock('@wallet/services/relay/WalletRelayingSigner', () => ({
  WalletRelayingSigner: jest.fn().mockImplementation(() => ({
    sendTransaction: mockRelaySend,
  })),
}));

jest.mock('@wallet/services/relay/OmniRelayClient', () => ({
  OmniRelayClient: {
    getInstance: () => ({
      isRelayAvailable: (addresses: { OmniForwarder?: string }) =>
        addresses.OmniForwarder !== undefined &&
        addresses.OmniForwarder !== '0x0000000000000000000000000000000000000000',
    }),
  },
}));

jest.mock('@wallet/core/providers/ClientRPCRegistry', () => ({
  getClientRPCRegistry: () => ({
    getProvider: (chainId: number) => ({ __provider: true, chainId }),
  }),
}));

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ...actual,
    Wallet: {
      ...actual.Wallet,
      fromPhrase: jest.fn(() => ({
        sendTransaction: mockDirectSend,
      })),
    },
  };
});

import {
  broadcastDirect,
  OMNICOIN_L1_CHAIN_ID,
  relayL1Transaction,
  shouldRelay,
  submitTransaction,
} from '../../src/services/RelaySubmitService';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('RelaySubmitService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRelaySend.mockResolvedValue({
      hash: '0xrelay',
      wait: async (): Promise<null> => null,
    });
    mockDirectSend.mockResolvedValue({
      hash: '0xdirect',
      wait: async (): Promise<null> => null,
    });
  });

  describe('shouldRelay', () => {
    it('returns true for OmniCoin L1 (88008)', () => {
      expect(shouldRelay(OMNICOIN_L1_CHAIN_ID)).toBe(true);
    });

    it('returns false for any non-L1 chain', () => {
      for (const id of [1, 10, 137, 8453, 42161, 43114, 56]) {
        expect(shouldRelay(id)).toBe(false);
      }
    });
  });

  describe('submitTransaction routing', () => {
    it('uses OmniForwarder (WalletRelayingSigner) for L1 txs', async () => {
      const hash = await submitTransaction(
        { to: '0xA', data: '0x', value: '0', chainId: OMNICOIN_L1_CHAIN_ID },
        MNEMONIC,
      );
      expect(mockRelaySend).toHaveBeenCalledTimes(1);
      expect(mockDirectSend).not.toHaveBeenCalled();
      expect(hash).toBe('0xrelay');
    });

    it('broadcasts directly (no forwarder) for non-L1 txs', async () => {
      const hash = await submitTransaction(
        { to: '0xA', data: '0x', value: '0', chainId: 1 },
        MNEMONIC,
      );
      expect(mockDirectSend).toHaveBeenCalledTimes(1);
      expect(mockRelaySend).not.toHaveBeenCalled();
      expect(hash).toBe('0xdirect');
    });
  });

  describe('relayL1Transaction', () => {
    it('rejects when called with a non-L1 chainId', async () => {
      await expect(
        relayL1Transaction({ to: '0xA', data: '0x', value: '0', chainId: 1 }, MNEMONIC),
      ).rejects.toThrow(/expected chainId 88008/);
    });
  });

  describe('broadcastDirect value parsing', () => {
    it('treats empty and 0x values as zero', async () => {
      await broadcastDirect({ to: '0xA', data: '0x', value: '', chainId: 1 }, MNEMONIC);
      await broadcastDirect({ to: '0xA', data: '0x', value: '0x', chainId: 1 }, MNEMONIC);
      expect(mockDirectSend).toHaveBeenCalledTimes(2);
      for (const call of mockDirectSend.mock.calls) {
        expect(call[0]?.value).toBe(0n);
      }
    });
  });
});
