/**
 * QRScannerModal — full-screen camera modal that returns the decoded
 * payload of the first QR code seen.
 *
 * Used by SendScreen to populate the recipient address (or username)
 * by scanning a payee's "Receive" QR code. Mirrors WebApp's
 * `QrScannerSheet` UX: a fullscreen camera viewfinder with a Cancel
 * button and a single-shot scan that closes the modal once a valid
 * payload is read.
 *
 * @module components/QRScannerModal
 */

import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { useTranslation } from 'react-i18next';

import { colors } from '@theme/colors';

/** Props for {@link QRScannerModal}. */
export interface QRScannerModalProps {
  /** True to show the modal. */
  visible: boolean;
  /** Fired when the user cancels OR a code is scanned. */
  onClose: () => void;
  /** Fired with the decoded text once the scanner reads a code. */
  onScan: (data: string) => void;
}

/**
 * Render a fullscreen camera modal with QR scanner overlay.
 *
 * @param props - See {@link QRScannerModalProps}.
 * @returns JSX.
 */
export default function QRScannerModal(props: QRScannerModalProps): JSX.Element {
  const { t } = useTranslation();
  const [permission, setPermission] = useState<'pending' | 'granted' | 'denied'>(
    'pending',
  );
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!props.visible) {
      // Reset for next open.
      setScanned(false);
      return;
    }
    void (async (): Promise<void> => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setPermission(status === 'granted' ? 'granted' : 'denied');
    })();
  }, [props.visible]);

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      onRequestClose={props.onClose}
    >
      <View style={styles.root}>
        {permission === 'granted' ? (
          <>
            <BarCodeScanner
              onBarCodeScanned={
                scanned
                  ? undefined
                  : ({ data }: { data: string }): void => {
                      setScanned(true);
                      props.onScan(data);
                      props.onClose();
                    }
              }
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.overlay}>
              <Text style={styles.helper}>
                {t('qrScanner.helper', { defaultValue: 'Align the QR code inside the frame.' })}
              </Text>
            </View>
          </>
        ) : permission === 'denied' ? (
          <View style={styles.center}>
            <Text style={styles.title}>
              {t('qrScanner.permissionDenied.title', {
                defaultValue: 'Camera access denied',
              })}
            </Text>
            <Text style={styles.body}>
              {t('qrScanner.permissionDenied.body', {
                defaultValue:
                  'Enable camera permission in Settings to scan QR codes.',
              })}
            </Text>
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.body}>
              {t('qrScanner.requesting', {
                defaultValue: 'Requesting camera permission…',
              })}
            </Text>
          </View>
        )}
        <Pressable
          onPress={props.onClose}
          style={styles.cancelButton}
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: { color: colors.textSecondary, fontSize: 16, lineHeight: 22, textAlign: 'center' },
  overlay: {
    position: 'absolute',
    bottom: 96,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 16,
    borderRadius: 12,
  },
  helper: { color: '#fff', textAlign: 'center', fontSize: 14 },
  cancelButton: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    overflow: 'hidden',
  },
});
