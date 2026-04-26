/**
 * SentryService — thin wrapper around `@sentry/react-native`.
 *
 * Initialised exactly once at app cold-start from `App.tsx`.
 * Reads its DSN from `EXPO_PUBLIC_SENTRY_DSN` so EAS profiles can
 * inject per-environment DSNs (dev / preview / production) without
 * a code change. When the DSN is unset, `init()` is a no-op so local
 * dev doesn't churn the Sentry quota.
 *
 * Wraps the SDK in a small helper surface so the rest of the app
 * doesn't need to know whether Sentry is active — `captureException`
 * and `captureMessage` quietly drop calls when init never ran.
 */

import * as Sentry from "@sentry/react-native";

let initialised = false;

/**
 * Read the build channel from EAS-injected env. Surfaces in Sentry's
 * `environment` tag so dashboards can filter dev vs preview vs prod.
 *
 * @returns Channel string (defaults to 'development').
 */
function buildChannel(): string {
  const ch =
    process.env["EXPO_PUBLIC_BUILD_CHANNEL"] ??
    process.env["EXPO_PUBLIC_VALIDATOR_ENDPOINT"]?.includes("localhost")
      ? "development"
      : process.env["EXPO_PUBLIC_BUILD_CHANNEL"];
  return typeof ch === "string" && ch.length > 0 ? ch : "development";
}

/**
 * Initialise Sentry. Idempotent — subsequent calls are no-ops.
 * Skipped entirely when `EXPO_PUBLIC_SENTRY_DSN` is empty so local dev
 * doesn't churn the production quota.
 */
export function initSentry(): void {
  if (initialised) return;
  const dsn = process.env["EXPO_PUBLIC_SENTRY_DSN"];
  if (typeof dsn !== "string" || dsn.length === 0) {
    initialised = true;
    return;
  }
  Sentry.init({
    dsn,
    environment: buildChannel(),
    // Cap the trace sample rate so we don't overload the Sentry plan
    // — 0.1 = 10 % of transactions. Override per-environment in Sentry's
    // dynamic sampling rules instead of here.
    tracesSampleRate: 0.1,
    // PII redaction: never send the user's IP; never attach the request
    // body for failed fetches (potential PII leak via a marketplace
    // listing description, for example).
    sendDefaultPii: false,
    enableNative: true,
    // Auto-tag every event with the runtime version so we can correlate
    // crashes to OTA versus binary builds.
    release: process.env["EXPO_PUBLIC_RELEASE"] ?? undefined,
    integrations: [],
  });
  initialised = true;
}

/**
 * Report an unexpected error. No-op when Sentry didn't initialise.
 *
 * @param err - Error or unknown thrown value.
 * @param context - Optional structured context bag.
 */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!initialised) return;
  Sentry.captureException(err, context !== undefined ? { extra: context } : undefined);
}

/**
 * Report a non-error message (warning, soft-fail). No-op without DSN.
 *
 * @param message - Short tag-like message.
 * @param level - Sentry severity (defaults to 'warning').
 */
export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" = "warning",
): void {
  if (!initialised) return;
  Sentry.captureMessage(message, level);
}
