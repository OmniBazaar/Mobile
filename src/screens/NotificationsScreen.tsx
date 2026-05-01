/**
 * NotificationsScreen — recent push notifications + history.
 *
 * Lists the most recent `Notifications.getPresentedNotificationsAsync`
 * results (in-tray notifications) plus a fetched history from
 * `/api/v1/push/history/:address` when available. Tap → deep-link.
 *
 * @module screens/NotificationsScreen
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import ScreenHeader from '@components/ScreenHeader';
import { colors } from '@theme/colors';
import { useAuthStore } from '../store/authStore';
import { getBaseUrl } from '../services/BootstrapService';
import { logger } from '../utils/logger';

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  category: string;
  url?: string;
  createdAt: number;
}

/** Convert an Expo presented-notification into a row. */
function fromExpo(n: Notifications.Notification): NotificationRow {
  const content = n.request.content;
  const data = (content.data ?? {}) as { url?: string; category?: string };
  return {
    id: n.request.identifier,
    title: typeof content.title === 'string' ? content.title : '',
    body: typeof content.body === 'string' ? content.body : '',
    category: typeof data.category === 'string' ? data.category : 'trade',
    ...(typeof data.url === 'string' && { url: data.url }),
    createdAt: n.date,
  };
}

/** Format a unix-ms timestamp for the list. */
function formatTime(t: number): string {
  if (!Number.isFinite(t) || t <= 0) return '';
  const d = new Date(t);
  const now = Date.now();
  const sameDay = new Date(now).toDateString() === d.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString();
}

/** Props accepted by NotificationsScreen. */
export interface NotificationsScreenProps {
  onBack: () => void;
}

/**
 * Render the notifications list.
 *
 * @param props - See {@link NotificationsScreenProps}.
 * @returns JSX.
 */
export default function NotificationsScreen(
  props: NotificationsScreenProps,
): React.ReactElement {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const presented = await Notifications.getPresentedNotificationsAsync();
      const local = presented.map(fromExpo);
      let serverRows: NotificationRow[] = [];
      if (address !== '') {
        try {
          const r = await fetch(
            `${getBaseUrl().replace(/\/+$/, '')}/api/v1/push/history/${encodeURIComponent(address)}`,
            { signal: AbortSignal.timeout(8_000) },
          );
          if (r.ok) {
            const body = (await r.json()) as { data?: NotificationRow[] } & { items?: NotificationRow[] };
            serverRows = body.data ?? body.items ?? [];
          }
        } catch (err) {
          logger.debug('[notifications] history fetch failed', {
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
      // De-dup by id; local presented wins for same id.
      const merged = new Map<string, NotificationRow>();
      for (const row of serverRows) merged.set(row.id, row);
      for (const row of local) merged.set(row.id, row);
      const sorted = Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt);
      setRows(sorted);
    } catch (err) {
      logger.warn('[notifications] refresh failed', {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onTap = useCallback((row: NotificationRow): void => {
    if (row.url !== undefined && row.url !== '') {
      void Linking.openURL(row.url);
    }
  }, []);

  if (rows.length === 0) {
    return (
      <View style={styles.root}>
        <ScreenHeader
          title={t('notifications.title', { defaultValue: 'Notifications' })}
          onBack={props.onBack}
        />
        <View style={styles.empty}>
          <Ionicons name="notifications-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>
            {t('notifications.empty.title', { defaultValue: 'All caught up' })}
          </Text>
          <Text style={styles.emptyBody}>
            {t('notifications.empty.body', {
              defaultValue: "You'll see trade, escrow, chat, and security alerts here as they arrive.",
            })}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('notifications.title', { defaultValue: 'Notifications' })}
        onBack={props.onBack}
      />
      <FlashList
        data={rows}
        estimatedItemSize={80}
        keyExtractor={(r): string => r.id}
        renderItem={({ item }): React.ReactElement => (
          <Pressable
            onPress={(): void => onTap(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.title} ${item.body}`}
            style={styles.row}
          >
            <View style={[styles.dot, { backgroundColor: dotColor(item.category) }]} />
            <View style={styles.rowMid}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.rowBody} numberOfLines={2}>
                {item.body}
              </Text>
            </View>
            <Text style={styles.rowTime}>{formatTime(item.createdAt)}</Text>
          </Pressable>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={(): void => {
              setRefreshing(true);
              void refresh().finally(() => setRefreshing(false));
            }}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

function dotColor(category: string): string {
  switch (category) {
    case 'security':
      return colors.danger;
    case 'escrow':
      return colors.primary;
    case 'chat':
      return colors.success;
    default:
      return colors.textMuted;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  rowMid: { flex: 1 },
  rowTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  rowBody: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  rowTime: { color: colors.textMuted, fontSize: 11, marginLeft: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});
