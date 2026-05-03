/**
 * ScreenCaptureGuard — currently a no-op (no-screen-capture-protection).
 *
 * **Why it's a stub right now (2026-05-03):**
 *
 * The previous implementation pulled in `expo-screen-capture`. On
 * Android 14+, expo-modules-core eagerly initialises every linked
 * expo module via the `NativeUnimoduleProxy` JSI host object — the
 * lazy `require()` inside this file does NOT change that. expo-
 * screen-capture's native init calls
 * `Activity.registerScreenCaptureCallback`, which on API 34 requires
 * the `DETECT_SCREEN_CAPTURE` runtime permission. Until the user has
 * granted that permission at runtime, the API throws Java's
 * `SecurityException` — and because the throw escapes the JSI proxy
 * BEFORE `AppRegistry.registerComponent` runs, the entire JS bundle
 * fails to register and the app crashes back to the launcher within a
 * second of the splash. (Confirmed via two consecutive Pixel-class
 * device logcats on 2026-05-03.) Adding the manifest permission alone
 * is not sufficient because the runtime grant isn't possible to
 * collect before module-init.
 *
 * **What replaces it (planned, not yet shipped):** Android's
 * `FLAG_SECURE` window flag. Set on the Activity at MainActivity
 * init, it produces the same outcome (blanked screenshot in the
 * recents view, blocked screen recording on most launchers) without
 * any runtime permission and without an expo module. iOS already
 * blanks the multitasking screenshot when an active text input or
 * sensitive view is shown, but a real solution will use a tiny
 * config-plugin to wire `Window.addFlags(WindowManager.LayoutParams
 * .FLAG_SECURE)` on Android and a `UIScreen.captured`-style observer
 * on iOS. Tracked as `MOBILE_REMEDIATION_PLAN.md` H8 follow-up.
 *
 * Until that ships, calling `useScreenCaptureBlocked` is a no-op.
 * This is a known security regression vs. the planned protection
 * level — but a *no-op* is strictly safer than a *crash* (the user
 * can at least back out of the screen, and the original mobile app
 * before Sprint 3 H8 was in this same state).
 *
 * @module services/ScreenCaptureGuard
 */

/**
 * Block screenshots + screen recording for the duration this hook is
 * mounted. Currently a no-op — see module docstring.
 *
 * @param _key - Reserved; ignored while the guard is stubbed.
 */
export function useScreenCaptureBlocked(_key?: string): void {
  // Intentional no-op. See module docstring.
}
