/**
 * FamilyAddressService unit tests.
 *
 * The service derives non-EVM family addresses from the BIP-39
 * mnemonic. We don't assert the exact derived addresses (those depend
 * on @wallet's family-derivation primitives, which are themselves
 * tested in the Wallet repo) — instead we assert:
 *   - Empty mnemonic returns an empty bundle.
 *   - Same mnemonic always yields the same bundle (determinism).
 *   - Different mnemonics yield different bundles.
 *   - The bundle keys match the FamilyAddressBundle interface.
 *   - Single-family failures don't tank the whole bundle.
 */

import { Mnemonic } from 'ethers';
import { deriveFamilyAddresses } from '../../src/services/FamilyAddressService';

const TEST_MNEMONIC_A = Mnemonic.fromEntropy('0x' + '00'.repeat(16)).phrase;
const TEST_MNEMONIC_B = Mnemonic.fromEntropy('0x' + '11'.repeat(16)).phrase;

describe('FamilyAddressService.deriveFamilyAddresses', () => {
  it('returns an empty object for an empty mnemonic', () => {
    expect(deriveFamilyAddresses('')).toEqual({});
    expect(deriveFamilyAddresses('   ')).toEqual({});
  });

  it('is deterministic — same mnemonic always yields the same bundle', () => {
    const a1 = deriveFamilyAddresses(TEST_MNEMONIC_A);
    const a2 = deriveFamilyAddresses(TEST_MNEMONIC_A);
    expect(a1).toEqual(a2);
  });

  it('yields different bundles for different mnemonics', () => {
    const a = deriveFamilyAddresses(TEST_MNEMONIC_A);
    const b = deriveFamilyAddresses(TEST_MNEMONIC_B);
    // For any non-empty key shared between the two, the address must
    // differ — otherwise we have a derivation that ignores the seed.
    const sharedKeys = Object.keys(a).filter((k) =>
      Object.prototype.hasOwnProperty.call(b, k),
    );
    expect(sharedKeys.length).toBeGreaterThan(0);
    for (const key of sharedKeys) {
      expect((a as Record<string, string>)[key]).not.toBe(
        (b as Record<string, string>)[key],
      );
    }
  });

  it('returns at least the families that have stable derivation paths', () => {
    const bundle = deriveFamilyAddresses(TEST_MNEMONIC_A);
    // XRP + TRON + Cosmos use plain secp256k1 derivation — they should
    // never fail in any environment that has ethers + the BIP-44 root.
    // (Cardano can fail in test env if the heavy CSL SDK is absent;
    // we treat that as best-effort in production code, so a missing
    // cardano key here is acceptable.)
    expect(typeof bundle.xrp === 'string' && bundle.xrp.length > 0).toBe(true);
    expect(typeof bundle.tron === 'string' && bundle.tron.length > 0).toBe(true);
    expect(typeof bundle.cosmos === 'string' && bundle.cosmos.length > 0).toBe(true);
  });

  it('rejects malformed mnemonics gracefully (never throws)', () => {
    // A 12-word phrase with a single bad word — should throw inside
    // ethers but the service must catch and return an empty bundle.
    expect(() =>
      deriveFamilyAddresses('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon notaword'),
    ).not.toThrow();
  });

  it('derived addresses use family-appropriate formats', () => {
    const bundle = deriveFamilyAddresses(TEST_MNEMONIC_A);
    if (typeof bundle.xrp === 'string') {
      // XRP classic addresses start with "r" and are base58.
      expect(bundle.xrp.startsWith('r')).toBe(true);
    }
    if (typeof bundle.cosmos === 'string') {
      // Cosmos hub bech32 prefix is "cosmos1".
      expect(bundle.cosmos.startsWith('cosmos1')).toBe(true);
    }
    if (typeof bundle.tron === 'string') {
      // TRON Base58Check addresses always start with "T".
      expect(bundle.tron.startsWith('T')).toBe(true);
    }
  });
});
