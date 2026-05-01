/**
 * RelaySubmitService — Mobile-side gateway for EIP-2771 meta-transactions on
 * OmniCoin L1 (chainId 88008).
 *
 * Lets the Mobile client broadcast L1 transactions through OmniRelay so the
 * user never pays gas. For non-L1 chains, callers should continue using
 * direct `ethers.Wallet.sendTransaction()` since those chains have no
 * gasless forwarder.
 *
 * Pattern is identical to the Wallet extension's {@link WalletRelayingSigner}
 * + {@link OmniRelayClient}, ported through the `@wallet/*` path alias.
 * Resolution of the validator base URL falls through to
 * `ValidatorDiscoveryService` — Mobile's `chrome.storage.local` probe in
 * `OmniRelayClient.readStoredEndpoint()` returns `undefined` in RN (no
 * `chrome` global), so discovery is authoritative.
 */
import { getClientRPCRegistry } from '@wallet/core/providers/ClientRPCRegistry';
import { OmniRelayClient } from '@wallet/services/relay/OmniRelayClient';
import { WalletRelayingSigner } from '@wallet/services/relay/WalletRelayingSigner';
import { ethers, Wallet } from 'ethers';

import { getContractAddresses } from '../config/omnicoin-integration';

/** Canonical OmniCoin L1 chain ID (same as WebApp + Wallet). */
export const OMNICOIN_L1_CHAIN_ID = 88008;

/**
 * Shape of an unsigned transaction as returned by the validator's
 * `/api/v1/universal-swap/execute` + marketplace intent endpoints.
 * Kept minimal so non-swap callers (NFT buy, staking, prediction claim)
 * can reuse this helper without importing swap-specific types.
 */
export interface MobileUnsignedTx {
  /** Contract address to call. */
  to: string;
  /** ABI-encoded calldata. */
  data: string;
  /** Value in wei (decimal string). */
  value: string;
  /** Target chain ID. */
  chainId: number;
}

/**
 * Return true when an unsigned tx should be relayed gaslessly through
 * OmniForwarder rather than broadcast directly from the user's wallet.
 * Currently limited to OmniCoin L1; other L1s charge real gas and must
 * submit the normal way.
 *
 * For non-L1 chains, returns `false` (use direct broadcast). For L1
 * routes, returns `true` only if the OmniForwarder address is configured
 * AND the relay is reachable. When relay is unavailable for an L1 tx the
 * caller MUST surface a clear error rather than fall back to direct
 * broadcast — the user expects gasless and will not have native XOM to
 * pay for a direct broadcast.
 *
 * @param chainId - Target chain ID of the unsigned transaction.
 * @returns `true` iff this tx should be relayed.
 */
export function shouldRelay(chainId: number): boolean {
  if (chainId !== OMNICOIN_L1_CHAIN_ID) return false;
  try {
    const addresses = getContractAddresses('mainnet');
    return OmniRelayClient.getInstance().isRelayAvailable(addresses);
  } catch {
    return false;
  }
}

/**
 * Error thrown when an L1 transaction needs the OmniRelay but the relay
 * client is not configured / not reachable. Callers should surface a
 * "Relayer unavailable, please retry" toast in the swap UI instead of
 * mis-routing the user to a direct broadcast that would either fail
 * with `insufficient funds for gas` or silently charge native XOM the
 * user did not expect to spend.
 */
export class RelayUnavailableError extends Error {
  /** Always set so callers can branch on it without instanceof in RN. */
  public readonly code = 'RELAY_UNAVAILABLE';
  /**
   * Construct a relay-unavailable error.
   * @param message - Human-readable explanation.
   */
  constructor(message = 'OmniRelay is unavailable. Please retry in a moment.') {
    super(message);
    this.name = 'RelayUnavailableError';
  }
}

/**
 * Broadcast a single unsigned tx via the OmniForwarder relay and return
 * the resulting on-chain tx hash. Caller is responsible for ensuring
 * `shouldRelay(tx.chainId)` is true before invoking this.
 *
 * Flow:
 *   1. Derive `ethers.Wallet` from the mnemonic, bound to the L1 provider
 *      from `ClientRPCRegistry`.
 *   2. Wrap it in `WalletRelayingSigner` with mainnet `ContractAddresses`.
 *   3. Issue `sendTransaction` — the signer builds + signs EIP-712
 *      ForwardRequest, posts to `/api/v1/relay/submit`, and resolves a
 *      TransactionResponse once the validator confirms on-chain.
 *   4. Await 1 confirmation so the caller sees a finalised receipt before
 *      moving to the next step.
 *
 * @param tx - Unsigned L1 transaction.
 * @param mnemonic - BIP39 phrase used to derive the signer.
 * @returns On-chain tx hash.
 */
