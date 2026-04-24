/**
 * SwapService — pure-helper unit tests.
 *
 * Quote fetching (`getQuote`) is a thin pass-through to Wallet's
 * UniversalSwapClient, which is exercised extensively by Wallet's own
 * test suite against the validator mock. Here we cover the formatting
 * and classification helpers Mobile owns.
 */

import {
  attributionLabel,
  classifySwap,
  COMMON_TOKENS,
  formatPriceImpact,
  NATIVE_TOKEN_SENTINEL,
} from '../../src/services/SwapService';

describe('SwapService.formatPriceImpact', () => {
  it('converts basis points to percent', () => {
    expect(formatPriceImpact(0)).toBe('0.00%');
    expect(formatPriceImpact(18)).toBe('0.18%');
    expect(formatPriceImpact(50)).toBe('0.50%');
    expect(formatPriceImpact(100)).toBe('1.00%');
    expect(formatPriceImpact(1234)).toBe('12.34%');
  });
});

describe('SwapService.attributionLabel', () => {
  const base = {
    quoteId: 'q1',
    amountOut: '1',
    amountOutMin: '0.99',
    priceImpactBps: 10,
    totalFees: '0',
    feeBreakdown: {},
    route: [],
    estimatedTimeSeconds: 30,
    expiresAt: Date.now() + 60_000,
  };

  it('returns the source when present', () => {
    expect(attributionLabel({ ...base, source: 'OmniDEX' })).toBe('OmniDEX');
    expect(attributionLabel({ ...base, source: 'Li.Fi' })).toBe('Li.Fi');
    expect(attributionLabel({ ...base, source: '0x' })).toBe('0x');
  });

  it('returns "Unknown" when source is missing or empty', () => {
    expect(attributionLabel(base)).toBe('Unknown');
    expect(attributionLabel({ ...base, source: '' })).toBe('Unknown');
  });
});

describe('SwapService.classifySwap', () => {
  it('same chain + different token → same-chain-swap', () => {
    expect(
      classifySwap({
        sourceChainId: 1,
        targetChainId: 1,
        tokenInSymbol: 'ETH',
        tokenOutSymbol: 'USDC',
      }),
    ).toBe('same-chain-swap');
  });

  it('different chain + same token → bridge-only', () => {
    expect(
      classifySwap({
        sourceChainId: 1,
        targetChainId: 42161,
        tokenInSymbol: 'USDC',
        tokenOutSymbol: 'USDC',
      }),
    ).toBe('bridge-only');
  });

  it('different chain + different token → bridge-and-swap', () => {
    expect(
      classifySwap({
        sourceChainId: 1,
        targetChainId: 42161,
        tokenInSymbol: 'ETH',
        tokenOutSymbol: 'USDC',
      }),
    ).toBe('bridge-and-swap');
  });

  it('XOM L1 → USDC on Ethereum is bridge-and-swap', () => {
    expect(
      classifySwap({
        sourceChainId: 88008,
        targetChainId: 1,
        tokenInSymbol: 'XOM',
        tokenOutSymbol: 'USDC',
      }),
    ).toBe('bridge-and-swap');
  });
});

describe('SwapService COMMON_TOKENS', () => {
  it('includes XOM on OmniCoin L1 with native sentinel', () => {
    const xom = COMMON_TOKENS.find((t) => t.symbol === 'XOM' && t.chainId === 88008);
    expect(xom).toBeDefined();
    expect(xom!.address).toBe(NATIVE_TOKEN_SENTINEL);
    expect(xom!.decimals).toBe(18);
  });

  it('includes USDC with proper decimals on each supported chain', () => {
    const usdcs = COMMON_TOKENS.filter((t) => t.symbol === 'USDC');
    expect(usdcs.length).toBeGreaterThan(0);
    for (const u of usdcs) {
      expect(u.decimals).toBe(6);
      expect(u.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });

  it('every non-native token has a real contract address', () => {
    for (const t of COMMON_TOKENS) {
      if (t.address === NATIVE_TOKEN_SENTINEL) continue;
      expect(t.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });
});
