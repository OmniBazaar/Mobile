/**
 * ChatRoomScreen — single P2P chat thread.
 *
 * Renders message history (oldest → newest at top, latest at bottom),
 * a composer with a text input + image-attach + send button, and
 * subscribes to the `chat` WS channel for live updates.
 *
 * Sending:
 *   1. User types a message (and optionally attaches an image).
 *   2. If an image is attached, upload it to IPFS first; the resulting
 *      CID/URL is appended to the message body so the receiver can
 *      render it inline.
 *   3. Sign the canonical EIP-191 string `${sender} ${threadId} ${body} ${ts}`.
 *   4. POST `/api/v1/chat/messages` with the envelope.
 *   5. Append optimistically to the local list; the WS echo refreshes
 *      with the server-assigned message id.
 *
 * @module screens/ChatRoomScreen
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Wallet } from 'ethers';
import * as ImagePicker from 'expo-image-picker';

import {
  getChatClient,
  type ChatMessage,
  type ChatThread,
} from '@wallet/services/marketplace/ChatClient';

import { colors } from '@theme/colors';
import { useAuthStore } from '../store/authStore';
import { uploadAsset } from '../services/IPFSUploadService';
import { logger } from '../utils/logger';

/** Format a unix-ms timestamp as HH:mm. */
function formatHm(t: number): string {
  if (!Number.isFinite(t) || t <= 0) return '';
  return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Props accepted by ChatRoomScreen. */
export interface ChatRoomScreenProps {
  /** Thread the user just opened. */
  thread: ChatThread;
  /** Back-navigation callback. */
  onBack: () => void;
}

/**
 * Render a single chat thread.
 *
 * @param props - See {@link ChatRoomScreenProps}.
 * @returns JSX.
 */
export default function ChatRoomScreen(props: ChatRoomScreenProps): React.ReactElement {
  const { thread, onBack } = props;
  const { t } = useTranslation();
  const senderAddress = useAuthStore((s) => s.address);
  const mnemonic = useAuthStore((s) => s.mnemonic);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const listRef = useRef<FlashList<ChatMessage> | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const list = await getChatClient().getMessages(thread.threadId, 100);
      setMessages(list);
      setError(undefined);
    } catch (err) {
      logger.warn('[chat] getMessages failed', {
        err: err instanceof Error ? err.message : String(err),
      });
      setError(
        t('chat.errors.messagesFailed', {
          defaultValue: 'Could not load messages. Tap retry.',
        }),
      );
    }
  }, [thread.threadId, t]);

  useEffect(() => {
    setBusy(true);
    void refresh().finally(() => setBusy(false));
    void getChatClient()
      .markRead(thread.threadId)
      .catch(() => {
        /* non-fatal — guards run server-side too. */
      });
  }, [refresh, thread.threadId]);

  // Live updates.
  useEffect(() => {
    if (senderAddress === '') return;
    const unsub = getChatClient().subscribe(senderAddress, (event) => {
      if (event.type === 'message') {
        const payload = event.payload as Partial<ChatMessage> | undefined;
        if (payload?.threadId === thread.threadId) {
          // Cheapest reliable refresh: re-fetch. Threads are small.
          void refresh();
        }
      }
    });
    return unsub;
  }, [senderAddress, thread.threadId, refresh]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToEnd({ animated: true });
      } catch {
        /* list may not be mounted yet */
      }
    });
  }, [messages.length]);

  /** Pick an image, upload to IPFS, append `[image:<url>]` to the body. */
  const onAttachImage = useCallback(async (): Promise<void> => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(
          t('chat.errors.noPhotoPermission', {
            defaultValue: 'Permission to access photos was denied.',
          }),
        );
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (res.canceled || res.assets.length === 0) return;
      const asset = res.assets[0];
      if (asset === undefined) return;
      setBusy(true);
      const result = await uploadAsset({
        uri: asset.uri,
        ...(asset.mimeType !== undefined && { mimeType: asset.mimeType }),
        ...(asset.fileName !== undefined && asset.fileName !== null && { fileName: asset.fileName }),
        ...(typeof asset.fileSize === 'number' && { fileSize: asset.fileSize }),
      });
      // Append `[image:URL]` to the body — receiver can render inline.
      setBody((prev) => (prev === '' ? `[image:${result.url}]` : `${prev}\n[image:${result.url}]`));
    } catch (err) {
      logger.warn('[chat] upload failed', {
        err: err instanceof Error ? err.message : String(err),
      });
      setError(
        t('chat.errors.uploadFailed', {
          defaultValue: 'Image upload failed. Try again.',
        }),
      );
    } finally {
      setBusy(false);
    }
  }, [t]);

  /** Sign + send the current message. */
  const onSend = useCallback(async (): Promise<void> => {
    const trimmed = body.trim();
    if (trimmed === '' || senderAddress === '' || mnemonic === '') return;
    setSending(true);
    setError(undefined);
    try {
      const ts = Date.now();
      const wallet = Wallet.fromPhrase(mnemonic);
      const canonical = `${senderAddress} ${thread.threadId} ${trimmed} ${ts}`;
      const signature = await wallet.signMessage(canonical);
      await getChatClient().sendMessage({
        threadId: thread.threadId,
        sender: senderAddress,
        body: trimmed,
        timestamp: ts,
        signature,
      });
      setBody('');
      await refresh();
    } catch (err) {
      logger.warn('[chat] sendMessage failed', {
        err: err instanceof Error ? err.message : String(err),
      });
      setError(
        t('chat.errors.sendFailed', {
          defaultValue: 'Could not deliver your message. Tap to retry.',
        }),
      );
    } finally {
      setSending(false);
    }
  }, [body, senderAddress, mnemonic, thread.threadId, refresh, t]);

  const headerTitle = useMemo(
    () =>
      thread.listingTitle !== undefined && thread.listingTitle !== ''
        ? thread.listingTitle
        : `${thread.counterparty.slice(0, 6)}…${thread.counterparty.slice(-4)}`,
    [thread.listingTitle, thread.counterparty],
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
          {headerTitle}
        </Text>
      </View>

      <FlashList
        ref={listRef}
        data={messages}
        estimatedItemSize={80}
        keyExtractor={(m): string => m.messageId}
        renderItem={({ item }): React.ReactElement => (
          <MessageBubble message={item} mine={item.sender.toLowerCase() === senderAddress.toLowerCase()} />
        )}
        contentContainerStyle={styles.list}
      />

      {busy && messages.length === 0 && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}

      {error !== undefined && (
        <Pressable onPress={() => void refresh()} style={styles.errorBar} accessibilityRole="button">
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorRetry}>
            {t('common.retry', { defaultValue: 'Retry' })}
          </Text>
        </Pressable>
      )}

      <View style={styles.composer}>
        <Pressable
          onPress={() => void onAttachImage()}
          accessibilityRole="button"
          accessibilityLabel={t('chat.attachImage', { defaultValue: 'Attach an image' })}
          style={styles.composerIcon}
          hitSlop={8}
        >
          <Ionicons name="image-outline" size={22} color={colors.primary} />
        </Pressable>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={t('chat.composer.placeholder', { defaultValue: 'Type a message…' })}
          placeholderTextColor={colors.textMuted}
          style={styles.composerInput}
          multiline
          accessibilityLabel={t('chat.composer.a11y', { defaultValue: 'Message body' })}
        />
        <Pressable
          onPress={() => void onSend()}
          disabled={sending || body.trim() === ''}
          accessibilityRole="button"
          accessibilityLabel={t('chat.send', { defaultValue: 'Send' })}
          style={[styles.composerSend, body.trim() === '' && styles.composerSendDisabled]}
        >
          {sending ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Ionicons name="send" size={18} color={colors.background} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/** A single chat bubble. */
function MessageBubble({
  message,
  mine,
}: {
  message: ChatMessage;
  mine: boolean;
}): React.ReactElement {
  return (
    <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
          {message.body}
        </Text>
        <Text style={styles.bubbleTime}>{formatHm(message.createdAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  backBtn: { paddingHorizontal: 4, paddingVertical: 4, marginRight: 4 },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '600', flex: 1 },
  list: { padding: 12 },
  bubbleWrap: { width: '100%', marginVertical: 4, paddingHorizontal: 8 },
  bubbleWrapMine: { alignItems: 'flex-end' },
  bubbleWrapTheirs: { alignItems: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 19 },
  bubbleTextMine: { color: colors.background },
  bubbleTextTheirs: { color: colors.textPrimary },
  bubbleTime: { color: colors.textMuted, fontSize: 10, marginTop: 4, textAlign: 'right' },
  center: { padding: 24, alignItems: 'center' },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  errorText: { color: colors.danger, fontSize: 13, flex: 1 },
  errorRetry: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.background,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  composerIcon: { paddingVertical: 8, paddingHorizontal: 4 },
  composerInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
    maxHeight: 96,
    marginHorizontal: 8,
  },
  composerSend: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerSendDisabled: { opacity: 0.4 },
});
