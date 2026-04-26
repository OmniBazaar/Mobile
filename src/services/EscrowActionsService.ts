/**
 * EscrowActionsService — buyer-side actions on a funded escrow.
 *
 * Currently exposes a single action: `releaseEscrow` (the buyer's
 * "Mark received → release funds to seller" gesture). Wraps the
 * validator's `POST /api/v1/escrow/:id/release`. Future actions
 * (raise dispute, refund) get added as siblings here.
 *
 * The release endpoint is buyer-authenticated server-side via the
 * existing escrow row; no client-side EIP-712 intent is required for
 * v1 because the validator already verifies the caller against the
 * stored buyer address. We forward the bearer token if one is
 * available so the audit trail attributes the action correctly.
 */

import { getBaseUrl } from "./BootstrapService";

/** Result of a release call. */
export interface ReleaseEscrowResult {
  /** Validator-side success flag. */
  ok: boolean;
  /** Updated escrow status, when the validator returns it. */
  status?: string;
  /** Error message when `ok === false`. */
  error?: string;
}

/**
 * Call `POST /api/v1/escrow/:id/release` and parse the response.
 *
 * @param escrowId - Validator-issued escrow id.
 * @param token - Optional bearer token for the user's session.
 * @returns Typed result.
 */
export async function releaseEscrow(
  escrowId: string,
  token?: string,
): Promise<ReleaseEscrowResult> {
  const base = getBaseUrl().replace(/\/$/, "");
  const url = `${base}/api/v1/escrow/${encodeURIComponent(escrowId)}/release`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token !== undefined && token !== "" && { Authorization: `Bearer ${token}` }),
      },
      body: "{}",
    });
    const body = (await resp.json().catch(() => ({}))) as {
      success?: boolean;
      escrow?: { status?: string };
      error?: string;
    };
    if (!resp.ok || body.success === false) {
      return { ok: false, error: body.error ?? `release failed (${resp.status})` };
    }
    return {
      ok: true,
      ...(body.escrow?.status !== undefined && { status: body.escrow.status }),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
