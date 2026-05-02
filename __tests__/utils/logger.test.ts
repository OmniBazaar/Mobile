/**
 * logger.test.ts — confirm the façade routes to the right console
 * channel + lazily forwards warn/error to Sentry breadcrumbs.
 */

const sentryAddBreadcrumb = jest.fn();

jest.mock(
  '@sentry/react-native',
  () => ({
    addBreadcrumb: (b: unknown): void => {
      sentryAddBreadcrumb(b);
    },
  }),
  { virtual: true },
);

beforeEach(() => {
  jest.resetModules();
  sentryAddBreadcrumb.mockReset();
});

describe('utils/logger', () => {
  it('warn always prints + breadcrumbs to Sentry', () => {
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logger } = require('../../src/utils/logger');
    logger.warn('hello', { foo: 1 });
    expect(consoleWarn).toHaveBeenCalledTimes(1);
    expect(sentryAddBreadcrumb).toHaveBeenCalledTimes(1);
    expect(sentryAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'log',
        level: 'warning',
        message: 'hello',
        data: { foo: 1 },
      }),
    );
    consoleWarn.mockRestore();
  });

  it('error always prints + breadcrumbs to Sentry', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logger } = require('../../src/utils/logger');
    logger.error('boom', { code: 42 });
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(sentryAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'error', message: 'boom' }),
    );
    consoleError.mockRestore();
  });

  it('debug is silent in non-dev mode', () => {
    // The dev detection reads globalThis.__DEV__. When unset, isDev()
    // returns true (default). Override to false for this test.
    const g = globalThis as unknown as { __DEV__?: boolean };
    g.__DEV__ = false;
    const consoleDebug = jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logger } = require('../../src/utils/logger');
    logger.debug('quiet');
    expect(consoleDebug).not.toHaveBeenCalled();
    delete g.__DEV__;
    consoleDebug.mockRestore();
  });

  it('info still breadcrumbs to Sentry even when dev console is silent', () => {
    const g = globalThis as unknown as { __DEV__?: boolean };
    g.__DEV__ = false;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logger } = require('../../src/utils/logger');
    logger.info('bridge route picked');
    expect(sentryAddBreadcrumb).toHaveBeenCalledTimes(1);
    expect(sentryAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'info', message: 'bridge route picked' }),
    );
    delete g.__DEV__;
  });
});
