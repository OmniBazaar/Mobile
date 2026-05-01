/**
 * Button — OmniBazaar-branded action button.
 *
 * Variants:
 *   - primary  — filled with brand colour. The screen's main action.
 *   - secondary— outlined, text in brand colour. Reversible / cancel.
 *   - danger   — red. Destructive. Comes with the implicit warning copy.
 *   - ghost    — text-only, no border. Tertiary actions ("Browse as Guest").
 *
 * @module components/Button
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
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** Optional style overrides. */
  style?: StyleProp<ViewStyle>;
  /** VoiceOver / TalkBack label. Falls back to `title`. */
  accessibilityLabel?: string;
  /** VoiceOver / TalkBack hint — appended after the label. */
  accessibilityHint?: string;
}

/**
 * Stateless Pressable wrapped with the Button styling.
 *
 * @param props - See {@link ButtonProps}.
 * @returns Rendered button.
 */
export default function Button(props: ButtonProps): JSX.Element {
  const {
    title,
    onPress,
    disabled = false,
    variant = 'primary',
    style,
    accessibilityLabel,
    accessibilityHint,
  } = props;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      {...(accessibilityHint !== undefined && { accessibilityHint })}
      accessibilityState={{ disabled }}
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === 'secondary' && styles.textSecondary,
          variant === 'ghost' && styles.textGhost,
        ]}
      >
        {title}
      </Text>
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
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.5 },
  text: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  textSecondary: { color: '#4f46e5' },
  textGhost: { color: '#4f46e5' },
});
