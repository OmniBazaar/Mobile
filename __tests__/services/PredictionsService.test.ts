/**
 * PredictionsService — integration tests for buy + claim flows.
 *
 * Mocks the shared PredictionsClient + RelaySubmitService so the service
 * orchestration (quote → build → approve? → trade → submitTrade) can be
 * verified without hitting the validator.
 */

const mockGetTradeQuote = jest.fn();
const mockBuildTradeTx = jest.fn();
const mockBuildClaim = jest.fn();
const mockSubmitTrade = jest.fn();

jest.mock('@wallet/services/predictions/PredictionsClient', () => ({
  getPredictionsClient: () => ({
    getTradeQuote: mockGetTradeQuote,
    buildTradeTx: mockBuildTradeTx,
    buildClaim: mockBuildClaim,
    submitTrade: mockSubmitTrade,
  }),
}));

const mockSubmitTransaction = jest.fn();
jest.mock('../../src/services/RelaySubmitService', () => ({
  submitTransaction: mockSubmitTransaction,
  OMNICOIN_L1_CHAIN_ID: 88008,
  shouldRelay: (id: number) => id === 88008,
  relayL1Transaction: jest.fn(),
  broadcastDirect: jest.fn(),
}));

import {
  buyOutcome,
  claimOutcome,
  getQuote,
} from '../../src/services/PredictionsService';
import type {
  PredictionMarketDetail,
  PredictionOutcome,
} from '@wallet/services/predictions/PredictionsClient';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const MARKET: PredictionMarketDetail = {
  id: 'polymarket:0xabc',
  platform: 'polymarket',
  conditionId: '0xabc',
  question: 'Test market',
  status: 'open',
  category: 'test',
  totalVolume: '1000',
  resolutionDate: '2026-12-31',
  outcomes: [
    { label: 'Yes', price: '0.5', payout: '1.0' },
    { label: 'No', price: '0.5', payout: '1.0' },
  ],
  collateralToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  routerAddress: '0xE2F12A18f10DBdb925458B1e6aacC88bb1Ff9978',
  chainId: 137,
} as unknown as PredictionMarketDetail;

describe('PredictionsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTradeQuote.mockResolvedValue({
      netAmount: '4.95',
      totalAmount: '5.00',
      feeAmount: '0.05',
      feeRateBps: 100,
      expectedShares: '9.9',
      midPrice: '0.5',
    });
    mockBuildTradeTx.mockResolvedValue({
      to: '0xROUTER',
      data: '0xdeadbeef',
      value: '0',
      chainId: 137,
      collateralToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      routerAddress: '0xE2F12A18f10DBdb925458B1e6aacC88bb1Ff9978',
    });
    mockSubmitTrade.mockResolvedValue({ orderId: 'order-123' });
    mockSubmitTransaction.mockResolvedValue('0xtradehash');
  });

  describe('getQuote', () => {
    it('returns the validator quote', async () => {
      const q = await getQuote(MARKET.id, 'yes', '5');
      expect(q.totalAmount).toBe('5.00');
      expect(mockGetTradeQuote).toHaveBeenCalledWith(MARKET.id, 'yes', '5');
    });
  });

  describe('buyOutcome', () => {
    it('runs quote → build → trade → submit without an approval tx', async () => {
      const res = await buyOutcome({
        market: MARKET,
        outcome: 'yes' as PredictionOutcome,
        amountUsd: '5',
        buyer: '0x1111111111111111111111111111111111111111',
        mnemonic: MNEMONIC,
      });
      expect(mockGetTradeQuote).toHaveBeenCalledTimes(1);
      expect(mockBuildTradeTx).toHaveBeenCalledTimes(1);
      expect(mockSubmitTransaction).toHaveBeenCalledTimes(1);
      expect(mockSubmitTrade).toHaveBeenCalledTimes(1);
      expect(res.tradeTxHash).toBe('0xtradehash');
      expect(res.orderId).toBe('order-123');
      expect(res.approvalTxHash).toBeUndefined();
    });

    it('broadcasts the approval tx first when the build response requires it', async () => {
      mockBuildTradeTx.mockResolvedValueOnce({
        to: '0xROUTER',
        data: '0xtradecalldata',
        value: '0',
        chainId: 137,
        collateralToken: '0xUSDC',
        routerAddress: '0xROUTER',
        approvalTx: {
          to: '0xUSDC',
          data: '0xapprovecalldata',
          value: '0',
          chainId: 137,
        },
      });
      mockSubmitTransaction
        .mockResolvedValueOnce('0xapprove')
        .mockResolvedValueOnce('0xtrade');

      const res = await buyOutcome({
        market: MARKET,
        outcome: 'no',
        amountUsd: '10',
        buyer: '0x1111111111111111111111111111111111111111',
        mnemonic: MNEMONIC,
      });
      expect(mockSubmitTransaction).toHaveBeenCalledTimes(2);
      expect(res.approvalTxHash).toBe('0xapprove');
      expect(res.tradeTxHash).toBe('0xtrade');
    });

    it('passes the expected routerAddress + collateralToken through to submitTrade', async () => {
      await buyOutcome({
        market: MARKET,
        outcome: 'yes',
        amountUsd: '5',
        buyer: '0x1111111111111111111111111111111111111111',
        mnemonic: MNEMONIC,
      });
      const [payload] = mockSubmitTrade.mock.calls[0];
      expect(payload.marketId).toBe(MARKET.id);
      expect(payload.platform).toBe('polymarket');
      expect(payload.chainId).toBe(137);
      expect(payload.routerAddress).toBe(
        '0xE2F12A18f10DBdb925458B1e6aacC88bb1Ff9978',
      );
    });
  });

  describe('claimOutcome', () => {
    beforeEach(() => {
      mockBuildClaim.mockResolvedValue({
        chainId: 137,
        to: '0xCTF',
        data: '0xredeem',
        value: '0',
      });
      mockSubmitTransaction.mockResolvedValue('0xclaimhash');
    });

    it('builds + signs + submits a redeem', async () => {
      const resolvedMarket = { ...MARKET, status: 'resolved' } as PredictionMarketDetail;
      const res = await claimOutcome({
        market: resolvedMarket,
        outcome: 'yes',
        trader: '0x1111111111111111111111111111111111111111',
        mnemonic: MNEMONIC,
      });
      expect(mockBuildClaim).toHaveBeenCalledTimes(1);
      const [payload] = mockBuildClaim.mock.calls[0];
      expect(payload.marketId).toBe(MARKET.id);
      expect(payload.outcome).toBe('yes');
      // Two signatures accompany a claim request: EIP-712 + legacy EIP-191.
      expect(typeof payload.signature).toBe('string');
      expect(payload.signature.startsWith('0x')).toBe(true);
      expect(typeof payload.legacySignature).toBe('string');
      expect(payload.legacyCanonical.startsWith('PREDICTION_CLAIM')).toBe(true);
      expect(res.txHash).toBe('0xclaimhash');
      expect(res.chainId).toBe(137);
    });

    it('refuses to sign an envelope with non-zero value', async () => {
      mockBuildClaim.mockResolvedValueOnce({
        chainId: 137,
        to: '0xCTF',
        data: '0xredeem',
        value: '1000000',
      });
      await expect(
        claimOutcome({
          market: MARKET,
          outcome: 'no',
          trader: '0x1111111111111111111111111111111111111111',
          mnemonic: MNEMONIC,
        }),
      ).rejects.toThrow(/non-zero value/);
    });
  });
});
