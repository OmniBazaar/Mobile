/**
 * Pure helpers for 6-digit PIN validation.
 *
 * Lives outside the PinSetupScreen component so the rules can be
 * exercised in unit tests without spinning up React Native.
 */

/**
 * Validate a PIN string.
 * Returns `null` when valid; an error message otherwise.
 *
 * Rules:
 *   1. Exactly 6 decimal digits.
 *   2. Not all the same digit (e.g., `000000`).
 *   3. Not strictly ascending or descending (e.g., `012345`, `987654`).
 *
 * @param pin - Candidate PIN.
 * @returns Error string, or `null` when acceptable.
 */
export function validatePin(pin: string): string | null {
  if (!/^\d{6}$/.test(pin)) {
    return 'PIN must be exactly 6 digits.';
  }
  if (/^(\d)\1{5}$/.test(pin)) {
    return 'PIN cannot be all the same digit.';
  }
  const digits = pin.split('').map((d) => Number.parseInt(d, 10));
  const ascending = digits.every((d, i) => i === 0 || d === (digits[i - 1] ?? -1) + 1);
  const descending = digits.every((d, i) => i === 0 || d === (digits[i - 1] ?? 99) - 1);
  if (ascending || descending) {
    return 'PIN cannot be strictly sequential.';
  }
  return null;
}
