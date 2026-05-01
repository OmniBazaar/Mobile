/**
 * LimitOrderScreen — minimal limit-order entry + active-orders list.
 *
 * Mirrors the Wallet popup's LimitPage at a structural level: the
 * user picks a side (buy / sell), price, and size, signs a CLOB
 * intent through `ClobService.placeOrder`, and sees their open
 * orders below with a Cancel button per row. Phase 1 wires only the
 * XOM/USDC pair on OmniCoin L1 — additional pairs land when the
 * Mobile pair-picker UI is ready (the validator already supports
 * multi-pair via the same endpoint).
 *
 * @module screens/LimitOrderScreen
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@components/Button';
import Card from '@components/Card';
import Input from '@components/Input';
import ScreenHeader from '@components/ScreenHeader';
import { colors } from '@theme/colors';
import { getClobService, type ClobOrder } from '@wallet/services/dex/ClobService';
import { useAuthStore } from '../store/authStore';

/** Props for {@link LimitOrderScreen}. */
export interface LimitOrderScreenProps {
  /** Back-navigation callback. */
  onBack: () => void;
}

/** XOM/USDC pair on OmniCoin L1 — only pair Mobile exposes for v1. */
const PAIR = 'XOM/USDC';

/**
 * Render the limit-order form + active-orders list.
 *
 * @param props - See {@link LimitOrderScreenProps}.
 * @returns JSX.
 */
export default function LimitOrderScreen(props: LimitOrderScreenProps): JSX.Element {
  const { t } = useTranslation();
  const address = useAuthStore((s) => s.address);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('');
  const [orders, setOrders] = useState<ClobOrder[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const refresh = useCallback(async (): Promise<void> => {
    if (address === '') return;
    try {
      const svc = getClobService();
      // Different ClobService versions expose either `getOpenOrders`
      // or `getActiveOrders`; cast to any to call whichever is wired.
      type SvcShape = {
        getOpenOrders?: (a: string) => Promise<ClobOrder[]>;
        getActiveOrders?: (a: string) => Promise<ClobOrder[]>;
      };
      const s = svc as unknown as SvcShape;
      const fetchFn = s.getOpenOrders ?? s.getActiveOrders;
      if (typeof fetchFn === 'function') {
        const list = await fetchFn.call(svc, address);
        setOrders(list);
      }
    } catch (err) {
      console.warn('[limit] refresh failed', err);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    setError(undefined);
    if (!/^\d+(\.\d+)?$/.test(price) || Number.parseFloat(price) <= 0) {
      setError(t('limit.error.price', { defaultValue: 'Enter a valid price.' }));
      return;
    }
    if (!/^\d+(\.\d+)?$/.test(size) || Number.parseFloat(size) <= 0) {
      setError(t('limit.error.size', { defaultValue: 'Enter a valid size.' }));
      return;
    }
    setBusy(true);
    try {
      const svc = getClobService();
      // Use the canonical placeOrder signature; cast through unknown
      // because the Wallet ships several overloads and TS picks the
      // most-restrictive one when imported through @wallet alias.
      const place = (svc as unknown as {
        placeOrder: (p: Record<string, unknown>) => Promise<unknown>;
      }).placeOrder;
      await place({
        pair: PAIR,
        side,
        priceUsd: Number.parseFloat(price),
        size: Number.parseFloat(size),
        owner: address,
      });
      setPrice('');
      setSize('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [price, size, side, address, refresh, t]);

  const handleCancel = useCallback(
    async (orderId: string): Promise<void> => {
      try {
        await getClobService().cancelOrder(orderId);
        await refresh();
      } catch (err) {
        console.warn('[limit] cancel failed', err);
      }
    },
    [refresh],
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('limit.title', { defaultValue: 'Limit Order' })}
        onBack={props.onBack}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pair}>{PAIR}</Text>

        <View style={styles.sideRow}>
          {(['buy', 'sell'] as const).map((s) => (
            <Button
              key={s}
              title={s === 'buy' ? t('limit.buy', { defaultValue: 'Buy' }) : t('limit.sell', { defaultValue: 'Sell' })}
              onPress={() => setSide(s)}
              variant={side === s ? 'primary' : 'secondary'}
              style={styles.sideButton}
            />
          ))}
        </View>

        <Input
          label={t('limit.price', { defaultValue: 'Price (USDC)' })}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          placeholder="0.0040"
        />
        <Input
          label={t('limit.size', { defaultValue: 'Size (XOM)' })}
          value={size}
          onChangeText={setSize}
          keyboardType="decimal-pad"
          placeholder="100.00"
        />

        {error !== undefined && <Text style={styles.error}>{error}</Text>}

        <Button
          title={busy
            ? t('common.submitting', { defaultValue: 'Submitting…' })
            : t('limit.submit', { defaultValue: 'Place Order' })}
          onPress={() => void handleSubmit()}
          disabled={busy}
          style={styles.submit}
        />

        <Text style={styles.sectionHeader}>
          {t('limit.activeOrders', { defaultValue: 'Active Orders' })}
        </Text>
        {orders.length === 0 ? (
          <Text style={styles.empty}>
            {t('limit.noOrders', { defaultValue: 'No active orders.' })}
          </Text>
        ) : (
          orders.map((o) => {
            // ClobOrder field names drifted between Wallet versions —
            // some emit `id`+`size`, others `orderId`+`amount`. Read
            // through unknown so we tolerate either shape at runtime.
            const row = o as unknown as Record<string, unknown>;
            const id = String(row['id'] ?? row['orderId'] ?? '');
            const size = String(row['size'] ?? row['amount'] ?? '');
            const filled = String(row['filled'] ?? row['filledAmount'] ?? '0');
            return (
              <Card key={id} style={styles.orderRow}>
                <Text style={styles.orderText}>
                  {String(o.side).toUpperCase()} {size} @ {String(row['price'] ?? '')}
                </Text>
                <Text style={styles.orderStatus}>
                  {String(o.status)} · {filled} / {size}
                </Text>
                <Button
                  title={t('limit.cancel', { defaultValue: 'Cancel' })}
                  variant="secondary"
                  onPress={() => void handleCancel(id)}
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
  pair: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 12 },
  sideRow: { flexDirection: 'row', marginBottom: 12 },
  sideButton: { flex: 1, marginRight: 8 },
  error: { color: colors.danger, fontSize: 14, marginVertical: 8 },
  submit: { marginTop: 8 },
  sectionHeader: {
    color: colors.textSecondary,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 24,
    marginBottom: 8,
  },
  empty: { color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', padding: 24 },
  orderRow: { marginBottom: 10 },
  orderText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  orderStatus: { color: colors.textSecondary, fontSize: 13, marginBottom: 8 },
});
