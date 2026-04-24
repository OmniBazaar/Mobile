/**
 * Locale-aware display formatters.
 *
 * Uses `Intl.NumberFormat` / `Intl.DateTimeFormat` threaded with the
 * current i18n language so every screen renders currency, amounts, and
 * timestamps correctly in the user's chosen locale (10 supported:
 * en, es, fr, de, it, pt, zh, ja, ko, ru). No hardcoded `$` or `,` —
 * see the wallet-extension i18n audit rules.
 */

import i18next from 'i18next';

/**
 * Resolve the current i18n language, falling back to `en` if i18next
 * hasn't initialized yet (e.g. during the very first render).
 *
 * @returns BCP-47 language tag.
 */
function currentLanguage(): string {
  return i18next.language !== '' ? i18next.language : 'en';
}

/**
 * Format a decimal number as a currency amount. Defaults to USD.
 *
 * @param amount - Numeric amount to format.
 * @param currency - ISO 4217 currency code (USD, EUR, ...).
 * @returns Locale-formatted currency string.
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat(currentLanguage(), {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a Unix-ms timestamp as an absolute date/time.
 *
 * @param ms - Unix ms timestamp.
 * @returns Locale-formatted date/time string.
 */
export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat(currentLanguage(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(ms));
}

/**
 * Format a crypto balance (arbitrary precision) with a user-friendly
 * number of decimals. Returns the raw input unchanged if it is not
 * a finite number.
 *
 * @param raw - Numeric or decimal-string amount.
 * @param decimals - Maximum decimal places to show (default 6).
 * @returns Locale-formatted balance string.
 */
export function formatBalance(raw: number | string, decimals: number = 6): string {
  const n = typeof raw === 'number' ? raw : Number.parseFloat(raw);
  if (!Number.isFinite(n)) return String(raw);
  return new Intl.NumberFormat(currentLanguage(), {
    maximumFractionDigits: decimals,
  }).format(n);
}

/**
 * Truncate a blockchain address for compact display.
 * Keeps leading and trailing 4 chars with an ellipsis in the middle.
 *
 * @param address - Full address.
 * @returns `0x1234…abcd`-style short form.
 */
export function shortAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}

const formatters = { formatCurrency, formatDate, formatBalance, shortAddress };
export default formatters;
