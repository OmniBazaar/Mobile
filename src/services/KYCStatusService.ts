/**
 * KYCStatusService — read the user's current KYC tier from the validator.
 *
 * Backed by `GET /api/v1/kyc/status?address=...`. The validator
 * stores tier upgrades in the `kyc_documents` table after each
 * Persona check completes; this client just polls for the latest.
 *
 * Result is cached for 60 s per address — KYC tier changes are rare
 * (manual user action) and we don't want to hammer the validator on
 * every re-render of `KYCScreen`.
 *
 * @module services/KYCStatusService
 */

import { getBaseUrl } from './BootstrapService';
import { withRetry } from './RetryHelper';

/** Tier numeric levels match the validator-side enum. */
export type KycTier = 0 | 1 | 2 | 3 | 4;

/** Result returned to KYCScreen. */
export interface KycStatus {
  /** Current tier level (0=Anonymous, 4=Institutional). */
  tier: KycTier;
  /** Human label for the tier. */
  tierName: string;
  /** True when email verification has succeeded (Tier ≥ 1). */
  emailVerified: boolean;
  /** True when phone verification has succeeded (Tier ≥ 1). */
  phoneVerified: boolean;
  /** True when AML/PEP screening passed (Tier ≥ 2). */
  amlCleared: boolean;
  /** True when government ID + facial match passed (Tier ≥ 3). */
  govIdVerified: boolean;
  /** Unix-ms when the status was last updated server-side. */
  updatedAt: number;
}

/** Map tier to display name (mirrors WebApp / Wallet labels). */
const TIER_NAMES: Record<KycTier, string> = {
  0: 'Anonymous',
  1: 'Basic',
  2: 'Verified',
  3: 'Identity',
  4: 'Institutional',
};

const cache = new Map<string, { status: KycStatus; expires: number }>();
const CACHE_TTL_MS = 60_000;

/**
 * Fetch current KYC status for the given address.
 *
 * @param address - User's primary EVM address.
 * @returns Current tier + verification flags. Falls back to tier 0
 *   on network failure rather than throwing — KYC display is a soft
 *   read; we don't want to block the UI.
 */
export async function fetchKycStatus(address: string): Promise<KycStatus> {
  if (address === '') {
    return defaultStatus();
  }
  const lower = address.toLowerCase();
  const cached = cache.get(lower);
  if (cached !== undefined && cached.expires > Date.now()) {
    return cached.status;
  }
  try {
    const base = getBaseUrl().replace(/\/$/, '');
    const url = `${base}/api/v1/kyc/status?address=${encodeURIComponent(address)}`;
    const status = await withRetry(async (): Promise<KycStatus> => {
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      if (!res.ok) throw new Error(`KYC status: HTTP ${res.status}`);
      const body = (await res.json()) as Partial<KycStatus> & { tier?: number };
      const t = (body.tier ?? 0) as KycTier;
      const safeTier: KycTier = (t >= 0 && t <= 4 ? t : 0) as KycTier;
      return {
        tier: safeTier,
        tierName: TIER_NAMES[safeTier],
        emailVerified: body.emailVerified ?? safeTier >= 1,
        phoneVerified: body.phoneVerified ?? safeTier >= 1,
        amlCleared: body.amlCleared ?? safeTier >= 2,
        govIdVerified: body.govIdVerified ?? safeTier >= 3,
        updatedAt: body.updatedAt ?? Date.now(),
      };
    });
    cache.set(lower, { status, expires: Date.now() + CACHE_TTL_MS });
    return status;
  } catch {
    // Soft-fail: render tier 0 rather than blocking the screen.
    return defaultStatus();
  }
}

/** Invalidate cache for `address` — call after the user finishes a Persona flow. */
export function invalidateKycCache(address: string): void {
  cache.delete(address.toLowerCase());
}

/** Default tier-0 status for cold reads. */
function defaultStatus(): KycStatus {
  return {
    tier: 0,
    tierName: TIER_NAMES[0],
    emailVerified: false,
    phoneVerified: false,
    amlCleared: false,
    govIdVerified: false,
    updatedAt: Date.now(),
  };
}
