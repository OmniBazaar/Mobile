/**
 * Unit tests for the pure `validatePin` helper exported by PinSetupScreen.
 *
 * Keeps the component test itself out of scope for Phase 1 (component
 * testing with RN + providers is wired up in Phase 8).
 */

import { validatePin } from '../../src/utils/pinValidation';

describe('validatePin', () => {
  it('accepts a random 6-digit PIN', () => {
    expect(validatePin('285193')).toBeNull();
    expect(validatePin('704821')).toBeNull();
  });

  it('rejects a PIN shorter than 6 digits', () => {
    expect(validatePin('12345')).toMatch(/6 digits/);
    expect(validatePin('0')).toMatch(/6 digits/);
    expect(validatePin('')).toMatch(/6 digits/);
  });

  it('rejects a PIN longer than 6 digits', () => {
    expect(validatePin('1234567')).toMatch(/6 digits/);
  });

  it('rejects non-digit characters', () => {
    expect(validatePin('12a456')).toMatch(/6 digits/);
    expect(validatePin('1234 6')).toMatch(/6 digits/);
    expect(validatePin('abcdef')).toMatch(/6 digits/);
  });

  it('rejects all-same-digit PINs', () => {
    for (const d of '0123456789') {
      expect(validatePin(d.repeat(6))).toMatch(/same digit/);
    }
  });

  it('rejects strictly ascending sequential PINs', () => {
    expect(validatePin('012345')).toMatch(/sequential/);
    expect(validatePin('123456')).toMatch(/sequential/);
    expect(validatePin('456789')).toMatch(/sequential/);
  });

  it('rejects strictly descending sequential PINs', () => {
    expect(validatePin('543210')).toMatch(/sequential/);
    expect(validatePin('987654')).toMatch(/sequential/);
    expect(validatePin('876543')).toMatch(/sequential/);
  });

  it('accepts near-sequential but not strictly sequential PINs', () => {
    expect(validatePin('123457')).toBeNull(); // 1,2,3,4,5,7 — not a run
    expect(validatePin('124356')).toBeNull();
  });
});
