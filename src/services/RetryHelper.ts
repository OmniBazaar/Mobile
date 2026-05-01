/**
 * RetryHelper — exponential-backoff retry wrapper for transient
 * network / RPC failures.
 *
 * Mirrors WebApp's `APIGateway` retry behaviour so the same flaky-
 * connection scenarios behave identically across clients. Treats
 * 5xx responses, network errors, and timeouts as retryable; treats
 * 4xx responses as permanent (don't retry — client must fix the
 * request).
 *
 * @module services/RetryHelper
 */

/** Options for {@link withRetry}. */
export interface RetryOptions {
  /** Max attempts including the initial try. Default 3. */
  maxAttempts?: number;
  /** Initial backoff in ms. Default 250. */
  initialDelayMs?: number;
  /** Max backoff in ms (cap so we don't wait minutes). Default 5000. */
  maxDelayMs?: number;
  /**
   * Optional predicate to decide whether an error is retryable.
   * Defaults to retrying any thrown error EXCEPT ones whose message
   * contains "4xx" / "401" / "403" / "404" / "409" / "422".
   */
  isRetryable?: (err: unknown) => boolean;
}

/** Default retryability: retry network / 5xx / unknown errors only. */
function defaultIsRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // Permanent client errors — don't retry.
  if (/(\b40[0-9]\b|\b41[0-9]\b|\b42[0-9]\b|\b43[0-9]\b)/.test(msg)) return false;
  return true;
}

/**
 * Sleep for `ms` milliseconds.
 *
 * @param ms - Duration.
 * @returns Promise that resolves after the delay.
 */
function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Run `fn` with exponential backoff retry on transient failure.
 *
 * @param fn - Async work to attempt. Receives the current attempt
 *   number (1-based) so the caller can log progress.
 * @param options - See {@link RetryOptions}.
 * @returns Resolved value of `fn`.
 * @throws The last error encountered after exhausting attempts.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const initialDelayMs = options.initialDelayMs ?? 250;
  const maxDelayMs = options.maxDelayMs ?? 5_000;
  const isRetryable = options.isRetryable ?? defaultIsRetryable;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts || !isRetryable(err)) {
        throw err;
      }
      // Capped exponential backoff with ±20% jitter so concurrent
      // callers don't synchronise their retries.
      const base = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const jitter = base * (0.8 + Math.random() * 0.4);
      await sleep(jitter);
    }
  }
  // Unreachable — the loop either returns or throws — but tsc needs it.
  throw lastErr ?? new Error('withRetry: exhausted with no error captured');
}
