/**
 * Button — OmniBazaar-branded primary action button.
 *
 * Minimal initial implementation. Real variants (ghost, danger, icon-
 * leading) and Tamagui styling arrive in a later UI-polish pass.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

/** Props accepted by {@link Button}. */
export interface ButtonProps {
  /** Text rendered inside the button. */
  title: string;
  /** Fired on tap. */
  onPress: () => void;
  /** Disables presses and dims the button. */
  disabled?: boolean;
  /** Visual variant. Defaults to `primary`. */
  variant?: 'primary' | 'secondary' | 'danger';
  /** Optional style overrides. */
  style?: StyleProp<ViewStyle>;
  /** VoiceOver / TalkBack label. Falls back to `title`. */
  accessibilityLabel?: string;
}

/**
 * Stateless Pressable wrapped with the Button styling. Accepts keyboard
 * focus via the underlying Pressable; long-press is not supported by
 * default (callers that need it should use `onLongPress` on Pressable
 * directly).
 *
 * @param props - See {@link ButtonProps}.
 * @returns Rendered button.
 */
export default function Button(props: ButtonProps): JSX.Element {
  const { title, onPress, disabled = false, variant = 'primary', style, accessibilityLabel } = props;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        disabled === true && styles.disabled,
        style,
      ]}
    >
      <Text style={[
        styles.text,
        variant === 'secondary' && styles.textSecondary,
      ]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: '#4f46e5' },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#4f46e5' },
  danger: { backgroundColor: '#dc2626' },
  disabled: { opacity: 0.5 },
  text: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  textSecondary: { color: '#4f46e5' },
});
