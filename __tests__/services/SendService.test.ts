/**
 * SendService — unit tests for the pure helpers.
 *
 * Actual broadcasting (sendNative) is deferred to Phase 8 E2E against a
 * live validator + forked chain. Here we cover the user-input parser
 * and contract edge cases.
 */

import { parseAmount } from '../../src/services/SendService';

describe('SendService.parseAmount', () => {
  it('parses integer inputs at 18 decimals', () => {
    expect(parseAmount('1')).toBe(10n ** 18n);
    expect(parseAmount('42')).toBe(42n * 10n ** 18n);
  });

  it('parses decimal inputs at 18 decimals', () => {
    expect(parseAmount('0.5')).toBe(5n * 10n ** 17n);
    expect(parseAmount('1.5')).toBe(15n * 10n ** 17n);
  });

  it('trims whitespace', () => {
    expect(parseAmount('   1.5   ')).toBe(15n * 10n ** 17n);
  });

  it('supports non-18 decimals', () => {
    expect(parseAmount('1', 6)).toBe(1_000_000n);
    expect(parseAmount('1.5', 6)).toBe(1_500_000n);
    expect(parseAmount('0.000001', 6)).toBe(1n);
  });

  it('rejects negative numbers', () => {
    expect(() => parseAmount('-1')).toThrow(/invalid numeric/);
  });

  it('rejects non-numeric input', () => {
    expect(() => parseAmount('abc')).toThrow(/invalid numeric/);
    expect(() => parseAmount('1.2.3')).toThrow(/invalid numeric/);
    expect(() => parseAmount('1,5')).toThrow(/invalid numeric/);
    expect(() => parseAmount('')).toThrow(/invalid numeric/);
  });

  it('rejects scientific notation', () => {
    expect(() => parseAmount('1e18')).toThrow(/invalid numeric/);
  });

  it('rejects leading "." without a whole part', () => {
    expect(() => parseAmount('.5')).toThrow(/invalid numeric/);
  });
});
