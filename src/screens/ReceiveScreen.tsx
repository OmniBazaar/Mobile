/**
 * ReceiveScreen — displays the user's EVM address and a QR code so a
 * sender can scan-to-send.
 *
 * Phase 2 scope: single address (EVM owner key). Phase 2 Week 2 extends
 * to per-family addresses (Bitcoin, Solana, XRP, …) via a chain-family
 * picker.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Card from '@components/Card';
import { colors } from '@theme/colors';
import { useAuthStore } from '../store/authStore';

/** Props accepted by ReceiveScreen. */
export interface ReceiveScreenProps {
  /** Back-navigation callback. */
  onBack: () => void;
}

/**
 * Render the address + QR + share row.
 * @param props - See {@link ReceiveScreenProps}.
 * @returns JSX.
 */
export default function ReceiveScreen(props: ReceiveScreenProps): JSX.Element {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);

  const handleCopy = async (): Promise<void> => {
    await Clipboard.setStringAsync(address);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title} accessibilityRole="header">
        {t('receive.title', { defaultValue: 'Receive' })}
      </Text>
      <Text style={styles.subtitle}>
        {t('receive.subtitle', {
          defaultValue: 'Share this address to receive tokens on any EVM chain.',
        })}
      </Text>

      <Card style={styles.qrCard}>
        <View style={styles.qrBox} accessibilityRole="image" accessibilityLabel={address}>
          <QRCode value={address !== '' ? address : '0x0'} size={220} backgroundColor="#fff" />
        </View>
        <Text style={styles.address} selectable>
          {address}
        </Text>
      </Card>

      <View style={styles.actions}>
        <Button
          title={t('receive.cta.copy', { defaultValue: 'Copy Address' })}
          onPress={() => void handleCopy()}
          style={styles.actionButton}
        />
        <Button
          title={t('common.back', { defaultValue: 'Back' })}
          onPress={props.onBack}
          variant="secondary"
        />
      </View>

      <Pressable accessibilityRole="text" style={styles.hint}>
        <Text style={styles.hintText}>
          {t('receive.hint', {
            defaultValue:
              'Only send tokens from chains your wallet supports. Sending from an unsupported chain may result in lost funds.',
          })}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 32,
  },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 24 },
  qrCard: { alignItems: 'center', paddingVertical: 24 },
  qrBox: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 16 },
  address: { color: colors.textPrimary, fontSize: 13, fontFamily: 'monospace', textAlign: 'center' },
  actions: { marginTop: 24 },
  actionButton: { marginBottom: 12 },
  hint: { marginTop: 16 },
  hintText: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
