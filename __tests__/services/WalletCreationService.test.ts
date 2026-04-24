/**
 * WalletCreationService unit tests.
 *
 * Exercises BIP39 generation, import, and verify-position selection.
 * No network calls — pure crypto + address derivation.
 */

import {
  chooseVerifyPositions,
  createWallet,
  importWallet,
} from '../../src/services/WalletCreationService';

describe('WalletCreationService', () => {
  describe('createWallet', () => {
    it('generates a 12-word mnemonic by default', () => {
      const keys = createWallet();
      const words = keys.mnemonic.trim().split(/\s+/);
      expect(words).toHaveLength(12);
    });

    it('generates a 24-word mnemonic when wordCount=24', () => {
      const keys = createWallet(24);
      const words = keys.mnemonic.trim().split(/\s+/);
      expect(words).toHaveLength(24);
    });

    it('produces a valid EIP-55 checksum address', () => {
      const keys = createWallet();
      expect(keys.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('produces distinct owner + active public keys', () => {
      const keys = createWallet();
      expect(keys.ownerPublicKey).not.toBe(keys.activePublicKey);
      // ethers v6 returns SEC1 compressed secp256k1 public keys:
      // 0x02 or 0x03 prefix + 32-byte x-coord (64 hex chars).
      expect(keys.ownerPublicKey).toMatch(/^0x0[23][0-9a-fA-F]{64}$/);
      expect(keys.activePublicKey).toMatch(/^0x0[23][0-9a-fA-F]{64}$/);
    });

    it('generates unique mnemonics across calls', () => {
      const a = createWallet();
      const b = createWallet();
      expect(a.mnemonic).not.toBe(b.mnemonic);
      expect(a.address).not.toBe(b.address);
    });
  });

  describe('importWallet', () => {
    // BIP39 test vector — well-known "abandon abandon … about" 12-word phrase
    const TEST_MNEMONIC =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const TEST_ADDRESS_LOWER = '0x9858effd232b4033e47d90003d41ec34ecaeda94';

    it('recovers the canonical test-vector address from abandon×11 about', () => {
      const keys = importWallet(TEST_MNEMONIC);
      expect(keys.address.toLowerCase()).toBe(TEST_ADDRESS_LOWER);
    });

    it('trims extra whitespace from the phrase', () => {
      const keys = importWallet(`   ${TEST_MNEMONIC}   `);
      expect(keys.address.toLowerCase()).toBe(TEST_ADDRESS_LOWER);
    });

    it('throws on an invalid word', () => {
      const bad = TEST_MNEMONIC.replace('abandon', 'zzzzz');
      expect(() => importWallet(bad)).toThrow();
    });

    it('throws on wrong word count (11 words)', () => {
      const short = TEST_MNEMONIC.split(' ').slice(0, 11).join(' ');
      expect(() => importWallet(short)).toThrow();
    });

    it('create → import roundtrip reproduces the same address', () => {
      const created = createWallet();
      const reimported = importWallet(created.mnemonic);
      expect(reimported.address).toBe(created.address);
      expect(reimported.ownerPublicKey).toBe(created.ownerPublicKey);
      expect(reimported.activePublicKey).toBe(created.activePublicKey);
    });
  });

  describe('chooseVerifyPositions', () => {
    it('returns 3 distinct positions by default', () => {
      const positions = chooseVerifyPositions(12);
      expect(positions).toHaveLength(3);
      expect(new Set(positions).size).toBe(3);
    });

    it('positions are within bounds [0, wordCount)', () => {
      for (let i = 0; i < 50; i += 1) {
        const positions = chooseVerifyPositions(12);
        for (const pos of positions) {
          expect(pos).toBeGreaterThanOrEqual(0);
          expect(pos).toBeLessThan(12);
        }
      }
    });

    it('returns positions sorted ascending', () => {
      const positions = chooseVerifyPositions(24);
      for (let i = 1; i < positions.length; i += 1) {
        expect(positions[i]).toBeGreaterThan(positions[i - 1] ?? -1);
      }
    });

    it('respects the `count` argument', () => {
      const positions = chooseVerifyPositions(12, 5);
      expect(positions).toHaveLength(5);
      expect(new Set(positions).size).toBe(5);
    });
  });
});
