/**
 * HardwareWalletScreen — Ledger Nano X pairing + device listing.
 *
 * The first time the user opens this screen we call
 * `registerHardwareAdapters()` which wires `MobileBLEAdapter` into the
 * shared `@wallet/platform/registry`. From there on,
 * `@wallet/services/hardware/LedgerService` can scan + connect + sign
 * via the adapter contract — the same contract the browser extension
 * consumes. Trezor is WebView-hosted and not reachable from Mobile yet
 * (Phase 6 Week 2).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { getBLEAdapter } from '@wallet/platform/registry';

import Card from '@components/Card';
import { Button } from '../components';
import { colors } from '../theme/colors';
import { registerHardwareAdapters } from '../platform/register-hardware-adapters';

/** Props. */
export interface HardwareWalletScreenProps {
  /** Back-nav. */
  onBack: () => void;
  /** Open the hosted Trezor Connect WebView. */
  onOpenTrezor?: () => void;
}

interface FoundDevice {
  id: string;
  name: string;
  rssi?: number;
}

/**
 * Render scan-for-device UX + connection result.
 * @param props - See {@link HardwareWalletScreenProps}.
 * @returns JSX.
 */
export default function HardwareWalletScreen(
  props: HardwareWalletScreenProps,
): JSX.Element {
  const { t } = useTranslation();
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<FoundDevice[]>([]);
  const [connectedId, setConnectedId] = useState<string | undefined>(undefined);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Lazy-register MobileBLEAdapter the first time we mount.
  useEffect(() => {
    try {
      registerHardwareAdapters();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const scan = useCallback(async (): Promise<void> => {
    setError(undefined);
    setDevices([]);
    setScanning(true);
    try {
      const adapter = getBLEAdapter();
      const found = await adapter.scan(30_000);
      setDevices(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }, []);

  const connect = useCallback(async (deviceId: string): Promise<void> => {
    setError(undefined);
    setConnecting(true);
    try {
      const adapter = getBLEAdapter();
      const transport = await adapter.connect(deviceId);
      // Close immediately — this screen only verifies handshake
      // succeeds. Actual APDU exchanges happen inside LedgerService
      // which requests its own transport at sign-time. The verification
      // round-trip is cheap and reassuring for the user.
      await transport.close();
      setConnectedId(deviceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={props.onBack} style={styles.backRow} accessibilityRole="button">
          <Text style={styles.back}>← {t('common.back', { defaultValue: 'Back' })}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {t('hardware.title', { defaultValue: 'Hardware wallets' })}
        </Text>
        <Text style={styles.subTitle}>
          {t('hardware.subtitle', {
            defaultValue:
              'Pair a Ledger Nano X via Bluetooth. Wake the device by pressing both buttons before scanning.',
          })}
        </Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>
          {t('hardware.ledger', { defaultValue: 'Ledger Nano X (BLE)' })}
        </Text>
        <View style={styles.row}>
          <Button
            title={
              scanning
                ? t('hardware.scanning', { defaultValue: 'Scanning…' })
                : t('hardware.scan', { defaultValue: 'Scan for devices' })
            }
            onPress={() => void scan()}
            disabled={scanning || connecting}
          />
        </View>
        {scanning && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
        {error !== undefined && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}
        {connectedId !== undefined && (
          <Text style={styles.successText}>
            {t('hardware.connected', { defaultValue: 'Connected:' })} {connectedId}
          </Text>
        )}
      </Card>

      <FlatList
        data={devices}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <DeviceRow
            device={item}
            connecting={connecting && connectedId === undefined}
            onConnect={() => void connect(item.id)}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !scanning && devices.length === 0 ? (
            <Text style={styles.empty}>
              {t('hardware.noDevices', {
                defaultValue: 'No devices found yet. Tap "Scan" above.',
              })}
            </Text>
          ) : null
        }
      />

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>
          {t('hardware.trezor', { defaultValue: 'Trezor' })}
        </Text>
        <Text style={styles.note}>
          {t('hardware.trezorNote', {
            defaultValue:
              'Trezor support on mobile runs through the hosted Trezor Connect page in a secure WebView.',
          })}
        </Text>
        {props.onOpenTrezor !== undefined && (
          <View style={styles.row}>
            <Button
              title={t('hardware.openTrezor', { defaultValue: 'Open Trezor Connect' })}
              onPress={props.onOpenTrezor}
            />
          </View>
        )}
      </Card>
    </View>
  );
}

/** Per-device row with a connect button. */
function DeviceRow({
  device,
  connecting,
  onConnect,
}: {
  device: FoundDevice;
  connecting: boolean;
  onConnect: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <Card style={styles.deviceRow}>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{device.name}</Text>
        <Text style={styles.deviceMeta}>
          {device.id}
          {device.rssi !== undefined ? `  • ${device.rssi} dBm` : ''}
        </Text>
      </View>
      <Button
        title={
          connecting
            ? t('hardware.connecting', { defaultValue: 'Connecting…' })
            : t('hardware.connect', { defaultValue: 'Connect' })
        }
        onPress={onConnect}
        disabled={connecting}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  backRow: { paddingVertical: 8 },
  back: { color: colors.primary, fontSize: 14 },
  title: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 4 },
  subTitle: { color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 18 },
  card: { marginHorizontal: 16, marginTop: 12, padding: 12 },
  sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  row: { marginTop: 6 },
  note: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  deviceRow: {
    marginVertical: 6,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceInfo: { flex: 1 },
  deviceName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  deviceMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  loadingRow: { alignItems: 'center', paddingVertical: 8 },
  error: { color: colors.danger, fontSize: 12, marginTop: 8 },
  successText: { color: colors.primary, fontSize: 12, fontWeight: '600', marginTop: 8 },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 16 },
});
