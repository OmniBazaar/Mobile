/**
 * ScreenHeader — shared top bar with a left-aligned back arrow + title.
 *
 * Every interior screen (Receive, Send, Swap, Profile sub-pages, …)
 * should render this at the top so the user has a visible back
 * affordance and the standard hardware-back interaction matches the
 * UI affordance. Uses an Expo vector icon that's already in the app's
 * native bundle so no extra runtime cost.
 *
 * @module components/ScreenHeader
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@theme/colors';

/** Props for {@link ScreenHeader}. */
export interface ScreenHeaderProps {
  /** Title rendered next to the back arrow. */
  title: string;
  /** Fired when the user taps the back arrow. */
  onBack: () => void;
  /** Optional right-side action (e.g. settings cog). */
  rightSlot?: React.ReactNode;
}

/**
 * Render a screen header with back arrow + title.
 *
 * @param props - See {@link ScreenHeaderProps}.
 * @returns JSX.
 */
export default function ScreenHeader(props: ScreenHeaderProps): JSX.Element {
  return (
    <View style={styles.root}>
      <Pressable
        onPress={props.onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        // 44×44 hit area — Apple's HIG minimum, also good Android target.
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={({ pressed }) => [styles.backTouchable, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {props.title}
      </Text>
      <View style={styles.rightSlot}>{props.rightSlot}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: colors.background,
  },
  backTouchable: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.5 },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 4,
  },
  rightSlot: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
});
