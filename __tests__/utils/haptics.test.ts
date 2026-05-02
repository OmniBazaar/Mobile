/**
 * haptics.test.ts — trivial wrappers over expo-haptics. Verify each
 * exported function dispatches the right native call.
 */

const selectionAsync = jest.fn().mockResolvedValue(undefined);
const impactAsync = jest.fn().mockResolvedValue(undefined);
const notificationAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  selectionAsync,
  impactAsync,
  notificationAsync,
}));

import * as haptics from '../../src/utils/haptics';

beforeEach(() => {
  selectionAsync.mockClear();
  impactAsync.mockClear();
  notificationAsync.mockClear();
});

describe('utils/haptics', () => {
  it('select → selectionAsync', () => {
    haptics.select();
    expect(selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('impactLight/Medium/Heavy dispatch the right styles', () => {
    haptics.impactLight();
    haptics.impactMedium();
    haptics.impactHeavy();
    expect(impactAsync).toHaveBeenCalledTimes(3);
    expect(impactAsync.mock.calls.map((c) => c[0])).toEqual(['light', 'medium', 'heavy']);
  });

  it('success/warning/error dispatch notification types', () => {
    haptics.success();
    haptics.warning();
    haptics.error();
    expect(notificationAsync).toHaveBeenCalledTimes(3);
    expect(notificationAsync.mock.calls.map((c) => c[0])).toEqual([
      'success',
      'warning',
      'error',
    ]);
  });
});
