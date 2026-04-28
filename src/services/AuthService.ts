/**
 * AuthService — Mobile-side orchestrator around the Wallet extension's
 * ChallengeAuthClient.
 *
 * Owns:
 *   - Attestation registration: sign `address:ownerPublicKey:activePublicKey`
 *     with the wallet's owner key and POST to `/api/v1/auth/register`.
 *   - Challenge-response sign-in: GET `/api/v1/auth/login-challenge`,
 *     sign with `ethers.Wallet.signMessage`, POST to
 *     `/api/v1/auth/login-verify`, receive JWT + refresh token.
 *   - Token storage: delegated to ChallengeAuthClient (which routes
 *     through our platform StorageAdapter → SecureStore on Mobile).
 *
 * This module is purely client-side. The server (Validator/src/services/
 * auth/ChallengeAuthService.ts) verifies signatures via
 * `ethers.verifyMessage()` — NO password is ever transmitted.
 */

import { ethers, Wallet } from 'ethers';
import { ChallengeAuthClient } from '@wallet/services/auth/ChallengeAuthClient';

import type { DerivedKeys } from './WalletCreationService';

/** Registration result returned by the validator. */
export interface RegistrationResult {
  token: string;
  refreshToken: string;
  userId: string;
}

/** Sign-in result returned by the validator. */
export interface SignInResult {
  token: string;
  refreshToken: string;
}

/**
 * Sign a UTF-8 string with the owner key derived from the mnemonic,
 * returning the compact 65-byte (r || s || v) EIP-191 signature.
 *
 * @param mnemonic - BIP39 phrase used to derive the owner key.
 * @param message - Plaintext to sign.
 * @returns Hex signature `0x<130 hex chars>`.
 */
export async function signWithOwnerKey(mnemonic: string, message: string): Promise<string> {
  const wallet = Wallet.fromPhrase(mnemonic);
  return await wallet.signMessage(message);
}

/**
 * Register a fresh wallet with the validator. Builds and signs the
 * attestation, POSTs to `/api/v1/auth/register`, stores the JWT via
 * ChallengeAuthClient.storeTokens (→ platform StorageAdapter).
 *
 * @param keys - DerivedKeys from WalletCreationService.
 * @param username - Desired username (lowercase, `^[a-z][a-z0-9_]{2,19}$`).
 * @param email - Verified email address.
 * @param referralCode - Optional referrer username.
 * @returns RegistrationResult (token + refreshToken + userId).
 * @throws If the validator rejects the registration (409 username taken,
 *   401 bad signature, 5xx, network error).
 */
export async function registerWithAttestation(
  keys: DerivedKeys,
  username: string,
  email: string,
  referralCode?: string,
): Promise<RegistrationResult> {
  const client = ChallengeAuthClient.getInstance();
  const result = await client.register(
    {
      address: keys.address,
      ownerPublicKey: keys.ownerPublicKey,
      activePublicKey: keys.activePublicKey,
      username,
      email,
      ...(referralCode !== undefined && { referralCode }),
    },
    async (message: string) => signWithOwnerKey(keys.mnemonic, message),
  );
  return {
    token: result.token,
    refreshToken: result.refreshToken,
    userId: result.userId,
  };
}

/**
 * Challenge-response sign-in. Obtains a one-time challenge, signs it
 * with the owner key, posts the signature for verification.
 *
 * @param mnemonic - BIP39 phrase (already decrypted by the caller).
 * @param username - Canonical lowercase username (the new
 *   ChallengeAuthClient identifies the user by username, not address).
 * @returns SignInResult (token + refreshToken).
 * @throws On expired challenge, signature mismatch, or network error.
 */
export async function signInWithMnemonic(mnemonic: string, username: string): Promise<SignInResult> {
  const wallet = Wallet.fromPhrase(mnemonic);
  const client = ChallengeAuthClient.getInstance();
  const tokens = await client.login(username, wallet.address, async (message: string) =>
    await wallet.signMessage(message),
  );
  return { token: tokens.token, refreshToken: tokens.refreshToken };
}

/**
 * Recover the EVM address associated with a mnemonic without signing
 * anything. Useful for the "which wallet did I back up?" screen during
 * the import-existing-wallet flow.
 *
 * @param mnemonic - BIP39 phrase.
 * @returns Checksummed 0x-address.
 */
export function addressFromMnemonic(mnemonic: string): string {
  return Wallet.fromPhrase(mnemonic).address;
}

/**
 * Hex-verify a signed message against an expected address, wrapping
 * ethers.verifyMessage for test fixtures + manual diagnostics.
 *
 * @param message - Plaintext that was signed.
 * @param signature - 0x-hex signature.
 * @returns True when the recovered address matches.
 */
export function verifySignature(
  message: string,
  signature: string,
  expectedAddress: string,
): boolean {
  try {
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}
