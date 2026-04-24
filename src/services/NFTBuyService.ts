/**
 * NFTBuyService — Mobile-side NFT purchase orchestrator.
 *
 * Flow mirrors the Wallet extension's SW `handleSignBuyNFT`:
 *   1. Resolve the UnifiedFeeVault settlement contract + payment token
 *      from `omnicoin-integration` mainnet addresses.
 *   2. Read the buyer's ERC-20 allowance via `nftBuyPrereqs.readErc20Allowance`
 *      (uses `ClientRPCRegistry` with failover — no hardcoded RPC).
 *   3. If allowance < paymentAmount, build an `approve` tx and submit it
 *      via `RelaySubmitService.submitTransaction` (gasless on L1 via
 *      OmniForwarder).
 *   4. Build a full `BuyNFT` intent, validate it against every on-chain
 *      guard (`buyNFTIntent.validateBuyNFTIntent`), sign with
 *      `ethers.Wallet.signTypedData` bound to the OmniBazaar EIP-712
 *      domain, and POST to the validator's `/api/v1/nft/buy` endpoint.
 *   5. Return the on-chain sale id + tx hash from the validator.
 *
 * The validator settles the sale atomically on-chain via
 * `UnifiedFeeVault.settleNftBuy(intent, signature, swapPath, swapSources)`.
 * The client never holds escrow; the validator is a relayer + index, not
 * a custodian.
 */

import { ethers, Wallet } from 'ethers';

import {
  BUY_NFT_TYPES,
  OMNIBAZAAR_DOMAIN,
  type BuyNFTMessage,
  randomNonce,
} from '@wallet/background/eip712Intents';
import {
  encodeErc20Approve,
  readErc20Allowance,
  UINT256_MAX,
} from '@wallet/services/marketplace/nftBuyPrereqs';
import {
  validateBuyNFTIntent,
  ZERO_HASH,
} from '@wallet/services/marketplace/buyNFTIntent';

import { getBaseUrl } from './BootstrapService';
import { submitTransaction } from './RelaySubmitService';
import { getContractAddresses } from '../config/omnicoin-integration';

/** Forward buffer applied to intent expiry — matches the SW's 15 min window. */
const INTENT_EXPIRY_SECONDS = 15 * 60;

/** OmniCoin L1 chain id (payment always settles on L1). */
const L1_CHAIN_ID = 88008;

/** Inputs needed to buy an NFT that's already listed on the marketplace. */
export interface BuyNFTParams {
  /** Index listing id (decimal string). */
  listingId: string;
  /** Token id (decimal string). */
  nftTokenId: string;
  /** ERC-721 collection contract address. */
  nftContract: string;
  /** Seller wallet address. */
  seller: string;
  /** Buyer wallet address (derived from the user's mnemonic). */
  buyer: string;
  /** Price the listing asks, in wei decimal string. */
  paymentAmount: string;
  /** BIP39 phrase used to derive the signer for approve + intent. */
  mnemonic: string;
  /** Optional primary referrer (defaults to 0x0). */
  referrer?: string;
  /** Optional secondary referrer (defaults to 0x0). */
  referrer2?: string;
}

/** Successful purchase result. */
export interface BuyNFTSuccess {
  ok: true;
  saleId: string;
  txHash: string;
  blockNumber?: number;
  /** Whether an `approve` tx was sent before the buy (for UX copy). */
  approvedInline: boolean;
}

/** Classified failure surfaced to the UI. */
export interface BuyNFTFailure {
  ok: false;
  code:
    | 'NO_XOM_CONFIG'
    | 'SETTLEMENT_NOT_DEPLOYED'
    | 'INTENT_REJECTED'
    | 'VALIDATOR_REJECTED'
    | 'APPROVE_FAILED';
  message: string;
  detail?: string;
}

export type BuyNFTResult = BuyNFTSuccess | BuyNFTFailure;

/**
 * Main entry point — run the full buy flow end-to-end.
 *
 * @param params - Buy inputs.
 * @returns Success payload with sale id + tx hash, or a typed failure.
 */
