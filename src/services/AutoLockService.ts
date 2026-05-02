/**
 * AutoLockService — enforce the user-configured auto-lock interval.
 *
 * The user picks an idle duration in SettingsScreen (1 / 5 / 15 / 30
 * minutes). After that much idle time OR when the app goes to the
 * background, the wallet locks itself by invoking the supplied
 * `onLock` callback — which RootNavigator wires to
 * `useAuthStore.lockKeystore()` (Phase 12, 2026-05-02).
 *
 * `lockKeystore()` wipes the in-memory mnemonic but **keeps** the
 * cached username + family addresses + lifecycle state — flipping
 * `state` to `'locked'`. The next 🔒 action triggers the contextual
 * UnlockSheet (mounted under RootNavigator), not the onboarding
 * bounce. Pre-Phase-12 the lock callback was `clear()`, which dropped
 * everything and forced a re-derivation through the welcome flow.
 *
 * Two triggers:
 *   1. Idle timer that fires after `intervalMs` of inactivity.
 *   2. AppState transition to `background` — fires immediately if the
 *      grace window has elapsed. `'inactive'` is intentionally NOT
 *      treated as a lock signal (too noisy: notification drop-down,
 *      biometric prompt, camera permission dialog, keyboard animation
 *      all trip it).
 *
 * Native alarm: the JS `setTimeout` here drops if the OS suspends the
 * bundle. The companion `NativeAutoLockTask` (registered at boot)
 * persists a "lockBy" timestamp on every background transition; the
 * RootNavigator checks it on cold-start AND on every AppState=active
 * transition and force-locks if expired. That layer survives bundle
 * kills and is what makes auto-lock truly resistant to OS suspension.
 *
 * @module services/AutoLockService
 */

import { AppState, type AppStateStatus } from 'react-native';
import {
  armNativeGuard,
  disarmNativeGuard,
} from './NativeAutoLockGuard';

/** Default lock interval — 5 minutes. */
const DEFAULT_INTERVAL_MS = 5 * 60_000;

/**
 * Grace period after unlocking before AutoLock will respond to ANY
 * AppState transition. Without this, transient OS-level
 * `'inactive'` / `'background'` flickers during the auth flow
 * (notification drop-down, biometric prompt, camera permission
 * dialog, even keyboard appearance on some Android skins) drop the
 * user back to the login screen mid-session. 60 seconds is enough
 * for the home screen + portfolio fetch to settle.
 */
const APP_STATE_GRACE_MS = 60_000;

/** Set of idle-duration options surfaced in SettingsScreen. */
export type AutoLockMinutes = 1 | 5 | 15 | 30 | 'never';

/** Internal singleton state. */
interface AutoLockState {
  intervalMs: number;
  timer: ReturnType<typeof setTimeout> | undefined;
  appStateSub: { remove(): void } | undefined;
  onLock?: () => void;
  /** Epoch-ms when AutoLock was started; used for the grace window. */
  startedAtMs: number;
}

const state: AutoLockState = {
  intervalMs: DEFAULT_INTERVAL_MS,
  timer: undefined,
  appStateSub: undefined,
  startedAtMs: 0,
};

/**
 * Convert the user-facing "minutes" picker value to milliseconds.
 *
 * @param mins - Picker value.
 * @returns Idle interval in ms, or Infinity for "never".
 */
export function minutesToMs(mins: AutoLockMinutes): number {
  if (mins === 'never') return Number.POSITIVE_INFINITY;
  return mins * 60_000;
}

/** Reschedule the idle timer from now. Also refreshes the persisted
 *  native-guard timestamp so a bundle kill before the timer fires
 *  still ends in a lock on the next foreground.
 */
function rescheduleTimer(): void {
  if (state.timer !== undefined) {
    clearTimeout(state.timer);
    state.timer = undefined;
  }
  if (!Number.isFinite(state.intervalMs)) {
    void disarmNativeGuard();
    return;
  }
  state.timer = setTimeout(() => {
    state.timer = undefined;
    state.onLock?.();
  }, state.intervalMs);
  // Best-effort: update the persisted lockBy timestamp. We do not
  // await — the lock countdown is JS-driven; the native guard is a
  // safety net for bundle suspension.
  void armNativeGuard(state.intervalMs);
}

/**
 * Reset the idle timer because the user just interacted with the
 * app. Called from a top-level touch handler in RootNavigator.
 */
export function resetIdleTimer(): void {
  rescheduleTimer();
}

/**
 * Set the auto-lock interval and (re)arm the idle timer.
 *
 * @param mins - User's chosen interval.
 */
export function setAutoLockInterval(mins: AutoLockMinutes): void {
  state.intervalMs = minutesToMs(mins);
  rescheduleTimer();
}

/**
 * Wire AutoLock into the app:
 *   - bind `onLock` so the navigator can sign-out + return to welcome
 *   - subscribe to AppState transitions (background-only, with grace
 *     window — see APP_STATE_GRACE_MS)
 *   - start the idle timer
 *
 * @param onLock - Callback to run when the wallet should lock.
 */
export function startAutoLock(onLock: () => void): void {
  state.onLock = onLock;
  state.startedAtMs = Date.now();
  rescheduleTimer();
  if (state.appStateSub === undefined) {
    state.appStateSub = AppState.addEventListener(
      'change',
      (next: AppStateStatus): void => {
        // ONLY treat a true `'background'` as a lock signal —
        // `'inactive'` is too noisy on mobile (notification drop-down,
        // biometric prompt, camera permission dialog, keyboard
        // animation, app-switcher peek) and previously caused the
        // session to drop mid-portfolio-load. Apple + Google both
        // recommend gating sensitive UI on `background` only.
        if (next === 'background') {
          // Honour the grace window so an OS hiccup right after
          // unlock doesn't bounce the user.
          if (Date.now() - state.startedAtMs < APP_STATE_GRACE_MS) return;
          state.onLock?.();
        } else if (next === 'active') {
          rescheduleTimer();
        }
      },
    );
  }
}

/** Tear down the AutoLock service (sign-out cleanup). Also clears the
 *  persisted native-guard timestamp so a stale entry from a previous
 *  session can't re-lock a freshly-signed-in user.
 */
export function stopAutoLock(): void {
  if (state.timer !== undefined) {
    clearTimeout(state.timer);
    state.timer = undefined;
  }
  if (state.appStateSub !== undefined) {
    state.appStateSub.remove();
    state.appStateSub = undefined;
  }
  state.onLock = undefined;
  void disarmNativeGuard();
}
