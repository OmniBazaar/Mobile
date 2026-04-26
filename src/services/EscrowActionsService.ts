/**
 * EscrowActionsService — buyer-side actions on a funded escrow.
 *
 * `releaseEscrow` signs a canonical EIP-191 message with the user's
 * wallet key and sends both the message + signature to the validator.
 * The validator looks up the escrow row, recovers the signer from the
 * signature, and refuses the release unless the recovered address
 * matches the on-record buyer.
 *
 * This closes the original "anyone with an escrow id can release"
 * gap: the message includes the escrow id, buyer address, and a
 * recent timestamp, all bound by the signature. Replays inside a
 * short window are still rejected by the validator's nonce check.
 */

import { Wallet } from "ethers";

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

/** Inputs for {@link releaseEscrow}. */
export interface ReleaseEscrowParams {
  /** Validator-issued escrow id. */
  escrowId: string;
  /** Mnemonic used to derive the buyer's signing key. */
  mnemonic: string;
  /** Optional bearer token for the validator session. */
  token?: string;
}

/**
 * Sign + POST a release request. The validator verifies the
 * recovered signer matches `escrow.buyer_address`.
 *
 * @param params - See {@link ReleaseEscrowParams}.
 * @returns Typed result.
 */
export async function releaseEscrow(
  params: ReleaseEscrowParams,
): Promise<ReleaseEscrowResult> {
  const wallet = Wallet.fromPhrase(params.mnemonic);
  const timestamp = Date.now();
  const canonical = `RELEASE_ESCROW ${params.escrowId} ${wallet.address.toLowerCase()} ${timestamp}`;
  const signature = await wallet.signMessage(canonical);

  const base = getBaseUrl().replace(/\/$/, "");
  const url = `${base}/api/v1/escrow/${encodeURIComponent(params.escrowId)}/release`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(params.token !== undefined && params.token !== "" && {
          Authorization: `Bearer ${params.token}`,
        }),
      },
      body: JSON.stringify({
        address: wallet.address,
        legacyCanonical: canonical,
        legacySignature: signature,
        timestamp,
      }),
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
