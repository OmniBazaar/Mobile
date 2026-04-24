/**
 * SendService — Mobile's thin wrapper around ethers v6 for native EVM
 * sends. Gasless L1 sends (OmniCoin chain 88008) route through
 * OmniRelay in Phase 3; for Phase 2 every chain uses direct
 * user-pays-gas broadcast so the primitive is in place.
 *
 * All RPC calls go through ClientRPCRegistry (sibling @wallet/*) so
 * every send originates from the user's mobile IP — no validator
 * proxying for public-RPC chains.
 */

import { ethers, Wallet } from 'ethers';
import { getClientRPCRegistry } from '@wallet/core/providers/ClientRPCRegistry';

/** Input parameters for a native EVM send. */
export interface SendNativeParams {
  /** BIP39 mnemonic — the caller is responsible for zeroing this after use. */
  mnemonic: string;
  /** Target EVM chain ID. */
  chainId: number;
  /** Recipient address (0x…, EIP-55 or lowercase — normalized by ethers). */
  to: string;
  /** Amount to send in the chain's smallest unit (wei for EVM). */
  amount: bigint;
  /**
   * Optional EIP-1559 maxFeePerGas override in gwei. When omitted,
   * ethers auto-estimates from the provider.
   */
  maxFeePerGasGwei?: bigint;
  /** Optional EIP-1559 maxPriorityFeePerGas override in gwei. */
  maxPriorityFeePerGasGwei?: bigint;
  /** Optional gasLimit override. */
  gasLimit?: bigint;
}

/** Receipt-lite from a successful broadcast. */
export interface SendResult {
  /** On-chain transaction hash. */
  txHash: string;
  /** Chain the tx was submitted to. */
  chainId: number;
  /** Address that signed the tx. */
  from: string;
}

/**
 * Build, sign, and broadcast a native EVM transfer.
 *
 * Errors propagate from the underlying ethers provider —
 * ClientRPCRegistry handles per-chain failover before this layer sees
 * any response, so the caller can assume the error represents a real
 * chain-level failure (insufficient balance, nonce collision, etc.)
 * rather than a transient RPC hiccup.
 *
 * @param params - See {@link SendNativeParams}.
 * @returns Broadcast receipt metadata.
 */
export async function sendNative(params: SendNativeParams): Promise<SendResult> {
  if (params.amount <= 0n) {
    throw new Error('sendNative: amount must be positive');
  }
  if (!ethers.isAddress(params.to)) {
    throw new Error(`sendNative: invalid recipient address ${params.to}`);
  }

  const provider = getClientRPCRegistry().getProvider(params.chainId);
  if (provider === undefined) {
    throw new Error(
      `sendNative: no RPC provider available for chainId ${params.chainId}`,
    );
  }

  // The provider is constructed in Wallet's ethers realm; Wallet.fromPhrase
  // here uses Mobile's own ethers. They're the same version but TypeScript
  // sees them as distinct because of the #private field on Network.
  // Pass through as unknown → Provider; the runtime is fully compatible.
  const wallet = Wallet.fromPhrase(
    params.mnemonic,
    provider as unknown as ethers.Provider,
  );

  const tx: ethers.TransactionRequest = {
    to: params.to,
    value: params.amount,
    chainId: params.chainId,
  };
  if (params.maxFeePerGasGwei !== undefined) {
    tx.maxFeePerGas = params.maxFeePerGasGwei * 1_000_000_000n;
  }
  if (params.maxPriorityFeePerGasGwei !== undefined) {
    tx.maxPriorityFeePerGas = params.maxPriorityFeePerGasGwei * 1_000_000_000n;
  }
  if (params.gasLimit !== undefined) {
    tx.gasLimit = params.gasLimit;
  }

  const sent = await wallet.sendTransaction(tx);

  return {
    txHash: sent.hash,
    chainId: params.chainId,
    from: wallet.address,
  };
}

/**
 * Parse a user-entered decimal amount string into the chain's smallest
 * unit. Accepts integer or decimal; rejects negative or non-numeric.
 *
 * @param amount - User-entered decimal, e.g. "0.1" or "3".
 * @param decimals - Chain-native decimals (18 for EVM).
 * @returns Smallest-unit bigint.
 * @throws On malformed or negative input.
 */
export function parseAmount(amount: string, decimals: number = 18): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`parseAmount: invalid numeric input "${amount}"`);
  }
  return ethers.parseUnits(trimmed, decimals);
}
