/**
 * Chat tab — conversations + room.
 *
 * Sprint 2 wired real screens on top of `ChatClient` from `@wallet`.
 * Conversations is a `FlashList` of threads with live unread updates.
 * Room is a thread view with a composer + image-attach via
 * `expo-image-picker` + IPFS upload via `IPFSUploadService`. WS
 * updates flow through `ChatClient.subscribe`.
 *
 * @module navigation/stacks/ChatStack
 */

import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import type { ChatThread } from '@wallet/services/marketplace/ChatClient';

import type { ChatStackParamList } from '../types';
import ConversationsScreen from '../../screens/ConversationsScreen';
import ChatRoomScreen from '../../screens/ChatRoomScreen';

const Stack = createNativeStackNavigator<ChatStackParamList>();

/**
 * Conversations + Room are stitched together via in-stack state rather
 * than route params alone — the thread object carries listing
 * metadata that we don't want to serialise into the URL. We park the
 * selected thread on the stack and let ChatRoomWrapper read it.
 */
let _selectedThread: ChatThread | undefined;

/** Conversations wrapper. */
function ConversationsWrapper(): React.ReactElement {
  const nav = useNavigation();
  const [, force] = useState({});
  return (
    <ConversationsScreen
      onSelectThread={(thread): void => {
        _selectedThread = thread;
        force({});
        nav.navigate('ChatRoom' as never, { roomId: thread.threadId } as never);
      }}
    />
  );
}

/** ChatRoom wrapper. */
function ChatRoomWrapper(): React.ReactElement {
  const nav = useNavigation();
  if (_selectedThread === undefined) {
    // Direct deep-link without the thread snapshot — bounce back. The
    // server-side state is still authoritative; in Sprint 3 a fetch-by-id
    // helper can replace this fallback.
    setTimeout(() => nav.goBack(), 0);
    return <></>;
  }
  return <ChatRoomScreen thread={_selectedThread} onBack={(): void => nav.goBack()} />;
}

/**
 * Build the Chat-tab stack.
 *
 * @returns Chat stack navigator.
 */
export default function ChatStack(): React.ReactElement {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="Conversations" component={ConversationsWrapper} />
      <Stack.Screen name="ChatRoom" component={ChatRoomWrapper} />
    </Stack.Navigator>
  );
}
