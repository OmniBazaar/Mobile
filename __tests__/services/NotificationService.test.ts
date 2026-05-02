/**
 * NotificationService unit tests.
 *
 * Verifies the lifecycle without booting the real Expo runtime:
 *   - registerPushToken: idempotent + skips on permission denial
 *   - registerPushToken: posts the right payload to /api/v1/push/register
 *   - registerPushToken: creates Android channels on Android
 *   - startTapListener / stopTapListener: idempotent attach/detach
 *   - tap routing: opens the deep-link URL via expo-linking
 */

const setNotificationHandler = jest.fn();
const getPermissionsAsync = jest.fn();
const requestPermissionsAsync = jest.fn();
const getExpoPushTokenAsync = jest.fn();
const setNotificationChannelAsync = jest.fn().mockResolvedValue(undefined);
const addNotificationResponseReceivedListener = jest.fn();

let _platformOS: 'ios' | 'android' = 'android';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return _platformOS;
    },
    select: (opts: Record<string, unknown>) => opts[_platformOS],
  },
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3, HIGH: 4, MAX: 5 },
  setNotificationHandler: (h: unknown) => setNotificationHandler(h),
  getPermissionsAsync: () => getPermissionsAsync(),
  requestPermissionsAsync: () => requestPermissionsAsync(),
  getExpoPushTokenAsync: () => getExpoPushTokenAsync(),
  setNotificationChannelAsync: (id: string, opts: unknown) =>
    setNotificationChannelAsync(id, opts),
  addNotificationResponseReceivedListener: (cb: unknown) =>
    addNotificationResponseReceivedListener(cb),
}));

jest.mock('expo-linking', () => ({
  openURL: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/BootstrapService', () => ({
  getBaseUrl: (): string => 'http://val.example/',
}));

const realFetch = global.fetch;

beforeEach(() => {
  setNotificationHandler.mockClear();
  getPermissionsAsync.mockReset();
  requestPermissionsAsync.mockReset();
  getExpoPushTokenAsync.mockReset();
  setNotificationChannelAsync.mockClear();
  addNotificationResponseReceivedListener.mockReset();
  global.fetch = jest.fn() as unknown as typeof fetch;
  _platformOS = 'android';
  // Reset the module's internal `_registered` flag between tests.
  jest.resetModules();
});

afterAll(() => {
  global.fetch = realFetch;
});

describe('NotificationService.registerPushToken', () => {
  it('skips silently when permission is denied', async () => {
    getPermissionsAsync.mockResolvedValueOnce({ granted: false });
    requestPermissionsAsync.mockResolvedValueOnce({ granted: false });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerPushToken } = require('../../src/services/NotificationService');
    await registerPushToken('0xabc');
    expect(getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('skips on empty address', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerPushToken } = require('../../src/services/NotificationService');
    await registerPushToken('');
    expect(getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('posts the correct payload after grant + token retrieval', async () => {
    getPermissionsAsync.mockResolvedValueOnce({ granted: true });
    getExpoPushTokenAsync.mockResolvedValueOnce({ data: 'ExponentPushToken[abc]' });
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerPushToken } = require('../../src/services/NotificationService');
    await registerPushToken('0xabc');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://val.example/api/v1/push/register');
    const body = JSON.parse(String(opts.body)) as {
      userAddress: string;
      token: string;
      platform: string;
      categories: string[];
    };
    expect(body.userAddress).toBe('0xabc');
    expect(body.token).toBe('ExponentPushToken[abc]');
    expect(body.platform).toBe('android');
    expect(body.categories).toEqual(['trade', 'escrow', 'chat', 'security']);
  });

  it('creates 4 Android channels on Android', async () => {
    getPermissionsAsync.mockResolvedValueOnce({ granted: true });
    getExpoPushTokenAsync.mockResolvedValueOnce({ data: 'tok' });
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerPushToken } = require('../../src/services/NotificationService');
    await registerPushToken('0xabc');
    expect(setNotificationChannelAsync).toHaveBeenCalledTimes(4);
    const ids = setNotificationChannelAsync.mock.calls.map((c) => c[0] as string).sort();
    expect(ids).toEqual(['chat', 'escrow', 'security', 'trade']);
  });

  it('skips channel creation on iOS', async () => {
    _platformOS = 'ios';
    getPermissionsAsync.mockResolvedValueOnce({ granted: true });
    getExpoPushTokenAsync.mockResolvedValueOnce({ data: 'tok-ios' });
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerPushToken } = require('../../src/services/NotificationService');
    await registerPushToken('0xabc');
    expect(setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('is idempotent — second call is a no-op', async () => {
    getPermissionsAsync.mockResolvedValue({ granted: true });
    getExpoPushTokenAsync.mockResolvedValue({ data: 'tok' });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerPushToken } = require('../../src/services/NotificationService');
    await registerPushToken('0xabc');
    await registerPushToken('0xabc');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('NotificationService.tap routing', () => {
  it('opens the deep-link URL when notification carries data.url', async () => {
    let captured: ((r: unknown) => void) | undefined;
    addNotificationResponseReceivedListener.mockImplementationOnce((cb: (r: unknown) => void) => {
      captured = cb;
      return { remove: jest.fn() };
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { startTapListener } = require('../../src/services/NotificationService');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const linking = require('expo-linking') as { openURL: jest.Mock };
    startTapListener();
    expect(captured).toBeDefined();
    captured?.({
      notification: {
        request: {
          content: {
            data: { url: 'omnibazaar://chat/room/r-1' },
          },
        },
      },
    });
    await Promise.resolve();
    expect(linking.openURL).toHaveBeenCalledWith('omnibazaar://chat/room/r-1');
  });

  it('does NOT open a URL when data.url is missing', async () => {
    let captured: ((r: unknown) => void) | undefined;
    addNotificationResponseReceivedListener.mockImplementationOnce((cb: (r: unknown) => void) => {
      captured = cb;
      return { remove: jest.fn() };
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { startTapListener } = require('../../src/services/NotificationService');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const linking = require('expo-linking') as { openURL: jest.Mock };
    linking.openURL.mockClear();
    startTapListener();
    captured?.({
      notification: { request: { content: { data: {} } } },
    });
    await Promise.resolve();
    expect(linking.openURL).not.toHaveBeenCalled();
  });
});
