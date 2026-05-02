/**
 * KYCPersonaService — Tier 3 verification end-to-end on Mobile.
 *
 *   1. Ask the validator to create a Persona inquiry (POST /api/v1/kyc/persona/inquiry).
 *   2. Open Persona's hosted flow in the system browser via expo-web-browser's
 *      `openAuthSessionAsync`, with `omnibazaar://kyc/complete` as the
 *      return URL — the browser auto-closes when Persona redirects there.
 *   3. Poll `/api/v1/kyc/persona/status?address=…` for up to 2 minutes until
 *      the inquiry reaches `completed` (or fails).
 *   4. Sign the `CompleteTier3` EIP-712 intent with the user's mnemonic and
 *      POST to `/api/v1/kyc/complete-tier3`. The validator re-checks both
 *      the signature AND that this address has a `completed` Persona
 *      inquiry — neither alone suffices, which is the trustless property.
 *
 * The same flow is used by WebApp (`PersonaVerification.tsx` +
 * `KYCService.completeTier3`) and Wallet (`KYCPage.launchPersona` +
 * `handleCompleteTier3`). All three resolve to the same on-chain write
 * via OmniRelay (gasless).
 *
 * @module services/KYCPersonaService
 */

import { ethers, Wallet } from 'ethers';
import * as WebBrowser from 'expo-web-browser';

import {
  buildTypedData,
  COMPLETE_TIER3_TYPES,
  type CompleteTier3Message,
  randomNonce,
} from '@wallet/background/eip712Intents';

import { getBaseUrl } from './BootstrapService';
import { getContractAddresses } from '../config/omnicoin-integration';

/** Persona inquiry creation response from the validator. */
interface InquiryResponse {
  /** True if the validator was able to create a Persona inquiry. */
  success?: boolean;
  /** Persona inquiry id (`inq_…`). */
  inquiryId?: string;
  /** Optional one-time session token for the hosted flow. */
  sessionToken?: string;
  /** User-friendly error message when `success` is false. */
  error?: string;
}

/** Persona status response from the validator. */
interface StatusResponse {
  /** Current inquiry status string. */
  status?: string;
  /** True once Persona has approved the inquiry. */
  approved?: boolean;
}

/** Result of {@link launchTier3Verification}. */
export interface Tier3Result {
  /** New on-chain tier returned by the validator. */
  newTier: number;
  /** Persona inquiry id used for this completion. */
  inquiryId: string;
  /** True when the user was already at Tier 3+ (idempotent retry). */
  alreadyAtTier?: boolean;
}

const PERSONA_VERIFY_URL = 'https://withpersona.com/verify';
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_MS = 120_000;
const RETURN_URL = 'omnibazaar://kyc/complete';

/**
 * Run the full Tier 3 verification flow on a real device.
 *
 * Throws on any failure with a user-friendly Error message; callers
 * (KYCScreen) should display the message and offer a retry button.
 *
 * @param address - User's primary EVM address (the signer).
 * @param mnemonic - BIP39 phrase, kept in memory only for signing.
 * @param token - Optional bearer token for authenticated endpoints.
 * @returns The new tier on success.
 */
export async function launchTier3Verification(
  address: string,
  mnemonic: string,
  token?: string,
): Promise<Tier3Result> {
  if (address === '') {
    throw new Error('No active wallet address.');
  }
  if (mnemonic === '') {
    throw new Error('Wallet is locked. Please sign in to continue.');
  }

  const base = getBaseUrl().replace(/\/$/, '');

  // 1. Create the inquiry server-side.
  const inquiryResp = await fetch(`${base}/api/v1/kyc/persona/inquiry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userAddress: address, tier: 3 }),
  });
  if (!inquiryResp.ok) {
    const err = (await inquiryResp.json().catch(() => ({}))) as InquiryResponse;
    throw new Error(err.error ?? `Failed to create Persona inquiry (${inquiryResp.status}).`);
  }
  const inquiryJson = (await inquiryResp.json()) as InquiryResponse;
  const inquiryId = inquiryJson.inquiryId ?? '';
  if (inquiryJson.success === false || inquiryId === '') {
    throw new Error(inquiryJson.error ?? 'Failed to create Persona inquiry.');
  }

  // 2. Open Persona's hosted flow in the system browser. openAuthSessionAsync
  //    auto-closes the in-app browser when Persona redirects to RETURN_URL.
  const params = new URLSearchParams({
    'inquiry-id': inquiryId,
    'environment-id': 'production',
    'redirect-uri': RETURN_URL,
    ...(typeof inquiryJson.sessionToken === 'string' && inquiryJson.sessionToken !== ''
      ? { 'session-token': inquiryJson.sessionToken }
      : {}),
  });
  const personaUrl = `${PERSONA_VERIFY_URL}?${params.toString()}`;

  const browserResult = await WebBrowser.openAuthSessionAsync(personaUrl, RETURN_URL);
  if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') {
    throw new Error('Verification was cancelled before completion.');
  }
  // Other result types ('success'/'opened'/'locked') just mean the browser
  // closed — we now poll the validator for the authoritative verdict.

  // 3. Poll until status reaches a terminal state or we time out.
  const start = Date.now();
  let approved = false;
  while (Date.now() - start < POLL_MAX_MS) {
    try {
      const sResp = await fetch(
        `${base}/api/v1/kyc/persona/status?address=${encodeURIComponent(address)}`,
      );
      if (sResp.ok) {
        const sJson = (await sResp.json()) as StatusResponse;
        if (sJson.status === 'completed' || sJson.approved === true) {
          approved = true;
          break;
        }
        if (sJson.status === 'failed' || sJson.status === 'declined') {
          throw new Error('Identity verification was not approved. You may try again.');
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('not approved')) throw err;
      // Transient errors are expected before Persona reports completion;
      // keep polling rather than aborting.
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  if (!approved) {
    throw new Error(
      'Verification timed out. Please re-open the verification page and complete the steps.',
    );
  }

  // 4. Build + sign + POST the CompleteTier3 EIP-712 intent.
  const addresses = getContractAddresses('mainnet');
  const verifyingContract = addresses.OmniCore ?? ethers.ZeroAddress;
  const timestamp = Date.now();
  const nonce = randomNonce();
  const wallet = Wallet.fromPhrase(mnemonic);

  const message: CompleteTier3Message = {
    user: address,
    timestamp,
    nonce,
  };
  const td = buildTypedData(message, 'CompleteTier3', COMPLETE_TIER3_TYPES, verifyingContract);
  const signature = await wallet.signTypedData(td.domain, td.types, td.message);
  const legacyCanonical = `COMPLETE_TIER3 ${address} ${timestamp}`;
  const legacySignature = await wallet.signMessage(legacyCanonical);

  const completeResp = await fetch(`${base}/api/v1/kyc/complete-tier3`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(typeof token === 'string' && token !== '' && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({
      address,
      personaInquiryId: inquiryId,
      typedData: td,
      signature,
      legacyCanonical,
      legacySignature,
      timestamp,
      gasless: true,
    }),
  });
  if (!completeResp.ok) {
    const err = (await completeResp.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Failed to finalize Tier 3 (${completeResp.status}).`);
  }
  const completeJson = (await completeResp.json()) as {
    success?: boolean;
    newTier?: number;
    alreadyAtTier?: boolean;
    error?: string;
  };
  if (completeJson.success === false) {
    throw new Error(completeJson.error ?? 'Failed to finalize Tier 3.');
  }
  return {
    newTier: completeJson.newTier ?? 3,
    inquiryId,
    ...(completeJson.alreadyAtTier === true && { alreadyAtTier: true }),
  };
}
