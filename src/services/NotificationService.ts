/**
 * NotificationService — Expo push notifications wired end-to-end.
 *
 * Lifecycle:
 *   1. App boot → request permission + register a push token.
 *   2. Token + family categories registered with the validator at
 *      `POST /api/v1/push/register` so the validator can target the
 *      device for trade / escrow / chat / security events.
 *   3. Foreground notifications surface as banners (Expo handler).
 *   4. Tapping a notification → deep-link to the right screen via
 *      `omnibazaar://` URLs (handled by `RootNavigator` linking config).
 *
 * Error handling: every step is best-effort. Permission denial is
 * normal — we surface a one-time copy in Settings; no notifications
 * still leaves the app fully usable.
 *
 * @module services/NotificationService
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

import { getBaseUrl } from './BootstrapService';
import { logger } from '../utils/logger';

/** Notification category keys the validator routes by. */
export type NotificationCategory = 'trade' | 'escrow' | 'chat' | 'security';

/** Configure how foreground notifications render. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let _registered = false;
let _tapSubscription: Notifications.Subscription | undefined;

/**
 * Ask for notification permission and register the device's push
 * token with the validator. Idempotent — second call is a no-op.
 *
 * @param userAddress - Wallet address (used as the validator's ID).
 */
export async function registerPushToken(userAddress: string): Promise<void> {
  if (_registered || userAddress === '') return;
  try {
    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) {
      logger.info('[push] permission denied — silent fallback');
      return;
    }
    if (Platform.OS === 'android') {
      // Android requires a default channel; create one for each
      // category so users can mute individual categories without
      // muting all push.
      const ensure = (id: string, name: string, importance: Notifications.AndroidImportance): Promise<unknown> =>
        Notifications.setNotificationChannelAsync(id, { name, importance });
      await Promise.all([
        ensure('trade', 'Trade & DEX', Notifications.AndroidImportance.DEFAULT),
        ensure('escrow', 'Escrow & Marketplace', Notifications.AndroidImportance.HIGH),
        ensure('chat', 'Chat', Notifications.AndroidImportance.HIGH),
        ensure('security', 'Security', Notifications.AndroidImportance.MAX),
      ]);
    }
    const tokenResult = await Notifications.getExpoPushTokenAsync();
    const token = tokenResult.data;
    const apiBase = getBaseUrl().replace(/\/+$/, '');
    const r = await fetch(`${apiBase}/api/v1/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        userAddress,
        token,
        platform: Platform.OS,
        categories: ['trade', 'escrow', 'chat', 'security'] satisfies NotificationCategory[],
      }),
    });
    if (!r.ok) {
      logger.warn('[push] validator register failed', { status: r.status });
      return;
    }
    _registered = true;
    logger.info('[push] registered', { token, address: userAddress });
  } catch (err) {
    logger.warn('[push] register failed', {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Wire the notification-tap listener. Tap → parse the embedded
 * `omnibazaar://…` deep-link → route the user via expo-linking
 * (NavigationContainer handles the rest).
 *
 * Idempotent — second call replaces the prior subscription.
 */
export function startTapListener(): void {
  _tapSubscription?.remove();
  _tapSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { url?: string } | undefined;
    const url = data?.url;
    if (typeof url !== 'string' || url === '') return;
    void Linking.openURL(url).catch((err) => {
      logger.warn('[push] deep-link failed', {
        url,
        err: err instanceof Error ? err.message : String(err),
      });
    });
  });
}

/** Drop the tap listener on sign-out. */
export function stopTapListener(): void {
  _tapSubscription?.remove();
  _tapSubscription = undefined;
  _registered = false;
}