export async function relayL1Transaction(
  tx: MobileUnsignedTx,
  mnemonic: string,
): Promise<string> {
  if (tx.chainId !== OMNICOIN_L1_CHAIN_ID) {
    throw new Error(
      `relayL1Transaction: expected chainId ${OMNICOIN_L1_CHAIN_ID}, got ${tx.chainId}`,
    );
  }
  const provider = getClientRPCRegistry().getProvider(tx.chainId);
  if (provider === undefined) {
    throw new Error(
      `relayL1Transaction: no RPC provider for chainId ${tx.chainId}`,
    );
  }
  const innerSigner = Wallet.fromPhrase(
    mnemonic,
    // Cross-realm ethers — Mobile and Wallet resolve distinct `ethers`
    // module instances under Metro; they share the same runtime ABI.
    provider as unknown as ethers.Provider,
  );
  const addresses = getContractAddresses('mainnet');
  // Wallet's ethers types live in Wallet/node_modules/ethers — same ABI,
  // distinct #private fields. The signer works at runtime; the `unknown`
  // cast punches through the realm mismatch.
  const relay = new WalletRelayingSigner(
    innerSigner as unknown as ConstructorParameters<
      typeof WalletRelayingSigner
    >[0],
    addresses,
  );
  const value = tx.value === '' || tx.value === '0x' ? 0n : BigInt(tx.value);
  const response = await relay.sendTransaction({
    to: tx.to,
    data: tx.data,
    value,
    chainId: tx.chainId,
  });
  await response.wait(1);
  return response.hash;
}

/**
 * Sign + broadcast a single unsigned tx through the user's own wallet.
 * Used for non-L1 chains (Ethereum, Arbitrum, Base, Polygon, Avalanche, …)
 * where the user pays real gas.
 *
 * @param tx - Unsigned transaction.
 * @param mnemonic - BIP39 phrase used to derive the signer.
 * @returns On-chain tx hash.
 */
export async function broadcastDirect(
  tx: MobileUnsignedTx,
  mnemonic: string,
): Promise<string> {
  const provider = getClientRPCRegistry().getProvider(tx.chainId);
  if (provider === undefined) {
    throw new Error(
      `broadcastDirect: no RPC provider for chainId ${tx.chainId}`,
    );
  }
  const wallet = Wallet.fromPhrase(
    mnemonic,
    provider as unknown as ethers.Provider,
  );
  const value = tx.value === '' || tx.value === '0x' ? 0n : BigInt(tx.value);
  const response = await wallet.sendTransaction({
    to: tx.to,
    data: tx.data,
    value,
    chainId: tx.chainId,
  });
  await response.wait(1);
  return response.hash;
}

/**
 * Broadcast an unsigned tx via the right path: relay for L1, direct
 * otherwise. This is the preferred helper for callers that handle mixed
 * chain flows (e.g. SwapService executing a multi-hop route).
 *
 * Fail-closed for L1: if the destination is OmniCoin L1 but the relay
 * is not available, throw {@link RelayUnavailableError} instead of
 * falling back to direct broadcast — the user does not own native gas
 * on L1 and would either get `insufficient funds for gas` from the RPC
 * or silently spend XOM they expected to be gasless.
 *
 * @param tx - Unsigned tx.
 * @param mnemonic - Signer mnemonic.
 * @returns On-chain tx hash.
 * @throws {RelayUnavailableError} When the tx is an L1 tx and the
 *   OmniRelay endpoint is not configured or not reachable.
 */
export async function submitTransaction(
  tx: MobileUnsignedTx,
  mnemonic: string,
): Promise<string> {
  if (tx.chainId === OMNICOIN_L1_CHAIN_ID) {
    if (!shouldRelay(tx.chainId)) {
      throw new RelayUnavailableError();
    }
    return relayL1Transaction(tx, mnemonic);
  }
  return broadcastDirect(tx, mnemonic);
}
