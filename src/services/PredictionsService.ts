/**
 * PredictionsService — Mobile-side prediction-market orchestrator.
 *
 * Two user flows live here:
 *   - {@link buyOutcome} — build unsigned trade tx via the validator, sign
 *     + approve (if needed) + broadcast via `RelaySubmitService`, then
 *     notify the validator via `submitTrade` so the market pending/open-
 *     position feed reflects the purchase.
 *   - {@link claimOutcome} — sign an EIP-712 PredictionClaim intent (plus
 *     its EIP-191 legacy canonical) and ask the validator for a
 *     `redeemPositions()` envelope, then broadcast on the destination CTF
 *     chain (Polygon 137 / Gnosis 100).
 *
 * All HTTP work happens on the validator's `/api/v1/predictions/*` routes
 * via the shared `PredictionsClient`. No client-side secret ever leaves
 * the function; the mnemonic is used in-memory only to derive the signer.
 */

import { ethers, Wallet } from 'ethers';

import {
  OMNIBAZAAR_DOMAIN,
  PREDICTION_CLAIM_TYPES,
  type PredictionClaimMessage,
  randomNonce,
} from '@wallet/background/eip712Intents';
import {
  getPredictionsClient,
  type PredictionMarketDetail,
  type PredictionOutcome,
  type PredictionTradeQuote,
  type PredictionTradeTx,
} from '@wallet/services/predictions/PredictionsClient';

import { submitTransaction, type MobileUnsignedTx } from './RelaySubmitService';
import { getContractAddresses } from '../config/omnicoin-integration';

/** Trade-buy inputs. */
export interface BuyOutcomeParams {
  /** Market detail (includes routerAddress + collateralToken). */
  market: PredictionMarketDetail;
  /** `yes` or `no`. */
  outcome: PredictionOutcome;
  /** Amount in collateral (USD-denominated decimal, e.g. `"5.0"`). */
  amountUsd: string;
  /** Buyer address. */
  buyer: string;
  /** Mnemonic used to derive the signer. */
  mnemonic: string;
}

/** Trade-buy result. */
export interface BuyOutcomeResult {
  /** Validator-issued position order id. */
  orderId: string;
  /** Quote the buy executed against. */
  quote: PredictionTradeQuote;
  /** Tx hash of the (optional) ERC-20 approval, if one was broadcast. */
  approvalTxHash?: string;
  /** Tx hash of the trade tx. */
  tradeTxHash: string;
}

/** Claim inputs. */
export interface ClaimOutcomeParams {
  /** Market the user is claiming from. */
  market: PredictionMarketDetail;
  /** `yes` or `no`. */
  outcome: PredictionOutcome;
  /** Trader address. */
  trader: string;
  /** Mnemonic used to sign intent + legacy EIP-191. */
  mnemonic: string;
  /** Optional bearer token for authenticated sessions. */
  token?: string;
}

/** Claim result. */
export interface ClaimOutcomeResult {
  /** Destination CTF chain id (Polygon/Gnosis). */
  chainId: number;
  /** On-chain tx hash. */
  txHash: string;
}

/**
 * Fetch a live quote from the validator. Thin wrapper that keeps all
 * prediction HTTP calls behind this service instead of the UI.
 *
 * @param marketId - Composite market id.
 * @param outcome - `yes` or `no`.
 * @param amountUsd - Collateral amount (decimal USD string).
 * @returns Live quote.
 */
export async function getQuote(
  marketId: string,
  outcome: PredictionOutcome,
  amountUsd: string,
): Promise<PredictionTradeQuote> {
  return getPredictionsClient().getTradeQuote(marketId, outcome, amountUsd);
}

/**
 * Execute a buy of a prediction market outcome.
 *
 * Flow:
 *   1. `getTradeQuote(marketId, outcome, amountUsd)` — read-only price check.
 *   2. `buildTradeTx(...)` — returns an unsigned tx on the market's chain,
 *      plus an optional approvalTx when collateral allowance is insufficient.
 *   3. Submit approval (if any) and then the trade tx through
 *      `RelaySubmitService` — which picks OmniRelay for L1 and direct
 *      broadcast for everything else.
 *   4. Call `submitTrade(...)` so the validator indexes the new position.
 *
 * @param params - See {@link BuyOutcomeParams}.
 * @returns Trade outcome.
 */
