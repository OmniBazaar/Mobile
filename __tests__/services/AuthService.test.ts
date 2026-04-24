/**
 * AuthService unit tests — signature produce/verify roundtrip.
 *
 * Exercises the cryptographic pieces that underlie the challenge-
 * response flow without hitting the validator. Integration against a
 * live validator is covered in Phase 8 E2E via Maestro.
 */

import {
  addressFromMnemonic,
  signWithOwnerKey,
  verifySignature,
} from '../../src/services/AuthService';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const EXPECTED_ADDRESS_LOWER = '0x9858effd232b4033e47d90003d41ec34ecaeda94';

describe('AuthService', () => {
  describe('addressFromMnemonic', () => {
    it('derives the canonical test-vector address', () => {
      expect(addressFromMnemonic(MNEMONIC).toLowerCase()).toBe(EXPECTED_ADDRESS_LOWER);
    });
  });

  describe('signWithOwnerKey + verifySignature', () => {
    it('signs a challenge and verifies against the derived address', async () => {
      const challenge = 'OmniBazaar login challenge 12345';
      const sig = await signWithOwnerKey(MNEMONIC, challenge);
      const address = addressFromMnemonic(MNEMONIC);
      expect(verifySignature(challenge, sig, address)).toBe(true);
    });

    it('rejects a signature against the wrong address', async () => {
      const challenge = 'another challenge';
      const sig = await signWithOwnerKey(MNEMONIC, challenge);
      const wrongAddress = '0x0000000000000000000000000000000000000000';
      expect(verifySignature(challenge, sig, wrongAddress)).toBe(false);
    });

    it('rejects a signature if the message changed', async () => {
      const sig = await signWithOwnerKey(MNEMONIC, 'original message');
      const address = addressFromMnemonic(MNEMONIC);
      expect(verifySignature('tampered message', sig, address)).toBe(false);
    });

    it('handles case-insensitive address comparison', async () => {
      const challenge = 'case test';
      const sig = await signWithOwnerKey(MNEMONIC, challenge);
      const upperAddress = addressFromMnemonic(MNEMONIC).toUpperCase();
      expect(verifySignature(challenge, sig, upperAddress)).toBe(true);
    });

    it('returns false for a malformed signature instead of throwing', () => {
      const address = addressFromMnemonic(MNEMONIC);
      expect(verifySignature('x', '0xdeadbeef', address)).toBe(false);
    });
  });
});
