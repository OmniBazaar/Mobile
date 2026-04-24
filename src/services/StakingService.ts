/**
 * StakingService — Mobile-side stake / unstake / claim orchestrator.
 *
 * Mirrors the Wallet SW's `handleStakingCall`:
 *   1. Build an EIP-712 Stake / Unstake / ClaimRewards intent bound to
 *      the OmniBazaar domain, verifyingContract = OmniValidatorRewards
 *      (or StakingRewardPool fallback).
 *   2. Sign the intent with `ethers.Wallet.signTypedData`.
 *   3. Sign the legacy EIP-191 canonical (`STAKING_<ACTION> <addr> <ts>`).
 *   4. POST both to `/api/v1/staking/<action>` — the validator translates
 *      to on-chain calldata and submits through OmniRelay (gasless).
 *
 * Mobile never pays gas for staking — everything settles on OmniCoin L1
 * via the validator's relay. If that endpoint is unhealthy the call
 * throws a visible error; we don't silently fall back to a direct
 * broadcast because staking semantics require the relay's intent-reply
 * flow (the validator is the one that submits the actual on-chain tx).
 */

import { ethers, Wallet } from 'ethers';

import {
  buildTypedData,
  CLAIM_REWARDS_TYPES,
  type ClaimRewardsMessage,
  randomNonce,
  STAKE_TYPES,
  type StakeMessage,
  UNSTAKE_TYPES,
  type UnstakeMessage,
} from '@wallet/background/eip712Intents';

import { getBaseUrl } from './BootstrapService';
import { getContractAddresses } from '../config/omnicoin-integration';

/** Input for stake(). */
export interface StakeParams {
  /** Staker wallet address. */
  staker: string;
  /** Amount in XOM wei (decimal string). */
  amount: string;
  /** Duration in days (0 for flexible). */
  durationDays: number;
  /** Mnemonic — used in-memory only for signing. */
  mnemonic: string;
  /** Optional bearer token when authenticated. */
  token?: string;
}

/** Input for unstake(). */
export interface UnstakeParams {
  /** Staker wallet address. */
  staker: string;
  /** Amount in XOM wei (decimal string). */
  amount: string;
  /** Mnemonic — used in-memory only for signing. */
  mnemonic: string;
  /** Optional bearer token. */
  token?: string;
}

/** Input for claim(). */
export interface ClaimParams {
  /** Staker wallet address. */
  staker: string;
  /** Mnemonic — used in-memory only for signing. */
  mnemonic: string;
  /** Optional bearer token. */
  token?: string;
}

/** Result of any staking action. */
export interface StakingResult {
  /** On-chain tx hash returned by the relay. */
  txHash: string;
}

type Action = 'stake' | 'unstake' | 'claim';

/**
 * Build + sign + POST a staking intent. Internal helper used by the
 * three exported wrappers below.
 *
 * @param action - Action kind.
 * @param extra - Payload specific to the action.
 * @param signer - Address that will sign.
 * @param mnemonic - BIP39 phrase.
 * @param token - Optional bearer token.
 * @returns Tx hash.
 */
async function postStakingIntent(
  action: Action,
  extra: Record<string, unknown>,
  signer: string,
  mnemonic: string,
  token: string,
): Promise<StakingResult> {
  const addresses = getContractAddresses('mainnet');
  const verifyingContract =
    addresses.OmniValidatorRewards ?? addresses.StakingRewardPool ?? ethers.ZeroAddress;

  const timestamp = Date.now();
  const nonce = randomNonce();
  const wallet = Wallet.fromPhrase(mnemonic);

  let typedDataEnvelope: Record<string, unknown>;
  let typedSignature: string;
  if (action === 'stake') {
    const message: StakeMessage = {
      staker: signer,
      amount: String(extra['amount'] ?? ''),
      durationDays: Number(extra['durationDays'] ?? 0),
      timestamp,
      nonce,
    };
    const td = buildTypedData(message, 'Stake', STAKE_TYPES, verifyingContract);
    typedSignature = await wallet.signTypedData(td.domain, td.types, td.message);
    typedDataEnvelope = td as unknown as Record<string, unknown>;
  } else if (action === 'unstake') {
    const message: UnstakeMessage = {
      staker: signer,
      amount: String(extra['amount'] ?? ''),
      timestamp,
      nonce,
    };
    const td = buildTypedData(message, 'Unstake', UNSTAKE_TYPES, verifyingContract);
    typedSignature = await wallet.signTypedData(td.domain, td.types, td.message);
    typedDataEnvelope = td as unknown as Record<string, unknown>;
  } else {
    const message: ClaimRewardsMessage = {
      staker: signer,
      timestamp,
      nonce,
    };
    const td = buildTypedData(
      message,
      'ClaimRewards',
      CLAIM_REWARDS_TYPES,
      verifyingContract,
    );
    typedSignature = await wallet.signTypedData(td.domain, td.types, td.message);
    typedDataEnvelope = td as unknown as Record<string, unknown>;
  }

  const legacyCanonical = `STAKING_${action.toUpperCase()} ${signer} ${timestamp}`;
  const legacySignature = await wallet.signMessage(legacyCanonical);

  const base = getBaseUrl().replace(/\/$/, '');
  const url = `${base}/api/v1/staking/${action}`;
  const body = {
    ...extra,
    address: signer,
    typedData: typedDataEnvelope,
    signature: typedSignature,
    legacyCanonical,
    legacySignature,
    timestamp,
    gasless: true,
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token !== '' && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
  const json = (await resp.json().catch(() => ({}))) as {
    success?: boolean;
    txHash?: string;
    data?: { txHash?: string };
    error?: string;
  };
  if (!resp.ok || json.success === false) {
    throw new Error(json.error ?? `${action} failed (${resp.status})`);
  }
  const txHash = json.txHash ?? json.data?.txHash ?? '';
  if (txHash === '') throw new Error('Validator returned no tx hash');
  return { txHash };
}

/**
 * Stake XOM for the given duration.
 *
 * @param params - See {@link StakeParams}.
 * @returns Tx hash from the relay.
 */
export async function stake(params: StakeParams): Promise<StakingResult> {
  return postStakingIntent(
    'stake',
    { amount: params.amount, durationDays: params.durationDays },
    params.staker,
    params.mnemonic,
    params.token ?? '',
  );
}

/**
 * Unstake XOM (subject to early-withdrawal penalty on-chain when before
 * the commitment window ends).
 *
 * @param params - See {@link UnstakeParams}.
 * @returns Tx hash from the relay.
 */
export async function unstake(params: UnstakeParams): Promise<StakingResult> {
  return postStakingIntent(
    'unstake',
    { amount: params.amount },
    params.staker,
    params.mnemonic,
    params.token ?? '',
  );
}

/**
 * Claim accrued staking rewards.
 *
 * @param params - See {@link ClaimParams}.
 * @returns Tx hash from the relay.
 */
export async function claim(params: ClaimParams): Promise<StakingResult> {
  return postStakingIntent(
    'claim',
    {},
    params.staker,
    params.mnemonic,
    params.token ?? '',
  );
}