export async function buyOutcome(params: BuyOutcomeParams): Promise<BuyOutcomeResult> {
  const client = getPredictionsClient();
  const quote = await client.getTradeQuote(params.market.id, params.outcome, params.amountUsd);

  const tradeTx: PredictionTradeTx = await client.buildTradeTx({
    marketId: params.market.id,
    outcome: params.outcome,
    totalAmount: quote.totalAmount,
    feeAmount: quote.feeAmount,
    userAddress: params.buyer,
    ...(quote.midPrice !== undefined && quote.midPrice !== '' && {
      maxPrice: Number.parseFloat(quote.midPrice),
    }),
  });

  let approvalTxHash: string | undefined;
  if (tradeTx.approvalTx !== undefined) {
    approvalTxHash = await submitTransaction(
      {
        to: tradeTx.approvalTx.to,
        data: tradeTx.approvalTx.data,
        value: tradeTx.approvalTx.value,
        chainId: tradeTx.approvalTx.chainId,
      },
      params.mnemonic,
    );
  }

  const unsigned: MobileUnsignedTx = {
    to: tradeTx.to,
    data: tradeTx.data,
    value: tradeTx.value,
    chainId: tradeTx.chainId,
  };
  const tradeTxHash = await submitTransaction(unsigned, params.mnemonic);

  const submitPayload = {
    txHash: tradeTxHash,
    marketId: params.market.id,
    platform: params.market.platform,
    conditionId: params.market.conditionId,
    chainId: tradeTx.chainId,
    outcome: params.outcome,
    totalAmount: quote.totalAmount,
    feeRateBps: quote.feeRateBps,
    feeAmount: quote.feeAmount,
    netAmount: quote.netAmount,
    userAddress: params.buyer,
    collateralToken: tradeTx.collateralToken,
    routerAddress: tradeTx.routerAddress,
  };
  const { orderId } = await client.submitTrade(submitPayload);

  return {
    orderId,
    quote,
    tradeTxHash,
    ...(approvalTxHash !== undefined && { approvalTxHash }),
  };
}

/**
 * Claim winnings from a resolved prediction market.
 *
 * Flow:
 *   1. Build + sign the OmniBazaar-domain `PredictionClaim` EIP-712 intent.
 *   2. Sign the legacy EIP-191 canonical string (still required by the
 *      validator until the server-side migration completes).
 *   3. `buildClaim(...)` — validator verifies the sig and returns a
 *      `redeemPositions()` envelope.
 *   4. Submit via `RelaySubmitService` (direct broadcast — CTF chains are
 *      not L1, so no relay; user pays gas unless they previously received
 *      gas via the bridge flow).
 *
 * @param params - See {@link ClaimOutcomeParams}.
 * @returns Broadcast result.
 */
export async function claimOutcome(params: ClaimOutcomeParams): Promise<ClaimOutcomeResult> {
  const addresses = getContractAddresses('mainnet');
  const verifyingContract = addresses.OmniPredictionRouter ?? ethers.ZeroAddress;

  const trader = params.trader;
  const timestamp = Date.now();
  const nonce = randomNonce();
  const message: PredictionClaimMessage = {
    trader,
    marketId: params.market.id,
    outcome: params.outcome,
    timestamp,
    nonce,
  };
  const domain = OMNIBAZAAR_DOMAIN(verifyingContract);
  const types = { PredictionClaim: PREDICTION_CLAIM_TYPES.PredictionClaim.slice() };

  const signer = Wallet.fromPhrase(params.mnemonic);
  const signature = await signer.signTypedData(domain, types, message);

  const legacyCanonical =
    `PREDICTION_CLAIM ${params.market.id} ${params.outcome} ${timestamp}`;
  const legacySignature = await signer.signMessage(legacyCanonical);

  const envelope = await getPredictionsClient().buildClaim({
    marketId: params.market.id,
    outcome: params.outcome,
    address: trader,
    typedData: {
      domain,
      types,
      primaryType: 'PredictionClaim',
      message,
    },
    signature,
    legacyCanonical,
    legacySignature,
    timestamp,
    token: params.token ?? '',
  });

  if (envelope.value !== '0') {
    throw new Error(
      `Claim envelope has non-zero value (${envelope.value}) — refusing to sign`,
    );
  }

  const txHash = await submitTransaction(
    {
      to: envelope.to,
      data: envelope.data,
      value: envelope.value,
      chainId: envelope.chainId,
    },
    params.mnemonic,
  );
  return { chainId: envelope.chainId, txHash };
}
