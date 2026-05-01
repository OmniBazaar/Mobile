/**
 * RWAMarketplaceScreen — list real-world-asset tokens with KYC + jurisdiction
 * gating.
 *
 * Pulls the catalog via `@wallet/services/rwa/RWAService`. RWA tokens require
 * Tier 2+ KYC; this screen surfaces the user's current tier and disables
 * trading actions when the user isn't eligible. Trading itself routes back
 * into the SwapScreen with the RWA token pre-filled.
 *
 * @module screens/RWAMarketplaceScreen
 */

import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Card from '@components/Card';
import ScreenHeader from '@components/ScreenHeader';
import { colors } from '@theme/colors';
import { fetchKycStatus } from '../services/KYCStatusService';
import { useAuthStore } from '../store/authStore';

/** Props for {@link RWAMarketplaceScreen}. */
export interface RWAMarketplaceScreenProps {
  /** Back navigation. */
  onBack: () => void;
  /** Open the swap screen, optionally with a pre-selected RWA token. */
  onTrade: (rwaTokenId?: string) => void;
}

/** RWA listing summary — fields are stable enough across versions to type. */
interface RWARow {
  id: string;
  symbol: string;
  name: string;
  priceUsd?: number;
  jurisdiction?: string;
  /** Minimum KYC tier the user needs to trade this asset. */
  minTier?: number;
}

/**
 * Render the RWA catalog with KYC gating.
 *
 * @param props - See {@link RWAMarketplaceScreenProps}.
 * @returns JSX.
 */
export default function RWAMarketplaceScreen(
  props: RWAMarketplaceScreenProps,
): JSX.Element {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);
  const [rows, setRows] = useState<RWARow[]>([]);
  const [tier, setTier] = useState<number>(0);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (address === '') return;
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const [mod, status] = await Promise.all([
          import('@wallet/services/rwa/RWAService'),
          fetchKycStatus(address),
        ]);
        if (cancelled) return;
        setTier(status.tier);
        // Wallet's RWAService exposes either a singleton or a static
        // helper depending on version — try both.
        const svc =
          ((mod as { RWAService?: { getInstance?: () => unknown } }).RWAService?.getInstance?.())
          ?? (mod as { default?: unknown }).default
          ?? mod;
        const list = (svc as { listAssets?: () => Promise<RWARow[]> }).listAssets;
        if (typeof list === 'function') {
          const data = await list.call(svc);
          if (!cancelled) setRows(data);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { cancelled = true; };
  }, [address]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('rwa.title', { defaultValue: 'Real-World Assets' })}
        onBack={props.onBack}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>
          {t('rwa.heading', {
            defaultValue: 'Tokenised real-world assets',
          })}
        </Text>
        <Text style={styles.body}>
          {t('rwa.body', {
            defaultValue:
              'Trade tokenised real-world assets (treasuries, corporate bonds, real estate) with on-chain settlement. Most RWA tokens require Tier 2+ KYC and may be restricted in your jurisdiction.',
          })}
        </Text>
        <Text style={styles.tierLine}>
          {t('rwa.yourTier', {
            defaultValue: 'Your KYC tier: {{tier}}',
            tier,
          })}
        </Text>

        {error !== undefined && <Text style={styles.error}>{error}</Text>}

        {rows.length === 0 && error === undefined ? (
          <Card>
            <Text style={styles.empty}>
              {t('rwa.loading', { defaultValue: 'Loading catalog…' })}
            </Text>
          </Card>
        ) : (
          rows.map((r) => {
            const blocked = (r.minTier ?? 2) > tier;
            return (
              <Card key={r.id} style={styles.row}>
                <Text style={styles.symbol}>{r.symbol}</Text>
                <Text style={styles.name}>{r.name}</Text>
                {r.priceUsd !== undefined && (
                  <Text style={styles.price}>${r.priceUsd.toFixed(4)}</Text>
                )}
                {r.jurisdiction !== undefined && (
                  <Text style={styles.jurisdiction}>{r.jurisdiction}</Text>
                )}
                <Button
                  title={blocked
                    ? t('rwa.tierLocked', {
                        defaultValue: 'KYC Tier {{n}} required',
                        n: r.minTier ?? 2,
                      })
                    : t('rwa.trade', { defaultValue: 'Trade' })}
                  variant={blocked ? 'secondary' : 'primary'}
                  onPress={() => {
                    if (!blocked) props.onTrade(r.id);
                  }}
                  disabled={blocked}
                />
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  heading: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  body: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: 12 },
  tierLine: { color: colors.primary, fontSize: 14, fontWeight: '600', marginBottom: 16 },
  error: { color: colors.danger, fontSize: 14, marginVertical: 8 },
  empty: { color: colors.textMuted, padding: 16, textAlign: 'center' },
  row: { marginBottom: 10 },
  symbol: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  name: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  price: { color: colors.textPrimary, fontSize: 18, fontWeight: '600', marginTop: 6 },
  jurisdiction: { color: colors.textMuted, fontSize: 12, marginTop: 4, marginBottom: 8 },
});
