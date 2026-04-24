/**
 * BootstrapService — unit tests for the idempotency + timeout logic.
 *
 * The underlying ValidatorDiscoveryService is mocked so the tests run
 * in milliseconds without actually reaching the live 5-node cluster.
 */

jest.mock('@wallet/background/services/ValidatorDiscoveryService', () => {
  const service = {
    initialize: jest.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 50))),
    getBaseUrl: jest.fn(() => 'http://65.108.205.116:3001'),
  };
  return {
    getDiscoveryService: jest.fn(() => service),
    __service: service,
  };
});

import { bootstrap, getBaseUrl } from '../../src/services/BootstrapService';
import * as Discovery from '@wallet/background/services/ValidatorDiscoveryService';

// Helper to reset the module-scoped readyPromise between tests. Since
// `bootstrap()` captures it in a closure, we need to re-import for each
// test that cares. Jest's isolateModules gives us a fresh copy.
function freshBootstrap(): typeof import('../../src/services/BootstrapService') {
  let mod: typeof import('../../src/services/BootstrapService') | undefined;
  jest.isolateModules(() => {
    mod = require('../../src/services/BootstrapService') as typeof import('../../src/services/BootstrapService');
  });
  return mod!;
}

describe('BootstrapService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getBaseUrl pass-throughs to ValidatorDiscoveryService.getBaseUrl', () => {
    const url = getBaseUrl();
    expect(url).toBe('http://65.108.205.116:3001');
    const svc = (Discovery as unknown as { __service: { getBaseUrl: jest.Mock } }).__service;
    expect(svc.getBaseUrl).toHaveBeenCalledTimes(1);
  });

  it('bootstrap() is idempotent — multiple calls share one promise', async () => {
    const mod = freshBootstrap();
    const svc = (Discovery as unknown as { __service: { initialize: jest.Mock } }).__service;
    const p1 = mod.bootstrap();
    const p2 = mod.bootstrap();
    const p3 = mod.bootstrap();
    expect(p1).toBe(p2);
    expect(p2).toBe(p3);
    await p1;
    expect(svc.initialize).toHaveBeenCalledTimes(1);
  });

  it('bootstrap() resolves rather than rejecting when initialize fails', async () => {
    const mod = freshBootstrap();
    const svc = (Discovery as unknown as { __service: { initialize: jest.Mock } }).__service;
    svc.initialize.mockImplementationOnce(() => Promise.reject(new Error('rpc dead')));
    await expect(mod.bootstrap()).resolves.toBeUndefined();
  });

  it('bootstrap() resolves on timeout even if initialize never settles', async () => {
    const mod = freshBootstrap();
    const svc = (Discovery as unknown as { __service: { initialize: jest.Mock } }).__service;
    // Stall forever.
    svc.initialize.mockImplementationOnce(() => new Promise<void>(() => {}));

    jest.useFakeTimers();
    const promise = mod.bootstrap();
    // Fast-forward past the 8s DISCOVERY_TIMEOUT_MS sentinel.
    jest.advanceTimersByTime(9_000);
    jest.useRealTimers();
    await expect(promise).resolves.toBeUndefined();
  });
});
