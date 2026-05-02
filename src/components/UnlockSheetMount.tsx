/**
 * UnlockSheetMount — Phase 12 root-level mount for the contextual
 * UnlockSheet.
 *
 * Listens to the unlock-guard zustand slice for a pending deferred
 * action; renders <UnlockSheet> when present; runs the action's
 * `run()` callback after a successful unlock; clears state on cancel.
 * The mount is rendered once inside RootNavigator so any screen that
 * calls `requireAuth(...)` while the keystore is locked will see the
 * sheet without having to manage its own modal lifecycle.
 *
 * Pairs with the wallet extension's `useUnlockGuard()` — same UX
 * contract; the difference is that mobile mounts a single sheet
 * instance instead of per-page sheets (RN modal stacking is finicky).
 *
 * @module components/UnlockSheetMount
 */

import React from 'react';

import { useUnlockGuardStore } from '../store/unlockGuardStore';
import UnlockSheet from './UnlockSheet';

/**
 * Render the sheet driven by the unlock-guard slice.
 *
 * @returns React element (always — the sheet manages its own
 *   visibility internally based on `open`).
 */
export default function UnlockSheetMount(): React.ReactElement {
  const pending = useUnlockGuardStore((s) => s.pending);
  const cancel = useUnlockGuardStore((s) => s.cancel);
  const resolve = useUnlockGuardStore((s) => s.resolve);

  return (
    <UnlockSheet
      open={pending !== null}
      actionKey={pending?.actionKey ?? 'default'}
      onUnlocked={(): void => {
        const action = resolve();
        if (action !== null) {
          // Defer one tick so the sheet's exit animation completes
          // before the action mutates state.
          setTimeout(() => {
            const result = action.run();
            if (result instanceof Promise) void result;
          }, 0);
        }
      }}
      onCancel={cancel}
    />
  );
}
