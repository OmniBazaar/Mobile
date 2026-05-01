/**
 * ConnectedSitesScreen — list dApp / WalletConnect sessions and let
 * the user disconnect any of them.
 *
 * On Mobile the most relevant case is WalletConnect v2 sessions —
 * the desktop browser-extension's EIP-6963 announcement doesn't
 * apply on RN. We render whatever sessions the platform StorageAdapter
 * tracks under the canonical `connectedSites` key.
 *
 * @module screens/ConnectedSitesScreen
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Card from '@components/Card';
import ScreenHeader from '@components/ScreenHeader';
import { colors } from '@theme/colors';
import { getStorageAdapter } from '@wallet/platform/registry';

/** Persisted connected-site record. */
interface ConnectedSite {
  origin: string;
  name?: string;
  iconUrl?: string;
  source?: 'eip1193' | 'walletconnect';
  /** Unix-ms when the connection was established. */
  connectedAt: number;
  /** Optional WalletConnect topic for v2 disconnects. */
  topic?: string;
}

/** Props for {@link ConnectedSitesScreen}. */
export interface ConnectedSitesScreenProps {
  /** Back-navigation. */
  onBack: () => void;
}

const STORAGE_KEY = 'connectedSites';

/**
 * Render the connected-sites list.
 *
 * @param props - See {@link ConnectedSitesScreenProps}.
 * @returns JSX.
 */
export default function ConnectedSitesScreen(
  props: ConnectedSitesScreenProps,
): JSX.Element {
  const { t } = useTranslation();
  const [sites, setSites] = useState<ConnectedSite[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const adapter = getStorageAdapter();
      const stored = await adapter.getItem<ConnectedSite[]>(STORAGE_KEY);
      setSites(Array.isArray(stored) ? stored : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDisconnect = useCallback(
    async (site: ConnectedSite): Promise<void> => {
      try {
        const adapter = getStorageAdapter();
        const remaining = sites.filter(
          (s) => !(s.origin === site.origin && s.topic === site.topic),
        );
        await adapter.setItem(STORAGE_KEY, remaining);
        setSites(remaining);
        // For WalletConnect v2 sessions, also try to terminate
        // server-side so the dApp sees us drop instead of timing out.
        if (site.source === 'walletconnect' && site.topic !== undefined) {
          try {
            // Lazy-resolve the service path through unknown — multiple
            // Wallet versions expose WalletConnect under different
            // export names, and the v1 mobile bundle doesn't guarantee
            // any specific module is present. Best-effort only.
            const path = '@wallet/services/walletconnect/WalletConnectService';
            const dynImport = (Function('p', 'return import(p)') as (p: string) => Promise<unknown>);
            const mod = (await dynImport(path)) as Record<string, unknown>;
            const cls = mod['WalletConnectService'] as
              | { getInstance?: () => unknown }
              | undefined;
            const svc = cls?.getInstance?.();
            const fn = (svc as { disconnect?: (t: string) => Promise<void> } | undefined)
              ?.disconnect;
            if (typeof fn === 'function') await fn.call(svc, site.topic);
          } catch {
            // Service unavailable — local removal is still meaningful.
          }
        }
      } catch (err) {
        console.warn('[connected-sites] disconnect failed', err);
      }
    },
    [sites],
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('connectedSites.title', { defaultValue: 'Connected Apps' })}
        onBack={props.onBack}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.body}>
          {t('connectedSites.body', {
            defaultValue:
              'Apps you have approved can request signatures and read your address. Disconnect ones you no longer use.',
          })}
        </Text>
        {loading && (
          <Text style={styles.empty}>
            {t('connectedSites.loading', { defaultValue: 'Loading…' })}
          </Text>
        )}
        {!loading && sites.length === 0 && (
          <Text style={styles.empty}>
            {t('connectedSites.none', { defaultValue: 'No connected apps.' })}
          </Text>
        )}
        {sites.map((s) => (
          <Card key={`${s.origin}|${s.topic ?? ''}`} style={styles.row}>
            <Text style={styles.origin}>{s.name ?? s.origin}</Text>
            <Text style={styles.meta}>{s.origin}</Text>
            <Text style={styles.meta}>
              {t('connectedSites.connectedAt', {
                defaultValue: 'Connected {{when}}',
                when: new Date(s.connectedAt).toLocaleString(),
              })}
            </Text>
            <Button
              title={t('connectedSites.disconnect', { defaultValue: 'Disconnect' })}
              variant="secondary"
              onPress={() => void handleDisconnect(s)}
            />
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  body: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 16 },
  empty: { color: colors.textMuted, padding: 24, textAlign: 'center' },
  row: { marginBottom: 10 },
  origin: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
});
