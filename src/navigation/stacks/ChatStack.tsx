/**
 * Chat tab — conversations + room.
 *
 * Sprint 2 B5 lands the real screens. For Sprint 1 we register the
 * routes (so the tab bar can navigate them) but render a shared
 * ComingSoon placeholder until the wiring is done.
 *
 * @module navigation/stacks/ChatStack
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { ChatStackParamList } from '../types';
import { ComingSoonScreen } from '../shared/ComingSoonScreen';

const Stack = createNativeStackNavigator<ChatStackParamList>();

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
      <Stack.Screen
        name="Conversations"
        component={ComingSoonScreen}
        initialParams={{ feature: 'Chat — Conversations', sprint: 'Sprint 2 B5' }}
      />
      <Stack.Screen
        name="ChatRoom"
        component={ComingSoonScreen}
        initialParams={{ feature: 'Chat — Room', sprint: 'Sprint 2 B5' }}
      />
    </Stack.Navigator>
  );
}
