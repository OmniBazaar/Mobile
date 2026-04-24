/**
 * StakingService — integration tests for stake / unstake / claim.
 *
 * Mocks the validator HTTP endpoint + BootstrapService, runs the full
 * sign-and-POST pipeline, and asserts the body shape the validator
 * expects (typedData + signature + legacyCanonical + legacySignature +
 * gasless: true).
 */

jest.mock('../../src/services/BootstrapService', () => ({
  getBaseUrl: () => 'http://validator.test',
}));

import { claim, stake, unstake } from '../../src/services/StakingService';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const STAKER = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';

/** Capture the last request body the service sent. */
let lastBody: unknown;
let lastUrl: string | undefined;

const originalFetch = global.fetch;

beforeEach(() => {
  lastBody = undefined;
  lastUrl = undefined;
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    lastUrl = url;
    lastBody = JSON.parse(String(init?.body ?? '{}'));
    return {
      ok: true,
      json: async () => ({ success: true, txHash: '0xabc123' }),
    };
  }) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('StakingService', () => {
  describe('stake', () => {
    it('POSTs a signed Stake intent with gasless: true', async () => {
      const { txHash } = await stake({
        staker: STAKER,
        amount: '1000000000000000000000',
        durationDays: 180,
        mnemonic: MNEMONIC,
      });
      expect(txHash).toBe('0xabc123');
      expect(lastUrl).toBe('http://validator.test/api/v1/staking/stake');
      const body = lastBody as Record<string, unknown>;
      expect(body.gasless).toBe(true);
      expect(body.address).toBe(STAKER);
      expect(typeof body.signature).toBe('string');
      expect(String(body.signature).startsWith('0x')).toBe(true);
      expect(typeof body.legacySignature).toBe('string');
      expect(String(body.legacyCanonical)).toMatch(/^STAKING_STAKE /);
      const typedData = body.typedData as { message?: Record<string, unknown> };
      expect(typedData.message?.['amount']).toBe('1000000000000000000000');
      expect(typedData.message?.['durationDays']).toBe(180);
    });
  });

  describe('unstake', () => {
    it('POSTs a signed Unstake intent', async () => {
      await unstake({
        staker: STAKER,
        amount: '500000000000000000000',
        mnemonic: MNEMONIC,
      });
      expect(lastUrl).toBe('http://validator.test/api/v1/staking/unstake');
      const body = lastBody as Record<string, unknown>;
      expect(String(body.legacyCanonical)).toMatch(/^STAKING_UNSTAKE /);
      const typedData = body.typedData as { primaryType?: string };
      expect(typedData.primaryType).toBe('Unstake');
    });
  });

  describe('claim', () => {
    it('POSTs a signed ClaimRewards intent without amount', async () => {
      await claim({ staker: STAKER, mnemonic: MNEMONIC });
      expect(lastUrl).toBe('http://validator.test/api/v1/staking/claim');
      const body = lastBody as Record<string, unknown>;
      expect(String(body.legacyCanonical)).toMatch(/^STAKING_CLAIM /);
      const typedData = body.typedData as { primaryType?: string };
      expect(typedData.primaryType).toBe('ClaimRewards');
    });
  });

  describe('failure modes', () => {
    it('throws when the validator returns {success:false}', async () => {
      global.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({ success: false, error: 'insufficient balance' }),
      })) as unknown as typeof fetch;
      await expect(
        stake({ staker: STAKER, amount: '1', durationDays: 0, mnemonic: MNEMONIC }),
      ).rejects.toThrow(/insufficient balance/);
    });

    it('throws when the response lacks txHash', async () => {
      global.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({ success: true }),
      })) as unknown as typeof fetch;
      await expect(
        claim({ staker: STAKER, mnemonic: MNEMONIC }),
      ).rejects.toThrow(/no tx hash/);
    });
  });
});
