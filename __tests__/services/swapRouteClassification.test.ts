/**
 * Tests for the Mobile Swap route classifier — mirrors the WebApp suite
 * since both modules share the same predicate semantics. Pure-function
 * tests; no mocks needed.
 */

import {
  requiresEmbeddedWallet,
  classifyQuoteForExternalWallet,
  OMNICOIN_CHAIN_ID,
} from '../../src/services/swapRouteClassification';
import type { SwapQuote } from '@wallet/services/dex/UniversalSwapClient';

/** Build a minimal route step at the given chains. */
function step(
  sourceChainId: number,
  targetChainId: number,
): SwapQuote['route'][number] {
  return {
    type: 'swap',
    label: 'test',
    protocol: 'test',
    estimatedTimeSeconds: 30,
    tokenIn: '0x0',
    tokenInSymbol: 'A',
    tokenOut: '0x0',
    tokenOutSymbol: 'B',
    sourceChainId,
    targetChainId,
  };
}

/** Build a SwapQuote stub. */
function quote(steps: ReturnType<typeof step>[]): SwapQuote {
  return {
    quoteId: 'q1',
    amountOut: '0',
    amountOutMin: '0',
    priceImpactBps: 0,
    totalFees: '0',
    feeBreakdown: {},
    route: steps,
    estimatedTimeSeconds: 30,
    expiresAt: 0,
  };
}

describe('Mobile swapRouteClassification', () => {
  describe('requiresEmbeddedWallet', () => {
    it('returns false for a pure EVM cross-chain route', () => {
      expect(
        requiresEmbeddedWallet(quote([step(1, 42161), step(42161, 8453)])),
      ).toBe(false);
    });

    it('returns true when source is OmniCoin L1', () => {
      expect(requiresEmbeddedWallet(quote([step(OMNICOIN_CHAIN_ID, 1)]))).toBe(true);
    });

    it('returns true when target is OmniCoin L1', () => {
      expect(requiresEmbeddedWallet(quote([step(1, OMNICOIN_CHAIN_ID)]))).toBe(true);
    });

    it('returns true when an intermediate hop touches L1', () => {
      expect(
        requiresEmbeddedWallet(
          quote([step(1, OMNICOIN_CHAIN_ID), step(OMNICOIN_CHAIN_ID, 42161)]),
        ),
      ).toBe(true);
    });

    it('returns false for empty / undefined route (defensive)', () => {
      expect(requiresEmbeddedWallet(quote([]))).toBe(false);
      const malformed = {
        ...quote([]),
        route: undefined as unknown as SwapQuote['route'],
      };
      expect(requiresEmbeddedWallet(malformed)).toBe(false);
    });
  });

  describe('classifyQuoteForExternalWallet', () => {
    it('returns null for a clean route on the right chain', () => {
      expect(classifyQuoteForExternalWallet(quote([step(1, 1)]), 1)).toBeNull();
    });

    it("returns 'requires-omnicoin' when L1 is touched", () => {
      expect(
        classifyQuoteForExternalWallet(quote([step(OMNICOIN_CHAIN_ID, 1)]), 1),
      ).toBe('requires-omnicoin');
    });

    it("returns 'wrong-chain' when wallet is elsewhere", () => {
      expect(classifyQuoteForExternalWallet(quote([step(42161, 1)]), 1)).toBe(
        'wrong-chain',
      );
    });

    it("returns 'unsupported-chain' when source isn't in the supported list", () => {
      expect(
        classifyQuoteForExternalWallet(quote([step(99, 1)]), 99, [1, 42161]),
      ).toBe('unsupported-chain');
    });

    it('prioritises requires-omnicoin over wrong-chain', () => {
      expect(
        classifyQuoteForExternalWallet(
          quote([step(OMNICOIN_CHAIN_ID, 1)]),
          42161,
        ),
      ).toBe('requires-omnicoin');
    });
  });
});
