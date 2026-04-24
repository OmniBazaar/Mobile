/**
 * Card — surface container used for list items and grouped content.
 *
 * Minimal initial implementation. Expect a Tamagui upgrade later.
 */

import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/** Props accepted by {@link Card}. */
export interface CardProps {
  /** Card content. */
  children: ReactNode;
  /** Optional style overrides. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Rounded surface with subtle elevation. Children are rendered inside
 * padded content.
 *
 * @param props - See {@link CardProps}.
 * @returns Rendered card.
 */
export default function Card(props: CardProps): JSX.Element {
  return <View style={[styles.card, props.style]}>{props.children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
