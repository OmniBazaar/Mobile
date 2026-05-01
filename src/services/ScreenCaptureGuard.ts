/**
 * ScreenCaptureGuard — wrapper around `expo-screen-capture` so screens
 * that must NEVER be screenshotted (seed phrase, email-verification
 * code, transaction-review with sensitive amounts) can declaratively
 * lock + unlock capture for the duration of their mount.
 *
 * iOS: blanks the screenshot of the app in the multitasking switcher
 * and hides screen recording. Android (API 23+): sets FLAG_SECURE on
 * the window so the system-level screenshot button + screen recorders
 * + remote-display tools (Cast, Mira) all see a black frame.
 *
 * Sprint 1's seed-backup carried a local stub; Sprint 3 (H8)
 * removes the stub and uses the real native module.
 *
 * @module services/ScreenCaptureGuard
 */

import { useEffect } from 'react';
import { logger } from '../utils/logger';

/** Lazy-load the native module so the test bundle still compiles. */
async function loadScreenCapture(): Promise<{
  preventScreenCaptureAsync?: (key?: string) => Promise<void>;
  allowScreenCaptureAsync?: (key?: string) => Promise<void>;
}> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod: unknown = require('expo-screen-capture');
    if (mod !== undefined && mod !== null && typeof mod === 'object') {
      return mod as {
        preventScreenCaptureAsync?: (key?: string) => Promise<void>;
        allowScreenCaptureAsync?: (key?: string) => Promise<void>;
      };
    }
  } catch (err) {
    logger.debug('[screen-capture] module unavailable', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
  return {};
}

/**
 * Block screenshots + screen recording for the duration this hook is
 * mounted. Releases automatically on unmount.
 *
 * @param key - Optional debug-tag (used by Expo to track multiple
 *   simultaneous holders so each one releases independently).
 */
export function useScreenCaptureBlocked(key?: string): void {
  useEffect(() => {
    let active = true;
    void (async () => {
      const mod = await loadScreenCapture();
      if (!active || mod.preventScreenCaptureAsync === undefined) return;
      try {
        await mod.preventScreenCaptureAsync(key);
      } catch (err) {
        logger.warn('[screen-capture] preventScreenCaptureAsync failed', {
          key,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return (): void => {
      active = false;
      void (async () => {
        const mod = await loadScreenCapture();
        if (mod.allowScreenCaptureAsync === undefined) return;
        try {
          await mod.allowScreenCaptureAsync(key);
        } catch (err) {
          logger.debug('[screen-capture] allowScreenCaptureAsync failed', {
            key,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      })();
    };
  }, [key]);
}
