/**
 * Phase 12 mobile unlock-guard plumbing.
 *
 * The wallet extension uses a `useUnlockGuard()` hook that returns
 * `{ gated, sheet }` where `sheet` renders inline next to the action
 * button. On mobile, screens are not always permitted to mount their
 * own `<Modal>` (overlapping z-orders, navigation transitions, etc.),
 * so we hoist the sheet to a single mount under `RootNavigator` and
 * use this tiny zustand slice as the deferred-action queue.
 *
 * Usage:
 *
 *   const requireAuth = useRequireAuth();
 *   <Pressable onPress={() => requireAuth('Sign in to buy', handleBuy, 'buyListing')} />
 *
 * `requireAuth` will:
 *   • run the action immediately when unlocked,
 *   • route to AuthPrompt when the user has no wallet on this device,
 *   • or set the deferred action here, which a single
 *     `<UnlockSheetMount />` listens to and renders the contextual
 *     unlock modal.
 *
 * @module store/unlockGuardStore
 */

import { create } from 'zustand';

/** Deferred action descriptor. */
export interface DeferredAction {
  /** Translation-key suffix for the unlock-sheet sentence. */
  actionKey: string;
  /** Callback that resumes the user's flow after unlock. */
  run: () => void | Promise<void>;
}

/** Slice shape. */
export interface UnlockGuardState {
  /** Currently-pending deferred action, or null when nothing is pending. */
  pending: DeferredAction | null;
  /** Set a pending action — opens the sheet. */
  setPending(action: DeferredAction): void;
  /** Clear without running — the user cancelled. */
  cancel(): void;
  /**
   * Mark unlocked. The mount component is responsible for invoking
   * the deferred `run()` after this resolves and clearing pending.
   */
  resolve(): DeferredAction | null;
}

export const useUnlockGuardStore = create<UnlockGuardState>((set, get) => ({
  pending: null,
  setPending: (action) => set({ pending: action }),
  cancel: () => set({ pending: null }),
  resolve: () => {
    const action = get().pending;
    set({ pending: null });
    return action;
  },
}));
