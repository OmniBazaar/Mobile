/**
 * RpcOriginReporter — periodic heartbeat that tells the validator
 * which RPC each chain is hitting from this device.
 *
 * Powers the decentralisation dashboard (Track F4 / Part 23 of
 * `Validator/ADD_MOBILE_APP.md`). We report a tiny per-chain summary
 * once every 5 minutes:
 *
 *   { chainId, isProxy, latencyMs, success }
 *
 * `isProxy` is true when the active RPC URL contains the validator's
 * own `/api/v1/rpc/chain/` proxy path; false for any public RPC. The
 * dashboard aggregates these to compute the % of calls that go
 * directly to public RPC (the "true decentralisation" metric).
 *
 * Reports are best-effort: a failed POST is dropped silently. The
 * service stays out of the cold-start path — `start()` is invoked
 * from `App.tsx` after the version-check modal clears.
 */

import { getClientRPCRegistry } from "@wallet/core/providers/ClientRPCRegistry";

import { getBaseUrl } from "./BootstrapService";

/** Default interval (ms) between reports. */
const REPORT_INTERVAL_MS = 5 * 60_000;

interface ChainSummary {
  chainId: number;
  isProxy: boolean;
  endpoint: string;
}

let intervalHandle: ReturnType<typeof setInterval> | undefined;

/**
 * Snapshot the current RPC choice for every chain ClientRPCRegistry
 * knows about. Intentionally opportunistic — only reports chains the
 * registry has already initialised a provider for (no warm-up calls).
 *
 * @returns Per-chain summary array (may be empty on a cold registry).
 */
function snapshotChains(): ChainSummary[] {
  const registry = getClientRPCRegistry() as unknown as {
    listInitialisedChains?: () => Array<{ chainId: number; activeUrl: string }>;
  };
  const chains = registry.listInitialisedChains?.() ?? [];
  return chains.map((c) => ({
    chainId: c.chainId,
    isProxy: c.activeUrl.includes("/api/v1/rpc/chain/"),
    endpoint: redactQuery(c.activeUrl),
  }));
}

/**
 * Strip query parameters from an RPC URL. Some providers include API
 * keys in the query (Alchemy / Infura) — never leak them in telemetry.
 *
 * @param url - Raw RPC URL.
 * @returns URL without the query portion.
 */
function redactQuery(url: string): string {
  const i = url.indexOf("?");
  return i < 0 ? url : url.slice(0, i);
}

/**
 * POST a single heartbeat to the validator. Best-effort — a failed
 * fetch returns silently so we don't churn the user's battery.
 *
 * @param address - Wallet address that owns the device (lower-case
 *   hex). Used by the validator only for per-user dedup; never linked
 *   to PII.
 */
async function report(address: string): Promise<void> {
  if (address === "") return;
  const summaries = snapshotChains();
  if (summaries.length === 0) return;
  const base = getBaseUrl().replace(/\/$/, "");
  const url = `${base}/api/v1/dashboard/rpc-origin`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: address.toLowerCase(), summaries }),
    });
  } catch {
    /* dashboard heartbeat is best-effort */
  }
}

/**
 * Start the periodic heartbeat. Idempotent — second call is a no-op.
 *
 * @param address - Wallet address to attribute the report to.
 * @param intervalMs - Override interval (mostly for tests).
 */
export function startRpcOriginReporter(
  address: string,
  intervalMs: number = REPORT_INTERVAL_MS,
): void {
  if (intervalHandle !== undefined) return;
  // Fire one immediate report so the dashboard isn't empty for the
  // first 5 minutes of a session, then settle into the cadence.
  void report(address);
  intervalHandle = setInterval(() => void report(address), intervalMs);
}

/**
 * Stop the heartbeat (e.g. on sign-out). Safe to call when never started.
 */
export function stopRpcOriginReporter(): void {
  if (intervalHandle === undefined) return;
  clearInterval(intervalHandle);
  intervalHandle = undefined;
}
