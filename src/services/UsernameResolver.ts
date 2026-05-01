/**
 * UsernameResolver — convert a human-readable OmniBazaar username
 * (`alice`, `@alice`, `alice.omnibazaar`) into the EVM address it
 * controls.
 *
 * Backed by the validator's `/api/v1/ens/resolve/:username` endpoint
 * (live in `Validator/src/services/ens/ValidatorENSOracle.ts`). The
 * validator looks the username up in its registry and returns the
 * canonical address. Result is cached for 5 minutes per username
 * because the registry only changes when a user explicitly
 * re-registers — which is rare.
 *
 * @module services/UsernameResolver
 */

import { getBaseUrl } from './BootstrapService';
import { withRetry } from './RetryHelper';

/** TTL for cached resolutions in milliseconds. */
const CACHE_TTL_MS = 5 * 60 * 1_000;

/** In-memory cache: lowercase username → { address, expires }. */
const cache = new Map<string, { address: string; expires: number }>();

/** Result of {@link resolveAddress}. */
export interface ResolveResult {
  /** Canonical 0x-prefixed EVM address. */
  address: string;
  /** Username we resolved (lowercase, no @ / .omnibazaar suffix). */
  username: string;
}

/**
 * Strip the optional `@` prefix and `.omnibazaar` / `.omnibazaar.com`
 * suffix from `input` and lowercase the result.
 *
 * @param input - User-typed string.
 * @returns Canonical lowercase username.
 */
export function canonicaliseUsername(input: string): string {
  let s = input.trim().toLowerCase();
  if (s.startsWith('@')) s = s.slice(1);
  s = s.replace(/\.omnibazaar(?:\.com)?$/, '');
  return s;
}

/**
 * `true` if `value` looks like a 0x-prefixed EVM address. Treat hex
 * strings as already-resolved so we don't make a network round-trip
 * just to bounce them back unchanged.
 */
export function isAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

/**
 * Resolve a username to its on-chain address.
 *
 * @param input - Username (with or without `@`/`.omnibazaar` suffix)
 *   or a 0x address (passes through).
 * @returns Resolution bundle.
 * @throws If the validator returns 404 (username not registered) or
 *   the network call fails after retries.
 */
export async function resolveAddress(input: string): Promise<ResolveResult> {
  const trimmed = input.trim();
  if (isAddress(trimmed)) {
    return { address: trimmed, username: '' };
  }
  const username = canonicaliseUsername(trimmed);
  if (username.length === 0) {
    throw new Error('Empty username');
  }

  const cached = cache.get(username);
  if (cached !== undefined && cached.expires > Date.now()) {
    return { address: cached.address, username };
  }

  const base = getBaseUrl().replace(/\/$/, '');
  const url = `${base}/api/v1/ens/resolve/${encodeURIComponent(username)}`;
  const data = await withRetry(async (): Promise<{ address?: string }> => {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (res.status === 404) {
      // Throw with a 404 marker so the retry helper treats it as
      // permanent and surfaces it cleanly to the user.
      throw new Error(`Username not found: ${username} (404)`);
    }
    if (!res.ok) throw new Error(`Resolve failed: HTTP ${res.status}`);
    return (await res.json()) as { address?: string };
  });

  if (data.address === undefined || !isAddress(data.address)) {
    throw new Error(`Validator returned no address for ${username}`);
  }

  cache.set(username, { address: data.address, expires: Date.now() + CACHE_TTL_MS });
  return { address: data.address, username };
}
