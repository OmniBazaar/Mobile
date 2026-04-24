/**
 * PortfolioService — unit tests for the pure helpers. The network-
 * bound `fetchNativeBalances` is exercised in Phase 8 integration tests
 * where it can run against a test validator; here we assert the
 * decimal-formatting math and the non-zero summary logic.
 */

import { formatRaw, summarize, type ChainBalance } from '../../src/services/PortfolioService';

describe('PortfolioService.formatRaw', () => {
  it('returns "0" for zero', () => {
    expect(formatRaw(0n, 18)).toBe('0');
  });

  it('handles whole-number wei values', () => {
    expect(formatRaw(1_000_000_000_000_000_000n, 18)).toBe('1');
    expect(formatRaw(42_000_000_000_000_000_000n, 18)).toBe('42');
  });

  it('handles fractional wei values', () => {
    expect(formatRaw(500_000_000_000_000_000n, 18)).toBe('0.5');
    expect(formatRaw(1_500_000_000_000_000_000n, 18)).toBe('1.5');
    // Default maxFractionDigits=6 — 1.23456789 truncates to 1.234567.
    expect(formatRaw(1_234_567_890_000_000_000n, 18)).toBe('1.234567');
    // Passing a higher cap shows more precision.
    expect(formatRaw(1_234_567_890_000_000_000n, 18, 9)).toBe('1.23456789');
  });

  it('trims trailing zeros from fractional output', () => {
    expect(formatRaw(1_100_000_000_000_000_000n, 18)).toBe('1.1');
    expect(formatRaw(1_010_000_000_000_000_000n, 18)).toBe('1.01');
  });

  it('truncates fractional output to maxFractionDigits', () => {
    // 10 non-zero fractional digits; maxFractionDigits=4 caps the output.
    expect(formatRaw(1_234_567_891_000_000_000n, 18, 4)).toBe('1.2345');
    expect(formatRaw(1_100_000_000_000_000_000n, 18, 1)).toBe('1.1');
  });

  it('supports non-18 decimals (e.g., USDC = 6)', () => {
    expect(formatRaw(1_500_000n, 6)).toBe('1.5');
    expect(formatRaw(12_345_678n, 6)).toBe('12.345678');
  });
});

describe('PortfolioService.summarize', () => {
  const row = (chainId: number, raw: bigint, err?: string): ChainBalance => ({
    chainId,
    chainName: `chain-${chainId}`,
    symbol: 'TEST',
    raw,
    decimals: 18,
    ...(err !== undefined && { error: err }),
  });

  it('counts non-zero chains ignoring errors', () => {
    const r = summarize([row(1, 0n), row(2, 1n), row(3, 100n)]);
    expect(r.nonZeroChains).toBe(2);
    expect(r.totalErrorRows).toBe(0);
  });

  it('counts error rows separately', () => {
    const r = summarize([row(1, 0n, 'rpc down'), row(2, 1n), row(3, 0n)]);
    expect(r.nonZeroChains).toBe(1);
    expect(r.totalErrorRows).toBe(1);
  });

  it('zero-length input returns zero summary', () => {
    expect(summarize([])).toEqual({ nonZeroChains: 0, totalErrorRows: 0 });
  });
});
