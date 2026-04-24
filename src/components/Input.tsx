/**
 * Input — OmniBazaar-branded text input with optional label + error hint.
 *
 * Minimal initial implementation. Real form validation should live in the
 * calling screen (see react-hook-form + zod in the Phase 1 plan).
 */

import React from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle, type TextInputProps } from 'react-native';

/** Props accepted by {@link Input}. */
export interface InputProps extends Omit<TextInputProps, 'style'> {
  /** Label shown above the input. */
  label?: string;
  /** Error text shown below the input with role=alert. */
  error?: string;
  /** Optional container style overrides. */
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Controlled TextInput wrapper with label and error slot.
 *
 * @param props - See {@link InputProps}.
 * @returns Rendered input.
 */
export default function Input(props: InputProps): JSX.Element {
  const { label, error, containerStyle, ...textInputProps } = props;
  const hasError = typeof error === 'string' && error.length > 0;
  return (
    <View style={[styles.container, containerStyle]}>
      {label !== undefined && <Text style={styles.label}>{label}</Text>}
      <TextInput
        {...textInputProps}
        style={[styles.input, hasError && styles.inputError]}
        placeholderTextColor="#6b7280"
        accessibilityLabel={label ?? textInputProps.placeholder}
      />
      {hasError && (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: { color: '#cccccc', fontSize: 13, marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#1f2937',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: '#ffffff',
    fontSize: 15,
  },
  inputError: { borderColor: '#dc2626' },
  error: { color: '#f87171', fontSize: 12, marginTop: 4 },
});
