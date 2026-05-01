/**
 * Mobile-side logger.
 *
 * `console.log` is banned by clean-code §6 — every log call must go
 * through this façade so production builds can: (a) strip log calls
 * below the threshold via the bundler, (b) forward warn/error to
 * Sentry, (c) attach a session id without touching every call site.
 *
 * Behavioural contract:
 *   - `info` / `debug` go to `__DEV__`-only `console.info` / `console.debug`.
 *   - `warn` and `error` always print and are mirrored into the Sentry
 *     SDK when it has been initialised. Sentry breadcrumb capture is
 *     defensive — the import is lazy so a Sentry-less Jest run still
 *     compiles.
 *
 * @module utils/logger
 */

/* eslint-disable no-console */

interface LogContext {
  [key: string]: unknown;
}

declare const __DEV__: boolean | undefined;

/** Whether we're running in the dev bundle (RN sets `__DEV__`). */
function isDev(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  return typeof g.__DEV__ === 'boolean' ? Boolean(g.__DEV__) : true;
}

/**
 * Forward a non-fatal event to Sentry as a breadcrumb. Lazy-loaded so
 * the dependency is optional in the test bundle.
 *
 * @param level - Sentry severity tag.
 * @param message - Human-readable message.
 * @param context - Structured key/value extras.
 */
function sendToSentry(level: 'info' | 'warning' | 'error', message: string, context?: LogContext): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry: unknown = require('@sentry/react-native');
    if (Sentry !== undefined && Sentry !== null && typeof Sentry === 'object') {
      const addBreadcrumb = (Sentry as { addBreadcrumb?: (b: unknown) => void }).addBreadcrumb;
      if (typeof addBreadcrumb === 'function') {
        addBreadcrumb({ category: 'log', level, message, data: context });
      }
    }
  } catch {
    // Sentry may not be linked in the test bundle — silently drop.
  }
}

export const logger = {
  /**
   * Diagnostic-level message, dev-only.
   *
   * @param message - Message body.
   * @param context - Structured metadata.
   */
  debug(message: string, context?: LogContext): void {
    if (isDev()) {
      console.debug(message, context ?? '');
    }
  },

  /**
   * Informational message, dev-only.
   *
   * @param message - Message body.
   * @param context - Structured metadata.
   */
  info(message: string, context?: LogContext): void {
    if (isDev()) {
      console.info(message, context ?? '');
    }
    sendToSentry('info', message, context);
  },

  /**
   * Recoverable warning. Always printed; mirrored to Sentry.
   *
   * @param message - Message body.
   * @param context - Structured metadata.
   */
  warn(message: string, context?: LogContext): void {
    console.warn(message, context ?? '');
    sendToSentry('warning', message, context);
  },

  /**
   * Error. Always printed; mirrored to Sentry as a breadcrumb. Use
   * `Sentry.captureException` separately for actual exceptions.
   *
   * @param message - Message body.
   * @param context - Structured metadata.
   */
  error(message: string, context?: LogContext): void {
    console.error(message, context ?? '');
    sendToSentry('error', message, context);
  },
};
