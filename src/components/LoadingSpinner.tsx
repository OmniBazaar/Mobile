/**
 * LoadingSpinner — wraps ActivityIndicator with OmniBazaar defaults.
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

/** Props accepted by {@link LoadingSpinner}. */
export interface LoadingSpinnerProps {
  /** Optional label shown beneath the spinner. */
  label?: string;
  /** Spinner color. Defaults to the OmniBazaar indigo. */
  color?: string;
  /** Spinner size; passed straight through to ActivityIndicator. */
  size?: number | 'small' | 'large';
  /** Optional style overrides for the wrapper. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Centered spinner with optional caption.
 *
 * @param props - See {@link LoadingSpinnerProps}.
 * @returns Rendered spinner.
 */
export default function LoadingSpinner(props: LoadingSpinnerProps): JSX.Element {
  const { label, color = '#4f46e5', size = 'large', style } = props;
  return (
    <View style={[styles.container, style]} accessibilityLiveRegion="polite">
      <ActivityIndicator size={size} color={color} accessibilityLabel={label ?? 'Loading'} />
      {label !== undefined && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: 16 },
  label: { color: '#cccccc', fontSize: 14, marginTop: 8 },
});
