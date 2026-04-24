/**
 * MobileTabsAdapter — Mobile impl of @wallet/platform's TabsAdapter.
 *
 * Wraps expo-web-browser, which opens URLs in a Safari View Controller
 * on iOS and Chrome Custom Tabs on Android. Callers that expect to
 * identify the returned tab later (e.g., to close it programmatically)
 * get a no-op close() — Expo's WebBrowser sessions are short-lived and
 * owned by the user, not the caller.
 *
 * For OmniBazaar the main consumer is the KYC Persona flow, which opens
 * a URL, lets the user complete verification, and returns via a deep
 * link (expo-linking). The WebBrowser session closing automatically on
 * deep-link return is exactly the desired behavior.
 */

import * as WebBrowser from 'expo-web-browser';
import type { TabsAdapter } from '@wallet/platform/adapters';

export class MobileTabsAdapter implements TabsAdapter {
  /**
   * Open the given URL in the in-app browser (SFSafariViewController on
   * iOS, CustomTabs on Android). Returns undefined because WebBrowser
   * doesn't expose a tab handle.
   *
   * @param url - Target URL (must be https:// for iOS Safari View Controller).
   * @param _opts - Currently unused; reserved for cross-platform parity.
   * @returns undefined (no trackable tab id on mobile).
   */
  async openUrl(url: string, _opts?: { active?: boolean; newWindow?: boolean }): Promise<string | undefined> {
    await WebBrowser.openBrowserAsync(url);
    return undefined;
  }

  /**
   * No-op. WebBrowser sessions are user-closable via the native "Done"
   * button; there's no programmatic close from the adapter layer.
   *
   * @param _tabId - Ignored.
   */
  async close(_tabId: string): Promise<void> {
    // expo-web-browser doesn't expose a close API for the currently-open
    // session. Callers that need to dismiss programmatically should use
    // WebBrowser.dismissBrowser() directly in the Mobile screen code.
  }
}
