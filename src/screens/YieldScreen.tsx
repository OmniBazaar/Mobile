/**
 * YieldScreen — deposit / withdraw against the platform yield vaults.
 *
 * Wraps `@wallet/services/yield/YieldService` for the canonical yield
 * surfaces. MVP shows a list of vaults with deposit + withdraw forms.
 * Detail UI (rebalance scheduling, performance graph) lands later.
 *
 * @module screens/YieldScreen
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Card from '@components/Card';
import Input from '@components/Input';
import ScreenHeader from '@components/ScreenHeader';
import { colors } from '@theme/colors';
import { useAuthStore } from '../store/authStore';

/** Props for {@link YieldScreen}. */
export interface YieldScreenProps {
  /** Back navigation. */
  onBack: () => void;
}

/** Vault summary row — shape fluctuates by Wallet version, so kept loose. */
interface VaultRow {
  id: string;
  symbol: string;
  apr: number | string;
  tvlUsd?: number;
}

/**
 * Render the vault picker + deposit / withdraw forms.
 *
 * @param props - See {@link YieldScreenProps}.
 * @returns JSX.
 */
export default function YieldScreen(props: YieldScreenProps): JSX.Element {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);
  const [vaults, setVaults] = useState<VaultRow[]>([]);
  const [selected, setSelected] = useState<VaultRow | undefined>(undefined);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [info, setInfo] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (address === '') return;
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const mod = await import('@wallet/services/yield/YieldService');
        const svc = (mod as { YieldService: { getInstance(): unknown } }).YieldService.getInstance();
        const fn = (svc as { getVaults?: (a: string) => Promise<VaultRow[]> }).getVaults;
        if (typeof fn === 'function') {
          const list = await fn.call(svc, address);
          if (cancelled) return;
          setVaults(list);
          if (list.length > 0 && list[0] !== undefined) setSelected(list[0]);
        }
      } catch (err) {
        console.warn('[yield] getVaults failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, [address]);

  const handleAction = useCallback(
    async (action: 'deposit' | 'withdraw'): Promise<void> => {
      setError(undefined);
      setInfo(undefined);
      if (selected === undefined) {
        setError(t('yield.error.noVault', { defaultValue: 'Pick a vault first.' }));
        return;
      }
      if (!/^\d+(\.\d+)?$/.test(amount) || Number.parseFloat(amount) <= 0) {
        setError(t('yield.error.amount', { defaultValue: 'Enter a positive amount.' }));
        return;
      }
      setBusy(true);
      try {
        const mod = await import('@wallet/services/yield/YieldService');
        const svc = (mod as { YieldService: { getInstance(): unknown } }).YieldService.getInstance();
        const fn = (svc as Record<string, unknown>)[action];
        if (typeof fn !== 'function') {
          throw new Error(`YieldService.${action} not available`);
        }
        await (fn as (p: Record<string, unknown>) => Promise<unknown>).call(svc, {
          vaultId: selected.id,
          amount,
          owner: address,
        });
        setInfo(t(`yield.success.${action}`, { defaultValue: `${action} submitted.` }));
        setAmount('');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [selected, amount, address, t],
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('yield.title', { defaultValue: 'Yield' })}
        onBack={props.onBack}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>
          {t('yield.heading', { defaultValue: 'Earn yield on your assets' })}
        </Text>
        {vaults.length === 0 ? (
          <Card>
            <Text style={styles.empty}>
              {t('yield.loading', { defaultValue: 'Loading vaults…' })}
            </Text>
          </Card>
        ) : (
          vaults.map((v) => (
            <Card
              key={v.id}
              style={[
                styles.vaultCard,
                selected?.id === v.id && styles.vaultCardSelected,
              ]}
            >
              <Text style={styles.vaultSymbol}>{v.symbol}</Text>
              <Text style={styles.vaultApr}>
                {typeof v.apr === 'number' ? `${(v.apr * 100).toFixed(2)}%` : v.apr} APR
              </Text>
              <Button
                title={t('yield.select', { defaultValue: 'Select' })}
                variant={selected?.id === v.id ? 'primary' : 'secondary'}
                onPress={() => setSelected(v)}
              />
            </Card>
          ))
        )}

        <Input
          label={t('yield.amount', { defaultValue: 'Amount' })}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.0"
        />

        {error !== undefined && <Text style={styles.error}>{error}</Text>}
        {info !== undefined && <Text style={styles.info}>{info}</Text>}

        <View style={styles.actions}>
          <Button
            title={t('yield.deposit', { defaultValue: 'Deposit' })}
            onPress={() => void handleAction('deposit')}
            disabled={busy || selected === undefined}
            style={styles.action}
          />
          <Button
            title={t('yield.withdraw', { defaultValue: 'Withdraw' })}
            variant="secondary"
            onPress={() => void handleAction('withdraw')}
            disabled={busy || selected === undefined}
            style={styles.action}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  heading: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 12 },
  vaultCard: { marginBottom: 10 },
  vaultCardSelected: { borderWidth: 1, borderColor: colors.primary },
  vaultSymbol: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  vaultApr: { color: colors.success, fontSize: 14, marginTop: 4, marginBottom: 8 },
  empty: { color: colors.textMuted, padding: 16, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 14, marginVertical: 8 },
  info: { color: colors.success, fontSize: 14, marginVertical: 8 },
  actions: { flexDirection: 'row', marginTop: 8 },
  action: { flex: 1, marginHorizontal: 4 },
});
