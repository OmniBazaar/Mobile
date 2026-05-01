/**
 * WalletConnectBar — wallet-mode toggle + WalletConnect connect/disconnect
 * for the Mobile Universal Swap screen.
 *
 * Mirrors the WebApp's `ExternalWalletBar`: a small segmented switch
 * (Embedded OmniWallet / External Wallet) plus connection-state UI on
 * the right. When the user hits "Connect Wallet" we open a deep-link
 * sheet — copying the `wc:` URI to the clipboard and emitting a
 * universal `wc://...` link the user can open in MetaMask Mobile, Trust,
 * Rainbow, etc. (We don't render a QR; this is mobile, the user is
 * already on their wallet device.)
 *
 * @module components/WalletConnectBar
 */
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@theme/colors';

import {
  getWalletConnect,
  type WalletConnectConnection,
  MissingProjectIdError,
} from '../services/WalletConnectService';

/** Wallet-mode value the parent screen owns. */
export type SwapWalletMode = 'embedded' | 'walletconnect';

/** Props for {@link WalletConnectBar}. */
export interface WalletConnectBarProps {
  /** Currently active mode. */
  walletMode: SwapWalletMode;
  /** Switches between embedded and walletconnect. */
  onWalletModeChange: (mode: SwapWalletMode) => void;
  /** Notifies the parent when the WC session connects / disconnects. */
  onConnectionChange: (conn: WalletConnectConnection | null) => void;
}

/**
 * Render the wallet-mode bar.
 *
 * @param props - See {@link WalletConnectBarProps}.
 * @returns JSX.
 */
export default function WalletConnectBar(
  props: WalletConnectBarProps,
): JSX.Element {
  const { t } = useTranslation();
  const { walletMode, onWalletModeChange, onConnectionChange } = props;

  const [connection, setConnection] = useState<WalletConnectConnection | null>(
    null,
  );
  const [pairing, setPairing] = useState<{ uri: string } | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  // Subscribe to live connection updates from the WC singleton.
  useEffect(() => {
    const unsubscribe = getWalletConnect().onChange((c) => {
      setConnection(c);
      onConnectionChange(c);
    });
    return unsubscribe;
  }, [onConnectionChange]);

  const handleConnect = useCallback(async (): Promise<void> => {
    setError(undefined);
    try {
      const handle = await getWalletConnect().connect();
      setPairing({ uri: handle.uri });
      try {
        await Clipboard.setStringAsync(handle.uri);
      } catch {
        // Clipboard failure isn't fatal — the user can still tap Open.
      }
      // Open the wallet selector sheet — most wallets register the wc:
      // protocol so this brings the wallet into the foreground.
      try {
        await Linking.openURL(handle.uri);
      } catch {
        // If no wallet handles wc: directly, leave the URI on the clipboard
        // so the user can paste it into their wallet manually.
      }
      try {
        await handle.approval;
        setPairing(null);
      } catch (e) {
        setPairing(null);
        setError(e instanceof Error ? e.message : String(e));
      }
    } catch (e) {
      if (e instanceof MissingProjectIdError) {
        setError(
          t('swap.external.missingProjectId', {
            defaultValue:
              'WalletConnect project id is not configured. Set EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID and reload.',
          }),
        );
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }, [t]);

  const handleDisconnect = useCallback(async (): Promise<void> => {
    setError(undefined);
    try {
      await getWalletConnect().disconnect();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const truncate = (addr: string): string =>
    addr.length <= 10 ? addr : `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  return (
    <View style={styles.bar}>
      <View style={styles.toggle} accessibilityRole="tablist">
        <Pressable
          onPress={() => onWalletModeChange('embedded')}
          accessibilityState={{ selected: walletMode === 'embedded' }}
          style={[
            styles.toggleBtn,
            walletMode === 'embedded' && styles.toggleBtnActive,
          ]}
        >
          <Text
            style={[
              styles.toggleBtnText,
              walletMode === 'embedded' && styles.toggleBtnTextActive,
            ]}
          >
            {t('swap.external.embeddedTab', { defaultValue: 'OmniWallet' })}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onWalletModeChange('walletconnect')}
          accessibilityState={{ selected: walletMode === 'walletconnect' }}
          style={[
            styles.toggleBtn,
            walletMode === 'walletconnect' && styles.toggleBtnActive,
          ]}
        >
          <Text
            style={[
              styles.toggleBtnText,
              walletMode === 'walletconnect' && styles.toggleBtnTextActive,
            ]}
          >
            {t('swap.external.externalTab', {
              defaultValue: 'External Wallet',
            })}
          </Text>
        </Pressable>
      </View>

      {walletMode === 'walletconnect' && (
        <View style={styles.right}>
          {connection !== null ? (
            <View style={styles.connectedRow}>
              <Text style={styles.connectedLabel}>
                {connection.peerName === ''
                  ? truncate(connection.address)
                  : connection.peerName}
              </Text>
              <Text style={styles.connectedSub}>
                {truncate(connection.address)} · chain {connection.chainId}
              </Text>
              <Pressable
                onPress={() => void handleDisconnect()}
                style={styles.disconnect}
              >
                <Text style={styles.disconnectText}>
                  {t('swap.external.disconnect', {
                    defaultValue: 'Disconnect',
                  })}
                </Text>
              </Pressable>
            </View>
          ) : pairing !== null ? (
            <Text style={styles.waiting}>
              {t('swap.external.waitingForApproval', {
                defaultValue: 'Waiting for wallet approval…',
              })}
            </Text>
          ) : (
            <Pressable
              onPress={() => void handleConnect()}
              style={styles.connectBtn}
            >
              <Text style={styles.connectBtnText}>
                {t('swap.external.connect', { defaultValue: 'Connect Wallet' })}
              </Text>
            </Pressable>
          )}
          {error !== undefined && <Text style={styles.error}>{error}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    padding: 8,
  },
  connectBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  connectBtnText: { color: colors.background, fontSize: 13, fontWeight: '700' },
  connectedLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  connectedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  connectedSub: {
    color: colors.textMuted,
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 11,
  },
  disconnect: {
    borderColor: colors.danger,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  disconnectText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 12, marginTop: 6 },
  right: { marginTop: 8 },
  toggle: {
    backgroundColor: colors.background,
    borderRadius: 8,
    flexDirection: 'row',
    padding: 2,
  },
  toggleBtn: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleBtnText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  toggleBtnTextActive: { color: colors.background },
  waiting: { color: colors.textSecondary, fontSize: 12 },
});
