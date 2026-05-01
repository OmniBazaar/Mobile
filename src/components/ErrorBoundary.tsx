/**
 * ErrorBoundary — catches render-time exceptions in any descendant
 * tree and renders a recoverable error UI instead of crashing the
 * whole React tree (which on RN unmounts everything down to the
 * native splash and leaves the app in an unrecoverable state).
 *
 * Wrap RootNavigator's output. The reset action remounts the
 * children by bumping a key, giving the user a way out without a
 * full app restart.
 *
 * @module components/ErrorBoundary
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '@theme/colors';

/** Props. */
export interface ErrorBoundaryProps {
  children: React.ReactNode;
}

/** State. */
interface ErrorBoundaryState {
  err: Error | undefined;
  /** Bumped on reset to force a fresh subtree mount. */
  resetKey: number;
}

/**
 * React error boundary that surfaces uncaught render-time errors
 * with stack + a Try-Again button.
 */
export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { err: undefined, resetKey: 0 };
  }

  /** Capture any error thrown during render of a descendant. */
  static getDerivedStateFromError(err: Error): Partial<ErrorBoundaryState> {
    return { err };
  }

  /** Forward error + componentStack to the console for adb logcat. */
  componentDidCatch(err: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[error-boundary]', err.message, info.componentStack);
  }

  /** Reset error state and remount children. */
  private handleReset = (): void => {
    this.setState((prev) => ({ err: undefined, resetKey: prev.resetKey + 1 }));
  };

  override render(): React.ReactNode {
    if (this.state.err === undefined) {
      // Use the resetKey so a successful Try-Again truly remounts
      // the subtree (state in children is fully discarded).
      return (
        <React.Fragment key={String(this.state.resetKey)}>
          {this.props.children}
        </React.Fragment>
      );
    }
    const err = this.state.err;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>{err.message}</Text>
        <ScrollView style={styles.stack} contentContainerStyle={styles.stackInner}>
          <Text style={styles.stackText}>{err.stack ?? '(no stack)'}</Text>
        </ScrollView>
        <Pressable
          onPress={this.handleReset}
          accessibilityRole="button"
          style={styles.button}
        >
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    paddingTop: 64,
  },
  title: {
    color: colors.danger,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: { color: colors.textPrimary, fontSize: 15, lineHeight: 22, marginBottom: 16 },
  stack: { flex: 1, backgroundColor: colors.surface, borderRadius: 8, padding: 12 },
  stackInner: { paddingBottom: 20 },
  stackText: { color: colors.textSecondary, fontSize: 11, fontFamily: 'monospace' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: '700' },
});
