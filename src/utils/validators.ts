/**
 * Lightweight client-side validators for form inputs.
 *
 * Covers the UI-layer checks the mobile app needs before the user can
 * submit something to a Wallet service. The canonical validation still
 * lives server-side in Validator/; these helpers only produce the nice
 * synchronous "red-underline-as-you-type" feedback.
 */

/** Result of a single validator. */
export interface ValidationResult {
  /** True when the input passes the validator. */
  valid: boolean;
  /** User-visible error message when `valid === false`. */
  error?: string;
}

/**
 * Username must match `^[a-z][a-z0-9_]{2,19}$` (3-20 chars, leading
 * lowercase letter, no uppercase allowed). See Validator/CLAUDE.md
 * username canonicalization rules.
 */
export function username(value: string): ValidationResult {
  if (!/^[a-z][a-z0-9_]{2,19}$/.test(value)) {
    return {
      valid: false,
      error: 'Username must start with a lowercase letter and use only lowercase letters, digits, and underscores (3–20 characters).',
    };
  }
  return { valid: true };
}

/** Plain email syntax check. */
export function email(value: string): ValidationResult {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { valid: false, error: 'Enter a valid email address.' };
  }
  return { valid: true };
}

/** Minimum-strength password check (9+ chars w/ mixed classes). */
export function password(value: string): ValidationResult {
  if (value.length < 9) {
    return { valid: false, error: 'Password must be at least 9 characters.' };
  }
  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value)) {
    return {
      valid: false,
      error: 'Password must include uppercase, lowercase, and a digit.',
    };
  }
  return { valid: true };
}

/** BIP39 mnemonic word count check (12 or 24, lowercase words). */
export function mnemonic(value: string): ValidationResult {
  const words = value.trim().split(/\s+/);
  if (words.length !== 12 && words.length !== 24) {
    return { valid: false, error: 'Recovery phrase must be 12 or 24 words.' };
  }
  if (!words.every((w) => /^[a-z]+$/.test(w))) {
    return { valid: false, error: 'Recovery phrase must contain only lowercase words.' };
  }
  return { valid: true };
}

const validators = { username, email, password, mnemonic };
export default validators;
