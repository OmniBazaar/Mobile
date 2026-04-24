/**
 * Smoke-import test for the path-alias plumbing.
 *
 * Confirms at TypeScript compile time that Mobile can resolve symbols
 * from the Wallet source tree through the `@wallet/*` path alias
 * configured in tsconfig.json + metro.config.js.
 *
 * This file is never imported at runtime — it exists only so
 * `npm run typecheck` fails loudly if the alias wiring regresses.
 * When a future refactor removes or renames any of these symbols, this
 * file is the canary that catches it before tests even run.
 */

// Platform layer — the registry that Mobile's adapters plug into.
import {
  getStorageAdapter,
  registerStorageAdapter,
} from '@wallet/platform/registry';

// Core service surface Mobile depends on.
import { KeyringService } from '@wallet/core/keyring/KeyringService';
import { ChallengeAuthClient } from '@wallet/services/auth/ChallengeAuthClient';
import { MarketplaceClient } from '@wallet/services/marketplace/MarketplaceClient';

// Reference each imported symbol so tsc emits a compile-time error the
// moment one of them disappears or changes shape.
export const _smokeCheck = {
  hasGet: typeof getStorageAdapter === 'function',
  hasRegister: typeof registerStorageAdapter === 'function',
  hasKeyring: KeyringService !== undefined,
  hasAuth: ChallengeAuthClient !== undefined,
  hasMarketplace: MarketplaceClient !== undefined,
} as const;
