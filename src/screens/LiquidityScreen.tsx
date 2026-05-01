/**
 * LiquidityScreen — add or remove liquidity in the XOM/USDC pool.
 *
 * Wraps `@wallet/services/LiquidityService` so the wallet user can
 * provide LP through the same OmniRelay-mediated path the Wallet
 * popup uses. Phase 1 supports the canonical XOM/USDC pool only.
 *
 * @module screens/LiquidityScreen
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Card from '@components/Card';
import Input from '@components/Input';
import ScreenHeader from '@components/ScreenHeader';
import { colors } from '@theme/colors';
import { LiquidityService, type LpPoolRow } from '@wallet/services/LiquidityService';
import { useAuthStore } from '../store/authStore';

/** Props for {@link LiquidityScreen}. */
export interface LiquidityScreenProps {
  /** Back-navigation. */
  onBack: () => void;
}

/**
 * Render the LP add / remove form.
 *
 * @param props - See {@link LiquidityScreenProps}.
 * @returns JSX.
 */
export default function LiquidityScreen(props: LiquidityScreenProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const address = useAuthStore((s) => s.address);
  const [pools, setPools] = useState<LpPoolRow[]>([]);
  const [poolAddress, setPoolAddress] = useState<string | undefined>(undefined);
  const [xomAmount, setXomAmount] = useState('');
  const [usdcAmount, setUsdcAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [info, setInfo] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (address === '') return;
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const list = await LiquidityService.getInstance().getPools(address);
        if (cancelled) return;
        setPools(list);
        if (list.length > 0 && list[0]) {
          // First pool wins — XOM/USDC is the only listed pool for v1.
          setPoolAddress((list[0] as { poolAddress?: string; address?: string }).poolAddress
            ?? (list[0] as { poolAddress?: string; address?: string }).address);
        }
      } catch (err) {
        console.warn('[lp] getPools failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, [address]);

  const handleAdd = useCallback(async (): Promise<void> => {
    setError(undefined);
    setInfo(undefined);
    if (poolAddress === undefined) {
      setError(t('lp.error.noPool', { defaultValue: 'No pool selected.' }));
      return;
    }
    setBusy(true);
    try {
      // The bundled LiquidityService builds the on-chain
      // RWAAMM.addLiquidity intent + relays through OmniRelay. We
      // pass plain decimal strings; the service handles the wei math.
      const svc = LiquidityService.getInstance();
      type AddFn = (intent: Record<string, unknown>) => Promise<unknown>;
      await (svc as unknown as { addLiquidity: AddFn }).addLiquidity({
        poolAddress,
        provider: address,
        token0Amount: xomAmount,
        token1Amount: usdcAmount,
      });
      setInfo(t('lp.success.add', { defaultValue: 'Liquidity added.' }));
      setXomAmount('');
      setUsdcAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [poolAddress, address, xomAmount, usdcAmount, t]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('lp.title', { defaultValue: 'Liquidity Pools' })}
        onBack={props.onBack}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>
          {t('lp.heading', { defaultValue: 'XOM / USDC Pool' })}
        </Text>
        {pools.length === 0 ? (
          <Card>
            <Text style={styles.empty}>
              {t('lp.noPools', { defaultValue: 'Loading pools…' })}
            </Text>
          </Card>
        ) : (
          (() => {
            // LpPoolRow exposes most numeric fields as `string` for
            // BigNumber faithfulness — coerce to number for display.
            const row = pools[0] as unknown as Record<string, unknown>;
            const tvlRaw = row['tvlUsd'] ?? row['tvl'];
            const tvl = typeof tvlRaw === 'string'
              ? Number.parseFloat(tvlRaw)
              : typeof tvlRaw === 'number' ? tvlRaw : undefined;
            const aprBpsRaw = row['aprBps'];
            const aprRaw = row['apr'];
            const aprBps = typeof aprBpsRaw === 'number'
              ? aprBpsRaw
              : typeof aprBpsRaw === 'string' ? Number.parseFloat(aprBpsRaw) : undefined;
            const apr = typeof aprRaw === 'number'
              ? aprRaw
              : typeof aprRaw === 'string' ? Number.parseFloat(aprRaw) : undefined;
            return (
              <Card style={styles.poolCard}>
                <Text style={styles.poolLabel}>{t('lp.tvl', { defaultValue: 'TVL' })}</Text>
                <Text style={styles.poolValue}>
                  {tvl !== undefined ? `$${tvl.toLocaleString(i18n.language)}` : '—'}
                </Text>
                <Text style={styles.poolLabel}>{t('lp.apr', { defaultValue: 'APR' })}</Text>
                <Text style={styles.poolValue}>
                  {aprBps !== undefined
                    ? `${(aprBps / 100).toFixed(2)}%`
                    : apr !== undefined ? `${(apr * 100).toFixed(2)}%` : '—'}
                </Text>
              </Card>
            );
          })()
        )}

        <Input
          label={t('lp.xomAmount', { defaultValue: 'XOM amount' })}
          value={xomAmount}
          onChangeText={setXomAmount}
          keyboardType="decimal-pad"
          placeholder="0.0"
        />
        <Input
          label={t('lp.usdcAmount', { defaultValue: 'USDC amount' })}
          value={usdcAmount}
          onChangeText={setUsdcAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        {error !== undefined && <Text style={styles.error}>{error}</Text>}
        {info !== undefined && <Text style={styles.info}>{info}</Text>}

        <Button
          title={busy
            ? t('common.submitting', { defaultValue: 'Submitting…' })
            : t('lp.add', { defaultValue: 'Add Liquidity' })}
          onPress={() => void handleAdd()}
          disabled={busy || poolAddress === undefined}
          style={styles.submit}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  heading: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 12 },
  poolCard: { marginBottom: 16 },
  poolLabel: { color: colors.textSecondary, fontSize: 12, marginTop: 8 },
  poolValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '600', marginTop: 2 },
  empty: { color: colors.textMuted, padding: 16, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 14, marginVertical: 8 },
  info: { color: colors.success, fontSize: 14, marginVertical: 8 },
  submit: { marginTop: 8 },
});
