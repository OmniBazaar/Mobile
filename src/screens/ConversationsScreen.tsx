/**
 * ConversationsScreen — list of P2P chat threads.
 *
 * Reads from `ChatClient.listThreads(address)` and subscribes to the
 * `chat` WebSocket channel so unread counts + last-message previews
 * update live without polling. Tap a row → navigates to ChatRoomScreen.
 *
 * Empty state shows guidance copy ("Once you message a seller, threads
 * appear here") rather than a blank pane.
 *
 * @module screens/ConversationsScreen
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import {
  getChatClient,
  type ChatThread,
} from '@wallet/services/marketplace/ChatClient';

import { colors } from '@theme/colors';
import { useAuthStore } from '../store/authStore';
import { logger } from '../utils/logger';

/** Format a unix-ms time as a relative HH:mm or yesterday/Mar 12 string. */
function formatTime(t: number): string {
  if (!Number.isFinite(t) || t <= 0) return '';
  const d = new Date(t);
  const now = Date.now();
  const sameDay = new Date(now).toDateString() === d.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const yesterday = new Date(now - 24 * 60 * 60 * 1000).toDateString();
  if (yesterday === d.toDateString()) return 'Yesterday';
  return d.toLocaleDateString();
}

/** Shorten an EVM address like 0xabcd…1234. */
function shortenAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Props accepted by ConversationsScreen. */
export interface ConversationsScreenProps {
  /** Tap handler — opens the chat room for the chosen thread. */
  onSelectThread: (thread: ChatThread) => void;
}

/**
 * Render the conversations list.
 *
 * @param props - See {@link ConversationsScreenProps}.
 * @returns JSX.
 */
export default function ConversationsScreen(
  props: ConversationsScreenProps,
): React.ReactElement {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const refresh = useCallback(async (): Promise<void> => {
    if (address === '') {
      setThreads([]);
      return;
    }
    try {
      const list = await getChatClient().listThreads(address);
      // Sort newest-first; defensive — server already sorts.
      const sorted = [...list].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      setThreads(sorted);
      setError(undefined);
    } catch (err) {
      logger.warn('[chat] listThreads failed', {
        err: err instanceof Error ? err.message : String(err),
      });
      setError(
        t('chat.errors.loadFailed', {
          defaultValue: 'Could not load your conversations. Pull to refresh.',
        }),
      );
    }
  }, [address, t]);

  useEffect(() => {
    setLoading(true);
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Live updates via the `chat` WS channel.
  useEffect(() => {
    if (address === '') return;
    const unsub = getChatClient().subscribe(address, (event) => {
      // Both `message` and `unread` deltas mean the thread list is
      // stale. Cheapest fix: re-fetch. Threads are short — not a perf
      // concern.
      if (event.type === 'message' || event.type === 'unread') {
        void refresh();
      }
    });
    return unsub;
  }, [address, refresh]);

  const onRefresh = useCallback((): void => {
    setRefreshing(true);
    void refresh().finally(() => setRefreshing(false));
  }, [refresh]);

  if (loading && threads.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (threads.length === 0) {
    return (
      <View style={styles.empty} accessibilityLiveRegion="polite">
        <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>
          {t('chat.empty.title', { defaultValue: 'No conversations yet' })}
        </Text>
        <Text style={styles.emptyBody}>
          {t('chat.empty.body', {
            defaultValue: 'Once you message a seller, your threads will appear here.',
          })}
        </Text>
        {error !== undefined && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  }

  return (
    <FlashList
      data={threads}
      estimatedItemSize={72}
      keyExtractor={(thread): string => thread.threadId}
      renderItem={({ item }): React.ReactElement => (
        <ConversationRow thread={item} onPress={(): void => props.onSelectThread(item)} />
      )}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      contentContainerStyle={styles.list}
    />
  );
}

/** Single row in the threads list. */
function ConversationRow({
  thread,
  onPress,
}: {
  thread: ChatThread;
  onPress: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const title =
    thread.listingTitle !== undefined && thread.listingTitle !== ''
      ? thread.listingTitle
      : shortenAddress(thread.counterparty);
  const preview =
    thread.lastMessagePreview ??
    t('chat.empty.preview', { defaultValue: 'Tap to open the conversation.' });
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('chat.row.a11y', {
        defaultValue: 'Conversation with {{counterparty}} about {{title}}',
        counterparty: shortenAddress(thread.counterparty),
        title,
      })}
      style={styles.row}
    >
      <View style={styles.rowMid}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.rowTime}>{formatTime(thread.lastMessageAt)}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={styles.rowPreview} numberOfLines={1}>
            {preview}
          </Text>
          {thread.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{thread.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: colors.background },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyBody: { color: colors.textSecondary, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  list: { padding: 16, backgroundColor: colors.background },
  row: { flexDirection: 'row', backgroundColor: colors.surface, padding: 12, borderRadius: 12, marginBottom: 8 },
  rowMid: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', flex: 1 },
  rowTime: { color: colors.textMuted, fontSize: 12, marginLeft: 8 },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  rowPreview: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: { color: colors.background, fontSize: 12, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 13, marginTop: 12, textAlign: 'center' },
});