export async function buyNFT(params: BuyNFTParams): Promise<BuyNFTResult> {
  const addresses = getContractAddresses('mainnet');
  const paymentToken = addresses.OmniCoin;
  if (paymentToken === undefined || paymentToken === '' || paymentToken === ethers.ZeroAddress) {
    return {
      ok: false,
      code: 'NO_XOM_CONFIG',
      message: 'XOM is not configured on the active network',
    };
  }
  const settlementCandidate = (addresses as unknown as Record<string, string | undefined>)[
    'UnifiedFeeVault'
  ];
  if (
    settlementCandidate === undefined ||
    settlementCandidate === '' ||
    settlementCandidate === ethers.ZeroAddress
  ) {
    return {
      ok: false,
      code: 'SETTLEMENT_NOT_DEPLOYED',
      message: 'NFT marketplace is being upgraded — please try again shortly',
    };
  }
  const settlementContract = settlementCandidate;

  // ── 1. Ensure allowance ────────────────────────────────────────────
  const paymentAmountBn = BigInt(params.paymentAmount);
  const allowance = await readErc20Allowance({
    chainId: L1_CHAIN_ID,
    token: paymentToken,
    owner: params.buyer,
    spender: settlementContract,
  });

  let approvedInline = false;
  if (allowance === undefined || allowance < paymentAmountBn) {
    try {
      await submitTransaction(
        {
          to: paymentToken,
          data: encodeErc20Approve(settlementContract, UINT256_MAX),
          value: '0',
          chainId: L1_CHAIN_ID,
        },
        params.mnemonic,
      );
      approvedInline = true;
    } catch (err) {
      return {
        ok: false,
        code: 'APPROVE_FAILED',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── 2. Build + validate the intent ─────────────────────────────────
  const zero = ethers.ZeroAddress;
  const referrer = params.referrer ?? zero;
  const referrer2 = params.referrer2 ?? zero;
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = nowSec + INTENT_EXPIRY_SECONDS;
  const nonce = randomNonce();

  // Fast path: same-token XOM↔XOM (receiveToken == paymentToken).
  const receiveToken = paymentToken;
  // Fast path requires minReceiveAmount ≤ paymentAmount * 99/100. Use the
  // exact contract floor; any slippage tolerance is on the seller's side.
  const minReceiveAmount = (paymentAmountBn * 9900n) / 10000n;

  const intent: BuyNFTMessage = {
    buyer: params.buyer,
    seller: params.seller,
    nftContract: params.nftContract,
    nftTokenId: params.nftTokenId,
    paymentToken,
    paymentAmount: params.paymentAmount,
    receiveToken,
    minReceiveAmount: minReceiveAmount.toString(),
    swapPathHash: ZERO_HASH,
    listingId: params.listingId,
    referrer,
    referrer2,
    expiresAt,
    nonce,
  };

  const validation = validateBuyNFTIntent(intent, paymentToken, nowSec);
  if (!validation.ok) {
    return {
      ok: false,
      code: 'INTENT_REJECTED',
      message: validation.error,
      ...(validation.detail !== undefined && { detail: validation.detail }),
    };
  }

  // ── 3. Sign + POST ─────────────────────────────────────────────────
  const domain = OMNIBAZAAR_DOMAIN(settlementContract);
  const types = { BuyNFT: BUY_NFT_TYPES.BuyNFT.slice() };
  const wallet = Wallet.fromPhrase(params.mnemonic);
  const signature = await wallet.signTypedData(domain, types, intent);

  const base = getBaseUrl().replace(/\/$/, '');
  const url = `${base}/api/v1/nft/buy`;
  const payload = {
    address: params.buyer,
    typedData: {
      domain,
      types,
      primaryType: 'BuyNFT',
      message: intent,
    },
    signature,
    swapPath: [],
    swapSources: [],
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await resp.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    action?: string;
    saleId?: string;
    txHash?: string;
    blockNumber?: number;
  };
  if (!resp.ok || body.success !== true) {
    const detail = body.action !== undefined ? ` — ${body.action}` : '';
    return {
      ok: false,
      code: 'VALIDATOR_REJECTED',
      message: `${body.error ?? 'NFT purchase failed'}${detail}`,
    };
  }
  if (body.saleId === undefined || body.txHash === undefined) {
    return {
      ok: false,
      code: 'VALIDATOR_REJECTED',
      message: 'Validator returned an incomplete buy response',
    };
  }
  return {
    ok: true,
    saleId: body.saleId,
    txHash: body.txHash,
    approvedInline,
    ...(body.blockNumber !== undefined && { blockNumber: body.blockNumber }),
  };
}
