/**
 * IntentRouter — XOM → USDC mandatory pre-hop regression (Track A4).
 *
 * Enforces the invariant that any cross-chain swap whose input is native
 * XOM on OmniCoin L1 MUST first convert XOM → USDC on L1 (gasless via
 * OmniRelay) and THEN hand USDC off to a bridge (Li.Fi / CCTP / ICTT).
 *
 * XOM is not a token Li.Fi / 0x know about. Passing XOM directly to a
 * cross-chain aggregator would silently fail or return a bogus route.
 * This test asserts that the Mobile-facing `IntentRouter`:
 *   1. Never calls the universal-swap backend with `fromToken === 'XOM'`
 *      for a cross-chain intent — it always substitutes USDC-on-L1 as
 *      the second-leg source.
 *   2. Always prepends an OmniDEX `XOM → USDC` step to every returned
 *      route so the UI renders the full two-hop path.
 *   3. Tags composite protocols with the `omni-dex+*` prefix so downstream
 *      attribution can distinguish a pure Li.Fi route from an
 *      OmniDEX+Li.Fi composite.
 */

jest.mock('@wallet/services/dex/UniversalSwapClient', () => ({
  getUniversalSwapClient: jest.fn(),
}));

import { IntentRouter } from '@wallet/services/dex/IntentRouter';
import type { QuoteResponse } from '@wallet/services/dex/UniversalSwapClient';

const OMNICOIN_L1 = 88008;
const ETHEREUM = 1;
const ARBITRUM = 42161;

const USER = '0x1111111111111111111111111111111111111111';

function mockQuoteResponse(targetChainId: number = ETHEREUM): QuoteResponse {
  return {
    operationId: 'op-regression',
    classification: 'bridge-and-swap',
    classificationLabel: 'Bridge + swap',
    quotes: [
      {
        quoteId: 'q-1',
        source: 'lifi',
        amountOut: '100',
        amountOutMin: '99',
        priceImpactBps: 5,
        totalFees: '0',
        feeBreakdown: { gasFee: '0', swapFee: '0' },
        route: [
          {
            type: 'bridge',
            label: 'Li.Fi USDC → target',
            protocol: 'lifi',
            estimatedTimeSeconds: 30,
            tokenIn: 'USDC',
            tokenInSymbol: 'USDC',
            tokenOut: 'USDC',
            tokenOutSymbol: 'USDC',
            sourceChainId: OMNICOIN_L1,
            targetChainId,
          },
        ],
        estimatedTimeSeconds: 30,
        expiresAt: Date.now() + 60_000,
      },
    ],
    estimatedTimeSeconds: 30,
  };
}

describe('IntentRouter — XOM→USDC pre-hop regression (Track A4)', () => {
  it('substitutes USDC-on-L1 as the backend fromToken when the user input is XOM', async () => {
    const getQuote = jest.fn().mockResolvedValue(mockQuoteResponse());
    const router = new IntentRouter({
      getQuote,
      // unused by getRoutes — cast to any to satisfy the UniversalSwapClient
      // shape without pulling in the whole client surface for a unit test.
    } as unknown as import('@wallet/services/dex/UniversalSwapClient').UniversalSwapClient);

    await router.getRoutes({
      fromChain: OMNICOIN_L1,
      toChain: ETHEREUM,
      fromToken: 'XOM',
      toToken: 'USDT',
      amount: 10n ** 18n,
      userAddress: USER,
      slippageBps: 50,
    });

    expect(getQuote).toHaveBeenCalledTimes(1);
    const params = getQuote.mock.calls[0][0];
    // Canonical invariant: the backend MUST NOT see XOM as fromToken.
    expect(params.tokenIn).toBe('USDC');
    expect(params.tokenInSymbol).toBe('USDC');
    // Second leg starts on OmniCoin L1.
    expect(params.sourceChainId).toBe(OMNICOIN_L1);
    // Second leg ends on the user-requested destination.
    expect(params.targetChainId).toBe(ETHEREUM);
  });

  it('prepends an OmniDEX XOM → USDC leg to every returned route', async () => {
    const getQuote = jest.fn().mockResolvedValue(mockQuoteResponse(ARBITRUM));
    const router = new IntentRouter({ getQuote } as unknown as import('@wallet/services/dex/UniversalSwapClient').UniversalSwapClient);

    const routes = await router.getRoutes({
      fromChain: OMNICOIN_L1,
      toChain: ARBITRUM,
      fromToken: 'XOM',
      toToken: 'USDC',
      amount: 5n * 10n ** 18n,
      userAddress: USER,
      slippageBps: 25,
    });

    expect(routes).toHaveLength(1);
    const [route] = routes;
    // First leg of every route is the gasless OmniDEX XOM→USDC hop.
    expect(route.steps[0]?.protocol).toBe('OmniDEX');
    expect(route.steps[0]?.tokenInSymbol).toBe('XOM');
    expect(route.steps[0]?.tokenOutSymbol).toBe('USDC');
    expect(route.steps[0]?.sourceChainId).toBe(OMNICOIN_L1);
    expect(route.steps[0]?.targetChainId).toBe(OMNICOIN_L1);
    // Second leg is the backend-quoted bridge/swap out of L1.
    expect(route.steps[1]?.sourceChainId).toBe(OMNICOIN_L1);
    expect(route.steps[1]?.targetChainId).toBe(ARBITRUM);
  });

  it('tags XOM-sourced composite routes as omni-dex+* (not bare lifi)', async () => {
    const getQuote = jest.fn().mockResolvedValue(mockQuoteResponse());
    const router = new IntentRouter({ getQuote } as unknown as import('@wallet/services/dex/UniversalSwapClient').UniversalSwapClient);

    const routes = await router.getRoutes({
      fromChain: OMNICOIN_L1,
      toChain: ETHEREUM,
      fromToken: 'XOM',
      toToken: 'USDT',
      amount: 10n ** 18n,
      userAddress: USER,
      slippageBps: 50,
    });

    expect(routes[0]?.protocol.startsWith('omni-dex')).toBe(true);
  });

  it('does not inject a pre-hop for non-XOM sources', async () => {
    const getQuote = jest.fn().mockResolvedValue(mockQuoteResponse());
    const router = new IntentRouter({ getQuote } as unknown as import('@wallet/services/dex/UniversalSwapClient').UniversalSwapClient);

    await router.getRoutes({
      fromChain: ETHEREUM,
      toChain: ARBITRUM,
      fromToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      toToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      amount: 10n ** 6n,
      userAddress: USER,
      slippageBps: 30,
    });

    expect(getQuote).toHaveBeenCalledTimes(1);
    const params = getQuote.mock.calls[0][0];
    // Non-XOM intents should be passed straight through to the backend.
    expect(params.tokenIn).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    expect(params.sourceChainId).toBe(ETHEREUM);
  });

  it('returns the OmniDEX single-step route for same-chain L1 swaps', async () => {
    const getQuote = jest.fn();
    const router = new IntentRouter({ getQuote } as unknown as import('@wallet/services/dex/UniversalSwapClient').UniversalSwapClient);

    const routes = await router.getRoutes({
      fromChain: OMNICOIN_L1,
      toChain: OMNICOIN_L1,
      fromToken: 'XOM',
      toToken: 'USDC',
      amount: 10n ** 18n,
      userAddress: USER,
      slippageBps: 50,
    });

    expect(getQuote).not.toHaveBeenCalled();
    expect(routes).toHaveLength(1);
    expect(routes[0]?.protocol).toBe('omni-dex');
    expect(routes[0]?.steps).toHaveLength(1);
    expect(routes[0]?.gasCostUsd).toBe(0);
  });
});
